import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return _client;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function chat(
  systemPrompt: string,
  history: ChatMessage[],
  model = "claude-sonnet-4-6",
  temperature = 0.7
): Promise<string> {
  const client = getClient();

  const response = await client.messages.create({
    model,
    max_tokens: 300, // curto — agente de vendas via WhatsApp
    temperature,
    system: systemPrompt,
    messages: history,
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
