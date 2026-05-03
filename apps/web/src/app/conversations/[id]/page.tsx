"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";

const STATUS_CFG = {
  em_atendimento: { label: "Em Atendimento", color: "#3b82f6" },
  qualificado:    { label: "Qualificado",     color: "#f59e0b" },
  reuniao_agendada: { label: "Reunião Agendada", color: "#a855f7" },
  encerrado:      { label: "Encerrado",        color: "#22c55e" },
};

interface MsgFeedback { rating: string; correction?: string }
interface Message { id: string; role: string; content: string; createdAt: string; feedback?: MsgFeedback | null }
interface Lead { id: string; name: string; status: string }
interface ConvDetail {
  id: string; aiEnabled: boolean; handoffRequested: boolean; status: string; channel: string;
  contact: { displayName?: string };
  messages: Message[];
  lead?: Lead | null;
}

function getToken() {
  return document.cookie.split(";").find((c) => c.trim().startsWith("token="))?.split("=")[1] ?? "";
}

export default function ConversationPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const [conv, setConv] = useState<ConvDetail | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState<string | null>(null);
  const [correction, setCorrection] = useState("");
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: "", whatsapp: "", businessType: "", painPoint: "", status: "novo" });
  const [savingLead, setSavingLead] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadConv() {
    const token = getToken();
    if (!token) { router.push("/"); return; }
    const res = await fetch(`/api/conversations/${id}`, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await res.json();
    setConv(data);
    if (!leadForm.name && data.contact?.displayName) {
      setLeadForm((prev) => ({ ...prev, name: data.contact.displayName ?? "" }));
    }
  }

  useEffect(() => {
    loadConv();
    const t = setInterval(loadConv, 5000);
    return () => clearInterval(t);
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conv?.messages.length]);

  async function sendReply() {
    if (!reply.trim()) return;
    setSending(true);
    const token = getToken();
    await fetch(`/api/conversations/${id}/reply`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ text: reply }),
    });
    setReply("");
    await loadConv();
    setSending(false);
  }

  async function toggleAI() {
    if (!conv) return;
    const token = getToken();
    await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        aiEnabled: !conv.aiEnabled,
        ...(conv.aiEnabled && { handoffRequested: false }),
      }),
    });
    await loadConv();
  }

  async function setStatus(status: string) {
    const token = getToken();
    await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setConv((prev) => (prev ? { ...prev, status } : prev));
  }

  async function submitFeedback(msgId: string, rating: string) {
    const token = getToken();
    await fetch(`/api/messages/${msgId}/feedback`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ rating, correction: rating === "bad" ? correction : undefined }),
    });
    setFeedbackOpen(null);
    setCorrection("");
    await loadConv();
  }

  async function createLead() {
    if (!leadForm.name.trim()) return;
    setSavingLead(true);
    const token = getToken();
    await fetch("/api/leads", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ ...leadForm, conversationId: id }),
    });
    setShowLeadForm(false);
    await loadConv();
    setSavingLead(false);
  }

  if (!conv) {
    return (
      <DashboardLayout>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
          <p style={{ color: "var(--muted)" }}>Carregando conversa...</p>
        </div>
      </DashboardLayout>
    );
  }

  const statusCfg = STATUS_CFG[conv.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.em_atendimento;

  return (
    <DashboardLayout>
      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "1.5rem 2rem",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ─── Header ─────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.875rem",
            marginBottom: "1rem",
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          <Link href="/dashboard" style={{ color: "var(--muted)", textDecoration: "none", fontSize: "0.8rem", flexShrink: 0 }}>
            ← Voltar
          </Link>

          {/* Avatar + name */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "var(--accent-dim)",
                border: "1px solid #adff2f30",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "0.875rem",
                color: "var(--accent)",
                flexShrink: 0,
              }}
            >
              {(conv.contact?.displayName?.[0] ?? "?").toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{conv.contact?.displayName ?? "Contato"}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Canal: {conv.channel}</div>
            </div>
          </div>

          {/* Status selector */}
          <select
            value={conv.status}
            onChange={(e) => setStatus(e.target.value)}
            style={{
              padding: "0.3rem 2rem 0.3rem 0.75rem",
              borderRadius: "9999px",
              background: `${statusCfg.color}18`,
              color: statusCfg.color,
              border: `1px solid ${statusCfg.color}40`,
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              outline: "none",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(statusCfg.color)}' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 0.625rem center",
            }}
          >
            {Object.entries(STATUS_CFG).map(([key, cfg]) => (
              <option key={key} value={key} style={{ background: "#111", color: "#fff" }}>
                {cfg.label}
              </option>
            ))}
          </select>

          {/* Lead button */}
          {conv.lead ? (
            <Link
              href="/crm"
              style={{
                fontSize: "0.78rem",
                padding: "0.3rem 0.875rem",
                borderRadius: "0.375rem",
                background: "#a855f718",
                color: "#a855f7",
                border: "1px solid #a855f740",
                textDecoration: "none",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              ⭐ Ver Lead
            </Link>
          ) : (
            <button
              onClick={() => setShowLeadForm(true)}
              style={{
                fontSize: "0.78rem",
                padding: "0.3rem 0.875rem",
                borderRadius: "0.375rem",
                background: "#f59e0b18",
                color: "#f59e0b",
                border: "1px solid #f59e0b40",
                cursor: "pointer",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              + Criar Lead
            </button>
          )}

          {/* AI toggle */}
          <button
            onClick={toggleAI}
            style={{
              padding: "0.3rem 0.875rem",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontSize: "0.78rem",
              fontWeight: 600,
              background: conv.aiEnabled ? "#22c55e18" : "#ef444418",
              color: conv.aiEnabled ? "#22c55e" : "#ef4444",
              border: `1px solid ${conv.aiEnabled ? "#22c55e40" : "#ef444440"}`,
              whiteSpace: "nowrap",
            }}
          >
            {conv.handoffRequested ? "✓ Resolver Handoff" : conv.aiEnabled ? "Pausar IA" : "Reativar IA"}
          </button>
        </div>

        {/* ─── Lead form modal ───────── */}
        {showLeadForm && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "#000000aa",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 200,
            }}
          >
            <div
              className="card"
              style={{ width: 420, maxWidth: "90vw" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                <h3 style={{ fontWeight: 700, fontSize: "1rem" }}>Converter em Lead</h3>
                <button onClick={() => setShowLeadForm(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1.25rem" }}>×</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {[
                  { key: "name", label: "Nome *", placeholder: "Nome do lead" },
                  { key: "whatsapp", label: "WhatsApp", placeholder: "55119..." },
                  { key: "businessType", label: "Tipo de negócio", placeholder: "Clínica, e-commerce..." },
                  { key: "painPoint", label: "Dor principal", placeholder: "Atendimento lento, sem CRM..." },
                ].map((f) => (
                  <div key={f.key}>
                    <label style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "4px" }}>
                      {f.label}
                    </label>
                    <input
                      className="input"
                      value={(leadForm as Record<string, string>)[f.key]}
                      onChange={(e) => setLeadForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                    />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "4px" }}>
                    Status inicial
                  </label>
                  <select
                    className="input select"
                    value={leadForm.status}
                    onChange={(e) => setLeadForm((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="novo">Novo</option>
                    <option value="em_negociacao">Em Negociação</option>
                    <option value="reuniao_agendada">Reunião Agendada</option>
                    <option value="fechado">Fechado</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                  <button onClick={createLead} className="btn-primary" disabled={savingLead} style={{ flex: 1 }}>
                    {savingLead ? "Salvando..." : "Criar Lead"}
                  </button>
                  <button onClick={() => setShowLeadForm(false)} className="btn-ghost" style={{ flex: 1 }}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Messages ────────────── */}
        <div
          className="card"
          style={{ flex: 1, overflowY: "auto", marginBottom: "0.875rem", padding: "1rem 1.25rem" }}
        >
          {conv.messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <div className="empty-state-title">Sem mensagens</div>
            </div>
          )}

          {conv.messages.map((msg) => {
            const isBot = msg.role === "assistant";
            const isManual = msg.content.startsWith("[MANUAL]");
            const displayContent = msg.content.replace(/^\[MANUAL\]\s?/, "");

            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isBot ? "flex-end" : "flex-start",
                  marginBottom: "0.875rem",
                }}
              >
                {isManual && (
                  <div style={{ fontSize: "0.68rem", color: "#3b82f6", marginBottom: "3px", paddingRight: "4px" }}>
                    👤 Operador
                  </div>
                )}

                <div
                  style={{
                    maxWidth: "78%",
                    padding: "0.6rem 0.875rem",
                    borderRadius: isBot
                      ? "0.875rem 0.875rem 0.25rem 0.875rem"
                      : "0.875rem 0.875rem 0.875rem 0.25rem",
                    background: isBot
                      ? isManual ? "#1e3a5f" : "#adff2f12"
                      : "#1c1c1c",
                    border: `1px solid ${
                      isBot
                        ? isManual ? "#3b82f640" : "#adff2f30"
                        : "#2a2a2a"
                    }`,
                    color: isBot
                      ? isManual ? "#93c5fd" : "var(--accent)"
                      : "var(--foreground)",
                    fontSize: "0.875rem",
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ whiteSpace: "pre-wrap" }}>{displayContent}</div>
                  <div
                    style={{
                      fontSize: "0.68rem",
                      color: "var(--muted)",
                      marginTop: "4px",
                      textAlign: isBot ? "left" : "right",
                      opacity: 0.7,
                    }}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                {/* Feedback buttons on bot messages */}
                {isBot && !isManual && (
                  <div style={{ display: "flex", gap: "0.25rem", marginTop: "3px", alignItems: "center" }}>
                    {msg.feedback ? (
                      <span
                        style={{
                          fontSize: "0.68rem",
                          color: msg.feedback.rating === "good" ? "#22c55e" : "#ef4444",
                          opacity: 0.8,
                        }}
                      >
                        {msg.feedback.rating === "good" ? "👍 Boa resposta" : "👎 Resposta ruim"}
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => submitFeedback(msg.id, "good")}
                          title="Boa resposta"
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            fontSize: "0.875rem", opacity: 0.4, padding: "2px 5px",
                            borderRadius: "4px", transition: "opacity 0.15s",
                          }}
                          onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = "1")}
                          onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = "0.4")}
                        >
                          👍
                        </button>
                        <button
                          onClick={() => { setFeedbackOpen(msg.id); setCorrection(""); }}
                          title="Resposta ruim"
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            fontSize: "0.875rem", opacity: 0.4, padding: "2px 5px",
                            borderRadius: "4px", transition: "opacity 0.15s",
                          }}
                          onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = "1")}
                          onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = "0.4")}
                        >
                          👎
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Bad feedback form */}
                {feedbackOpen === msg.id && (
                  <div
                    style={{
                      maxWidth: "78%",
                      marginTop: "0.375rem",
                      background: "#1a1a1a",
                      border: "1px solid var(--card-border)",
                      borderRadius: "0.5rem",
                      padding: "0.75rem",
                    }}
                  >
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
                      O que o bot deveria ter respondido?
                    </div>
                    <textarea
                      value={correction}
                      onChange={(e) => setCorrection(e.target.value)}
                      rows={3}
                      className="input"
                      placeholder="Descreva a resposta ideal para treinar o bot..."
                      style={{ marginBottom: "0.5rem" }}
                    />
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => submitFeedback(msg.id, "bad")} className="btn-primary" style={{ fontSize: "0.75rem", padding: "0.3rem 0.75rem" }}>
                        Salvar
                      </button>
                      <button onClick={() => setFeedbackOpen(null)} className="btn-ghost" style={{ fontSize: "0.75rem", padding: "0.3rem 0.75rem" }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* ─── Reply box ──────────── */}
        <div style={{ display: "flex", gap: "0.625rem", flexShrink: 0 }}>
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendReply()}
            placeholder="Responder como operador... (Enter para enviar)"
            className="input"
            style={{ flex: 1, padding: "0.625rem 1rem" }}
          />
          <button onClick={sendReply} className="btn-primary" disabled={sending}>
            {sending ? "..." : "Enviar"}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
