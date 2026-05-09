"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  em_atendimento: { label: "Em Atendimento", color: "#3b82f6", bg: "#3b82f618" },
  qualificado:    { label: "Qualificado",     color: "#f59e0b", bg: "#f59e0b18" },
  reuniao_agendada: { label: "Reunião",       color: "#a855f7", bg: "#a855f718" },
  encerrado:      { label: "Encerrado",        color: "#22c55e", bg: "#22c55e18" },
};

interface Conversation {
  id: string;
  aiEnabled: boolean;
  handoffRequested: boolean;
  status: string;
  tags: string;
  updatedAt: string;
  contact: { displayName?: string; photoUrl?: string };
  messages: Array<{ content: string; role: string }>;
}

function getToken() {
  return document.cookie.split(";").find((c) => c.trim().startsWith("token="))?.split("=")[1] ?? "";
}

export default function DashboardPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [whatsappStatus, setWhatsappStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [alerts, setAlerts] = useState<{ hotLeads: number; priceAlerts: number; hotConvs: { id: string; name: string; score: number }[] } | null>(null);

  function loadData() {
    const token = getToken();
    if (!token) { router.push("/"); return; }
    Promise.all([
      fetch("/api/conversations", { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/health").then((r) => r.json()),
      fetch("/api/alerts", { headers: { authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : null),
    ])
      .then(([convs, health, alertData]) => {
        setConversations(Array.isArray(convs) ? convs : []);
        setWhatsappStatus(health?.evolution ?? "");
        if (alertData) setAlerts(alertData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 10000);
    return () => clearInterval(t);
  }, []);

  async function toggleAI(convId: string, current: boolean, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const token = getToken();
    await fetch(`/api/conversations/${convId}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ aiEnabled: !current }),
    });
    setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, aiEnabled: !current } : c)));
  }

  const filtered = conversations.filter((c) => {
    const matchStatus = filter === "all" || c.status === filter;
    const name = c.contact?.displayName ?? "";
    const lastMsg = c.messages[0]?.content ?? "";
    const matchSearch =
      !search ||
      name.toLowerCase().includes(search.toLowerCase()) ||
      lastMsg.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const stats = {
    total: conversations.length,
    aiAtiva: conversations.filter((c) => c.aiEnabled).length,
    handoff: conversations.filter((c) => c.handoffRequested).length,
    qualificados: conversations.filter(
      (c) => c.status === "qualificado" || c.status === "reuniao_agendada"
    ).length,
  };

  return (
    <DashboardLayout whatsappStatus={whatsappStatus}>
      <div className="page-container">
        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, marginBottom: "0.25rem" }}>
            Dashboard
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.825rem" }}>
            Conversas em tempo real · atualiza a cada 10s
          </p>
        </div>

        {/* 🔥 Banner de alertas comportamentais */}
        {alerts && (alerts.hotLeads > 0 || alerts.priceAlerts > 0) && (
          <div style={{
            marginBottom: "1rem",
            padding: "0.875rem 1.25rem",
            background: "#ef444410",
            border: "1px solid #ef444430",
            borderLeft: "4px solid #ef4444",
            borderRadius: "0.5rem",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}>
            <span style={{ fontSize: "1.25rem" }}>🔥</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: "#ef4444", fontSize: "0.875rem", marginBottom: "2px" }}>
                Ação necessária agora
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--muted)", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                {alerts.hotLeads > 0 && (
                  <span>🔥 {alerts.hotLeads} lead{alerts.hotLeads > 1 ? "s" : ""} quente{alerts.hotLeads > 1 ? "s" : ""} — responda agora para fechar!</span>
                )}
                {alerts.priceAlerts > 0 && (
                  <span>💰 {alerts.priceAlerts} cliente{alerts.priceAlerts > 1 ? "s" : ""} perguntou preço — acompanhe!</span>
                )}
              </div>
              {alerts.hotConvs.length > 0 && (
                <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                  {alerts.hotConvs.map((c) => (
                    <a
                      key={c.id}
                      href={`/conversations/${c.id}`}
                      style={{
                        fontSize: "0.72rem", padding: "2px 10px", borderRadius: "9999px",
                        background: "#ef444420", color: "#ef4444", border: "1px solid #ef444440",
                        textDecoration: "none", fontWeight: 600,
                      }}
                    >
                      {c.name} · {c.score}pts →
                    </a>
                  ))}
                </div>
              )}
            </div>
            <Link href="/crm" style={{ textDecoration: "none" }}>
              <button style={{ fontSize: "0.78rem", padding: "0.4rem 1rem", borderRadius: "0.375rem", background: "#ef4444", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
                Ver no CRM →
              </button>
            </Link>
          </div>
        )}

        {/* Stats */}
        <div className="stats-grid-4" style={{ marginBottom: "1.25rem" }}>
          {[
            { label: "Conversas", value: stats.total,        color: "var(--accent)", icon: "💬" },
            { label: "IA Ativa",  value: stats.aiAtiva,      color: "#22c55e",       icon: "🤖" },
            { label: "Handoff",   value: stats.handoff,      color: "#f59e0b",       icon: "⚠️" },
            { label: "Qualificados", value: stats.qualificados, color: "#a855f7",    icon: "⭐" },
          ].map((s) => (
            <div
              key={s.label}
              className="card"
              style={{ display: "flex", alignItems: "center", gap: "0.875rem", padding: "1rem 1.25rem" }}
            >
              <div style={{ fontSize: "1.5rem" }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: "1.625rem", fontWeight: 700, color: s.color, lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ color: "var(--muted)", fontSize: "0.72rem", marginTop: "2px" }}>
                  {s.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div
          className="card"
          style={{
            marginBottom: "0.875rem",
            padding: "0.75rem 1rem",
            display: "flex",
            gap: "0.625rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou mensagem..."
            className="input"
            style={{ flex: 1, minWidth: 180, padding: "0.4rem 0.75rem" }}
          />

          {["all", "em_atendimento", "qualificado", "reuniao_agendada", "encerrado"].map((s) => {
            const cfg = STATUS_CFG[s];
            const active = filter === s;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                style={{
                  padding: "0.3rem 0.875rem",
                  borderRadius: "9999px",
                  fontSize: "0.75rem",
                  border: "1px solid",
                  borderColor: active ? (cfg?.color ?? "var(--accent)") : "var(--card-border)",
                  background: active ? (cfg ? `${cfg.color}18` : "var(--accent-dim)") : "transparent",
                  color: active ? (cfg?.color ?? "var(--accent)") : "var(--muted)",
                  cursor: "pointer",
                  fontWeight: active ? 600 : 400,
                  whiteSpace: "nowrap",
                }}
              >
                {s === "all" ? "Todas" : cfg?.label}
              </button>
            );
          })}
        </div>

        {/* Conversation list */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ height: 72, opacity: 0.4 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon">💬</div>
            <div className="empty-state-title">
              {conversations.length === 0
                ? "Nenhuma conversa ainda"
                : "Nenhuma conversa encontrada"}
            </div>
            <div className="empty-state-desc">
              {conversations.length === 0
                ? "Aguardando mensagens no WhatsApp..."
                : "Tente outro filtro ou termo de busca."}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {filtered.map((conv) => {
              const statusCfg = STATUS_CFG[conv.status] ?? STATUS_CFG.em_atendimento;
              const name = conv.contact?.displayName ?? "Contato";
              const lastMsg = conv.messages[0]?.content ?? "—";
              const initial = name[0]?.toUpperCase() ?? "?";

              return (
                <Link
                  key={conv.id}
                  href={`/conversations/${conv.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.875rem",
                      padding: "0.75rem 1rem",
                      background: "var(--card)",
                      borderRadius: "0.5rem",
                      border: "1px solid var(--card-border)",
                      transition: "border-color 0.15s, background 0.15s",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = "var(--input-focus-border)";
                      (e.currentTarget as HTMLDivElement).style.background = "var(--card-hover)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = "var(--card-border)";
                      (e.currentTarget as HTMLDivElement).style.background = "var(--card)";
                    }}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        background: "var(--avatar-bg)",
                        border: "1px solid var(--avatar-border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "0.875rem",
                        color: "var(--accent)",
                        flexShrink: 0,
                        overflow: "hidden",
                      }}
                    >
                      {conv.contact?.photoUrl ? (
                        <img src={conv.contact.photoUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.parentElement as HTMLElement).innerText = initial; }} />
                      ) : initial}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.375rem",
                          marginBottom: "2px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--foreground)" }}>
                          {name}
                        </span>
                        <span
                          className="chip"
                          style={{
                            background: statusCfg.bg,
                            color: statusCfg.color,
                            border: `1px solid ${statusCfg.color}30`,
                            fontSize: "0.65rem",
                            padding: "0.1rem 0.5rem",
                          }}
                        >
                          {statusCfg.label}
                        </span>
                        {conv.handoffRequested && (
                          <span
                            className="chip"
                            style={{ background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b30", fontSize: "0.65rem", padding: "0.1rem 0.5rem" }}
                          >
                            ⚠ Handoff
                          </span>
                        )}
                        {conv.tags && conv.tags.split(",").filter(Boolean).map((tag) => (
                          <span key={tag} className="chip" style={{ background: "#ffffff08", color: "#9ca3af", border: "1px solid #2a2a2a", fontSize: "0.62rem", padding: "0.1rem 0.45rem" }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div
                        style={{
                          color: "var(--muted)",
                          fontSize: "0.78rem",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {lastMsg.slice(0, 90)}
                      </div>
                    </div>

                    {/* Right side */}
                    <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.375rem" }}>
                      <div style={{ fontSize: "0.7rem", color: "var(--dim-text)" }}>
                        {new Date(conv.updatedAt).toLocaleString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </div>
                      <button
                        onClick={(e) => toggleAI(conv.id, conv.aiEnabled, e)}
                        style={{
                          fontSize: "0.72rem",
                          padding: "0.2rem 0.625rem",
                          borderRadius: "9999px",
                          background: conv.aiEnabled ? "#22c55e18" : "#ef444418",
                          color: conv.aiEnabled ? "#22c55e" : "#ef4444",
                          border: `1px solid ${conv.aiEnabled ? "#22c55e30" : "#ef444430"}`,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        {conv.aiEnabled ? "IA On" : "IA Off"}
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
