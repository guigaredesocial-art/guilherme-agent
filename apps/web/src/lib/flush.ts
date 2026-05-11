import { prisma } from "@/lib/prisma";
import { chat } from "@/lib/llm/anthropic";
import { retrieveContext } from "@/lib/rag";
import { decideAction, type ChannelMessage } from "@/lib/ai-rules/evaluate";
import { sendTextEvolution, sendMediaEvolution } from "@/lib/channels/evolution";
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

    // Score aditivo — múltiplos fatores somam
    const finalTags = mergedTags;
    const finalStatus = newStatus ?? currentStatus;
    let score = 0;
    if (finalTags.includes("🔥 quente"))      score += 40;
    if (finalTags.includes("📅 agendamento")) score += 25;
    if (finalTags.includes("💰 preço"))       score += 20;
    if (finalTags.includes("❓ dúvida"))       score += 10;
    if (finalTags.includes("❄️ frio"))         score -= 30;
    if (finalStatus === "reuniao_agendada")   score += 30;
    else if (finalStatus === "qualificado")   score += 15;
    else if (finalStatus === "fechado")       score = 100;
    else if (finalStatus === "perdido")       score = Math.min(score, 5);
    score = Math.max(0, Math.min(100, score));

    // Buscar lead associado para atualizar score e cancelar drips
    const lead = await prisma.lead.findFirst({
      where: { conversationId: convId } as any,
    });
    if (lead) {
      await prisma.lead.update({
        where: { id: (lead as any).id },
        data: { leadScore: score } as any,
      });

      // Cliente respondeu → cancela drip D+1 (não spamear quem está falando)
      await (prisma as any).dripMessage.updateMany({
        where: { leadId: (lead as any).id, step: 1, status: "pending" },
        data: { status: "cancelled" },
      });

      // Lead quente (score>=70) → cancela TODOS os drips pendentes
      if (score >= 70) {
        await (prisma as any).dripMessage.updateMany({
          where: { leadId: (lead as any).id, status: "pending" },
          data: { status: "cancelled" },
        });
        console.log(JSON.stringify({ event: "drip.cancelled_hot", leadId: (lead as any).id, score }));
      }
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

  // 2a. Checar horário de funcionamento
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bh = agentSession as any;
  if (bh.businessHoursEnabled) {
    // Converter para horário de Brasília (UTC-3)
    const now = new Date();
    const brTime = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const hour = brTime.getUTCHours();
    const day = brTime.getUTCDay(); // 0=Dom, 1=Seg ... 6=Sáb
    const allowedDays: number[] = (bh.businessDays ?? "1,2,3,4,5")
      .split(",")
      .map((d: string) => parseInt(d.trim()));

    const isOutside =
      !allowedDays.includes(day) ||
      hour < (bh.businessHoursStart ?? 9) ||
      hour >= (bh.businessHoursEnd ?? 18);

    if (isOutside) {
      const bhMsg: string =
        bh.businessHoursMsg ||
        "Olá! Nosso atendimento funciona de segunda a sexta, das 9h às 18h. Em breve retornamos! 😊";

      // Buscar histórico para evitar repetir a mensagem de fora de horário
      const lastMsgs = await prisma.message.findMany({
        where: { conversationId: conv.id },
        orderBy: { createdAt: "desc" },
        take: 3,
      });
      const alreadySent = lastMsgs.some(
        (m) => m.role === "assistant" && m.content === bhMsg
      );

      if (!alreadySent) {
        const externalId = msgs[0]?.contactId;
        if (externalId) {
          await sendTextEvolution(externalId, bhMsg);
          await prisma.message.create({
            data: { conversationId: conv.id, role: "assistant", content: bhMsg },
          });
          console.log(JSON.stringify({ event: "business_hours.outside", convId: conv.id, hour, day }));
        }
      }
      return;
    }
  }

  // 2b. Auto-classificar tags e status com base na mensagem do usuário
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

  // 5. Montar system prompt com RAG e Provas Sociais
  let systemPrompt = agentSession.systemPrompt;
  if (ragContext) {
    systemPrompt += `\n\n--- BASE DE CONHECIMENTO ---\n${ragContext}\n--- FIM DA BASE ---`;
  }

  // Injetar provas sociais disponíveis
  let socialProofs: any[] = [];
  try {
    socialProofs = await (prisma as any).socialProof.findMany({ orderBy: { createdAt: "asc" } });
  } catch { /* tabela pode não existir ainda */ }
  if (socialProofs.length > 0) {
    systemPrompt += `\n\n--- PROVAS SOCIAIS DISPONÍVEIS ---
Você pode enviar fotos ou vídeos de prova social para quebrar objeções e gerar confiança.
Quando identificar o momento certo (cliente pediu prova, resultado, foto, depoimento, está desconfiante ou em dúvida sobre eficácia), inclua EXATAMENTE este código no FINAL da sua mensagem (em linha separada):
[PROVA_SOCIAL:ID_AQUI]

Provas disponíveis:
${socialProofs.map((p: any) => `• ID: ${p.id} | Nome: "${p.name}" | Tipo: ${p.mediaType} | Legenda: "${p.caption}" | Quando usar: ${p.triggerHint || "a seu critério"}`).join("\n")}

IMPORTANTE: Use no máximo 1 prova por mensagem. Só use quando for realmente oportuno. Não force.
--- FIM DAS PROVAS SOCIAIS ---`;
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
        ...(msg.mediaUrl ? { mediaUrl: msg.mediaUrl } as any : {}),
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

  // Detectar marcador de prova social no reply
  const proofMatch = reply.match(/\[PROVA_SOCIAL:([^\]]+)\]/);
  const cleanReply = reply.replace(/\[PROVA_SOCIAL:[^\]]*\]/g, "").trim();

  try {
    console.log(JSON.stringify({ event: "flush.sending_whatsapp", externalId }));
    // Se o bot responder, comentamos o envio para que a mensagem fique apenas como SUGESTÃO interna
    if (cleanReply) {
      // DESATIVADO: AI agora é apenas Gerente/Copiloto. Não responde o cliente diretamente.
      // await sendTextEvolution(externalId, cleanReply);
      console.log(JSON.stringify({ event: "flush.suggestion_saved_not_sent", externalId }));
    }

    // Se havia prova social, também não envia automaticamente
    if (proofMatch) {
      const proofId = proofMatch[1].trim();
      const proof = await (prisma as any).socialProof.findUnique({ where: { id: proofId } });
      if (proof) {
        // await sendMediaEvolution(
        //   externalId,
        //   proof.mediaUrl,
        //   proof.mediaType as "image" | "video" | "document",
        //   proof.caption
        // );
        console.log(JSON.stringify({ event: "flush.social_proof_suggestion_saved", proofId, proofName: proof.name }));
      } else {
        console.error(JSON.stringify({ event: "flush.social_proof_not_found", proofId }));
      }
    }

    console.log(JSON.stringify({ event: "flush.sent_ok", conversationId: conv.id, externalId }));
  } catch (e) {
    console.error(JSON.stringify({ event: "flush.send_failed", err: String(e), conversationId: conv.id }));
  }
}
