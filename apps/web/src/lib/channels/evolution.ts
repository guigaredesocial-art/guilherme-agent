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

/** Faz logout da sessão expirada (limpa credenciais salvas) */
export async function logoutEvolutionInstance(): Promise<boolean> {
  const name = INSTANCE();
  try {
    const res = await fetch(`${BASE()}/instance/logout/${name}`, {
      method: "DELETE",
      headers: HEADERS(),
    });
    console.log(JSON.stringify({ event: "evolution.logout", status: res.status }));
    return res.ok || res.status === 404;
  } catch (e) {
    console.error(JSON.stringify({ event: "evolution.logout_failed", err: String(e) }));
    return false;
  }
}

/** Logout + restart + retorna novo QR code base64 */
export async function refreshEvolutionQR(): Promise<{ qr: string | null; state: SessionState }> {
  const name = INSTANCE();
  const base = BASE();
  const headers = HEADERS();

  // 1. Logout para limpar sessão expirada
  await logoutEvolutionInstance().catch(() => {});

  // Aguarda 1.5s para Evolution processar
  await new Promise((r) => setTimeout(r, 1500));

  // 2. Restart da instância
  try {
    await fetch(`${base}/instance/restart/${name}`, { method: "PUT", headers });
  } catch { /* ignora */ }

  await new Promise((r) => setTimeout(r, 1500));

  // 3. Reconecta e busca QR
  try {
    const res = await fetch(`${base}/instance/connect/${name}`, { headers });
    const data = await res.json();
    const qr = data?.qrcode?.base64 ?? data?.base64 ?? null;
    const state = await getEvolutionState();
    return { qr, state };
  } catch {
    return { qr: null, state: "FAILED" };
  }
}

export async function fetchProfilePicture(externalId: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE()}/chat/fetchProfilePictureUrl/${INSTANCE()}`, {
      method: "POST",
      headers: HEADERS(),
      body: JSON.stringify({ number: externalId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.profilePictureUrl ?? data?.picture ?? null;
  } catch {
    return null;
  }
}

export async function sendMediaEvolution(
  externalId: string,
  mediaUrl: string,
  mediaType: "image" | "video" | "document",
  caption = ""
): Promise<void> {
  if (!externalId.includes("@")) {
    throw new Error(`sendMedia: externalId inválido (${externalId})`);
  }
  const res = await fetch(`${BASE()}/message/sendMedia/${INSTANCE()}`, {
    method: "POST",
    headers: HEADERS(),
    body: JSON.stringify({
      number: externalId,
      mediaMessage: {
        mediaType,
        fileName: mediaType === "image" ? "prova.jpg" : mediaType === "video" ? "video.mp4" : "arquivo.pdf",
        caption,
        media: mediaUrl,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(JSON.stringify({ event: "evolution.sendMedia_failed", status: res.status, body }));
    throw new Error(`sendMedia failed: ${res.status}`);
  }
  console.log(JSON.stringify({ event: "evolution.sendMedia_ok", externalId, mediaType }));
}

export async function sendTextEvolution(externalId: string, text: string): Promise<void> {
  if (!externalId.includes("@")) {
    console.error(JSON.stringify({ event: "evolution.send_invalid_id", externalId }));
    throw new Error(`sendText: externalId inválido (${externalId}) — deve conter @`);
  }
  const res = await fetch(`${BASE()}/message/sendText/${INSTANCE()}`, {
    method: "POST",
    headers: HEADERS(),
    body: JSON.stringify({ 
      number: externalId, 
      textMessage: { text }, 
      options: { delay: 1200, presence: "composing" } 
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(JSON.stringify({ event: "evolution.send_failed", status: res.status, body, originalId: externalId }));
    throw new Error(`sendText failed: ${res.status}`);
  }
  console.log(JSON.stringify({ event: "evolution.send_ok", number: externalId }));
}
