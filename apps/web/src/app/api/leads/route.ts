import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const status = req.nextUrl.searchParams.get("status");

  const leads = await prisma.lead.findMany({
    where: status ? { status } : undefined,
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
    conversationId,
    contactId,
    name,
    whatsapp,
    businessType,
    painPoint,
    monthlyVolume,
    currentTool,
    meetingDate,
    notes,
    status,
  } = body;

  if (!conversationId || !contactId) {
    return new Response("conversationId and contactId required", { status: 400 });
  }

  const lead = await prisma.lead.upsert({
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
    },
  });

  return Response.json(lead);
}
