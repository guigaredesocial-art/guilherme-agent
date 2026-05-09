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

  const { ensureEvolutionInstance, fetchProfilePicture } = await import("@/lib/channels/evolution");
  try {
    const state = await ensureEvolutionInstance();
    console.log(JSON.stringify({ event: "channel.ensure_ok", channel: "evolution", state }));
  } catch (err) {
    console.error(JSON.stringify({ event: "channel.ensure_failed", channel: "evolution", err: String(err) }));
  }

  // Buscar foto de perfil em background para contatos sem foto
  setTimeout(async () => {
    try {
      const contacts = await prisma.contactIdentity.findMany({
        where: { channel: "evolution", contact: { photoUrl: null } },
        include: { contact: true },
        take: 50,
      });
      console.log(JSON.stringify({ event: "photo_backfill.start", total: contacts.length }));
      let updated = 0;
      for (const ci of contacts) {
        try {
          const url = await fetchProfilePicture(ci.externalId);
          if (url) {
            await prisma.contact.update({ where: { id: ci.contactId }, data: { photoUrl: url } as any });
            updated++;
          }
          // Pequena pausa para não sobrecarregar a Evolution API
          await new Promise((r) => setTimeout(r, 300));
        } catch {
          // ignora erro individual
        }
      }
      console.log(JSON.stringify({ event: "photo_backfill.done", updated, total: contacts.length }));
    } catch (err) {
      console.error(JSON.stringify({ event: "photo_backfill.failed", err: String(err) }));
    }
  }, 5000); // aguarda 5s após o startup para não disputar recursos
}
