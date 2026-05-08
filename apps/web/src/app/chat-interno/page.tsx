"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";

interface Msg { role: "user" | "assistant"; content: string }

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

export default function ChatInternoPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) router.push("/");
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");

    const newMessages: Msg[] = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);
    setLoading(true);

    const token = getToken();
    try {
      const res = await fetch("/api/chat-interno", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
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
      <div className="chat-screen">
        {/* Header */}
        <div style={{ marginBottom: "1rem", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent-dim)", border: "1px solid #adff2f40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>
              🧠
            </div>
            <div>
              <h1 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Chat Interno — Guilherme</h1>
              <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: 0 }}>Assistente de estratégia e vendas · não vai para o WhatsApp</p>
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
                <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Estratégia, abordagens, mensagens, análise de leads…</div>
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

        {/* Input */}
        <div style={{ display: "flex", gap: "0.625rem", flexShrink: 0 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Pergunte sobre estratégia, clientes, mensagens..."
            className="input"
            style={{ flex: 1, padding: "0.625rem 1rem" }}
            disabled={loading}
          />
          <button onClick={() => send()} className="btn-primary" disabled={loading || !input.trim()}>
            {loading ? "..." : "Enviar"}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
