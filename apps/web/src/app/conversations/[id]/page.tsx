"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";

const STATUS_CFG = {
  em_atendimento:   { label: "Em Atendimento",  color: "#3b82f6" },
  qualificado:      { label: "Qualificado",      color: "#f59e0b" },
  reuniao_agendada: { label: "Reunião Agendada", color: "#a855f7" },
  encerrado:        { label: "Encerrado",        color: "#22c55e" },
};

interface MsgFeedback { rating: string; correction?: string }
interface Message { id: string; role: string; content: string; createdAt: string; feedback?: MsgFeedback | null }
interface Lead { id: string; name: string; status: string }
interface ConvDetail {
  id: string; aiEnabled: boolean; handoffRequested: boolean; status: string; channel: string;
  internalNotes?: string;
  contact: { id: string; displayName?: string };
  messages: Message[];
  lead?: Lead | null;
}
interface Reminder { id: string; message: string; scheduledAt: string; status: string }
interface Consultoria {
  chanceFechamento: number;
  classificacao: string;
  erros: string[];
  sugestoes: string[];
  proximoPasso: string;
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
  const [activeTab, setActiveTab] = useState<"notas" | "consultoria" | "lembretes">("notas");
  // Notas internas
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  // Consultoria
  const [consultoria, setConsultoria] = useState<Consultoria | null>(null);
  const [loadingConsultoria, setLoadingConsultoria] = useState(false);
  // Lembretes
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [newReminder, setNewReminder] = useState({ message: "", scheduledAt: "" });
  const [savingReminder, setSavingReminder] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadConv() {
    const token = getToken();
    if (!token) { router.push("/"); return; }
    const res = await fetch(`/api/conversations/${id}`, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await res.json();
    setConv(data);
    if (notes === "") setNotes(data.internalNotes ?? "");
    if (!leadForm.name && data.contact?.displayName) {
      setLeadForm((prev) => ({ ...prev, name: data.contact.displayName ?? "" }));
    }
  }

  async function loadReminders() {
    const token = getToken();
    const res = await fetch(`/api/reminders?conversationId=${id}`, { headers: { authorization: `Bearer ${token}` } });
    if (res.ok) setReminders(await res.json());
  }

  useEffect(() => {
    loadConv();
    loadReminders();
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
      body: JSON.stringify({ aiEnabled: !conv.aiEnabled, ...(conv.aiEnabled && { handoffRequested: false }) }),
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
    setConv((prev) => prev ? { ...prev, status } : prev);
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
    if (!leadForm.name.trim() || !conv) return;
    setSavingLead(true);
    const token = getToken();
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ ...leadForm, conversationId: id, contactId: conv.contact.id }),
    });
    setSavingLead(false);
    if (!res.ok) { alert("Erro ao criar lead. Tente novamente."); return; }
    setShowLeadForm(false);
    await loadConv();
  }

  async function saveNotes() {
    setSavingNotes(true);
    const token = getToken();
    await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ internalNotes: notes } as any),
    });
    setSavingNotes(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  async function runConsultoria() {
    setLoadingConsultoria(true);
    const token = getToken();
    const res = await fetch("/api/consultoria", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ conversationId: id }),
    });
    if (res.ok) setConsultoria(await res.json());
    setLoadingConsultoria(false);
  }

  async function createReminder() {
    if (!newReminder.message.trim() || !newReminder.scheduledAt) return;
    setSavingReminder(true);
    const token = getToken();
    await fetch("/api/reminders", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ conversationId: id, message: newReminder.message, scheduledAt: newReminder.scheduledAt }),
    });
    setNewReminder({ message: "", scheduledAt: "" });
    setSavingReminder(false);
    await loadReminders();
  }

  async function cancelReminder(remId: string) {
    const token = getToken();
    await fetch(`/api/reminders/${remId}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    await loadReminders();
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

  const chanceColor = (n: number) => n >= 70 ? "#22c55e" : n >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <DashboardLayout>
      <div style={{ display: "flex", height: "100vh", maxWidth: 1100, margin: "0 auto", padding: "1.5rem 2rem", gap: "1rem" }}>
        {/* ─── Coluna principal: chat ─────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", marginBottom: "1rem", flexShrink: 0, flexWrap: "wrap" }}>
            <Link href="/dashboard" style={{ color: "var(--muted)", textDecoration: "none", fontSize: "0.8rem", flexShrink: 0 }}>← Voltar</Link>

            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flex: 1, minWidth: 0 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--accent-dim)", border: "1px solid #adff2f30", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.875rem", color: "var(--accent)", flexShrink: 0 }}>
                {(conv.contact?.displayName?.[0] ?? "?").toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{conv.contact?.displayName ?? "Contato"}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Canal: {conv.channel}</div>
              </div>
            </div>

            <select value={conv.status} onChange={(e) => setStatus(e.target.value)} style={{ padding: "0.3rem 2rem 0.3rem 0.75rem", borderRadius: "9999px", background: `${statusCfg.color}18`, color: statusCfg.color, border: `1px solid ${statusCfg.color}40`, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", outline: "none", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(statusCfg.color)}' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 0.625rem center" }}>
              {Object.entries(STATUS_CFG).map(([key, cfg]) => (
                <option key={key} value={key} style={{ background: "#111", color: "#fff" }}>{cfg.label}</option>
              ))}
            </select>

            {conv.lead ? (
              <Link href="/crm" style={{ fontSize: "0.78rem", padding: "0.3rem 0.875rem", borderRadius: "0.375rem", background: "#a855f718", color: "#a855f7", border: "1px solid #a855f740", textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap" }}>⭐ Ver Lead</Link>
            ) : (
              <button onClick={() => setShowLeadForm(true)} style={{ fontSize: "0.78rem", padding: "0.3rem 0.875rem", borderRadius: "0.375rem", background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b40", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>+ Criar Lead</button>
            )}

            {conv.aiEnabled ? (
              <button onClick={toggleAI} style={{ padding: "0.3rem 0.875rem", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.78rem", fontWeight: 700, background: "#ef444418", color: "#ef4444", border: "1px solid #ef444440", whiteSpace: "nowrap" }}>
                👤 Assumir
              </button>
            ) : (
              <button onClick={toggleAI} style={{ padding: "0.3rem 0.875rem", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.78rem", fontWeight: 700, background: "#22c55e18", color: "#22c55e", border: "1px solid #22c55e40", whiteSpace: "nowrap" }}>
                🤖 Devolver IA
              </button>
            )}
          </div>

          {/* Lead form modal */}
          {showLeadForm && (
            <div style={{ position: "fixed", inset: 0, background: "#000000aa", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
              <div className="card" style={{ width: 420, maxWidth: "90vw" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                  <h3 style={{ fontWeight: 700, fontSize: "1rem" }}>Converter em Lead</h3>
                  <button onClick={() => setShowLeadForm(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1.25rem" }}>×</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {[
                    { key: "name", label: "Nome *", placeholder: "Nome do lead" },
                    { key: "whatsapp", label: "WhatsApp", placeholder: "55119..." },
                    { key: "businessType", label: "Tipo de negócio", placeholder: "Clínica, e-commerce..." },
                    { key: "painPoint", label: "Dor principal", placeholder: "Atendimento lento..." },
                  ].map((f) => (
                    <div key={f.key}>
                      <label style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "4px" }}>{f.label}</label>
                      <input className="input" value={(leadForm as Record<string, string>)[f.key]} onChange={(e) => setLeadForm((prev) => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.placeholder} />
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "4px" }}>Status inicial</label>
                    <select className="input" value={leadForm.status} onChange={(e) => setLeadForm((prev) => ({ ...prev, status: e.target.value }))}>
                      <option value="novo">Novo</option>
                      <option value="em_negociacao">Em Negociação</option>
                      <option value="reuniao_agendada">Reunião Agendada</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                    <button onClick={createLead} className="btn-primary" disabled={savingLead} style={{ flex: 1 }}>{savingLead ? "Salvando..." : "Criar Lead"}</button>
                    <button onClick={() => setShowLeadForm(false)} className="btn-ghost" style={{ flex: 1 }}>Cancelar</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="card" style={{ flex: 1, overflowY: "auto", marginBottom: "0.875rem", padding: "1rem 1.25rem" }}>
            {conv.messages.length === 0 && <div className="empty-state"><div className="empty-state-icon">💬</div><div className="empty-state-title">Sem mensagens</div></div>}
            {conv.messages.map((msg) => {
              const isBot = msg.role === "assistant";
              const isManual = msg.content.startsWith("[MANUAL]");
              const displayContent = msg.content.replace(/^\[MANUAL\]\s?/, "");
              return (
                <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isBot ? "flex-end" : "flex-start", marginBottom: "0.875rem" }}>
                  {isManual && <div style={{ fontSize: "0.68rem", color: "#3b82f6", marginBottom: "3px", paddingRight: "4px" }}>👤 Operador</div>}
                  <div style={{ maxWidth: "78%", padding: "0.6rem 0.875rem", borderRadius: isBot ? "0.875rem 0.875rem 0.25rem 0.875rem" : "0.875rem 0.875rem 0.875rem 0.25rem", background: isBot ? (isManual ? "#1e3a5f" : "#adff2f12") : "#1c1c1c", border: `1px solid ${isBot ? (isManual ? "#3b82f640" : "#adff2f30") : "#2a2a2a"}`, color: isBot ? (isManual ? "#93c5fd" : "var(--accent)") : "var(--foreground)", fontSize: "0.875rem", lineHeight: 1.5 }}>
                    <div style={{ whiteSpace: "pre-wrap" }}>{displayContent}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: "4px", textAlign: isBot ? "left" : "right", opacity: 0.7 }}>
                      {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  {isBot && !isManual && (
                    <div style={{ display: "flex", gap: "0.25rem", marginTop: "3px", alignItems: "center" }}>
                      {msg.feedback ? (
                        <span style={{ fontSize: "0.68rem", color: msg.feedback.rating === "good" ? "#22c55e" : "#ef4444", opacity: 0.8 }}>
                          {msg.feedback.rating === "good" ? "👍 Boa resposta" : "👎 Resposta ruim"}
                        </span>
                      ) : (
                        <>
                          <button onClick={() => submitFeedback(msg.id, "good")} title="Boa resposta" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.875rem", opacity: 0.4, padding: "2px 5px", borderRadius: "4px" }} onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = "1")} onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = "0.4")}>👍</button>
                          <button onClick={() => { setFeedbackOpen(msg.id); setCorrection(""); }} title="Resposta ruim" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.875rem", opacity: 0.4, padding: "2px 5px", borderRadius: "4px" }} onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = "1")} onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = "0.4")}>👎</button>
                        </>
                      )}
                    </div>
                  )}
                  {feedbackOpen === msg.id && (
                    <div style={{ maxWidth: "78%", marginTop: "0.375rem", background: "#1a1a1a", border: "1px solid var(--card-border)", borderRadius: "0.5rem", padding: "0.75rem" }}>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.5rem" }}>O que o bot deveria ter respondido?</div>
                      <textarea value={correction} onChange={(e) => setCorrection(e.target.value)} rows={3} className="input" placeholder="Descreva a resposta ideal..." style={{ marginBottom: "0.5rem" }} />
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button onClick={() => submitFeedback(msg.id, "bad")} className="btn-primary" style={{ fontSize: "0.75rem", padding: "0.3rem 0.75rem" }}>Salvar</button>
                        <button onClick={() => setFeedbackOpen(null)} className="btn-ghost" style={{ fontSize: "0.75rem", padding: "0.3rem 0.75rem" }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Reply box */}
          <div style={{ display: "flex", gap: "0.625rem", flexShrink: 0 }}>
            <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendReply()} placeholder="Responder como operador... (Enter para enviar)" className="input" style={{ flex: 1, padding: "0.625rem 1rem" }} />
            <button onClick={sendReply} className="btn-primary" disabled={sending}>{sending ? "..." : "Enviar"}</button>
          </div>
        </div>

        {/* ─── Painel lateral: Notas | Consultoria | Lembretes ──── */}
        <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: "0" }}>
          {/* Tabs */}
          <div style={{ display: "flex", background: "#111", border: "1px solid var(--card-border)", borderRadius: "0.5rem 0.5rem 0 0", overflow: "hidden" }}>
            {(["notas", "consultoria", "lembretes"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: "0.625rem 0.25rem",
                  background: activeTab === tab ? "#161616" : "transparent",
                  border: "none",
                  borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                  color: activeTab === tab ? "var(--accent)" : "var(--muted)",
                  fontSize: "0.72rem",
                  fontWeight: activeTab === tab ? 700 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {tab === "notas" ? "📝 Notas" : tab === "consultoria" ? "🤖 IA" : "⏰ Lembretes"}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, background: "var(--card)", border: "1px solid var(--card-border)", borderTop: "none", borderRadius: "0 0 0.5rem 0.5rem", padding: "1rem", overflowY: "auto", maxHeight: "calc(100vh - 160px)" }}>

            {/* ── Notas Internas ── */}
            {activeTab === "notas" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Anotações internas — não aparecem para o cliente</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={12}
                  className="input"
                  placeholder="Ex: Cliente quase fechando. Citar prova social. Tem budget de R$500/mês..."
                  style={{ resize: "none", fontSize: "0.825rem", lineHeight: 1.6 }}
                />
                <button onClick={saveNotes} className="btn-primary" disabled={savingNotes} style={{ width: "100%" }}>
                  {notesSaved ? "✓ Salvo!" : savingNotes ? "Salvando..." : "Salvar Notas"}
                </button>
              </div>
            )}

            {/* ── Consultoria IA ── */}
            {activeTab === "consultoria" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>A IA analisa a conversa e dá sugestões práticas</div>
                <button onClick={runConsultoria} className="btn-primary" disabled={loadingConsultoria} style={{ width: "100%" }}>
                  {loadingConsultoria ? "Analisando..." : "🔍 Analisar Conversa"}
                </button>

                {consultoria && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                    {/* Chance de fechar */}
                    <div className="card" style={{ padding: "0.875rem", background: "#0d0d0d" }}>
                      <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Chance de Fechar</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{ fontSize: "2rem", fontWeight: 800, color: chanceColor(consultoria.chanceFechamento) }}>
                          {consultoria.chanceFechamento}%
                        </div>
                        <div>
                          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: chanceColor(consultoria.chanceFechamento), textTransform: "capitalize" }}>
                            {consultoria.classificacao}
                          </div>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div style={{ height: 6, background: "#1e1e1e", borderRadius: 3, marginTop: "0.5rem", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${consultoria.chanceFechamento}%`, background: chanceColor(consultoria.chanceFechamento), borderRadius: 3, transition: "width 0.6s ease" }} />
                      </div>
                    </div>

                    {/* Próximo passo */}
                    <div style={{ background: "#adff2f10", border: "1px solid #adff2f30", borderRadius: "0.5rem", padding: "0.75rem" }}>
                      <div style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 700, marginBottom: "0.3rem" }}>👉 PRÓXIMO PASSO</div>
                      <div style={{ fontSize: "0.82rem", color: "var(--foreground)", lineHeight: 1.5 }}>{consultoria.proximoPasso}</div>
                    </div>

                    {/* Sugestões */}
                    {consultoria.sugestoes.length > 0 && (
                      <div>
                        <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>💡 Sugestões</div>
                        {consultoria.sugestoes.map((s, i) => (
                          <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.375rem", fontSize: "0.8rem", color: "var(--foreground)", lineHeight: 1.4 }}>
                            <span style={{ color: "var(--accent)", flexShrink: 0 }}>•</span>
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Erros */}
                    {consultoria.erros.length > 0 && (
                      <div>
                        <div style={{ fontSize: "0.72rem", color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>⚠ Erros na Abordagem</div>
                        {consultoria.erros.map((e, i) => (
                          <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.375rem", fontSize: "0.8rem", color: "#ef4444", lineHeight: 1.4 }}>
                            <span style={{ flexShrink: 0 }}>•</span>
                            <span>{e}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Lembretes ── */}
            {activeTab === "lembretes" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                {/* Criar lembrete */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.75rem", background: "#0d0d0d", borderRadius: "0.5rem", border: "1px solid var(--card-border)" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Novo Lembrete</div>
                  <input
                    className="input"
                    placeholder="Mensagem para o cliente..."
                    value={newReminder.message}
                    onChange={(e) => setNewReminder((p) => ({ ...p, message: e.target.value }))}
                    style={{ fontSize: "0.8rem" }}
                  />
                  <input
                    type="datetime-local"
                    className="input"
                    value={newReminder.scheduledAt}
                    onChange={(e) => setNewReminder((p) => ({ ...p, scheduledAt: e.target.value }))}
                    style={{ fontSize: "0.8rem" }}
                  />
                  <button onClick={createReminder} className="btn-primary" disabled={savingReminder || !newReminder.message || !newReminder.scheduledAt} style={{ width: "100%", fontSize: "0.8rem" }}>
                    {savingReminder ? "Criando..." : "+ Criar Lembrete"}
                  </button>
                </div>

                {/* Lista de lembretes */}
                {reminders.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.8rem", padding: "1.5rem 0" }}>Nenhum lembrete ainda</div>
                ) : (
                  reminders.map((r) => {
                    const overdue = r.status === "pending" && new Date(r.scheduledAt) < new Date();
                    return (
                      <div key={r.id} style={{ background: "#0d0d0d", borderRadius: "0.5rem", border: `1px solid ${overdue ? "#ef444430" : "var(--card-border)"}`, padding: "0.625rem 0.75rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "0.8rem", marginBottom: "3px" }}>{r.message}</div>
                            <div style={{ fontSize: "0.7rem", color: overdue ? "#ef4444" : "var(--muted)" }}>
                              {overdue ? "⚠ " : "📅 "}
                              {new Date(r.scheduledAt).toLocaleDateString("pt-BR")} {new Date(r.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                          {r.status === "pending" && (
                            <button onClick={() => cancelReminder(r.id)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "1rem", padding: "0", flexShrink: 0 }}>×</button>
                          )}
                          {r.status === "sent" && <span style={{ fontSize: "0.7rem", color: "#22c55e" }}>✓</span>}
                          {r.status === "cancelled" && <span style={{ fontSize: "0.7rem", color: "#555" }}>—</span>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
