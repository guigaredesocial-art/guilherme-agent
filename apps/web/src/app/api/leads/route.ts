import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";

const DRIP_TEMPLATES = [
  { step: 1, days: 1, msg: (name: string) => `Oi ${name}! 😊 Passando para ver se você conseguiu analisar as informações que conversamos. Ficou alguma dúvida?` },
  { step: 2, days: 3, msg: (name: string) => `Oi ${name}! Muita gente que estava na mesma situação que você já está usando nosso serviço e tendo ótimos resultados 🚀 Posso te contar mais?` },
  { step: 3, days: 7, msg: (name: string) => `Oi ${name}! Vou encerrar seu atendimento por aqui, mas se quiser retomar é só me chamar 😊 Qualquer momento estou à disposição!` },
];

export async function GET(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const status = req.nextUrl.searchParams.get("status");
  const source = req.nextUrl.searchParams.get("source");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (status) where.status = status;
  if (source) where.leadSource = source;

  const leads = await prisma.lead.findMany({
    where,
    include: {
      contact: true,
      conversation: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(leads);
}

export async function POST(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const body = await req.json();
  const {
    conversationId, contactId, name, whatsapp,
    businessType, painPoint, monthlyVolume, currentTool,
    meetingDate, notes, status, city, leadSource, nextAction,
  } = body;

  if (!conversationId || !contactId) {
    return new Response("conversationId and contactId required", { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lead = await (prisma.lead.upsert as any)({
    where: { conversationId },
    update: {
      ...(name && { name }),
      ...(whatsapp && { whatsapp }),
      ...(businessType && { businessType }),
      ...(painPoint && { painPoint }),
      ...(monthlyVolume && { monthlyVolume }),
      ...(currentTool && { currentTool }),
      ...(meetingDate && { meetingDate: new Date(meetingDate) }),
      ...(notes && { notes }),
      ...(status && { status }),
      ...(city !== undefined && { city }),
      ...(leadSource && { leadSource }),
      ...(nextAction !== undefined && { nextAction }),
    },
    create: {
      conversationId,
      contactId,
      name: name ?? "",
      whatsapp: whatsapp ?? "",
      businessType: businessType ?? null,
      painPoint: painPoint ?? null,
      monthlyVolume: monthlyVolume ?? null,
      currentTool: currentTool ?? null,
      meetingDate: meetingDate ? new Date(meetingDate) : null,
      notes: notes ?? null,
      status: status ?? "novo",
      city: city ?? null,
      leadSource: leadSource ?? "organico",
      nextAction: nextAction ?? null,
    },
  });

  // Criar drip automático apenas em novos leads (upsert cria se não existir)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (prisma as any).dripMessage.count({ where: { leadId: lead.id } });
    if (existing === 0) {
      const now = new Date();
      await (prisma as any).dripMessage.createMany({
        data: DRIP_TEMPLATES.map((t) => ({
          leadId: lead.id,
          step: t.step,
          message: t.msg(name ?? ""),
          scheduledAt: new Date(now.getTime() + t.days * 24 * 60 * 60 * 1000),
          status: "pending",
        })),
      });
      console.log(JSON.stringify({ event: "drip.scheduled", leadId: lead.id }));
    }
  } catch { /* não bloquear criação do lead */ }

  return Response.json(lead);
}
