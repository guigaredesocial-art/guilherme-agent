import { prisma } from "@/lib/prisma";
import { chat } from "@/lib/llm/anthropic";
import { retrieveContext } from "@/lib/rag";
import { decideAction, type ChannelMessage } from "@/lib/ai-rules/evaluate";
import { sendTextEvolution } from "@/lib/channels/evolution";
import type { Conversation } from "@prisma/client";

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

  // 2. Buscar histórico
  const history = await prisma.message.findMany({
    where: { conversationId: conv.id },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  // 3. RAG context
  const queryText = msgs.map((m) => m.text).join(" ");
  const ragContext = await retrieveContext(queryText, agentSession.id);

  // 4. Montar system prompt com RAG
  let systemPrompt = agentSession.systemPrompt;
  if (ragContext) {
    systemPrompt += `\n\n--- BASE DE CONHECIMENTO ---\n${ragContext}\n--- FIM DA BASE ---`;
  }

  // 5. Salvar msgs do usuário no DB
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

  // 6. Chamar LLM
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

  // 7. Salvar resposta
  await prisma.message.create({
    data: { conversationId: conv.id, role: "assistant", content: reply },
  });

  // 8. Enviar pelo Evolution API
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
