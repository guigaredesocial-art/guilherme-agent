import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";
import { chat } from "@/lib/llm/anthropic";

export async function POST(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { conversationId } = await req.json();
  if (!conversationId) return new Response("conversationId required", { status: 400 });

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      contact: true,
      messages: { orderBy: { createdAt: "asc" }, take: 30 },
      lead: true,
    },
  });

  if (!conv) return new Response("not found", { status: 404 });
  if (conv.messages.length < 2) {
    return Response.json({
      chanceFechamento: 0,
      classificacao: "sem dados",
      erros: [],
      sugestoes: ["Conversa muito curta para análise. Aguarde mais mensagens."],
      proximoPasso: "Aguardar o cliente responder.",
    });
  }

  const transcript = conv.messages
    .map((m) => `${m.role === "user" ? "CLIENTE" : "GUILHERME"}: ${m.content}`)
    .join("\n");

  const systemPrompt = `Você é um consultor especialista em vendas via WhatsApp.
Analise a conversa abaixo e retorne um JSON VÁLIDO (sem markdown, sem \`\`\`) com este formato exato:
{
  "chanceFechamento": <número 0-100>,
  "classificacao": "<frio|morno|quente|fechando>",
  "erros": ["<erro detectado na abordagem>"],
  "sugestoes": ["<sugestão prática e direta>"],
  "proximoPasso": "<próxima ação recomendada>"
}

Seja honesto, direto e prático. Máximo 3 erros, 3 sugestões.`;

  try {
    const raw = await chat(
      systemPrompt,
      [{ role: "user", content: `Conversa:\n${transcript}` }],
      "claude-sonnet-4-6",
      0.3
    );

    const analysis = JSON.parse(raw.trim());
    return Response.json(analysis);
  } catch {
    return Response.json({
      chanceFechamento: 50,
      classificacao: "morno",
      erros: ["Não foi possível analisar a conversa completamente."],
      sugestoes: ["Tente novamente com mais mensagens na conversa."],
      proximoPasso: "Continue a conversa normalmente.",
    });
  }
}
