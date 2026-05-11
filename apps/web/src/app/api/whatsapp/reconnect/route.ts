import { refreshEvolutionQR } from "@/lib/channels/evolution";

/**
 * POST /api/whatsapp/reconnect
 * Faz logout da sessão expirada, reinicia a instância e devolve um novo QR code.
 */
export async function POST() {
  try {
    const { qr, state } = await refreshEvolutionQR();
    return Response.json({ ok: true, state, qr });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
