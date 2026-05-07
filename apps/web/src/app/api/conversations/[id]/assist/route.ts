import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";
import { chat } from "@/lib/llm/anthropic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { id } = await params;

  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: {
      contact: true,
      messages: { orderBy: { createdAt: "asc" }, take: 20 },
    },
  });

  if (!conv) return new Response("not found", { status: 404 });
  if (conv.messages.length < 2) {
    return Response.json({
      sentimento: "neutro",
      objecao: "nenhuma",
      sugestoes: [
        { texto: "Olá! Como posso te ajudar hoje?", tom: "receptivo" },
        { texto: "Oi! Pode me contar um pouco mais sobre o que você precisa?", tom: "curioso" },
        { texto: "Olá! Estou aqui para te ajudar. O que você está buscando?", tom: "atencioso" },
      ],
    });
  }

  const transcript = conv.messages
    .slice(-15) // últimas 15 mensagens para context relevante
    .map((m) => `${m.role === "user" ? "CLIENTE" : "AGENTE"}: ${m.content.replace(/^\[MANUAL\]\s?/, "")}`)
    .join("\n");

  const systemPrompt = `Você é um gerente de vendas experiente que auxilia vendedores em tempo real no WhatsApp.
Analise a conversa e retorne um JSON VÁLIDO (sem markdown, sem \`\`\`) com este formato exato:
{
  "sentimento": "<irritado|ansioso|interessado|indeciso|empolgado|desconfiante|neutro>",
  "objecao": "<preco|confianca|tempo|necessidade|concorrencia|nenhuma>",
  "urgencia": <número 1-10>,
  "resumo": "<1 frase sobre o momento atual da conversa>",
  "sugestoes": [
    { "texto": "<mensagem pronta para copiar e enviar>", "tom": "<por que essa abordagem funciona agora>" },
    { "texto": "<segunda opção>", "tom": "<justificativa>" },
    { "texto": "<terceira opção mais ousada>", "tom": "<justificativa>" }
  ]
}

Regras:
- As sugestões devem ser mensagens PRONTAS para enviar no WhatsApp, naturais e em português brasileiro
- Adapte ao sentimento detectado (se irritado, seja mais empático; se empolgado, acelere o fechamento)
- Se a objeção for preço, foque em valor e ROI
- Se for desconfiança, use prova social e garantias
- Se estiver quase fechando (urgencia >= 8), sugira o fechamento direto`;

  try {
    const raw = await chat(
      systemPrompt,
      [{ role: "user", content: `Conversa:\n${transcript}` }],
      "claude-sonnet-4-6",
      0.4
    );

    const analysis = JSON.parse(raw.trim());
    return Response.json(analysis);
  } catch {
    return Response.json({
      sentimento: "neutro",
      objecao: "nenhuma",
      urgencia: 5,
      resumo: "Conversa em andamento.",
      sugestoes: [
        { texto: "Posso te ajudar com mais alguma informação?", tom: "aberto" },
        { texto: "Qual é a sua maior dúvida antes de decidir?", tom: "direto à objeção" },
        { texto: "O que falta para fecharmos hoje?", tom: "fechamento direto" },
      ],
    });
  }
}
