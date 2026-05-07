import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTextEvolution } from "@/lib/channels/evolution";
import { chat } from "@/lib/llm/anthropic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const { event, durationSeconds } = body as { event: "viewed" | "left"; durationSeconds?: number };

  const conv = await db.conversation.findUnique({
    where: { id: token },
    include: {
      contact: true,
      messages: { orderBy: { createdAt: "asc" }, take: 20 },
      lead: true,
    },
  });

  if (!conv) return new Response("not found", { status: 404 });

  console.log(JSON.stringify({ event: "portal.track", convId: token, trackEvent: event, durationSeconds }));

  // Quando o lead SAI após 3+ minutos sem fechar → dispara follow-up em 15 min
  if (event === "left" && durationSeconds && durationSeconds >= 180) {
    const clientName = conv.lead?.name ?? conv.contact?.displayName ?? "você";
    const externalId = conv.contact?.contactIdentities?.[0]?.externalId
      ?? (await db.contactIdentity.findFirst({ where: { contactId: conv.contactId } }))?.externalId;

    if (!externalId) return Response.json({ ok: true });

    // Gerar mensagem personalizada com IA
    const transcript = conv.messages
      .slice(-10)
      .map((m: any) => `${m.role === "user" ? "CLIENTE" : "AGENTE"}: ${m.content.replace(/^\[MANUAL\]\s?/, "")}`)
      .join("\n");

    const minutes = Math.round(durationSeconds / 60);

    // Dispara em background após 15 minutos
    setTimeout(async () => {
      try {
        // Verificar se o lead já respondeu desde que saiu do portal
        const recent = await db.message.findFirst({
          where: { conversationId: token, role: "user", createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
          orderBy: { createdAt: "desc" },
        });
        if (recent) {
          console.log(JSON.stringify({ event: "portal.track.skip_already_replied", convId: token }));
          return;
        }

        // Gerar mensagem personalizada
        const prompt = `Você é um vendedor. O lead ${clientName} ficou ${minutes} minuto(s) lendo a proposta no portal e fechou sem responder.
Crie UMA mensagem curta e natural para WhatsApp que mencione sutilmente que ele estava vendo a proposta e pergunte se ficou com alguma dúvida.
NÃO seja invasivo. Seja humano e amigável. Máximo 2 frases. Sem emoji excessivo. Somente o texto da mensagem, sem aspas.`;

        const msg = await chat(prompt, [{ role: "user", content: `Histórico da conversa:\n${transcript}` }], "claude-sonnet-4-6", 0.7);
        await sendTextEvolution(externalId, msg.trim());
        console.log(JSON.stringify({ event: "portal.track.followup_sent", convId: token }));
      } catch (e) {
        console.error(JSON.stringify({ event: "portal.track.followup_failed", err: String(e) }));
      }
    }, 15 * 60 * 1000); // 15 minutos
  }

  return Response.json({ ok: true });
}
