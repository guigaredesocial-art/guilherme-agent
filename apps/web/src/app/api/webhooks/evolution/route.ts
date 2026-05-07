import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { flushConversation } from "@/lib/flush";
import { fetchProfilePicture } from "@/lib/channels/evolution";
import type { ChannelMessage } from "@/lib/ai-rules/evaluate";

// Evolution API não tem HMAC nativo — validar via bearer token custom
function verifyAuth(req: NextRequest): boolean {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;
  if (!secret) return true; // sem secret configurado, aceita (dev)
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

interface EvolutionPayload {
  event: string;
  instance: string;
  data: {
    key?: { id?: string; remoteJid?: string; fromMe?: boolean };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      audioMessage?: { seconds?: number; ptt?: boolean; mimetype?: string };
      imageMessage?: { caption?: string; mimetype?: string };
      videoMessage?: { caption?: string; mimetype?: string };
      documentMessage?: { caption?: string; fileName?: string; mimetype?: string };
      stickerMessage?: object;
      locationMessage?: { degreesLatitude?: number; degreesLongitude?: number };
      reactionMessage?: { text?: string };
      base64?: string; // preenchido quando webhookBase64: true
    };
    messageType?: string;
    pushName?: string;
  };
}

// Transcreve áudio via OpenAI Whisper (só roda se OPENAI_API_KEY estiver configurado)
async function transcribeAudioBase64(base64: string, mimetype: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { console.log(JSON.stringify({ event: "whisper.skip_no_key" })); return ""; }
  if (!base64) { console.log(JSON.stringify({ event: "whisper.skip_no_base64" })); return ""; }

  try {
    const buffer = Buffer.from(base64, "base64");
    const ext = mimetype?.includes("ogg") ? "ogg"
      : mimetype?.includes("webm") ? "webm"
      : mimetype?.includes("mp4") ? "mp4"
      : "mp3";

    console.log(JSON.stringify({ event: "whisper.start", ext, mimeType: mimetype, bufferBytes: buffer.length }));

    // FormData nativo do Node.js 18+ / Next.js 15
    const form = new FormData();
    const blob = new Blob([buffer], { type: mimetype || "audio/ogg; codecs=opus" });
    form.append("file", blob, `audio.${ext}`);
    form.append("model", "whisper-1");
    form.append("language", "pt");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(JSON.stringify({ event: "whisper.error", status: res.status, body }));
      return "";
    }
    const data = await res.json();
    const text = data?.text?.trim() ?? "";
    console.log(JSON.stringify({ event: "whisper.ok", chars: text.length }));
    return text;
  } catch (e) {
    console.error(JSON.stringify({ event: "whisper.transcribe_failed", err: String(e) }));
    return "";
  }
}

