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
  updatedAt: string;
  contact: { displayName?: string };
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

  function loadData() {
    const token = getToken();
    if (!token) { router.push("/"); return; }
    Promise.all([
      fetch("/api/conversations", { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/health").then((r) => r.json()),
    ])
      .then(([convs, health]) => {
        setConversations(Array.isArray(convs) ? convs : []);
        setWhatsappStatus(health?.evolution ?? "");
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
      <div style={{ padding: "1.75rem 2rem", minHeight: "100vh" }}>
        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, marginBottom: "0.25rem" }}>
            Dashboard
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.825rem" }}>
            Conversas em tempo real · atualiza a cada 10s
          </p>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "0.75rem",
            marginBottom: "1.25rem",
          }}
        >
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
                      (e.currentTarget as HTMLDivElement).style.borderColor = "#333";
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
                        background: "#1a1a1a",
                        border: "1px solid #2a2a2a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "0.875rem",
                        color: "var(--accent)",
                        flexShrink: 0,
                      }}
                    >
                      {initial}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "2px",
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
                          }}
                        >
                          {statusCfg.label}
                        </span>
                        {conv.handoffRequested && (
                          <span
                            className="chip"
                            style={{ background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b30" }}
                          >
                            ⚠ Handoff
                          </span>
                        )}
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
                      <div style={{ fontSize: "0.7rem", color: "#555" }}>
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
