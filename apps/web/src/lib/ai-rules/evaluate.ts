import { prisma } from "@/lib/prisma";
import type { AgentSession, AIRule, Conversation } from "@prisma/client";

export interface ChannelMessage {
  id: string;
  contactId: string; // externalId (ex: 5571...@c.us)
  text: string;
  timestamp: Date;
  mediaUrl?: string; // data URI para áudio/imagem (base64) ou URL remota
}

export type Decision =
  | { action: "respond"; agentSession: AgentSession }
  | { action: "drop"; reason: string }
  | { action: "handoff"; reason: string }
  | { action: "static_reply"; text: string };

export async function decideAction(
  msgs: ChannelMessage[],
  conv: Conversation
): Promise<Decision> {
  if (!conv.aiEnabled) return { action: "drop", reason: "conversation.aiEnabled=false" };

  const agentSession = conv.agentSessionId
    ? await prisma.agentSession.findUnique({ where: { id: conv.agentSessionId } })
    : await prisma.agentSession.findFirst({ where: { isDefault: true } });

  if (!agentSession) return { action: "drop", reason: "no_default_agent_session" };

  const rules = await prisma.aIRule.findMany({
    where: { agentSessionId: agentSession.id, enabled: true },
    orderBy: { priority: "asc" },
  });

  for (const rule of rules) {
    if (!evaluateRule(rule, msgs, conv)) continue;
    if (rule.action === "respond") return { action: "respond", agentSession };
    if (rule.action === "drop") return { action: "drop", reason: `rule:${rule.id}` };
    if (rule.action === "handoff") return { action: "handoff", reason: `rule:${rule.id}` };
    if (rule.action === "static_reply") return { action: "static_reply", text: rule.staticReply ?? "" };
  }

  // default: always_on
  return { action: "respond", agentSession };
}

function evaluateRule(rule: AIRule, msgs: ChannelMessage[], conv: Conversation): boolean {
  const p = rule.params as Record<string, unknown>;
  switch (rule.mode) {
    case "always_on": return true;
    case "keyword_trigger": {
      const keywords: string[] = (p.keywords as string[]) ?? [];
      const text = msgs.map((m) => m.text.toLowerCase()).join(" ");
      return keywords.some((k) => text.includes(k.toLowerCase()));
    }
    case "keyword_pause": {
      const keywords: string[] = (p.keywords as string[]) ?? [];
      const text = msgs.map((m) => m.text.toLowerCase()).join(" ");
      return !keywords.some((k) => text.includes(k.toLowerCase()));
    }
    default: return false;
  }
}
