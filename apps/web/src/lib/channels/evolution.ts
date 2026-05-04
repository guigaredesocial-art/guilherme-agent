export type SessionState = "NOT_CREATED" | "STOPPED" | "STARTING" | "SCAN_QR" | "WORKING" | "FAILED";

const BASE = () => process.env.EVOLUTION_BASE_URL!;
const HEADERS = () => ({
  "apikey": process.env.EVOLUTION_API_KEY!,
  "content-type": "application/json",
});
const INSTANCE = () => process.env.EVOLUTION_INSTANCE ?? "robo_vendas";
const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL!;

export async function ensureEvolutionInstance(): Promise<SessionState> {
  const name = INSTANCE();
  const base = BASE();
  const headers = HEADERS();

  // 1. GET primeiro — nunca POST cego
  const listRes = await fetch(`${base}/instance/fetchInstances?instanceName=${name}`, { headers });
  const list = await listRes.json().catch(() => []);
  const exists = Array.isArray(list) && list.length > 0;

  if (!exists) {
    const r = await fetch(`${base}/instance/create`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        instanceName: name,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        groupsIgnore: false,
        alwaysOnline: true,
      }),
    });
    if (!r.ok && ![403, 409].includes(r.status)) {
      console.error(JSON.stringify({ event: "evolution.create_failed", status: r.status }));
    }
  }

  // 2. Reconfigurar webhook SEMPRE (URL muda em redeploy)
  // Evolution API v2: body plano — não usar objeto aninhado "webhook" (400 na v2).
  await fetch(`${base}/webhook/set/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      enabled: true,
      url: `${APP_URL()}/api/webhooks/evolution`,
      webhookByEvents: false,
      webhookBase64: true,
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
    }),
  }).catch((e) => console.error(JSON.stringify({ event: "evolution.webhook_set_failed", err: String(e) })));

  return await getEvolutionState();
}

export async function getEvolutionState(): Promise<SessionState> {
  const name = INSTANCE();
  try {
    const res = await fetch(`${BASE()}/instance/connectionState/${name}`, { headers: HEADERS() });
    const data = await res.json();
    const state: string = data?.instance?.state ?? "close";
    const map: Record<string, SessionState> = {
      open: "WORKING",
      connecting: "SCAN_QR",
      close: "STOPPED",
    };
    return map[state] ?? "FAILED";
  } catch {
    return "FAILED";
  }
}

export async function getEvolutionQR(): Promise<string | null> {
  const name = INSTANCE();
  try {
    const res = await fetch(`${BASE()}/instance/connect/${name}`, { headers: HEADERS() });
    const data = await res.json();
    return data?.qrcode?.base64 ?? data?.base64 ?? null;
  } catch {
    return null;
  }
}

export async function sendTextEvolution(externalId: string, text: string): Promise<void> {
  // externalId deve conter @ (ex: 5571...@c.us ou @lid)
  if (!externalId.includes("@")) {
    console.error(JSON.stringify({ event: "evolution.send_invalid_id", externalId }));
    throw new Error(`sendText: externalId inválido (${externalId}) — deve conter @`);
  }
  const res = await fetch(`${BASE()}/message/sendText/${INSTANCE()}`, {
    method: "POST",
    headers: HEADERS(),
    body: JSON.stringify({ number: externalId, textMessage: { text } }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(JSON.stringify({ event: "evolution.send_failed", status: res.status, body }));
    throw new Error(`sendText failed: ${res.status}`);
  }
  console.log(JSON.stringify({ event: "evolution.send_ok", externalId }));
}
