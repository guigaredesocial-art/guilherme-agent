import { ensureEvolutionInstance } from "@/lib/channels/evolution";

export async function POST() {
  try {
    const state = await ensureEvolutionInstance();
    return Response.json({ ok: true, state });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
