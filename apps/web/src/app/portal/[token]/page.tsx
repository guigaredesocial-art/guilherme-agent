"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";

const STATUS_CFG: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  em_atendimento:   { label: "Em Atendimento",  color: "#3b82f6", icon: "💬", desc: "Estamos analisando seu caso" },
  qualificado:      { label: "Proposta Pronta",  color: "#f59e0b", icon: "⭐", desc: "Você foi qualificado — aguarde nosso contato" },
  reuniao_agendada: { label: "Reunião Agendada", color: "#a855f7", icon: "📅", desc: "Sua reunião está confirmada" },
  encerrado:        { label: "Atendimento Encerrado", color: "#22c55e", icon: "✅", desc: "Atendimento finalizado com sucesso" },
};

interface Msg {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface PortalData {
  id: string;
  status: string;
  updatedAt: string;
  clientName: string;
  messages: Msg[];
}

export default function PortalPage() {
  const { token } = useParams() as { token: string };
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState(false);
  const [companyName, setCompanyName] = useState("{companyName}");
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch(`/api/portal/${token}`);
      if (!res.ok) { setError(true); return; }
      setData(await res.json());
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    fetch("/api/config").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.companyName) setCompanyName(d.companyName);
    }).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [token]);

  // Rastreamento: registra visita e tempo na proposta
  useEffect(() => {
    const startedAt = Date.now();

    function sendLeft() {
      const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
      navigator.sendBeacon(`/api/portal/${token}/track`, JSON.stringify({ event: "left", durationSeconds }));
    }

    // Registra que abriu o portal
    fetch(`/api/portal/${token}/track`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "viewed" }),
    }).catch(() => {});

    // Quando fechar a aba ou sair
    window.addEventListener("beforeunload", sendLeft);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") sendLeft();
    });

    return () => {
      window.removeEventListener("beforeunload", sendLeft);
    };
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length]);

  if (error) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ textAlign: "center", color: "#555" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔒</div>
        <div style={{ fontSize: "1rem", color: "#888", marginBottom: "0.5rem" }}>Link inválido ou expirado</div>
        <div style={{ fontSize: "0.78rem", color: "#555" }}>Entre em contato pelo WhatsApp para receber um novo link.</div>
      </div>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, border: "3px solid #adff2f30", borderTopColor: "#adff2f", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const statusCfg = STATUS_CFG[data.status] ?? STATUS_CFG.em_atendimento;
  const firstName = data.clientName.split(" ")[0];

  const steps = ["em_atendimento", "qualificado", "reuniao_agendada", "encerrado"];
  const currentStep = steps.indexOf(data.status);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{
        background: "#111",
        borderBottom: "1px solid #1e1e1e",
        padding: "1rem 1.25rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: "0.375rem",
          background: "#adff2f15", border: "1px solid #adff2f44",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.8rem", fontWeight: 700, color: "#adff2f",
        }}>{companyName[0]?.toUpperCase() ?? "G"}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#adff2f" }}>{companyName}</div>
          <div style={{ fontSize: "0.68rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.05em" }}>Portal do Cliente</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px #22c55e88" }} />
          <span style={{ fontSize: "0.7rem", color: "#555" }}>Ao vivo</span>
        </div>
      </div>

      <div style={{ maxWidth: 540, margin: "0 auto", padding: "1.5rem 1rem 6rem" }}>
        {/* Saudação */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.25rem" }}>
            Olá, {firstName}! 👋
          </div>
          <div style={{ fontSize: "0.82rem", color: "#666" }}>
            Acompanhe seu atendimento em tempo real · atualiza a cada 30s
          </div>
        </div>

        {/* Status atual */}
        <div style={{
          background: "#111",
          border: `1px solid ${statusCfg.color}30`,
          borderLeft: `4px solid ${statusCfg.color}`,
          borderRadius: "0.75rem",
          padding: "1rem 1.25rem",
          marginBottom: "1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}>
          <div style={{ fontSize: "1.75rem" }}>{statusCfg.icon}</div>
          <div>
            <div style={{ fontWeight: 700, color: statusCfg.color, fontSize: "0.9rem" }}>{statusCfg.label}</div>
            <div style={{ fontSize: "0.78rem", color: "#777", marginTop: "2px" }}>{statusCfg.desc}</div>
          </div>
        </div>

        {/* Linha do tempo */}
        <div style={{
          background: "#111", border: "1px solid #1e1e1e", borderRadius: "0.75rem",
          padding: "1rem 1.25rem", marginBottom: "1.25rem",
        }}>
          <div style={{ fontSize: "0.72rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.875rem" }}>
            Progresso
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            {steps.map((step, i) => {
              const cfg = STATUS_CFG[step];
              const done = i <= currentStep;
              const active = i === currentStep;
              return (
                <div key={step} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem", minWidth: 48 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: done ? (active ? statusCfg.color : "#22c55e") : "#1a1a1a",
                      border: `2px solid ${done ? (active ? statusCfg.color : "#22c55e") : "#2a2a2a"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.75rem",
                      boxShadow: active ? `0 0 8px ${statusCfg.color}66` : "none",
                      transition: "all 0.3s",
                    }}>
                      {done ? (active ? cfg.icon : "✓") : <span style={{ color: "#444", fontSize: "0.65rem" }}>{i + 1}</span>}
                    </div>
                    <div style={{ fontSize: "0.6rem", color: done ? "#aaa" : "#444", textAlign: "center", lineHeight: 1.2, maxWidth: 44 }}>
                      {cfg.label.split(" ")[0]}
                    </div>
                  </div>
                  {i < steps.length - 1 && (
                    <div style={{
                      flex: 1, height: 2, background: i < currentStep ? "#22c55e" : "#1e1e1e",
                      margin: "0 2px", marginBottom: "1.25rem", transition: "background 0.3s",
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Histórico de mensagens */}
        <div style={{
          background: "#111", border: "1px solid #1e1e1e", borderRadius: "0.75rem",
          padding: "1rem", marginBottom: "1rem",
        }}>
          <div style={{ fontSize: "0.72rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.875rem" }}>
            Histórico da conversa
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", maxHeight: 420, overflowY: "auto" }}>
            {data.messages.length === 0 && (
              <div style={{ textAlign: "center", color: "#444", fontSize: "0.78rem", padding: "1.5rem 0" }}>
                Nenhuma mensagem ainda
              </div>
            )}
            {data.messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div key={msg.id} style={{
                  display: "flex",
                  justifyContent: isUser ? "flex-end" : "flex-start",
                }}>
                  <div style={{
                    maxWidth: "80%",
                    padding: "0.5rem 0.875rem",
                    borderRadius: isUser ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
                    background: isUser ? "#1a2e1a" : "#1a1a1a",
                    border: `1px solid ${isUser ? "#22c55e20" : "#2a2a2a"}`,
                    fontSize: "0.82rem",
                    lineHeight: 1.5,
                    color: isUser ? "#d4f7d4" : "#ccc",
                  }}>
                    <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.content}</div>
                    <div style={{ fontSize: "0.62rem", color: "#444", marginTop: "0.25rem", textAlign: "right" }}>
                      {new Date(msg.createdAt).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Rodapé info */}
        <div style={{ textAlign: "center", fontSize: "0.68rem", color: "#333", padding: "0.5rem 0" }}>
          Atualizado {new Date(data.updatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          {" · "}{companyName} · Painel de Vendas IA
        </div>
      </div>
    </div>
  );
}
