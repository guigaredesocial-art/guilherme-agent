"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";

interface Reminder {
  id: string;
  conversationId: string;
  message: string;
  scheduledAt: string;
  sentAt: string | null;
  status: string;
  conversation: { contact: { displayName?: string } };
}

function getToken() {
  return document.cookie.split(";").find((c) => c.trim().startsWith("token="))?.split("=")[1] ?? "";
}

function statusColor(s: string) {
  if (s === "sent") return "#22c55e";
  if (s === "cancelled") return "#6b7280";
  return "#f59e0b";
}
function statusLabel(s: string) {
  if (s === "sent") return "✓ Enviado";
  if (s === "cancelled") return "Cancelado";
  return "⏳ Pendente";
}

function isOverdue(r: Reminder) {
  return r.status === "pending" && new Date(r.scheduledAt) < new Date();
}

export default function RemindersPage() {
  const router = useRouter();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "sent">("all");

  async function load() {
    const token = getToken();
    if (!token) { router.push("/"); return; }
    const res = await fetch("/api/reminders", { headers: { authorization: `Bearer ${token}` } });
    if (res.ok) setReminders(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  async function cancel(id: string) {
    const token = getToken();
    await fetch(`/api/reminders/${id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    setReminders((prev) => prev.map((r) => r.id === id ? { ...r, status: "cancelled" } : r));
  }

  const filtered = filter === "all" ? reminders : reminders.filter((r) => r.status === (filter === "sent" ? "sent" : "pending"));
  const pendentes = reminders.filter((r) => r.status === "pending").length;
  const atrasados = reminders.filter(isOverdue).length;

  return (
    <DashboardLayout>
      <div style={{ padding: "1.75rem 2rem", minHeight: "100vh" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ fontSize: "1.375rem", fontWeight: 700, marginBottom: "0.25rem" }}>⏰ Lembretes</h1>
            <p style={{ color: "var(--muted)", fontSize: "0.825rem" }}>
              {pendentes} pendente{pendentes !== 1 ? "s" : ""}
              {atrasados > 0 && <span style={{ color: "#ef4444", fontWeight: 600 }}> · {atrasados} atrasado{atrasados !== 1 ? "s" : ""}</span>}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
          {[
            { key: "all", label: `Todos (${reminders.length})` },
            { key: "pending", label: `Pendentes (${pendentes})` },
            { key: "sent", label: `Enviados (${reminders.filter((r) => r.status === "sent").length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key as "all" | "pending" | "sent")}
              style={{
                padding: "0.375rem 1rem",
                borderRadius: "9999px",
                fontSize: "0.78rem",
                fontWeight: filter === key ? 700 : 400,
                border: "1px solid",
                borderColor: filter === key ? "var(--accent)" : "var(--card-border)",
                background: filter === key ? "var(--accent-dim)" : "transparent",
                color: filter === key ? "var(--accent)" : "var(--muted)",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[1, 2, 3].map((i) => <div key={i} className="card" style={{ height: 72, opacity: 0.4 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon">⏰</div>
            <div className="empty-state-title">Nenhum lembrete ainda</div>
            <div className="empty-state-desc">Abra uma conversa e crie lembretes para não perder nenhum cliente.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {filtered.map((r) => {
              const overdue = isOverdue(r);
              const dt = new Date(r.scheduledAt);
              const color = statusColor(r.status);
              return (
                <div
                  key={r.id}
                  className="card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "0.875rem 1rem",
                    borderLeft: `3px solid ${overdue ? "#ef4444" : color}`,
                  }}
                >
                  {/* Icon */}
                  <div style={{ fontSize: "1.25rem", flexShrink: 0 }}>
                    {r.status === "sent" ? "✅" : overdue ? "🔴" : "⏰"}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "3px" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                        {r.conversation.contact.displayName ?? "Cliente"}
                      </span>
                      <span className="chip" style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
                        {statusLabel(r.status)}
                      </span>
                      {overdue && (
                        <span className="chip" style={{ background: "#ef444418", color: "#ef4444", border: "1px solid #ef444430" }}>
                          ⚠ Atrasado
                        </span>
                      )}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: "0.8rem", marginBottom: "2px" }}>
                      {r.message}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#555" }}>
                      📅 {dt.toLocaleDateString("pt-BR")} às {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {r.sentAt && <span> · Enviado: {new Date(r.sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                    <Link
                      href={`/conversations/${r.conversationId}`}
                      className="btn-ghost"
                      style={{ fontSize: "0.75rem", padding: "0.3rem 0.75rem", textDecoration: "none" }}
                    >
                      Ver Chat
                    </Link>
                    {r.status === "pending" && (
                      <button
                        onClick={() => cancel(r.id)}
                        className="btn-danger"
                        style={{ fontSize: "0.75rem" }}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
