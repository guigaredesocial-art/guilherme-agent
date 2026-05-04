export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { prisma } = await import("@/lib/prisma");

  try {
    const { execSync } = require("child_process");
    console.log("Running prisma db push...");
    execSync("npx -y prisma@6.8.2 db push --accept-data-loss", { stdio: "inherit" });
    console.log("Prisma db push done.");

    // Seed: Ensure AgentSession exists
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
      console.log("✅ Seed: Agente Guilherme criado");
    } else {
      // Fix invalid/deprecated model name if it exists
      await prisma.agentSession.updateMany({
        where: { model: "claude-3-5-sonnet-20241022" },
        data: { model: "claude-sonnet-4-6" }
      });
    }
  } catch (err) {
    console.error("Prisma init failed in instrumentation:", err);
  }

  // Aplicar migrações incrementais de forma idempotente
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'em_atendimento'`
    );

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "MessageFeedback" (
        "id" TEXT NOT NULL,
        "messageId" TEXT NOT NULL,
        "rating" TEXT NOT NULL,
        "correction" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MessageFeedback_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "MessageFeedback_messageId_key" ON "MessageFeedback"("messageId")`
    );
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "MessageFeedback" ADD CONSTRAINT "MessageFeedback_messageId_fkey"
          FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Lead" (
        "id" TEXT NOT NULL,
        "conversationId" TEXT NOT NULL,
        "contactId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "whatsapp" TEXT NOT NULL DEFAULT '',
        "businessType" TEXT,
        "painPoint" TEXT,
        "monthlyVolume" TEXT,
        "currentTool" TEXT,
        "meetingDate" TIMESTAMP(3),
        "notes" TEXT,
        "status" TEXT NOT NULL DEFAULT 'novo',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "Lead_conversationId_key" ON "Lead"("conversationId")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Lead_contactId_idx" ON "Lead"("contactId")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Lead_status_idx" ON "Lead"("status")`
    );
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "Lead" ADD CONSTRAINT "Lead_conversationId_fkey"
          FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "Lead" ADD CONSTRAINT "Lead_contactId_fkey"
          FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    // Novas colunas: tags, follow-up, lembrete de reunião
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "tags" TEXT NOT NULL DEFAULT ''`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "lastUserMsgAt" TIMESTAMP(3)`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "followupSentAt" TIMESTAMP(3)`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3)`
    );

    // Origem, cidade, próxima ação, score e drip
    await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "city" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "leadSource" TEXT NOT NULL DEFAULT 'organico'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "nextAction" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "leadScore" INTEGER NOT NULL DEFAULT 0`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DripMessage" (
        "id" TEXT NOT NULL,
        "leadId" TEXT NOT NULL,
        "step" INTEGER NOT NULL,
        "message" TEXT NOT NULL,
        "scheduledAt" TIMESTAMP(3) NOT NULL,
        "sentAt" TIMESTAMP(3),
        "status" TEXT NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DripMessage_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DripMessage_leadId_idx" ON "DripMessage"("leadId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DripMessage_status_scheduledAt_idx" ON "DripMessage"("status", "scheduledAt")`);
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "DripMessage" ADD CONSTRAINT "DripMessage_leadId_fkey"
          FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    // Fase 3-D: Multiusuário
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Operator" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'operator'`
    );
    // Promover o operador mais antigo a admin automaticamente
    await prisma.$executeRawUnsafe(`
      UPDATE "Operator" SET "role" = 'admin'
      WHERE "id" = (SELECT "id" FROM "Operator" ORDER BY "createdAt" ASC LIMIT 1)
        AND "role" = 'operator'
    `);

    // Fase 3-A: Horário de funcionamento
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "AgentSession" ADD COLUMN IF NOT EXISTS "businessHoursEnabled" BOOLEAN NOT NULL DEFAULT false`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "AgentSession" ADD COLUMN IF NOT EXISTS "businessHoursStart" INTEGER NOT NULL DEFAULT 9`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "AgentSession" ADD COLUMN IF NOT EXISTS "businessHoursEnd" INTEGER NOT NULL DEFAULT 18`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "AgentSession" ADD COLUMN IF NOT EXISTS "businessDays" TEXT NOT NULL DEFAULT '1,2,3,4,5'`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "AgentSession" ADD COLUMN IF NOT EXISTS "businessHoursMsg" TEXT NOT NULL DEFAULT 'Olá! Nosso atendimento funciona de segunda a sexta, das 9h às 18h. Em breve retornamos! 😊'`
    );

    // Fase 2: notas internas e tabela de lembretes
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "internalNotes" TEXT NOT NULL DEFAULT ''`
    );

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Reminder" (
        "id" TEXT NOT NULL,
        "conversationId" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "scheduledAt" TIMESTAMP(3) NOT NULL,
        "sentAt" TIMESTAMP(3),
        "status" TEXT NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Reminder_conversationId_idx" ON "Reminder"("conversationId")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Reminder_status_scheduledAt_idx" ON "Reminder"("status", "scheduledAt")`
    );
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_conversationId_fkey"
          FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    console.log(JSON.stringify({ event: "migrations.ok" }));
  } catch (err) {
    console.error(JSON.stringify({ event: "migrations.failed", err: String(err) }));
  }

  const { ensureEvolutionInstance } = await import("@/lib/channels/evolution");
  try {
    const state = await ensureEvolutionInstance();
    console.log(JSON.stringify({ event: "channel.ensure_ok", channel: "evolution", state }));
  } catch (err) {
    console.error(JSON.stringify({ event: "channel.ensure_failed", channel: "evolution", err: String(err) }));
  }

  // ── Follow-up automático: roda a cada 2 minutos ───────────────────────────
  const { sendTextEvolution } = await import("@/lib/channels/evolution");

  setInterval(async () => {
    try {
      const now = new Date();
      const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      const thirtyMinFromNow = new Date(now.getTime() + 30 * 60 * 1000);

      // 1. Bot enviou, cliente não respondeu há 10min
      const aguardando = await prisma.conversation.findMany({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        where: {
          aiEnabled: true,
          status: { notIn: ["encerrado"] },
          followupSentAt: null,
          lastUserMsgAt: { not: null },
        } as any,
        include: {
          contact: { include: { identities: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });
      for (const conv of aguardando) {
        const last = conv.messages[0];
        if (!last || last.role !== "assistant") continue;
        if (last.createdAt > tenMinAgo) continue;
        const extId = conv.contact.identities[0]?.externalId;
        if (!extId) continue;
        try {
          await sendTextEvolution(extId, "Oi! Ainda estou aqui 😊 Ficou alguma dúvida?");
          await prisma.conversation.update({ where: { id: conv.id }, data: { followupSentAt: now } as any });
          console.log(JSON.stringify({ event: "followup.10m", convId: conv.id }));
        } catch { /* ignore */ }
      }

      // 2. Cliente sumiu há 24h sem fechar
      const sumidas = await prisma.conversation.findMany({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        where: {
          aiEnabled: true,
          status: { in: ["qualificado", "em_atendimento"] },
          updatedAt: { lt: oneDayAgo },
          OR: [{ followupSentAt: null }, { followupSentAt: { lt: oneDayAgo } }],
        } as any,
        include: { contact: { include: { identities: true } } },
      });
      for (const conv of sumidas) {
        const extId = conv.contact.identities[0]?.externalId;
        if (!extId) continue;
        try {
          await sendTextEvolution(extId, "Oi! Tudo bem? Passando para saber se ainda tem interesse 😊 Qualquer dúvida é só falar!");
          await prisma.conversation.update({ where: { id: conv.id }, data: { followupSentAt: now } as any });
          console.log(JSON.stringify({ event: "followup.24h", convId: conv.id }));
        } catch { /* ignore */ }
      }

      // 3. Enviar lembretes agendados (Reminder table)
      const remindersDevidos = await (prisma as any).reminder.findMany({
        where: { status: "pending", scheduledAt: { lte: now } },
        include: { conversation: { include: { contact: { include: { identities: true } } } } },
      });
      for (const rem of remindersDevidos) {
        const extId = rem.conversation.contact.identities[0]?.externalId;
        if (!extId) continue;
        try {
          await sendTextEvolution(extId, rem.message);
          await (prisma as any).reminder.update({
            where: { id: rem.id },
            data: { status: "sent", sentAt: now },
          });
          console.log(JSON.stringify({ event: "reminder.sent", reminderId: rem.id }));
        } catch { /* ignore */ }
      }

      // 4. Drip sequence (D+1, D+3, D+7)
      const dripDevidos = await (prisma as any).dripMessage.findMany({
        where: { status: "pending", scheduledAt: { lte: now } },
        include: { lead: { include: { conversation: { include: { contact: { include: { identities: true } } } } } } },
      });
      for (const drip of dripDevidos) {
        const extId = drip.lead.conversation?.contact?.identities?.[0]?.externalId;
        if (!extId) continue;
        try {
          await sendTextEvolution(extId, drip.message);
          await (prisma as any).dripMessage.update({
            where: { id: drip.id },
            data: { status: "sent", sentAt: now },
          });
          console.log(JSON.stringify({ event: "drip.sent", dripId: drip.id, step: drip.step }));
        } catch { /* ignore */ }
      }

      // 5. Lembrete de reunião (1h antes)
      const leadsReuniao = await prisma.lead.findMany({
        where: {
          meetingDate: { gte: thirtyMinFromNow, lte: oneHourFromNow },
          reminderSentAt: null,
        },
        include: { conversation: { include: { contact: { include: { identities: true } } } } },
      });
      for (const lead of leadsReuniao) {
        const extId = lead.conversation.contact.identities[0]?.externalId;
        if (!extId || !lead.meetingDate) continue;
        const hora = new Date(lead.meetingDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        try {
          await sendTextEvolution(extId, `Oi ${lead.name}! Lembrando nossa reunião hoje às ${hora} 📅 Qualquer imprevisto me avisa!`);
          await prisma.lead.update({ where: { id: lead.id }, data: { reminderSentAt: now } as any });
          console.log(JSON.stringify({ event: "followup.reminder", leadId: lead.id }));
        } catch { /* ignore */ }
      }
    } catch (err) {
      console.error(JSON.stringify({ event: "followup.error", err: String(err) }));
    }
  }, 2 * 60 * 1000); // a cada 2 minutos
}
