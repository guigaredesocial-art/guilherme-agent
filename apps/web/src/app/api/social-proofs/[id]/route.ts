import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { id } = await params;
  await (prisma as any).socialProof.delete({ where: { id } });
  return new Response(null, { status: 204 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const updated = await (prisma as any).socialProof.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.mediaUrl !== undefined && { mediaUrl: body.mediaUrl.trim() }),
      ...(body.mediaType !== undefined && { mediaType: body.mediaType }),
      ...(body.caption !== undefined && { caption: body.caption.trim() }),
      ...(body.triggerHint !== undefined && { triggerHint: body.triggerHint.trim() }),
    },
  });
  return Response.json(updated);
}
