import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // O "token" é o próprio conversationId (UUID já é suficientemente aleatório)
  const conv = await db.conversation.findUnique({
    where: { id: token },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      contact: { select: { displayName: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 100,
        select: { id: true, role: true, content: true, createdAt: true },
      },
      lead: { select: { name: true } },
    },
  });

  if (!conv) return new Response("not found", { status: 404 });

  return Response.json({
    id: conv.id,
    status: conv.status,
    updatedAt: conv.updatedAt,
    clientName: conv.lead?.name ?? conv.contact?.displayName ?? "Cliente",
    messages: conv.messages,
  });
}
