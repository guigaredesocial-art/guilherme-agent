import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { id } = await params;
  const { rating, correction } = await req.json();

  const feedback = await prisma.messageFeedback.upsert({
    where: { messageId: id },
    update: { rating, ...(correction !== undefined && { correction }) },
    create: { messageId: id, rating, correction: correction ?? null },
  });

  return Response.json(feedback);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { id } = await params;
  const feedback = await prisma.messageFeedback.findUnique({ where: { messageId: id } });
  if (!feedback) return new Response("not found", { status: 404 });
  return Response.json(feedback);
}
