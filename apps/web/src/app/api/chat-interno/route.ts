import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";
import { chat, ContentBlock, ChatMessage } from "@/lib/llm/anthropic";

const SYSTEM_INTERNO = `Você é o Guilherme, consultor interno de vendas e estratégia.

Você TEM memória persistente — lembra de todas as conversas anteriores com o operador. Quando ele voltar, você sabe o que foi discutido, o que foi ensinado e o contexto do negócio.

Suas funções:
1. Ajudar o operador a pensar em abordagens para clientes
2. Absorver informações que o operador te passa (produto, objeções comuns, argumentos, scripts)
3. Quando o operador colar uma mensagem de cliente, montar a resposta ideal para enviar
4. Sugerir melhorias no processo de vendas com base no que já aprendeu
5. Analisar imagens, prints de conversa, fotos de produtos e PDFs

Fluxo principal de uso:
- Operador cola mensagem do cliente → você monta a resposta ideal → operador copia e envia
- Operador te ensina algo → você absorve e usa nas próximas conversas
- Operador pede análise de situação → você dá conselho baseado no histórico

Você LEMBRA de tudo. Não diga que vai esquecer — você não vai.
Use formatação, listas quando útil. Responda em PT-BR, seja direto e prático.`;

interface Attachment {
  name: string;
  mimeType: string;
  base64: string;
}

// ── GET: carregar histórico persistido ───────────────────────────────────────
export async function GET(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const messages = await (prisma as any).internalMessage.findMany({
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return Response.json(messages);
}

// ── DELETE: nova conversa (limpa histórico) ──────────────────────────────────
export async function DELETE(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  await (prisma as any).internalMessage.deleteMany({});
  return new Response(null, { status: 204 });
}

// ── POST: enviar mensagem, salvar no banco, retornar resposta ─────────────────
export async function POST(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { content, attachments } = await req.json() as {
    content: string;
    attachments?: Attachment[];
  };

  if (!content?.trim() && (!attachments || attachments.length === 0)) {
    return new Response("content required", { status: 400 });
  }

  // 1. Salvar mensagem do usuário no banco
  const userDisplay = content?.trim() || attachments?.map((a) => `[${a.name}]`).join(" ") || "";
  await (prisma as any).internalMessage.create({
    data: { id: crypto.randomUUID(), role: "user", content: userDisplay },
  });

  // 2. Buscar histórico completo (últimas 60 msgs para contexto)
  const allHistory = await (prisma as any).internalMessage.findMany({
    orderBy: { createdAt: "asc" },
    take: 60,
  });

  // 3. Contexto do painel (leads)
  const [totalLeads, leadsQuentes, reunioesHoje] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { status: { in: ["em_negociacao", "reuniao_agendada"] } } }),
    prisma.lead.findMany({
      where: {
        meetingDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lte: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
      select: { name: true, meetingDate: true },
    }),
  ]);

  let contextExtra = `\n\n--- CONTEXTO DO PAINEL AGORA ---\nLeads cadastrados: ${totalLeads}\nLeads quentes (negociação/reunião): ${leadsQuentes}`;
  if (reunioesHoje.length > 0) {
    contextExtra += `\nReuniões hoje: ${reunioesHoje.map((r: any) => `${r.name} às ${new Date(r.meetingDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`).join(", ")}`;
  }
  contextExtra += "\n--- FIM DO CONTEXTO ---";

  const systemPrompt = SYSTEM_INTERNO + contextExtra;

  // 4. Montar histórico para a API do Claude
  // Todos os msgs anteriores são texto simples; a última (atual) pode ter anexos
  const historyForClaude: ChatMessage[] = allHistory.map((m: any) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Se a última mensagem do usuário tiver anexos, converte em content blocks
  if (attachments && attachments.length > 0) {
    const lastIdx = historyForClaude.length - 1;
    const blocks: ContentBlock[] = [];

    if (content?.trim()) {
      blocks.push({ type: "text", text: content.trim() });
    }

    for (const att of attachments) {
      const mime = att.mimeType;
      if (mime === "application/pdf") {
        blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: att.base64 }, title: att.name });
      } else if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime)) {
        blocks.push({ type: "image", source: { type: "base64", media_type: mime as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: att.base64 } });
      } else {
        try {
          const decoded = Buffer.from(att.base64, "base64").toString("utf-8");
          blocks.push({ type: "text", text: `\n\n[Arquivo: ${att.name}]\n${decoded}` });
        } catch {
          blocks.push({ type: "text", text: `\n\n[Arquivo: ${att.name}]` });
        }
      }
    }

    if (!content?.trim()) {
      blocks.unshift({ type: "text", text: "Analise este(s) arquivo(s) e me dê insights práticos." });
    }

    historyForClaude[lastIdx] = { role: "user", content: blocks };
  }

  // 5. Chamar o Claude
  let reply: string;
  try {
    reply = await chat(systemPrompt, historyForClaude, "claude-sonnet-4-6", 0.8, 1500);
  } catch (e) {
    console.error("chat-interno error:", e);
    return new Response("internal error", { status: 500 });
  }

  // 6. Salvar resposta do assistente no banco
  await (prisma as any).internalMessage.create({
    data: { id: crypto.randomUUID(), role: "assistant", content: reply },
  });

  return Response.json({ reply });
}
