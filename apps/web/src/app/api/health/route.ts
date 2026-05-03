import { getEvolutionState } from "@/lib/channels/evolution";

export async function GET() {
  const evolutionState = await getEvolutionState().catch(() => "UNKNOWN");
  return Response.json({
    ok: true,
    ts: new Date().toISOString(),
    evolution: evolutionState,
  });
}
