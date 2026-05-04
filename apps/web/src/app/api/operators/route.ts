import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";
import bcrypt from "bcryptjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const operators = await db.operator.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return Response.json(operators);
}

export async function POST(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const me = await db.operator.findUnique({ where: { id: op.operatorId } });
  if (me?.role !== "admin") {
    return new Response("Apenas administradores podem criar usuários", { status: 403 });
  }

  const { email, name, password, role } = await req.json();
  if (!email || !password) return new Response("email e password obrigatórios", { status: 400 });

  const existing = await prisma.operator.findUnique({ where: { email } });
  if (existing) return new Response("Email já cadastrado", { status: 409 });

  const hash = await bcrypt.hash(password, 10);
  const created = await db.operator.create({
    data: { email, name: name || null, password: hash, role: role || "operator" },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return Response.json(created);
}
