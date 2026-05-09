import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";
import { chat, ContentBlock, ChatMessage } from "@/lib/llm/anthropic";

const SYSTEM_INTERNO = `Você é o Guilherme, assistente interno de vendas e estratégia.

Neste chat interno (não é WhatsApp), você pode:
1. Ajudar o operador a pensar em abordagens para clientes
2. Sugerir melhorias no processo de vendas
3. Responder dúvidas sobre o negócio
4. Ajudar a redigir mensagens para clientes específicos
5. Analisar situações e dar conselhos práticos
6. Analisar imagens, prints de conversa, fotos de produtos, PDFs e documentos enviados

Quando receber uma imagem ou arquivo, analise com atenção e dê insights práticos.
Você pode usar formatação, listas e ser mais detalhado aqui.
Responda sempre em PT-BR, seja direto e prático.`;

interface Attachment {
  name: string;
  mimeType: string;
  base64: string;
}

export async function POST(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { messages, attachments } = await req.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
    attachments?: Attachment[];
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("messages required", { status: 400 });
  }

  // Buscar contexto: leads ativos e conversas recentes
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

  let contextExtra = `\n\n--- CONTEXTO DO PAINEL ---\nLeads cadastrados: ${totalLeads}\nLeads quentes (negociação/reunião): ${leadsQuentes}`;
  if (reunioesHoje.length > 0) {
    contextExtra += `\nReuniões hoje: ${reunioesHoje.map((r) => `${r.name} às ${new Date(r.meetingDate!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`).join(", ")}`;
  }
  contextExtra += "\n--- FIM DO CONTEXTO ---";

  const systemPrompt = SYSTEM_INTERNO + contextExtra;

  // Montar histórico — se a última mensagem tiver anexos, transforma em content blocks
  const history: ChatMessage[] = messages.map((m, idx) => {
    const isLast = idx === messages.length - 1;
    const hasAttachments = isLast && attachments && attachments.length > 0;

    if (!hasAttachments || m.role !== "user") {
      return { role: m.role, content: m.content };
    }

    // Última mensagem do usuário com anexos → content blocks
    const blocks: ContentBlock[] = [];

    // Texto da mensagem (pode ser vazio se só enviou arquivo)
    if (m.content.trim()) {
      blocks.push({ type: "text", text: m.content });
    }

    // Blocos de arquivo
    for (const att of attachments) {
      const mime = att.mimeType;

      if (mime === "application/pdf") {
        blocks.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: att.base64 },
          title: att.name,
        });
      } else if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime)) {
        blocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: mime as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: att.base64,
          },
        });
      } else {
        // Arquivo de texto ou outro — adiciona como texto
        try {
          const decoded = Buffer.from(att.base64, "base64").toString("utf-8");
          blocks.push({ type: "text", text: `\n\n[Arquivo: ${att.name}]\n${decoded}` });
        } catch {
          blocks.push({ type: "text", text: `\n\n[Arquivo: ${att.name} — não foi possível decodificar]` });
        }
      }
    }

    // Se não havia texto mas só arquivos, adiciona prompt padrão
    if (!m.content.trim()) {
      blocks.unshift({ type: "text", text: "Analise este(s) arquivo(s) e me dê insights práticos." });
    }

    return { role: "user", content: blocks };
  });

  try {
    const reply = await chat(systemPrompt, history, "claude-sonnet-4-6", 0.8, 1500);
    return Response.json({ reply });
  } catch (e) {
    console.error("chat-interno error:", e);
    return new Response("internal error", { status: 500 });
  }
}
