"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";

interface Agent {
  id: string;
  name: string;
  model: string;
  isDefault: boolean;
  ragDocs: unknown[];
  rules: unknown[];
}

function getToken() {
  return document.cookie.split(";").find((c) => c.trim().startsWith("token="))?.split("=")[1] ?? "";
}

const MODEL_LABELS: Record<string, string> = {
  "claude-sonnet-4-6": "Sonnet 4.6 · Balanceado",
  "claude-haiku-4-5-20251001": "Haiku 4.5 · Rápido",
  "claude-opus-4-6": "Opus 4.6 · Poderoso",
};

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/"); return; }
    fetch("/api/agents", { headers: { authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setAgents(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <div style={{ padding: "1.75rem 2rem", minHeight: "100vh" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, marginBottom: "0.25rem" }}>Agentes de IA</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.825rem" }}>Configure o comportamento e conhecimento do bot</p>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[1].map((i) => <div key={i} className="card" style={{ height: 88, opacity: 0.4 }} />)}
          </div>
        ) : agents.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon">🤖</div>
            <div className="empty-state-title">Nenhum agente configurado</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="card"
                style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "0.5rem",
                    background: "var(--accent-dim)",
                    border: "1px solid #adff2f30",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.25rem",
                    flexShrink: 0,
                  }}
                >
                  🤖
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{agent.name}</span>
                    {agent.isDefault && (
                      <span
                        className="chip"
                        style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid #adff2f30" }}
                      >
                        ● Padrão
                      </span>
                    )}
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: "0.8rem", marginTop: "3px", display: "flex", gap: "1rem" }}>
                    <span>{MODEL_LABELS[agent.model] ?? agent.model}</span>
                    <span>{(agent.ragDocs as unknown[])?.length ?? 0} doc(s) RAG</span>
                    <span>{(agent.rules as unknown[])?.length ?? 0} regra(s)</span>
                  </div>
                </div>

                <Link
                  href={`/agents/${agent.id}`}
                  className="btn-ghost"
                  style={{ textDecoration: "none", flexShrink: 0 }}
                >
                  Configurar →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
