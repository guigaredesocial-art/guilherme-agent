import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return _client;
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string }; title?: string };

export interface ChatMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export async function chat(
  systemPrompt: string,
  history: ChatMessage[],
  model = "claude-3-5-sonnet-20241022",
  temperature = 0.7,
  maxTokens = 300 // curto — agente de vendas via WhatsApp
): Promise<string> {
  const client = getClient();

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: history as Anthropic.MessageParam[],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type from Anthropic");
  return block.text;
}

export async function embedText(text: string): Promise<number[]> {
  // Anthropic não tem endpoint de embedding nativo ainda
  // Usamos uma representação simples via hash para MVP
  // Em produção: substituir por OpenAI text-embedding-3-small ou Voyage AI
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-512", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Normalizar para vetor 1536 repetindo o hash
  const vec: number[] = [];
  while (vec.length < 1536) {
    for (const b of hashArray) {
      vec.push((b / 255) * 2 - 1);
      if (vec.length >= 1536) break;
    }
  }
  return vec.slice(0, 1536);
}