// Extrai texto ou placeholder de qualquer tipo de mensagem do WhatsApp
async function extractMessageText(data: EvolutionPayload["data"]): Promise<string | null> {
  const msg = data?.message;
  if (!msg) return null;

  // Mensagens de texto simples
  const text = msg.conversation ?? msg.extendedTextMessage?.text ?? "";
  if (text.trim()) return text.trim();

  // Áudio / voz
  if (msg.audioMessage) {
    // Log para ver exatamente o que a Evolution API envia (sem base64 poluir o log)
    console.log(JSON.stringify({
      event: "audio.received",
      seconds: msg.audioMessage.seconds,
      mimetype: msg.audioMessage.mimetype,
      hasBase64: !!msg.base64,
      base64Len: msg.base64?.length ?? 0,
      msgKeys: Object.keys(msg),
    }));

    // A Evolution API coloca o base64 em data.message.base64 quando webhookBase64: true
    const base64 = msg.base64 ?? "";
    const mimetype = msg.audioMessage.mimetype ?? "audio/ogg; codecs=opus";
    const transcribed = await transcribeAudioBase64(base64, mimetype);
    if (transcribed) return `🎵 Áudio: "${transcribed}"`;
    const secs = msg.audioMessage.seconds;
    return secs ? `[🎵 Áudio de ${secs}s — responda pedindo para digitar]` : "[🎵 Áudio recebido — responda pedindo para digitar]";
  }

  // Imagem (com ou sem legenda)
  if (msg.imageMessage) {
    const caption = msg.imageMessage.caption?.trim();
    return caption ? `[📷 Imagem] ${caption}` : "[📷 Imagem recebida]";
  }

  // Vídeo
  if (msg.videoMessage) {
    const caption = msg.videoMessage.caption?.trim();
    return caption ? `[📹 Vídeo] ${caption}` : "[📹 Vídeo recebido]";
  }

  // Documento / arquivo
  if (msg.documentMessage) {
    const caption = msg.documentMessage.caption?.trim();
    const fileName = msg.documentMessage.fileName ?? "";
    if (caption) return `[📄 ${fileName || "Documento"}] ${caption}`;
    return fileName ? `[📄 Documento: ${fileName}]` : "[📄 Documento recebido]";
  }

  // Sticker
  if (msg.stickerMessage) return "[🌟 Sticker]";

  // Localização
  if (msg.locationMessage) {
    const lat = msg.locationMessage.degreesLatitude?.toFixed(5);
    const lng = msg.locationMessage.degreesLongitude?.toFixed(5);
    return `[📍 Localização: ${lat}, ${lng}]`;
  }

  // Reação (não precisa responder, mas registrar)
  if (msg.reactionMessage) return null; // ignora reações silenciosamente

  return null; // tipo desconhecido
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    if (!verifyAuth(req)) {
      return new Response("unauthorized", { status: 401 });
    }

    let payload: EvolutionPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response("bad json", { status: 400 });
    }

    console.log(JSON.stringify({ event: "webhook.evolution.recv", evtType: payload.event }));

    // Processar apenas mensagens recebidas (não enviadas por nós)
    // Evolution v1.x usa "messages.upsert", v2.x usa "MESSAGES_UPSERT"
    const evtNorm = payload.event ? payload.event.toUpperCase().replace(".", "_") : "";
    if (evtNorm !== "MESSAGES_UPSERT") {
      return Response.json({ ok: true, skipped: true });
    }

    const key = payload.data?.key;
    if (!key || key.fromMe) {
      return Response.json({ ok: true, skipped: "fromMe" });
    }

    const providerMsgId = key.id;
    const externalId = key.remoteJid;

    if (!externalId || !providerMsgId) {
      return Response.json({ ok: true, skipped: "missing_fields" });
    }

    // Dedup por providerMsgId
    const dup = await prisma.message.findUnique({ where: { providerMsgId } });
    if (dup) {
      console.log(JSON.stringify({ event: "webhook.evolution.duplicate", providerMsgId }));
      return Response.json({ ok: true, duplicate: true });
    }

    const text = await extractMessageText(payload.data);

    if (text === null) {
      return Response.json({ ok: true, skipped: "reaction_or_unknown" });
    }
    if (!text.trim()) {
      return Response.json({ ok: true, skipped: "empty_text" });
    }

    const displayName = payload.data?.pushName ?? externalId;

    // Upsert contact usando create-then-catch para evitar race condition
    let contactIdentity;
    try {
      contactIdentity = await prisma.contactIdentity.create({
        data: {
          channel: "evolution",
          externalId,
          contact: { create: { displayName } },
        },
        include: { contact: true },
      });
    } catch (e) {
      console.error("DB Create Error:", e);
      contactIdentity = await prisma.contactIdentity.findUnique({
        where: { channel_externalId: { channel: "evolution", externalId } },
        include: { contact: true },
      });
    }

    if (!contactIdentity) {
      return new Response(JSON.stringify({ error: "db error", details: "contactIdentity not found after create/findUnique" }), { status: 500 });
    }

    // Buscar e salvar foto de perfil (em background, sem bloquear)
    const contactId = contactIdentity.contactId;
    const currentPhoto = (contactIdentity.contact as any).photoUrl;
    if (!currentPhoto) {
      fetchProfilePicture(externalId).then((url) => {
        if (url) {
          prisma.contact.update({ where: { id: contactId }, data: { photoUrl: url } as any }).catch(() => {});
        }
      }).catch(() => {});
    }

    // Upsert conversation
    const conversation = await prisma.conversation.upsert({
      where: { channel_contactId: { channel: "evolution", contactId: contactIdentity.contactId } },
      update: { updatedAt: new Date() },
      create: {
        channel: "evolution",
        contactId: contactIdentity.contactId,
      },
    });

    const msg: ChannelMessage = {
      id: providerMsgId,
      contactId: externalId, // SEMPRE o externalId, nunca o cuid interno
      text,
      timestamp: new Date(),
    };

    // Processar em background para responder 200 rápido
    setTimeout(() => {
      flushConversation(conversation, [msg]).catch((e) =>
        console.error(JSON.stringify({ event: "webhook.flush_error", err: String(e) }))
      );
    }, 0);

    return Response.json({ ok: true });
  } catch (error: any) {
    console.error("Webhook Unhandled Error:", error);
    return new Response(JSON.stringify({ error: "unhandled webhook error", message: error.message, stack: error.stack }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
