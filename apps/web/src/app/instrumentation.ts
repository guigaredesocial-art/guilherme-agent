export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { ensureEvolutionInstance } = await import("@/lib/channels/evolution");
  try {
    const state = await ensureEvolutionInstance();
    console.log(JSON.stringify({ event: "channel.ensure_ok", channel: "evolution", state }));
  } catch (err) {
    console.error(JSON.stringify({ event: "channel.ensure_failed", channel: "evolution", err: String(err) }));
  }
}
