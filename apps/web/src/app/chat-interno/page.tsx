"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";

interface AttachmentPreview { name: string; url: string; mimeType: string }
interface Attachment { name: string; mimeType: string; base64: string }
interface Msg {
  role: "user" | "assistant";
  content: string;
  previews?: AttachmentPreview[];
}

function getToken() {
  return document.cookie.split(";").find((c) => c.trim().startsWith("token="))?.split("=")[1] ?? "";
}

const SUGESTOES = [
  "Como posso melhorar minha abordagem de vendas?",
  "Me ajuda a escrever uma mensagem de follow-up",
  "Quais leads devo priorizar hoje?",
  "Como lidar com cliente que sumiu?",
  "Me dá uma estratégia para fechar mais rápido",
];

const ACCEPTED = "image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain";
const MAX_FILE_MB = 5;

export default function ChatInternoPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<AttachmentPreview[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) router.push("/");
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const newAttachments: Attachment[] = [];
    const newPreviews: AttachmentPreview[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        alert(`"${file.name}" é muito grande. Máximo ${MAX_FILE_MB}MB.`);
        continue;
      }
      const base64 = await fileToBase64(file);
      newAttachments.push({ name: file.name, mimeType: file.type, base64 });
      newPreviews.push({
        name: file.name,
        mimeType: file.type,
        url: file.type.startsWith("image/") ? `data:${file.type};base64,${base64}` : "",
      });
    }

    setPendingAttachments((prev) => [...prev, ...newAttachments]);
    setPendingPreviews((prev) => [...prev, ...newPreviews]);
    // reset input so same file pode ser reusado
    e.target.value = "";
  }

  function removeAttachment(idx: number) {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== idx));
    setPendingPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    const hasAttachments = pendingAttachments.length > 0;
    if ((!msg && !hasAttachments) || loading) return;
    setInput("");

    const displayContent = msg || (hasAttachments ? `[${pendingPreviews.map((p) => p.name).join(", ")}]` : "");
    const newMsg: Msg = { role: "user", content: displayContent, previews: hasAttachments ? [...pendingPreviews] : undefined };
    const newMessages: Msg[] = [...messages, newMsg];
    setMessages(newMessages);

    const attachmentsToSend = hasAttachments ? [...pendingAttachments] : [];
    setPendingAttachments([]);
    setPendingPreviews([]);

    setLoading(true);
    const token = getToken();

    // Histórico limpo (sem previews) para enviar à API
    const apiMessages = newMessages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/chat-interno", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, attachments: attachmentsToSend }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erro ao conectar. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      {/* hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <div className="chat-screen">
        {/* Header */}
        <div style={{ marginBottom: "1rem", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent-dim)", border: "1px solid #adff2f40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>
              🧠
            </div>
            <div>
              <h1 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Chat Interno — Guilherme</h1>
              <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: 0 }}>Assistente de estratégia e vendas · não vai para o WhatsApp · aceita imagens e PDFs</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="card" style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem", marginBottom: "0.875rem" }}>
          {messages.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "1.25rem" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🧠</div>
                <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.25rem" }}>Fala comigo sobre negócios</div>
                <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Estratégia, abordagens, mensagens, análise de leads, imagens e PDFs…</div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center", maxWidth: 520 }}>
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    style={{
                      padding: "0.4rem 0.875rem",
                      borderRadius: "9999px",
                      border: "1px solid var(--card-border)",
                      background: "var(--input-bg)",
                      color: "var(--muted-light)",
                      fontSize: "0.78rem",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--card-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted-light)"; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isBot = msg.role === "assistant";
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isBot ? "flex-start" : "flex-end", marginBottom: "0.875rem" }}>
                {isBot && (
                  <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginBottom: "3px", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    🧠 Guilherme
                  </div>
                )}

                {/* Previews de imagem/arquivo (mensagens do usuário) */}
                {msg.previews && msg.previews.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.375rem", justifyContent: "flex-end" }}>
                    {msg.previews.map((p, pi) => (
                      p.mimeType.startsWith("image/") ? (
                        <img
                          key={pi}
                          src={p.url}
                          alt={p.name}
                          style={{ maxWidth: 200, maxHeight: 160, borderRadius: "0.5rem", border: "1px solid #adff2f40", cursor: "pointer", objectFit: "cover" }}
                          onClick={() => window.open(p.url, "_blank")}
                        />
                      ) : (
                        <div key={pi} style={{ padding: "0.4rem 0.75rem", background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: "0.5rem", fontSize: "0.75rem", color: "var(--muted-light)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          📄 {p.name}
                        </div>
                      )
                    ))}
                  </div>
                )}

                {msg.content && (
                  <div
                    style={{
                      maxWidth: "82%",
                      padding: "0.625rem 0.9rem",
                      borderRadius: isBot ? "0.875rem 0.875rem 0.875rem 0.25rem" : "0.875rem 0.875rem 0.25rem 0.875rem",
                      background: isBot ? "var(--msg-bot-bg)" : "var(--accent-dim)",
                      border: `1px solid ${isBot ? "var(--msg-bot-border)" : "#adff2f40"}`,
                      color: isBot ? "var(--foreground)" : "var(--accent)",
                      fontSize: "0.875rem",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {msg.content}
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div style={{ display: "flex", alignItems: "flex-start", marginBottom: "0.875rem" }}>
              <div style={{ padding: "0.625rem 0.9rem", background: "var(--msg-bot-bg)", border: "1px solid var(--msg-bot-border)", borderRadius: "0.875rem 0.875rem 0.875rem 0.25rem", color: "var(--muted)", fontSize: "0.875rem" }}>
                <span style={{ animation: "pulse 1s infinite" }}>...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Pending attachments preview */}
        {pendingPreviews.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem", padding: "0.5rem 0.75rem", background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: "0.625rem", flexShrink: 0 }}>
            {pendingPreviews.map((p, idx) => (
              <div key={idx} style={{ position: "relative" }}>
                {p.mimeType.startsWith("image/") ? (
                  <img
                    src={p.url}
                    alt={p.name}
                    style={{ width: 56, height: 56, objectFit: "cover", borderRadius: "0.375rem", border: "1px solid #adff2f40" }}
                  />
                ) : (
                  <div style={{ width: 56, height: 56, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: "0.375rem", fontSize: "0.6rem", color: "var(--muted)", padding: "0.25rem", textAlign: "center" }}>
                    📄<br />{p.name.length > 8 ? p.name.slice(0, 8) + "…" : p.name}
                  </div>
                )}
                <button
                  onClick={() => removeAttachment(idx)}
                  style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#ff4444", border: "none", color: "#fff", fontSize: "0.65rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ display: "flex", gap: "0.625rem", flexShrink: 0, alignItems: "center" }}>
          {/* Botão de anexo */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            title="Anexar imagem ou PDF"
            style={{
              width: 40, height: 40, borderRadius: "0.5rem",
              border: "1px solid var(--card-border)",
              background: "var(--input-bg)",
              color: "var(--muted-light)",
              fontSize: "1.1rem",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { if (!loading) { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; } }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--card-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted-light)"; }}
          >
            📎
          </button>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Pergunte sobre estratégia, envie uma imagem ou PDF..."
            className="input"
            style={{ flex: 1, padding: "0.625rem 1rem" }}
            disabled={loading}
          />
          <button
            onClick={() => send()}
            className="btn-primary"
            disabled={loading || (!input.trim() && pendingAttachments.length === 0)}
          >
            {loading ? "..." : "Enviar"}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Converte File para base64 puro (sem o prefixo data:...)
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove "data:mime/type;base64," prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
