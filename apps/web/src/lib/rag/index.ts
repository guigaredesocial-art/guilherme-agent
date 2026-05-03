import { prisma } from "@/lib/prisma";
import { embedText } from "@/lib/llm/anthropic";

function splitIntoChunks(text: string, size = 500, overlap = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + size).join(" "));
    i += size - overlap;
  }
  return chunks.filter(Boolean);
}

export async function indexDocument(
  agentSessionId: string,
  fileName: string,
  text: string,
  mimeType = "text/plain"
): Promise<string> {
  const doc = await prisma.ragDoc.create({
    data: { agentSessionId, fileName, mimeType },
  });

  const chunks = splitIntoChunks(text);
  for (let i = 0; i < chunks.length; i++) {
    const vec = await embedText(chunks[i]);
    // Salvar chunk com embedding via raw SQL (pgvector)
    await prisma.$executeRaw`
      INSERT INTO "RagChunk" (id, "docId", ord, text, embedding, "embeddingModel", "createdAt")
      VALUES (
        gen_random_uuid()::text,
        ${doc.id},
        ${i},
        ${chunks[i]},
        ${`[${vec.join(",")}]`}::vector,
        'claude-embed',
        NOW()
      )
    `;
  }

  console.log(JSON.stringify({ event: "rag.indexed", docId: doc.id, chunks: chunks.length }));
  return doc.id;
}

export async function retrieveContext(
  query: string,
  agentSessionId: string,
  k = 5
): Promise<string> {
  try {
    const qVec = await embedText(query);
    const rows = await prisma.$queryRaw<Array<{ text: string; distance: number }>>`
      SELECT c.text, c.embedding <=> ${`[${qVec.join(",")}]`}::vector AS distance
      FROM "RagChunk" c
      JOIN "RagDoc" d ON d.id = c."docId"
      WHERE d."agentSessionId" = ${agentSessionId}
      ORDER BY distance ASC
      LIMIT ${k}
    `;

    if (!rows.length) return "";

    return rows.map((r) => r.text).join("\n\n---\n\n");
  } catch (e) {
    console.error(JSON.stringify({ event: "rag.retrieve_failed", err: String(e) }));
    return "";
  }
}
