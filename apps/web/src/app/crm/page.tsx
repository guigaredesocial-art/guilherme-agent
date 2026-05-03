"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";

const LEAD_STATUS: Record<string, { label: string; color: string }> = {
  novo:             { label: "Novo",              color: "#6b7280" },
  em_negociacao:    { label: "Em Negociação",     color: "#3b82f6" },
  reuniao_agendada: { label: "Reunião Agendada",  color: "#a855f7" },
  fechado:          { label: "Fechado",           color: "#22c55e" },
  perdido:          { label: "Perdido",           color: "#ef4444" },
};

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

export default function CrmPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
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

  const filtered = filter === "all" ? leads : leads.filter((l) => l.status === filter);

  const counts = Object.fromEntries(
    Object.keys(LEAD_STATUS).map((k) => [k, leads.filter((l) => l.status === k).length])
  );

  return (
    <DashboardLayout>
      <div style={{ padding: "1.75rem 2rem", minHeight: "100vh" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ fontSize: "1.375rem", fontWeight: 700, marginBottom: "0.25rem" }}>CRM / Leads</h1>
            <p style={{ color: "var(--muted)", fontSize: "0.825rem" }}>
              {leads.length} lead{leads.length !== 1 ? "s" : ""} cadastrado{leads.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Link href="/dashboard" className="btn-ghost" style={{ textDecoration: "none", fontSize: "0.825rem" }}>
            + Nova Conversa
          </Link>
        </div>

        {/* Status pills */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            marginBottom: "1.25rem",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => setFilter("all")}
            style={{
              padding: "0.375rem 1rem",
              borderRadius: "9999px",
              fontSize: "0.78rem",
              fontWeight: 600,
              border: "1px solid",
              borderColor: filter === "all" ? "var(--accent)" : "var(--card-border)",
              background: filter === "all" ? "var(--accent-dim)" : "transparent",
              color: filter === "all" ? "var(--accent)" : "var(--muted)",
              cursor: "pointer",
            }}
          >
            Todos ({leads.length})
          </button>
          {Object.entries(LEAD_STATUS).map(([key, cfg]) => {
            const isActive = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.375rem 0.875rem",
                  borderRadius: "9999px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  border: "1px solid",
                  borderColor: isActive ? cfg.color : "var(--card-border)",
                  background: isActive ? `${cfg.color}18` : "transparent",
                  color: isActive ? cfg.color : "var(--muted)",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    minWidth: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: cfg.color,
                    color: "#fff",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {counts[key] ?? 0}
                </span>
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Content: list + detail */}
        <div style={{ display: "flex", gap: "1rem", minHeight: 0 }}>
          {/* Lead list */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="card" style={{ height: 68, opacity: 0.4 }} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="card empty-state">
                <div className="empty-state-icon">👥</div>
                <div className="empty-state-title">
                  {leads.length === 0 ? "Nenhum lead ainda" : "Nenhum lead com esse status"}
                </div>
                <div className="empty-state-desc">
                  {leads.length === 0
                    ? 'Abra uma conversa e clique em "Criar Lead" para converter um contato.'
                    : "Tente outro filtro de status."}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {filtered.map((lead) => {
                  const cfg = LEAD_STATUS[lead.status] ?? LEAD_STATUS.novo;
                  const isSelected = selected?.id === lead.id;
                  return (
                    <div
                      key={lead.id}
                      onClick={() => selectLead(lead)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.875rem",
                        padding: "0.75rem 1rem",
                        background: isSelected ? "#adff2f06" : "var(--card)",
                        borderRadius: "0.5rem",
                        border: `1px solid ${isSelected ? "var(--accent)" : "var(--card-border)"}`,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {/* Avatar */}
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "#1a1a1a",
                          border: `1px solid ${cfg.color}40`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "0.875rem",
                          color: cfg.color,
                          flexShrink: 0,
                        }}
                      >
                        {lead.name[0]?.toUpperCase() ?? "?"}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{lead.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          {lead.whatsapp || "—"} · {lead.businessType ?? "Tipo não definido"}
                        </div>
                      </div>

                      {/* Status + date */}
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <span
                          className="chip"
                          style={{
                            background: `${cfg.color}18`,
                            color: cfg.color,
                            border: `1px solid ${cfg.color}30`,
                            display: "block",
                            marginBottom: "3px",
                          }}
                        >
                          {cfg.label}
                        </span>
                        <div style={{ fontSize: "0.68rem", color: "#555" }}>
                          {new Date(lead.createdAt).toLocaleDateString("pt-BR")}
                        </div>
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
                width: 320,
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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1.25rem",
                }}
              >
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: "0.95rem", margin: 0 }}>
                    {selected.name}
                  </h3>
                  <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "2px" }}>
                    Lead #{selected.id.slice(-6)}
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1.25rem", lineHeight: 1 }}
                >
                  ×
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {[
                  { key: "name",          label: "Nome" },
                  { key: "whatsapp",      label: "WhatsApp" },
                  { key: "businessType",  label: "Tipo de negócio" },
                  { key: "painPoint",     label: "Dor principal" },
                  { key: "monthlyVolume", label: "Volume mensal" },
                  { key: "currentTool",   label: "Ferramenta atual" },
                ].map((field) => (
                  <div key={field.key}>
                    <label
                      style={{
                        fontSize: "0.68rem",
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        display: "block",
                        marginBottom: "4px",
                        fontWeight: 600,
                      }}
                    >
                      {field.label}
                    </label>
                    <input
                      className="input"
                      value={(editing as Record<string, string>)[field.key] ?? ""}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      style={{ fontSize: "0.825rem" }}
                    />
                  </div>
                ))}

                <div>
                  <label
                    style={{
                      fontSize: "0.68rem",
                      color: "var(--muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      display: "block",
                      marginBottom: "4px",
                      fontWeight: 600,
                    }}
                  >
                    Data da Reunião
                  </label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={editing.meetingDate ? new Date(editing.meetingDate).toISOString().slice(0, 16) : ""}
                    onChange={(e) =>
                      setEditing((prev) => ({
                        ...prev,
                        meetingDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                      }))
                    }
                    style={{ fontSize: "0.825rem" }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: "0.68rem",
                      color: "var(--muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      display: "block",
                      marginBottom: "4px",
                      fontWeight: 600,
                    }}
                  >
                    Status
                  </label>
                  <select
                    className="input"
                    value={editing.status ?? "novo"}
                    onChange={(e) => setEditing((prev) => ({ ...prev, status: e.target.value }))}
                    style={{ fontSize: "0.825rem" }}
                  >
                    {Object.entries(LEAD_STATUS).map(([key, cfg]) => (
                      <option key={key} value={key}>
                        {cfg.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: "0.68rem",
                      color: "var(--muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      display: "block",
                      marginBottom: "4px",
                      fontWeight: 600,
                    }}
                  >
                    Anotações
                  </label>
                  <textarea
                    className="input"
                    value={editing.notes ?? ""}
                    onChange={(e) => setEditing((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={4}
                    placeholder="Observações sobre esse lead..."
                    style={{ resize: "vertical", fontSize: "0.825rem" }}
                  />
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={saveLead} className="btn-primary" disabled={saving} style={{ flex: 1 }}>
                    {savedMsg ? "✓ Salvo!" : saving ? "Salvando..." : "Salvar"}
                  </button>
                  <Link
                    href={`/conversations/${selected.conversationId}`}
                    className="btn-ghost"
                    style={{ flex: 1, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.825rem" }}
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
