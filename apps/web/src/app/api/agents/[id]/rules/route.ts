import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { id } = await params;
  const rules = await prisma.aIRule.findMany({
    where: { agentSessionId: id },
    orderBy: { priority: "asc" },
  });
  return Response.json(rules);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { mode, action, staticReply, priority } = body;
  // Accept keywords from body.params.keywords or body.keywords
  const keywords: string[] = body.params?.keywords ?? body.keywords ?? [];

  if (!mode || !action) {
    return new Response("mode and action required", { status: 400 });
  }

  const rule = await prisma.aIRule.create({
    data: {
      agentSessionId: id,
      mode,
      action,
      params: { keywords },
      staticReply: staticReply ?? null,
      priority: priority ?? 0,
      enabled: true,
    },
  });

  return Response.json(rule);
}
