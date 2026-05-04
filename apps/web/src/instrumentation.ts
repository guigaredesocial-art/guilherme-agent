export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { prisma } = await import("@/lib/prisma");

  try {
    const { execSync } = require("child_process");
    console.log("Running prisma db push...");
    execSync("npx -y prisma db push --accept-data-loss", { stdio: "inherit" });
    console.log("Prisma db push done.");
  } catch (err) {
    console.error("Prisma db push failed in instrumentation:", err);
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
}
