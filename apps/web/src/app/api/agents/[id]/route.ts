import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });
  const { id } = await params;
  const agent = await prisma.agentSession.findUnique({
    where: { id },
    include: { rules: { orderBy: { priority: "asc" } }, ragDocs: true },
  });
  if (!agent) return new Response("not found", { status: 404 });
  return Response.json(agent);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const agent = await prisma.agentSession.update({
    where: { id },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.systemPrompt && { systemPrompt: body.systemPrompt }),
      ...(body.model && { model: body.model }),
      ...(typeof body.temperature === "number" && { temperature: body.temperature }),
      ...(typeof body.isDefault === "boolean" && { isDefault: body.isDefault }),
    },
  });
  return Response.json(agent);
}
