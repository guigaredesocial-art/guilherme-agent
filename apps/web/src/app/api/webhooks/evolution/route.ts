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
    message?: { conversation?: string; extendedTextMessage?: { text?: string } };
    pushName?: string;
  };
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

    const text =
      payload.data?.message?.conversation ??
      payload.data?.message?.extendedTextMessage?.text ??
      "";

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
