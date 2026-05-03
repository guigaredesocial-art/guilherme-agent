import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const agents = await prisma.agentSession.findMany({
    orderBy: { createdAt: "asc" },
    include: { rules: { orderBy: { priority: "asc" } }, ragDocs: true },
  });
  return Response.json(agents);
}

export async function POST(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const body = await req.json();
  const agent = await prisma.agentSession.create({
    data: {
      name: body.name,
      systemPrompt: body.systemPrompt,
      model: body.model ?? "claude-sonnet-4-6",
      provider: "anthropic",
      temperature: body.temperature ?? 0.7,
      isDefault: false,
    },
  });
  return Response.json(agent);
}
