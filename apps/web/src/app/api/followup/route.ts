import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";
import { sendTextEvolution } from "@/lib/channels/evolution";

export async function POST(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const now = new Date();
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const thirtyMinFromNow = new Date(now.getTime() + 30 * 60 * 1000);

  const results = { followup10m: 0, followup24h: 0, meetingReminder: 0, errors: 0 };

  // ── 1. Follow-up 10 min: bot enviou mensagem, cliente não respondeu ──────────
  try {
    const convsAguardando = await prisma.conversation.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: {
        aiEnabled: true,
        status: { notIn: ["encerrado"] },
        followupSentAt: null,
        lastUserMsgAt: { not: null },
      } as any,
      include: {
        contact: { include: { identities: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    for (const conv of convsAguardando) {
      const lastMsg = conv.messages[0];
      if (!lastMsg) continue;
      // Só envia se a última mensagem for do bot E foi há mais de 10 min
      if (lastMsg.role !== "assistant") continue;
      if (lastMsg.createdAt > tenMinAgo) continue;

      const externalId = conv.contact.identities[0]?.externalId;
      if (!externalId) continue;

      try {
        await sendTextEvolution(externalId, "Oi! Ainda estou aqui 😊 Ficou alguma dúvida?");
        await prisma.conversation.update({
          where: { id: conv.id },
          data: { followupSentAt: now } as any,
        });
        results.followup10m++;
      } catch (e) {
        results.errors++;
      }
    }
  } catch (e) {
    console.error("followup 10m error:", e);
  }

  // ── 2. Follow-up 24h: cliente sumiu sem fechar ───────────────────────────────
  try {
    const convsSumidas = await prisma.conversation.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: {
        aiEnabled: true,
        status: { in: ["qualificado", "em_atendimento"] },
        updatedAt: { lt: oneDayAgo },
        followupSentAt: { lt: oneDayAgo },
      } as any,
      include: {
        contact: { include: { identities: true } },
      },
    });

    for (const conv of convsSumidas) {
      const externalId = conv.contact.identities[0]?.externalId;
      if (!externalId) continue;

      try {
        await sendTextEvolution(
          externalId,
          "Oi! Tudo bem? Passando para saber se ainda tem interesse 😊 Qualquer dúvida é só falar!"
        );
        await prisma.conversation.update({
          where: { id: conv.id },
          data: { followupSentAt: now } as any,
        });
        results.followup24h++;
      } catch (e) {
        results.errors++;
      }
    }
  } catch (e) {
    console.error("followup 24h error:", e);
  }

  // ── 3. Lembrete de reunião (1h antes) ────────────────────────────────────────
  try {
    const leadsComReuniao = await prisma.lead.findMany({
      where: {
        meetingDate: { gte: thirtyMinFromNow, lte: oneHourFromNow },
        reminderSentAt: null,
      },
      include: {
        conversation: {
          include: { contact: { include: { identities: true } } },
        },
      },
    });

    for (const lead of leadsComReuniao) {
      const externalId = lead.conversation.contact.identities[0]?.externalId;
      if (!externalId) continue;
      const hora = new Date(lead.meetingDate!).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      try {
        await sendTextEvolution(
          externalId,
          `Oi ${lead.name}! Lembrando que temos nossa reunião hoje às ${hora} 📅 Qualquer imprevisto pode me avisar!`
        );
        await prisma.lead.update({
          where: { id: lead.id },
          data: { reminderSentAt: now } as any,
        });
        results.meetingReminder++;
      } catch (e) {
        results.errors++;
      }
    }
  } catch (e) {
    console.error("meeting reminder error:", e);
  }

  console.log(JSON.stringify({ event: "followup.run", ...results }));
  return Response.json(results);
}
