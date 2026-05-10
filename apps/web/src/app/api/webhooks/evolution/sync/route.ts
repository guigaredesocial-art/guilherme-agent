import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const BASE = () => process.env.EVOLUTION_BASE_URL!;
const HEADERS = () => ({
  "apikey": process.env.EVOLUTION_API_KEY!,
  "content-type": "application/json",
});
const INSTANCE = () => process.env.EVOLUTION_INSTANCE ?? "robo_vendas";
const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL!;
const SECRET = () => process.env.EVOLUTION_WEBHOOK_SECRET ?? "";

export async function POST(req: NextRequest) {
  try {
    // Basic auth check to prevent abuse
    const auth = req.headers.get("authorization");
    if (SECRET() && auth !== `Bearer ${SECRET()}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    console.log("[Sync] Fetching chats from Evolution API...");
    
    // 1. Fetch all chats
    const chatsRes = await fetch(`${BASE()}/chat/findChats/${INSTANCE()}`, {
      method: "POST",
      headers: HEADERS(),
      body: JSON.stringify({}),
    });

    if (!chatsRes.ok) {
      return Response.json({ error: "Failed to fetch chats", status: chatsRes.status });
    }

    const chats = await chatsRes.json();
    if (!Array.isArray(chats)) {
      return Response.json({ error: "Invalid chats response", data: chats });
    }

    // Filter chats with unread messages
    const unreadChats = chats.filter(c => c.unreadCount > 0);
    console.log(`[Sync] Found ${unreadChats.length} chats with unread messages.`);

    let syncedMessages = 0;

    // 2. Fetch messages for each unread chat
    for (const chat of unreadChats) {
      const remoteJid = chat.id || chat.remoteJid;
      if (!remoteJid || remoteJid.includes("@g.us")) continue; // Skip groups for now

      console.log(`[Sync] Fetching messages for ${remoteJid}...`);
      
      const msgsRes = await fetch(`${BASE()}/chat/findMessages/${INSTANCE()}`, {
        method: "POST",
        headers: HEADERS(),
        body: JSON.stringify({
          where: { key: { remoteJid } }
        }),
      });

      if (!msgsRes.ok) continue;

      const result = await msgsRes.json();
      const messages = result?.messages?.records || result?.records || result || [];
      
      if (!Array.isArray(messages)) continue;

      // Filter to only messages from the user (fromMe: false) that have actual content
      const missedMsgs = messages.filter((m: any) => 
        m.key && 
        m.key.fromMe === false && 
        m.message
      );

      for (const msg of missedMsgs) {
        // Check if message is already in our DB
        const exists = await prisma.message.findUnique({
          where: { providerMsgId: msg.key.id }
        });

        if (!exists) {
          console.log(`[Sync] Syncing missed message: ${msg.key.id}`);
          
          // Reconstruct webhook payload
          const payload = {
            event: "MESSAGES_UPSERT",
            instance: INSTANCE(),
            data: {
              key: msg.key,
              pushName: msg.pushName || chat.name || remoteJid,
              message: msg.message,
              messageType: msg.messageType,
              base64: msg.base64 // if any
            }
          };

          // Trigger our own webhook locally
          await fetch(`${APP_URL()}/api/webhooks/evolution`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SECRET()}`
            },
            body: JSON.stringify(payload)
          }).catch(e => console.error(`[Sync] Failed to trigger webhook:`, e));

          syncedMessages++;
        }
      }
    }

    return Response.json({ ok: true, syncedMessages, unreadChatsProcessed: unreadChats.length });

  } catch (error: any) {
    console.error("[Sync] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
