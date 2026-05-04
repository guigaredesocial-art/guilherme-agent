"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";

const COLUMNS: { key: string; label: string; color: string; emoji: string }[] = [
  { key: "novo",             label: "Novo",             color: "#6b7280", emoji: "🆕" },
  { key: "em_negociacao",    label: "Em Negociação",    color: "#3b82f6", emoji: "🤝" },
  { key: "reuniao_agendada", label: "Reunião Agendada", color: "#a855f7", emoji: "📅" },
  { key: "fechado",          label: "Fechado",          color: "#22c55e", emoji: "✅" },
  { key: "perdido",          label: "Perdido",          color: "#ef4444", emoji: "❌" },
];

interface Lead {
  id: string;
  name: string;
  whatsapp: string;
  businessType?: string;
  painPoint?: string;
  monthlyVolume?: string;
  currentTool?: string;
  meetingDate?: string;
  notes?: string;
  status: string;
  createdAt: string;
  conversationId: string;
}

function getToken() {
  return document.cookie.split(";").find((c) => c.trim().startsWith("token="))?.split("=")[1] ?? "";
}

function LeadCard({
  lead,
  color,
  onClick,
  isSelected,
  onMoveLeft,
  onMoveRight,
  colIndex,
}: {
  lead: Lead;
  color: string;
  onClick: () => void;
  isSelected: boolean;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  colIndex: number;
}) {
  const initials = lead.name.slice(0, 2).toUpperCase();
  const date = new Date(lead.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  return (
    <div
      onClick={onClick}
      style={{
        background: isSelected ? "#adff2f06" : "#161616",
        border: `1px solid ${isSelected ? "var(--accent)" : color + "30"}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: "0.5rem",
        padding: "0.75rem",
        cursor: "pointer",
        transition: "all 0.15s",
        marginBottom: "0.5rem",
      }}
    >
      {/* Avatar + nome */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: color + "22",
            border: `1px solid ${color}50`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.65rem",
            fontWeight: 700,
            color,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: "0.82rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {lead.name}
          </div>
        </div>
      </div>

      {/* Info */}
      {lead.businessType && (
        <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
          🏢 {lead.businessType}
        </div>
      )}
      {lead.whatsapp && (
        <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
          📱 {lead.whatsapp}
        </div>
      )}
      {lead.meetingDate && (
        <div style={{ fontSize: "0.72rem", color: "#a855f7", marginBottom: "0.25rem" }}>
          📅 {new Date(lead.meetingDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </div>
      )}

      {/* Footer: data + mover */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.5rem", borderTop: "1px solid #1e1e1e", paddingTop: "0.4rem" }}>
        <span style={{ fontSize: "0.68rem", color: "#555" }}>{date}</span>
        <div style={{ display: "flex", gap: "2px" }} onClick={(e) => e.stopPropagation()}>
          {colIndex > 0 && (
            <button
              onClick={onMoveLeft}
              title="Mover para estágio anterior"
              style={{ background: "none", border: "1px solid #2a2a2a", borderRadius: "3px", color: "#555", cursor: "pointer", fontSize: "0.65rem", padding: "1px 5px", lineHeight: 1 }}
            >
              ←
            </button>
          )}
          {colIndex < COLUMNS.length - 1 && (
            <button
              onClick={onMoveRight}
              title="Avançar estágio"
              style={{ background: "none", border: "1px solid #2a2a2a", borderRadius: "3px", color: color, cursor: "pointer", fontSize: "0.65rem", padding: "1px 5px", lineHeight: 1 }}
            >
              →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CrmPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [editing, setEditing] = useState<Partial<Lead>>({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  async function loadLeads() {
    const token = getToken();
    if (!token) { router.push("/"); return; }
    const res = await fetch("/api/leads", { headers: { authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setLeads(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }

  useEffect(() => { loadLeads(); }, []);

  function selectLead(lead: Lead) {
    setSelected(lead);
    setEditing({ ...lead });
    setSavedMsg(false);
  }

  async function saveLead() {
    if (!selected) return;
    setSaving(true);
    const token = getToken();
    await fetch(`/api/leads/${selected.id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(editing),
    });
    await loadLeads();
    setSelected((prev) => (prev ? { ...prev, ...editing } as Lead : prev));
    setSaving(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  }

  async function moveLead(lead: Lead, newStatus: string) {
    const token = getToken();
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, status: newStatus } : l));
    if (selected?.id === lead.id) {
      setSelected((prev) => prev ? { ...prev, status: newStatus } : prev);
      setEditing((prev) => ({ ...prev, status: newStatus }));
    }
  }

  const totalPipeline = leads.filter((l) => ["em_negociacao", "reuniao_agendada"].includes(l.status)).length;

  return (
    <DashboardLayout>
      <div style={{ padding: "1.75rem 2rem", minHeight: "100vh" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <div>
            <h1 style={{ fontSize: "1.375rem", fontWeight: 700, marginBottom: "0.25rem" }}>CRM / Leads</h1>
            <p style={{ color: "var(--muted)", fontSize: "0.825rem" }}>
              {leads.length} lead{leads.length !== 1 ? "s" : ""} · {totalPipeline} em negociação ativa
            </p>
          </div>
          <Link href="/dashboard" className="btn-ghost" style={{ textDecoration: "none", fontSize: "0.825rem" }}>
            + Nova Conversa
          </Link>
        </div>

        {/* Pipeline summary bar */}
        {leads.length > 0 && (
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
            {COLUMNS.map((col) => {
              const count = leads.filter((l) => l.status === col.key).length;
              return (
                <div key={col.key} style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.3rem 0.75rem", borderRadius: "9999px", background: count > 0 ? col.color + "18" : "#141414", border: `1px solid ${count > 0 ? col.color + "40" : "#1e1e1e"}`, fontSize: "0.75rem", fontWeight: 600, color: count > 0 ? col.color : "#555" }}>
                  {col.emoji} {col.label} <span style={{ opacity: 0.7 }}>({count})</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Kanban board + detail panel */}
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
          {/* Kanban columns */}
          <div style={{ flex: 1, minWidth: 0, overflowX: "auto" }}>
            {loading ? (
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {COLUMNS.map((c) => (
                  <div key={c.key} style={{ flex: "0 0 200px", height: 300, background: "#111", borderRadius: "0.5rem", opacity: 0.4 }} />
                ))}
              </div>
            ) : leads.length === 0 ? (
              <div className="card empty-state">
                <div className="empty-state-icon">🗂️</div>
                <div className="empty-state-title">Nenhum lead ainda</div>
                <div className="empty-state-desc">
                  Abra uma conversa e clique em &quot;Criar Lead&quot; para adicionar ao pipeline.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "0.75rem", minWidth: `${COLUMNS.length * 210}px` }}>
                {COLUMNS.map((col, colIndex) => {
                  const colLeads = leads.filter((l) => l.status === col.key);
                  return (
                    <div
                      key={col.key}
                      style={{
                        flex: "0 0 200px",
                        background: "#0d0d0d",
                        borderRadius: "0.5rem",
                        border: "1px solid #1a1a1a",
                        display: "flex",
                        flexDirection: "column",
                        maxHeight: "calc(100vh - 230px)",
                      }}
                    >
                      {/* Column header */}
                      <div style={{ padding: "0.75rem 0.875rem", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: col.color, flex: 1 }}>{col.label}</span>
                        <span style={{ fontSize: "0.72rem", color: "#555", background: "#1a1a1a", borderRadius: "9999px", padding: "1px 7px", fontWeight: 600 }}>
                          {colLeads.length}
                        </span>
                      </div>

                      {/* Cards */}
                      <div style={{ padding: "0.625rem", overflowY: "auto", flex: 1 }}>
                        {colLeads.length === 0 ? (
                          <div style={{ textAlign: "center", padding: "2rem 0.5rem", color: "#333", fontSize: "0.75rem" }}>
                            Vazio
                          </div>
                        ) : (
                          colLeads.map((lead) => (
                            <LeadCard
                              key={lead.id}
                              lead={lead}
                              color={col.color}
                              isSelected={selected?.id === lead.id}
                              colIndex={colIndex}
                              onClick={() => selectLead(lead)}
                              onMoveLeft={() => moveLead(lead, COLUMNS[colIndex - 1].key)}
                              onMoveRight={() => moveLead(lead, COLUMNS[colIndex + 1].key)}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div
              style={{
                width: 300,
                flexShrink: 0,
                background: "var(--card)",
                border: "1px solid var(--card-border)",
                borderRadius: "0.5rem",
                padding: "1.25rem",
                overflowY: "auto",
                maxHeight: "calc(100vh - 200px)",
                position: "sticky",
                top: "1.75rem",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: "0.95rem", margin: 0 }}>{selected.name}</h3>
                  <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "2px" }}>
                    Lead #{selected.id.slice(-6)}
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1.25rem", lineHeight: 1 }}
                >×</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {/* Status badge */}
                <div>
                  <label style={{ fontSize: "0.68rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "4px", fontWeight: 600 }}>
                    Status
                  </label>
                  <select
                    className="input"
                    value={editing.status ?? "novo"}
                    onChange={(e) => setEditing((prev) => ({ ...prev, status: e.target.value }))}
                    style={{ fontSize: "0.825rem" }}
                  >
                    {COLUMNS.map((col) => (
                      <option key={col.key} value={col.key}>{col.emoji} {col.label}</option>
                    ))}
                  </select>
                </div>

                {[
                  { key: "name",          label: "Nome" },
                  { key: "whatsapp",      label: "WhatsApp" },
                  { key: "businessType",  label: "Tipo de negócio" },
                  { key: "painPoint",     label: "Dor principal" },
                  { key: "monthlyVolume", label: "Volume mensal" },
                  { key: "currentTool",   label: "Ferramenta atual" },
                ].map((field) => (
                  <div key={field.key}>
                    <label style={{ fontSize: "0.68rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "4px", fontWeight: 600 }}>
                      {field.label}
                    </label>
                    <input
                      className="input"
                      value={(editing as Record<string, string>)[field.key] ?? ""}
                      onChange={(e) => setEditing((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      style={{ fontSize: "0.825rem" }}
                    />
                  </div>
                ))}

                <div>
                  <label style={{ fontSize: "0.68rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "4px", fontWeight: 600 }}>
                    Data da Reunião
                  </label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={editing.meetingDate ? new Date(editing.meetingDate).toISOString().slice(0, 16) : ""}
                    onChange={(e) => setEditing((prev) => ({ ...prev, meetingDate: e.target.value ? new Date(e.target.value).toISOString() : undefined }))}
                    style={{ fontSize: "0.825rem" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.68rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "4px", fontWeight: 600 }}>
                    Anotações
                  </label>
                  <textarea
                    className="input"
                    value={editing.notes ?? ""}
                    onChange={(e) => setEditing((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    placeholder="Observações sobre esse lead..."
                    style={{ resize: "vertical", fontSize: "0.825rem" }}
                  />
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={saveLead} className="btn-primary" disabled={saving} style={{ flex: 1, fontSize: "0.8rem" }}>
                    {savedMsg ? "✓ Salvo!" : saving ? "Salvando..." : "Salvar"}
                  </button>
                  <Link
                    href={`/conversations/${selected.conversationId}`}
                    className="btn-ghost"
                    style={{ flex: 1, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem" }}
                  >
                    Ver Chat
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
