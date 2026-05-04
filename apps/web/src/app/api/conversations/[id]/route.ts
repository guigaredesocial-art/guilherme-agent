import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { id } = await params;
  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: {
      contact: { include: { identities: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { feedback: true },
      },
      agentSession: true,
      lead: true,
    },
  });

  if (!conv) return new Response("not found", { status: 404 });
  return Response.json(conv);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { aiEnabled, handoffRequested, status, internalNotes } = body;

  const updated = await prisma.conversation.update({
    where: { id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: {
      ...(typeof aiEnabled === "boolean" && { aiEnabled }),
      ...(typeof handoffRequested === "boolean" && { handoffRequested }),
      ...(typeof status === "string" && { status }),
      ...(typeof internalNotes === "string" && { internalNotes }),
    } as any,
  });

  return Response.json(updated);
}
