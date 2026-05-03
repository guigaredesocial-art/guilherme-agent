import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";
import { sendTextEvolution } from "@/lib/channels/evolution";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { id } = await params;
  const { text } = await req.json();
  if (!text?.trim()) return new Response("text required", { status: 400 });

  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: { contact: { include: { identities: true } } },
  });
  if (!conv) return new Response("not found", { status: 404 });

  // Buscar externalId via ContactIdentity (NUNCA usar Contact.id)
  const identity = conv.contact.identities.find((i) => i.channel === conv.channel);
  if (!identity) return new Response("no identity", { status: 400 });

  await sendTextEvolution(identity.externalId, text);

  await prisma.message.create({
    data: { conversationId: id, role: "assistant", content: `[MANUAL] ${text}` },
  });

  return Response.json({ ok: true });
}
