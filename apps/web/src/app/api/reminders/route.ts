import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const convId = req.nextUrl.searchParams.get("conversationId");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reminders = await (prisma as any).reminder.findMany({
    where: convId ? { conversationId: convId } : undefined,
    include: {
      conversation: { include: { contact: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  return Response.json(reminders);
}

export async function POST(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { conversationId, message, scheduledAt } = await req.json();
  if (!conversationId || !message || !scheduledAt) {
    return new Response("conversationId, message and scheduledAt required", { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reminder = await (prisma as any).reminder.create({
    data: {
      conversationId,
      message,
      scheduledAt: new Date(scheduledAt),
      status: "pending",
    },
  });

  return Response.json(reminder);
}
