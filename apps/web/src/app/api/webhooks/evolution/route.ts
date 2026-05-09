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
    base64?: string; // Evolution API v2: base64 no nível de data
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
      // Mensagem de anúncio click-to-WhatsApp (Instagram/Facebook Ads)
      advertisingMessage?: { advertisingBody?: string; advertisingTitle?: string };
      // Botão de template clicado
      templateButtonReplyMessage?: { selectedId?: string; selectedDisplayText?: string };
      // Resposta interativa (lista ou botão)
      listResponseMessage?: { title?: string; description?: string };
      buttonsResponseMessage?: { selectedButtonId?: string; selectedDisplayText?: string };
      base64?: string; // Evolution API v1: base64 dentro de message
    };
    // Referral de anúncio — presente em click-to-WhatsApp
    referral?: { headline?: string; body?: string; sourceUrl?: string; sourceType?: string };
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

interface ExtractResult {
  text: string;
  mediaUrl?: string; // data URI (base64) para áudio ou imagem
}

// Extrai texto e mídia de qualquer tipo de mensagem do WhatsApp
async function extractMessage(data: EvolutionPayload["data"]): Promise<ExtractResult | null> {
  const msg = data?.message;
  if (!msg) return null;

  // Evolution API pode colocar o base64 em data.base64 (v2) ou data.message.base64 (v1)
  const rawBase64 = data.base64 ?? msg.base64 ?? "";

  // Mensagens de texto simples
  const text = msg.conversation ?? msg.extendedTextMessage?.text ?? "";
  if (text.trim()) return { text: text.trim() };

  // Anúncio click-to-WhatsApp (Instagram/Facebook Ads) — texto do próprio anúncio ou referral
  if (msg.advertisingMessage) {
    const adText = msg.advertisingMessage.advertisingBody || msg.advertisingMessage.advertisingTitle || "";
    const referralText = data.referral?.body || data.referral?.headline || "";
    const combined = [adText, referralText].filter(Boolean).join(" — ");
    const fallback = "Olá! Vim pelo anúncio";
    console.log(JSON.stringify({ event: "ad_message.received", adText, referralText }));
    return { text: combined || fallback };
  }

  // Referral sem corpo de mensagem (clique no link do anúncio sem digitar nada)
  if (data.referral && !text.trim()) {
    const referralText = data.referral.body || data.referral.headline || "";
    console.log(JSON.stringify({ event: "referral.received", referralText, sourceType: data.referral.sourceType }));
    return { text: referralText || "Olá! Vim pelo anúncio" };
  }

  // Botão de template clicado
  if (msg.templateButtonReplyMessage) {
    const btnText = msg.templateButtonReplyMessage.selectedDisplayText || msg.templateButtonReplyMessage.selectedId || "Clicou em botão";
    return { text: btnText };
  }

  // Resposta de lista interativa
  if (msg.listResponseMessage) {
    const listText = [msg.listResponseMessage.title, msg.listResponseMessage.description].filter(Boolean).join(" — ");
    return { text: listText || "Selecionou uma opção" };
  }

  // Resposta de botão interativo
  if (msg.buttonsResponseMessage) {
    const btnText = msg.buttonsResponseMessage.selectedDisplayText || msg.buttonsResponseMessage.selectedButtonId || "Clicou em botão";
    return { text: btnText };
  }

  // Áudio / voz
  if (msg.audioMessage) {
    const mimetype = msg.audioMessage.mimetype ?? "audio/ogg; codecs=opus";
    const secs = msg.audioMessage.seconds;

    console.log(JSON.stringify({
      event: "audio.received",
      seconds: secs,
      mimetype,
      hasBase64: !!rawBase64,
      base64Len: rawBase64?.length ?? 0,
      source: data.base64 ? "data.base64" : msg.base64 ? "msg.base64" : "none",
    }));

    const transcribed = await transcribeAudioBase64(rawBase64, mimetype);

    const mediaUrl = rawBase64
      ? `data:${mimetype.split(";")[0]};base64,${rawBase64}`
      : undefined;

    const textContent = transcribed
      ? `🎵 Áudio: "${transcribed}"`
      : secs
        ? `[🎵 Áudio de ${secs}s]`
        : "[🎵 Áudio recebido]";

    return { text: textContent, mediaUrl };
  }

  // Imagem (com ou sem legenda)
  if (msg.imageMessage) {
    const caption = msg.imageMessage.caption?.trim();
    const mimetype = msg.imageMessage.mimetype ?? "image/jpeg";

    console.log(JSON.stringify({
      event: "image.received",
      mimetype,
      hasBase64: !!rawBase64,
      base64Len: rawBase64?.length ?? 0,
      source: data.base64 ? "data.base64" : msg.base64 ? "msg.base64" : "none",
    }));

    const mediaUrl = rawBase64
      ? `data:${mimetype.split(";")[0]};base64,${rawBase64}`
      : undefined;
    const textContent = caption ? `[📷 Imagem] ${caption}` : "[📷 Imagem recebida]";
    return { text: textContent, mediaUrl };
  }

  // Vídeo
  if (msg.videoMessage) {
    const caption = msg.videoMessage.caption?.trim();
    return { text: caption ? `[📹 Vídeo] ${caption}` : "[📹 Vídeo recebido]" };
  }

  // Documento / arquivo
  if (msg.documentMessage) {
    const caption = msg.documentMessage.caption?.trim();
    const fileName = msg.documentMessage.fileName ?? "";
    if (caption) return { text: `[📄 ${fileName || "Documento"}] ${caption}` };
    return { text: fileName ? `[📄 Documento: ${fileName}]` : "[📄 Documento recebido]" };
  }

  // Sticker
  if (msg.stickerMessage) return { text: "[🌟 Sticker]" };

  // Localização
  if (msg.locationMessage) {
    const lat = msg.locationMessage.degreesLatitude?.toFixed(5);
    const lng = msg.locationMessage.degreesLongitude?.toFixed(5);
    return { text: `[📍 Localização: ${lat}, ${lng}]` };
  }

  // Reação — ignora silenciosamente
  if (msg.reactionMessage) return null;

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
    if (!key) {
      return Response.json({ ok: true, skipped: "no_key" });
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

    const extracted = await extractMessage(payload.data);

    if (extracted === null) {
      return Response.json({ ok: true, skipped: "reaction_or_unknown" });
    }
    if (!extracted.text.trim()) {
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
      text: extracted.text,
      timestamp: new Date(),
      mediaUrl: extracted.mediaUrl,
    };

    if (key.fromMe) {
      // É uma mensagem enviada pelo próprio número (pelo celular ou pela IA via API)
      // Checar se a IA acabou de gerar essa mesma mensagem
      const recentAiMsg = await prisma.message.findFirst({
        where: {
          conversationId: conversation.id,
          role: "assistant",
          content: extracted.text,
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }
        }
      });

      if (recentAiMsg && !recentAiMsg.providerMsgId) {
        // Foi a IA, apenas vinculamos o ID da Evolution API a essa mensagem
        await prisma.message.update({
          where: { id: recentAiMsg.id },
          data: { providerMsgId: msg.id }
        });
        return Response.json({ ok: true, skipped: "ai_echo_updated" });
      }

      // Se não, o dono do WhatsApp digitou no celular dele
      // Salvamos no contexto como "assistant" para a IA ficar ciente, mas sem ativar o flush
      await prisma.message.upsert({
        where: { providerMsgId: msg.id },
        update: {},
        create: {
          conversationId: conversation.id,
          role: "assistant",
          content: msg.text,
          providerMsgId: msg.id,
        },
      });
      console.log(JSON.stringify({ event: "webhook.fromMe_saved", text: msg.text }));
      return Response.json({ ok: true, saved: "user_from_phone" });
    }

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
