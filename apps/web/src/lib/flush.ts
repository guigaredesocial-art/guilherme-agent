import { prisma } from "@/lib/prisma";
import { chat } from "@/lib/llm/anthropic";
import { retrieveContext } from "@/lib/rag";
import { decideAction, type ChannelMessage } from "@/lib/ai-rules/evaluate";
import { sendTextEvolution } from "@/lib/channels/evolution";
import type { Conversation } from "@prisma/client";

// ─── Auto-classificação de tags e status ─────────────────────────────────────

const TAG_RULES: { tag: string; regex: RegExp }[] = [
  { tag: "🔥 quente",      regex: /quero|comprar|fechar|contratar|quero sim|vamos|bora|me interess|pode ser|topo|fechado/ },
  { tag: "❄️ frio",        regex: /não quero|nao quero|não tenho interesse|sem interesse|não preciso|tchau|até mais|obrigad[ao] nao/ },
  { tag: "💰 preço",       regex: /quanto custa|qual o preço|valor|custo|investimento|cobr[a-z]|mensalidade|plano|quanto é/ },
  { tag: "📅 agendamento", regex: /agendar|reunião|horário|disponível|marcar|quando podemos|que dia|qual semana|que hora/ },
  { tag: "❓ dúvida",      regex: /como funciona|me explica|não entendi|nao entendi|dúvida|me conta mais|o que é|como é|como seria/ },
];

async function autoClassify(convId: string, userText: string, currentStatus: string) {
  const lower = userText.toLowerCase();

  // Detectar tags
  const newTags: string[] = [];
  for (const { tag, regex } of TAG_RULES) {
    if (regex.test(lower)) newTags.push(tag);
  }

  // Detectar novo status
  let newStatus: string | null = null;
  if (
    /quero|comprar|fechar|contratar|quero sim|vamos|bora|topo/.test(lower) &&
    currentStatus === "em_atendimento"
  ) {
    newStatus = "qualificado";
  }
  if (
    /agendar|marcar reunião|horário disponível|quando podemos|que dia|que hora/.test(lower) &&
    ["em_atendimento", "qualificado"].includes(currentStatus)
  ) {
    newStatus = "reuniao_agendada";
  }

  try {
    const conv = await prisma.conversation.findUnique({
      where: { id: convId },
      select: { tags: true },
    });
    const existingTags = (conv?.tags ?? "").split(",").filter(Boolean);
    const mergedTags = [...new Set([...existingTags, ...newTags])].join(",");

    await prisma.conversation.update({
      where: { id: convId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        tags: mergedTags,
        lastUserMsgAt: new Date(),
        ...(newStatus ? { status: newStatus } : {}),
      } as any,
    });

    if (newStatus) {
      console.log(JSON.stringify({ event: "auto_status", convId, newStatus }));
    }
    if (newTags.length > 0) {
      console.log(JSON.stringify({ event: "auto_tags", convId, newTags }));
    }
  } catch (e) {
    console.error("autoClassify error:", e);
  }
}

// ─── Flush principal ──────────────────────────────────────────────────────────

export async function flushConversation(
  conv: Conversation,
  msgs: ChannelMessage[]
): Promise<void> {
  console.log(JSON.stringify({ event: "flush.start", conversationId: conv.id, msgCount: msgs.length }));

  // 1. Decidir se responde
  const decision = await decideAction(msgs, conv);
  console.log(JSON.stringify({ event: "flush.decided", conversationId: conv.id, action: decision.action }));

  if (decision.action === "drop") return;

  if (decision.action === "static_reply") {
    const externalId = msgs[0]?.contactId;
    if (!externalId) return;
    await sendTextEvolution(externalId, decision.text);
    return;
  }

  if (decision.action === "handoff") {
    console.log(JSON.stringify({ event: "flush.handoff", conversationId: conv.id, reason: decision.reason }));
    await prisma.conversation.update({ where: { id: conv.id }, data: { handoffRequested: true, aiEnabled: false } });
    const externalId = msgs[0]?.contactId;
    if (externalId) {
      await sendTextEvolution(externalId, "Deixa eu te conectar com um de nossos especialistas. Um momento!");
    }
    return;
  }

  // action === "respond"
  const { agentSession } = decision;

  // 2. Auto-classificar tags e status com base na mensagem do usuário
  const userText = msgs.map((m) => m.text).join(" ");
  await autoClassify(conv.id, userText, conv.status);

  // 3. Buscar histórico
  const history = await prisma.message.findMany({
    where: { conversationId: conv.id },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  // 4. RAG context
  const ragContext = await retrieveContext(userText, agentSession.id);

  // 5. Montar system prompt com RAG
  let systemPrompt = agentSession.systemPrompt;
  if (ragContext) {
    systemPrompt += `\n\n--- BASE DE CONHECIMENTO ---\n${ragContext}\n--- FIM DA BASE ---`;
  }

  // 6. Salvar msgs do usuário no DB
  for (const msg of msgs) {
    await prisma.message.upsert({
      where: { providerMsgId: msg.id },
      update: {},
      create: {
        conversationId: conv.id,
        role: "user",
        content: msg.text,
        providerMsgId: msg.id,
      },
    });
  }

  // 7. Chamar LLM
  const chatHistory = [
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ...msgs.map((m) => ({ role: "user" as const, content: m.text })),
  ];

  console.log(JSON.stringify({ event: "flush.sending", conversationId: conv.id }));

  let reply: string;
  try {
    reply = await chat(systemPrompt, chatHistory, agentSession.model, agentSession.temperature);
  } catch (e) {
    console.error(JSON.stringify({ event: "flush.llm_failed", err: String(e) }));
    return;
  }

  // 8. Salvar resposta
  await prisma.message.create({
    data: { conversationId: conv.id, role: "assistant", content: reply },
  });

  // 9. Enviar pelo Evolution API
  const externalId = msgs[0]?.contactId;
  if (!externalId) {
    console.error(JSON.stringify({ event: "flush.no_external_id", conversationId: conv.id }));
    return;
  }

  try {
    console.log(JSON.stringify({ event: "flush.sending_whatsapp", externalId }));
    await sendTextEvolution(externalId, reply);
    console.log(JSON.stringify({ event: "flush.sent_ok", conversationId: conv.id, externalId }));
  } catch (e) {
    console.error(JSON.stringify({ event: "flush.send_failed", err: String(e), conversationId: conv.id }));
  }
}
