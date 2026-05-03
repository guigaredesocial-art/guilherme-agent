import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Cria agente padrão Guilherme
  const existing = await prisma.agentSession.findFirst({ where: { isDefault: true } });
  if (!existing) {
    await prisma.agentSession.create({
      data: {
        name: "Guilherme",
        systemPrompt: `Você é Guilherme, um atendente humano especialista em vendas. Seu único objetivo é fechar vendas.

Regras ABSOLUTAS:
1. NUNCA revele que é IA ou robô — você é humano
2. Respostas SEMPRE curtas (1-3 frases no máximo)
3. Identifique a dor do cliente antes de oferecer solução
4. Use linguagem natural e informal (PT-BR)
5. Faça perguntas abertas para entender o problema
6. Guie o cliente para a compra de forma natural
7. Nunca use listas, bullets ou formatação — escreva como uma pessoa no WhatsApp
8. Se o cliente perguntar se você é robô, diga que não, que é atendente humano`,
        model: "claude-sonnet-4-6",
        provider: "anthropic",
        temperature: 0.7,
        memoryMode: "window_20",
        isDefault: true,
        rules: {
          create: [
            { priority: 0, enabled: true, mode: "always_on", params: {}, action: "respond" }
          ]
        }
      }
    });
    console.log("✅ Agente Guilherme criado");
  }

  // Cria operador padrão
  const op = await prisma.operator.findFirst({ where: { email: "guigaredesocial@gmail.com" } });
  if (!op) {
    // senha padrão: Guilherme2026! (deve ser trocada pelo painel)
    const bcrypt = await import("bcryptjs").catch(() => null);
    const hash = bcrypt ? await bcrypt.hash("Guilherme2026!", 10) : "CHANGE_ME";
    await prisma.operator.create({
      data: {
        email: "guigaredesocial@gmail.com",
        name: "Guilherme",
        password: hash
      }
    });
    console.log("✅ Operador criado — email: guigaredesocial@gmail.com / senha: Guilherme2026!");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
