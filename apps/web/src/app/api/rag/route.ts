import { NextRequest } from "next/server";
import { verifyOperator } from "@/lib/auth";
import { indexDocument } from "@/lib/rag";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const agentSessionId = formData.get("agentSessionId") as string | null;

  if (!file || !agentSessionId) {
    return new Response("file and agentSessionId required", { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let text = "";

  if (file.type === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    const result = await parser.getText();
    text = result.text;
    await parser.destroy();
  } else {
    text = buf.toString("utf-8");
  }

  const docId = await indexDocument(agentSessionId, file.name, text, file.type);
  return Response.json({ ok: true, docId });
}

export async function GET(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const agentSessionId = req.nextUrl.searchParams.get("agentSessionId");
  if (!agentSessionId) return new Response("agentSessionId required", { status: 400 });

  const docs = await prisma.ragDoc.findMany({
    where: { agentSessionId },
    include: { _count: { select: { chunks: true } } },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(docs);
}

export async function DELETE(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const docId = req.nextUrl.searchParams.get("docId");
  if (!docId) return new Response("docId required", { status: 400 });

  await prisma.ragDoc.delete({ where: { id: docId } });

  return new Response(null, { status: 204 });
}
