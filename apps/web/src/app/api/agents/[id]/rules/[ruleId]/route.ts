import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { ruleId } = await params;
  const body = await req.json();

  const rule = await prisma.aIRule.update({
    where: { id: ruleId },
    data: {
      ...(typeof body.enabled === "boolean" && { enabled: body.enabled }),
      ...(body.mode !== undefined && { mode: body.mode }),
      ...(body.action !== undefined && { action: body.action }),
      ...(body.keywords !== undefined && { params: { keywords: body.keywords } }),
      ...(body.staticReply !== undefined && { staticReply: body.staticReply }),
      ...(typeof body.priority === "number" && { priority: body.priority }),
    },
  });

  return Response.json(rule);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { ruleId } = await params;
  await prisma.aIRule.delete({ where: { id: ruleId } });
  return new Response(null, { status: 204 });
}
