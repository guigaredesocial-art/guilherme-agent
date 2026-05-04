import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";
import bcrypt from "bcryptjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { id } = await params;
  const me = await db.operator.findUnique({ where: { id: op.operatorId } });
  if (me?.role !== "admin" && op.operatorId !== id) {
    return new Response("Sem permissão", { status: 403 });
  }

  const { name, password, role } = await req.json();
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (role !== undefined) data.role = role;
  if (password) data.password = await bcrypt.hash(password, 10);

  const updated = await db.operator.update({
    where: { id },
    data,
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return Response.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const me = await db.operator.findUnique({ where: { id: op.operatorId } });
  if (me?.role !== "admin") {
    return new Response("Apenas administradores podem remover usuários", { status: 403 });
  }

  const { id } = await params;
  if (id === op.operatorId) return new Response("Não pode remover a si mesmo", { status: 400 });

  await prisma.operator.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
