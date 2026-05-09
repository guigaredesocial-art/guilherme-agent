import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const proofs = await (prisma as any).socialProof.findMany({
    orderBy: { createdAt: "desc" },
  });
  return Response.json(proofs);
}

export async function POST(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { name, mediaUrl, mediaType, caption, triggerHint } = await req.json();
  if (!name?.trim() || !mediaUrl?.trim()) {
    return new Response("name e mediaUrl são obrigatórios", { status: 400 });
  }

  const proof = await (prisma as any).socialProof.create({
    data: {
      id: crypto.randomUUID(),
      name: name.trim(),
      mediaUrl: mediaUrl.trim(),
      mediaType: mediaType ?? "image",
      caption: caption?.trim() ?? "",
      triggerHint: triggerHint?.trim() ?? "",
    },
  });
  return Response.json(proof, { status: 201 });
}
