import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";
import { chat } from "@/lib/llm/anthropic";

const SYSTEM_INTERNO = `Você é o Guilherme, assistente interno de vendas e estratégia.

Neste chat interno (não é WhatsApp), você pode:
1. Ajudar o operador a pensar em abordagens para clientes
2. Sugerir melhorias no processo de vendas
3. Responder dúvidas sobre o negócio
4. Ajudar a redigir mensagens para clientes específicos
5. Analisar situações e dar conselhos práticos

Você pode usar formatação, listas e ser mais detalhado aqui.
Responda sempre em PT-BR, seja direto e prático.`;

export async function POST(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { messages } = await req.json();
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

  try {
    const reply = await chat(systemPrompt, messages, "claude-sonnet-4-6", 0.8);
    return Response.json({ reply });
  } catch (e) {
    console.error("chat-interno error:", e);
    return new Response("internal error", { status: 500 });
  }
}
