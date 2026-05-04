"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface DiaData {
  label: string;
  conversas: number;
  leads: number;
}

interface InsightData {
  totalConversas: number;
  conversasHoje: number;
  conversasSemana: number;
  aiAtiva: number;
  handoffRate: number;
  feedbackTotal: number;
  feedbackBom: number;
  taxaSatisfacao: number;
  correcoesTotais: number;
  totalLeads: number;
  leadsHoje: number;
  leadsPorStatus: Record<string, number>;
  conversasPorStatus: Record<string, number>;
  conversasPorDia: DiaData[];
}

function getToken() {
  return document.cookie.split(";").find((c) => c.trim().startsWith("token="))?.split("=")[1] ?? "";
}

function StatCard({
  label, value, sub, color = "var(--accent)", icon, delta,
}: {
  label: string; value: string | number; sub?: string; color?: string; icon: string; delta?: number;
}) {
  return (
    <div className="card" style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "0.5rem",
          background: `${color}18`,
          border: `1px solid ${color}30`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.25rem",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "1.625rem", fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "3px" }}>{label}</div>
        {sub && <div style={{ fontSize: "0.7rem", color: "#555", marginTop: "2px" }}>{sub}</div>}
        {delta !== undefined && (
          <div style={{ fontSize: "0.7rem", marginTop: "4px", color: delta >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs semana anterior
          </div>
        )}
      </div>
    </div>
  );
}

const CUSTOM_TOOLTIP_STYLE = {
  background: "#111",
  border: "1px solid #1e1e1e",
  borderRadius: "0.5rem",
  fontSize: "0.8rem",
  color: "#ededed",
  padding: "0.5rem 0.875rem",
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={CUSTOM_TOOLTIP_STYLE}>
      <div style={{ fontWeight: 600, marginBottom: "4px", color: "#adff2f" }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

const PIE_STATUS = [
  { key: "em_atendimento", label: "Em Atendimento", color: "#3b82f6" },
  { key: "qualificado",    label: "Qualificado",    color: "#f59e0b" },
  { key: "reuniao_agendada", label: "Reunião",      color: "#a855f7" },
  { key: "encerrado",      label: "Encerrado",      color: "#22c55e" },
];

const PIE_LEADS = [
  { key: "novo",             label: "Novo",             color: "#6b7280" },
  { key: "em_negociacao",    label: "Em Negociação",    color: "#3b82f6" },
  { key: "reuniao_agendada", label: "Reunião Agendada", color: "#a855f7" },
  { key: "fechado",          label: "Fechado",          color: "#22c55e" },
  { key: "perdido",          label: "Perdido",          color: "#ef4444" },
];

export default function InsightsPage() {
  const router = useRouter();
  const [data, setData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/"); return; }
    fetch("/api/insights", { headers: { authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const conversasPieData = data
    ? PIE_STATUS.map((s) => ({ name: s.label, value: data.conversasPorStatus[s.key] ?? 0, color: s.color })).filter((d) => d.value > 0)
    : [];

  const leadsPieData = data
    ? PIE_LEADS.map((s) => ({ name: s.label, value: data.leadsPorStatus[s.key] ?? 0, color: s.color })).filter((d) => d.value > 0)
    : [];

  return (
    <DashboardLayout>
      <div style={{ padding: "1.75rem 2rem", minHeight: "100vh" }}>
        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, marginBottom: "0.25rem" }}>Insights</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.825rem" }}>
            Análise de desempenho do agente e conversas · últimos 7 dias
          </p>
        </div>

        {loading || !data ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="card" style={{ height: 90, opacity: 0.4 }} />
            ))}
          </div>
        ) : (
          <>
            {/* ── Stat cards ── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "0.75rem",
                marginBottom: "1.5rem",
              }}
            >
              <StatCard
                icon="💬" label="Total de Conversas" color="var(--accent)"
                value={data.totalConversas}
                sub={`${data.conversasHoje} hoje`}
                delta={data.conversasSemana > 0 ? Math.round((data.conversasHoje / (data.conversasSemana / 7)) * 100 - 100) : 0}
              />
              <StatCard icon="🤖" label="IA Ativa" value={data.aiAtiva} color="#22c55e"
                sub={`de ${data.totalConversas} conversas`}
              />
              <StatCard icon="⚠️" label="Taxa de Handoff" value={`${data.handoffRate}%`} color="#f59e0b"
                sub="conversas que pediram humano"
              />
              <StatCard icon="👥" label="Total de Leads" value={data.totalLeads} color="#a855f7"
                sub={`+${data.leadsHoje} hoje`}
              />
              <StatCard
                icon="⭐" label="Satisfação do Bot" color={data.taxaSatisfacao >= 70 ? "#22c55e" : "#f59e0b"}
                value={data.feedbackTotal > 0 ? `${data.taxaSatisfacao}%` : "—"}
                sub={data.feedbackTotal > 0 ? `${data.feedbackBom} positivos de ${data.feedbackTotal}` : "Nenhum feedback ainda"}
              />
              <StatCard icon="📅" label="Conversas esta semana" value={data.conversasSemana} color="#3b82f6"
                sub="últimos 7 dias"
              />
            </div>

            {/* ── Gráfico de área: conversas + leads por dia ── */}
            <div className="card" style={{ marginBottom: "1rem" }}>
              <h3 style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "1.25rem" }}>
                Evolução nos últimos 7 dias
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.conversasPorDia} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradConversas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#adff2f" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#adff2f" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                  <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: "0.78rem", paddingTop: "0.5rem" }}
                    formatter={(val) => <span style={{ color: "#9ca3af" }}>{val}</span>}
                  />
                  <Area type="monotone" dataKey="conversas" name="Conversas" stroke="#3b82f6" strokeWidth={2} fill="url(#gradConversas)" dot={{ fill: "#3b82f6", r: 3 }} activeDot={{ r: 5 }} />
                  <Area type="monotone" dataKey="leads" name="Leads" stroke="#adff2f" strokeWidth={2} fill="url(#gradLeads)" dot={{ fill: "#adff2f", r: 3 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* ── Pie charts ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              {/* Conversas por status */}
              <div className="card">
                <h3 style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "1rem" }}>
                  Conversas por Status
                </h3>
                {conversasPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={conversasPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {conversasPieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={CUSTOM_TOOLTIP_STYLE}
                        formatter={(val: number, name: string) => [val, name]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: "0.75rem" }}
                        formatter={(val) => <span style={{ color: "#9ca3af" }}>{val}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: "0.8rem" }}>
                    Nenhuma conversa ainda
                  </div>
                )}
              </div>

              {/* Leads por status (pipeline) */}
              <div className="card">
                <h3 style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "1rem" }}>
                  Pipeline de Leads
                </h3>
                {leadsPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={leadsPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {leadsPieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={CUSTOM_TOOLTIP_STYLE}
                        formatter={(val: number, name: string) => [val, name]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: "0.75rem" }}
                        formatter={(val) => <span style={{ color: "#9ca3af" }}>{val}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: "0.8rem" }}>
                    Nenhum lead ainda
                  </div>
                )}
              </div>
            </div>

            {/* ── Feedback section ── */}
            {data.correcoesTotais > 0 && (
              <div className="card">
                <h3 style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                  Feedbacks de Melhoria
                </h3>
                <p style={{ fontSize: "0.825rem", color: "var(--muted)" }}>
                  Você marcou <strong style={{ color: "#ef4444" }}>{data.correcoesTotais}</strong> respostas como ruins com correção.
                </p>
                <div style={{ marginTop: "0.875rem", padding: "0.75rem 1rem", background: "#141414", borderRadius: "0.375rem", border: "1px solid var(--card-border)", fontSize: "0.8rem", color: "var(--muted)" }}>
                  💡 <strong style={{ color: "var(--foreground)" }}>Dica:</strong> Acesse o Agente e adicione esses exemplos ao System Prompt para treinar respostas melhores.
                </div>
              </div>
            )}

            {data.feedbackTotal === 0 && (
              <div className="card" style={{ border: "1px solid #adff2f20", background: "var(--accent-dim)" }}>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "1.25rem" }}>💡</span>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--accent)", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
                      Ative o sistema de feedback
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.6 }}>
                      Nas conversas, clique em 👍 ou 👎 nas respostas do bot para treinar o Guilherme com base em exemplos reais.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
