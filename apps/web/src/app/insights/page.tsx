"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";

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
}

function getToken() {
  return document.cookie.split(";").find((c) => c.trim().startsWith("token="))?.split("=")[1] ?? "";
}

function StatCard({
  label, value, sub, color = "var(--accent)", icon,
}: {
  label: string; value: string | number; sub?: string; color?: string; icon: string;
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
      <div>
        <div style={{ fontSize: "1.625rem", fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "3px" }}>{label}</div>
        {sub && <div style={{ fontSize: "0.7rem", color: "#555", marginTop: "2px" }}>{sub}</div>}
      </div>
    </div>
  );
}

function MiniBar({
  label, value, max, color,
}: {
  label: string; value: number; max: number; color: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "0.8rem" }}>
        <span style={{ color: "var(--foreground)" }}>{label}</span>
        <span style={{ color: "var(--muted)", fontWeight: 600 }}>{value}</span>
      </div>
      <div style={{ height: 6, background: "#1e1e1e", borderRadius: 3, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 3,
            transition: "width 0.6s ease",
          }}
        />
      </div>
    </div>
  );
}

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

  return (
    <DashboardLayout>
      <div style={{ padding: "1.75rem 2rem", minHeight: "100vh" }}>
        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, marginBottom: "0.25rem" }}>Insights</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.825rem" }}>
            Análise de desempenho do agente e conversas
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
            {/* Top stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "0.75rem",
                marginBottom: "1.25rem",
              }}
            >
              <StatCard icon="💬" label="Total de Conversas" value={data.totalConversas} sub={`+${data.conversasSemana} esta semana`} />
              <StatCard icon="📅" label="Conversas Hoje" value={data.conversasHoje} color="#3b82f6" />
              <StatCard icon="🤖" label="IA Ativa" value={`${data.aiAtiva}`} sub={`de ${data.totalConversas} conversas`} color="#22c55e" />
              <StatCard icon="⚠️" label="Taxa de Handoff" value={`${data.handoffRate}%`} sub="conversas que pediram humano" color="#f59e0b" />
              <StatCard icon="👥" label="Total de Leads" value={data.totalLeads} sub={`+${data.leadsHoje} hoje`} color="#a855f7" />
              <StatCard
                icon="⭐"
                label="Satisfação do Bot"
                value={data.feedbackTotal > 0 ? `${data.taxaSatisfacao}%` : "—"}
                sub={data.feedbackTotal > 0 ? `${data.feedbackBom} boas de ${data.feedbackTotal} avaliadas` : "Nenhum feedback ainda"}
                color={data.taxaSatisfacao >= 70 ? "#22c55e" : "#f59e0b"}
              />
            </div>

            {/* Charts row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              {/* Conversas por status */}
              <div className="card">
                <h3 style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "1rem", color: "var(--foreground)" }}>
                  Conversas por Status
                </h3>
                {Object.entries({
                  "Em Atendimento": { count: data.conversasPorStatus["em_atendimento"] ?? 0, color: "#3b82f6" },
                  "Qualificado":    { count: data.conversasPorStatus["qualificado"] ?? 0,    color: "#f59e0b" },
                  "Reunião":        { count: data.conversasPorStatus["reuniao_agendada"] ?? 0, color: "#a855f7" },
                  "Encerrado":      { count: data.conversasPorStatus["encerrado"] ?? 0,       color: "#22c55e" },
                }).map(([label, { count, color }]) => (
                  <MiniBar
                    key={label}
                    label={label}
                    value={count}
                    max={data.totalConversas || 1}
                    color={color}
                  />
                ))}
              </div>

              {/* Leads por status */}
              <div className="card">
                <h3 style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "1rem", color: "var(--foreground)" }}>
                  Pipeline de Leads
                </h3>
                {Object.entries({
                  "Novo":             { count: data.leadsPorStatus["novo"] ?? 0,             color: "#6b7280" },
                  "Em Negociação":    { count: data.leadsPorStatus["em_negociacao"] ?? 0,    color: "#3b82f6" },
                  "Reunião Agendada": { count: data.leadsPorStatus["reuniao_agendada"] ?? 0, color: "#a855f7" },
                  "Fechado":          { count: data.leadsPorStatus["fechado"] ?? 0,          color: "#22c55e" },
                  "Perdido":          { count: data.leadsPorStatus["perdido"] ?? 0,          color: "#ef4444" },
                }).map(([label, { count, color }]) => (
                  <MiniBar
                    key={label}
                    label={label}
                    value={count}
                    max={data.totalLeads || 1}
                    color={color}
                  />
                ))}
              </div>
            </div>

            {/* Feedback section */}
            {data.correcoesTotais > 0 && (
              <div className="card">
                <h3 style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                  Feedbacks de Melhoria
                </h3>
                <p style={{ fontSize: "0.825rem", color: "var(--muted)" }}>
                  Você marcou <strong style={{ color: "#ef4444" }}>{data.correcoesTotais}</strong> respostas como ruins com correção.
                  Esses exemplos podem ser usados para melhorar o prompt do agente.
                </p>
                <div
                  style={{
                    marginTop: "0.875rem",
                    padding: "0.75rem 1rem",
                    background: "#141414",
                    borderRadius: "0.375rem",
                    border: "1px solid var(--card-border)",
                    fontSize: "0.8rem",
                    color: "var(--muted)",
                  }}
                >
                  💡 <strong style={{ color: "var(--foreground)" }}>Dica:</strong> Acesse o Agente e adicione esses exemplos
                  ao System Prompt para treinar respostas melhores.
                </div>
              </div>
            )}

            {/* Tip */}
            {data.feedbackTotal === 0 && (
              <div className="card" style={{ border: "1px solid #adff2f20", background: "var(--accent-dim)" }}>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "1.25rem" }}>💡</span>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--accent)", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
                      Ative o sistema de feedback
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.6 }}>
                      Nas conversas, clique em 👍 ou 👎 nas respostas do bot para treinar o Guilherme
                      com base em exemplos reais. Os dados aparecem aqui.
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
