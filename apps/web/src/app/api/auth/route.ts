import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sign } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) return new Response("email e password obrigatórios", { status: 400 });

  const op = await prisma.operator.findUnique({ where: { email } });
  if (!op) return new Response("credenciais inválidas", { status: 401 });

  // Verificar senha
  let valid = false;
  try {
    const bcrypt = await import("bcryptjs");
    valid = await bcrypt.compare(password, op.password);
  } catch {
    valid = op.password === password; // fallback para dev
  }

  if (!valid) return new Response("credenciais inválidas", { status: 401 });

  const token = sign({ operatorId: op.id, email: op.email });
  return Response.json({ token, name: op.name ?? op.email });
}
