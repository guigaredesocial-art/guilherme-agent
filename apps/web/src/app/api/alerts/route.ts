import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const [hotLeads, priceAlerts, hotConvs] = await Promise.all([
    db.lead.count({ where: { leadScore: { gte: 70 } } }),
    db.conversation.count({
      where: { tags: { contains: "preço" }, offerSentAt: null, status: { notIn: ["encerrado"] } },
    }),
    db.conversation.findMany({
      where: { tags: { contains: "quente" }, status: { notIn: ["encerrado"] } },
      include: { contact: { select: { displayName: true } }, lead: { select: { name: true, leadScore: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  return Response.json({
    hotLeads,
    priceAlerts,
    total: hotLeads + priceAlerts,
    hotConvs: hotConvs.map((c: any) => ({
      id: c.id,
      name: c.lead?.name ?? c.contact?.displayName ?? "Cliente",
      score: c.lead?.leadScore ?? 0,
    })),
  });
}
