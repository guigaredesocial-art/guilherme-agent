import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { contact: true, conversation: true },
  });
  if (!lead) return new Response("not found", { status: 404 });
  return Response.json(lead);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.whatsapp !== undefined && { whatsapp: body.whatsapp }),
      ...(body.businessType !== undefined && { businessType: body.businessType }),
      ...(body.painPoint !== undefined && { painPoint: body.painPoint }),
      ...(body.monthlyVolume !== undefined && { monthlyVolume: body.monthlyVolume }),
      ...(body.currentTool !== undefined && { currentTool: body.currentTool }),
      ...(body.meetingDate !== undefined && {
        meetingDate: body.meetingDate ? new Date(body.meetingDate) : null,
      }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.status !== undefined && { status: body.status }),
    },
  });

  return Response.json(lead);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { id } = await params;
  await prisma.lead.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
