import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - 7);

  const [
    totalConversas,
    conversasHoje,
    conversasSemana,
    aiAtiva,
    handoffTotal,
    feedbackData,
    correcoesTotais,
    totalLeads,
    leadsHoje,
    leadsPorStatus,
    conversasPorStatus,
  ] = await Promise.all([
    prisma.conversation.count(),
    prisma.conversation.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.conversation.count({ where: { createdAt: { gte: startOfWeek } } }),
    prisma.conversation.count({ where: { aiEnabled: true } }),
    prisma.conversation.count({ where: { handoffRequested: true } }),
    prisma.messageFeedback.groupBy({
      by: ["rating"],
      _count: { rating: true },
    }),
    prisma.messageFeedback.count({
      where: { rating: "bad", correction: { not: null } },
    }),
    prisma.lead.count(),
    prisma.lead.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.lead.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.conversation.groupBy({ by: ["status"], _count: { status: true } }),
  ]);

  const feedbackTotal = feedbackData.reduce((acc, r) => acc + r._count.rating, 0);
  const feedbackBom = feedbackData.find((r) => r.rating === "good")?._count.rating ?? 0;
  const taxaSatisfacao =
    feedbackTotal > 0 ? Math.round((feedbackBom / feedbackTotal) * 100) : 0;

  const handoffRate =
    totalConversas > 0 ? Math.round((handoffTotal / totalConversas) * 100) : 0;

  const leadsPorStatusMap = Object.fromEntries(
    leadsPorStatus.map((r) => [r.status, r._count.status])
  );

  const conversasPorStatusMap = Object.fromEntries(
    conversasPorStatus.map((r) => [r.status, r._count.status])
  );

  return Response.json({
    totalConversas,
    conversasHoje,
    conversasSemana,
    aiAtiva,
    handoffRate,
    feedbackTotal,
    feedbackBom,
    taxaSatisfacao,
    correcoesTotais,
    totalLeads,
    leadsHoje,
    leadsPorStatus: leadsPorStatusMap,
    conversasPorStatus: conversasPorStatusMap,
  });
}
