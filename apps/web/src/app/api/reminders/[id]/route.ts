import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reminder = await (prisma as any).reminder.update({
    where: { id },
    data: {
      ...(body.status && { status: body.status }),
      ...(body.message && { message: body.message }),
      ...(body.scheduledAt && { scheduledAt: new Date(body.scheduledAt) }),
    },
  });

  return Response.json(reminder);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).reminder.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
