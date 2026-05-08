export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Migrations idempotentes
  const { prisma } = await import("@/lib/prisma");
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT`);
    console.log(JSON.stringify({ event: "migration.ok", column: "Message.mediaUrl" }));
  } catch (err) {
    console.error(JSON.stringify({ event: "migration.failed", err: String(err) }));
  }

  const { ensureEvolutionInstance } = await import("@/lib/channels/evolution");
  try {
    const state = await ensureEvolutionInstance();
    console.log(JSON.stringify({ event: "channel.ensure_ok", channel: "evolution", state }));
  } catch (err) {
    console.error(JSON.stringify({ event: "channel.ensure_failed", channel: "evolution", err: String(err) }));
  }
}
