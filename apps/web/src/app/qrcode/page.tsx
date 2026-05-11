"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";

type DiagStep = { label: string; status: "ok" | "fail" | "loading" | "idle"; detail?: string };

export default function QRCodePage() {
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState("Verificando...");
  const [loading, setLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [diagSteps, setDiagSteps] = useState<DiagStep[]>([
    { label: "Servidor do painel (Railway)", status: "idle" },
    { label: "Evolution API (VPS)", status: "idle" },
    { label: "Instância WhatsApp criada", status: "idle" },
    { label: "Sessão do WhatsApp ativa", status: "idle" },
  ]);
  const [rawData, setRawData] = useState<string>("");

  function updateStep(index: number, update: Partial<DiagStep>) {
    setDiagSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...update } : s)));
  }

  async function runDiagnostic() {
    setLoading(true);
    setRawData("");

    // Step 0: painel online
    updateStep(0, { status: "loading" });
    updateStep(1, { status: "idle" });
    updateStep(2, { status: "idle" });
    updateStep(3, { status: "idle" });

    await new Promise((r) => setTimeout(r, 300));
    updateStep(0, { status: "ok", detail: "Painel online ✓" });

    // Step 1: Evolution API health
    updateStep(1, { status: "loading" });
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      const evState = data.evolution ?? "UNKNOWN";
      setStatus(evState);
      setRawData(JSON.stringify(data, null, 2));

      if (evState === "FAILED" || evState === "UNKNOWN") {
        updateStep(1, { status: "fail", detail: `Evolution API não responde (${evState})` });
        updateStep(2, { status: "fail", detail: "Não verificado" });
        updateStep(3, { status: "fail", detail: "Não verificado" });
        setLoading(false);
        return;
      }

      updateStep(1, { status: "ok", detail: `Evolution API online (${evState})` });

      // Step 2: instância existe
      updateStep(2, { status: "loading" });
      if (evState === "SCAN_QR" || evState === "WORKING" || evState === "STOPPED" || evState === "STARTING") {
        updateStep(2, { status: "ok", detail: "Instância criada ✓" });
      } else {
        updateStep(2, { status: "fail", detail: "Instância não encontrada" });
        updateStep(3, { status: "fail", detail: "Não verificado" });
        setLoading(false);
        return;
      }

      // Step 3: sessão
      updateStep(3, { status: "loading" });
      if (evState === "WORKING") {
        updateStep(3, { status: "ok", detail: "WhatsApp conectado e ativo ✓" });
        setQr(null);
      } else {
        updateStep(3, {
          status: "fail",
          detail: evState === "SCAN_QR"
            ? "Aguardando leitura do QR Code"
            : `Sessão encerrada (${evState}) — reconecte`,
        });
        // Buscar QR
        const qrRes = await fetch("/api/whatsapp/qr");
        if (qrRes.ok) {
          const { qrcode } = await qrRes.json();
          setQr(qrcode ?? null);
        }
      }
    } catch (e) {
      updateStep(1, { status: "fail", detail: `Erro de rede: ${String(e)}` });
      updateStep(2, { status: "fail", detail: "Não verificado" });
      updateStep(3, { status: "fail", detail: "Não verificado" });
      setStatus("FAILED");
    }

    setLoading(false);
  }

  async function forceReconnect() {
    setReconnecting(true);
    setQr(null);
    try {
      // Chama ensureEvolutionInstance via endpoint dedicado
      await fetch("/api/whatsapp/reconnect", { method: "POST" });
      await new Promise((r) => setTimeout(r, 2000));
      await runDiagnostic();
    } catch {
      // silently continue
    }
    setReconnecting(false);
  }

  useEffect(() => {
    runDiagnostic();
    const t = setInterval(runDiagnostic, 8000);
    return () => clearInterval(t);
  }, []);

  const isConnected = status === "WORKING";
  const stepColors: Record<string, string> = {
    ok: "#22c55e",
    fail: "#ef4444",
    loading: "#f59e0b",
    idle: "#6b7280",
  };
  const stepIcons: Record<string, string> = {
    ok: "✓",
    fail: "✗",
    loading: "⟳",
    idle: "○",
  };

  return (
    <DashboardLayout whatsappStatus={status}>
      <div className="page-container">
        <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h1 style={{ fontSize: "1.375rem", fontWeight: 700, marginBottom: "0.25rem" }}>Conexão WhatsApp</h1>
            <p style={{ color: "var(--muted)", fontSize: "0.825rem" }}>
              Diagnóstico completo e reconexão da instância Evolution API
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={runDiagnostic}
              disabled={loading}
              className="btn-ghost"
              style={{ fontSize: "0.825rem", opacity: loading ? 0.5 : 1 }}
            >
              {loading ? "⟳ Verificando..." : "↻ Verificar"}
            </button>
            {!isConnected && (
              <button
                onClick={forceReconnect}
                disabled={reconnecting}
                className="btn-primary"
                style={{ fontSize: "0.825rem" }}
              >
                {reconnecting ? "⟳ Reconectando..." : "⚡ Forçar Reconexão"}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", maxWidth: 880 }}>

          {/* Diagnóstico */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div className="card">
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: "1rem" }}>
                🔍 Diagnóstico em tempo real
              </div>
              {diagSteps.map((step, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    padding: "0.625rem 0.75rem",
                    borderRadius: "0.375rem",
                    background: step.status === "ok" ? "#22c55e08" : step.status === "fail" ? "#ef444408" : "transparent",
                    border: `1px solid ${step.status === "ok" ? "#22c55e20" : step.status === "fail" ? "#ef444420" : "transparent"}`,
                    marginBottom: "0.375rem",
                    transition: "all 0.2s",
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: stepColors[step.status] + "20",
                      border: `1px solid ${stepColors[step.status]}50`,
                      color: stepColors[step.status],
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      flexShrink: 0,
                      animation: step.status === "loading" ? "spin 1s linear infinite" : "none",
                    }}
                  >
                    {stepIcons[step.status]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.825rem", fontWeight: 500, color: step.status === "idle" ? "var(--muted)" : "var(--foreground)" }}>
                      {step.label}
                    </div>
                    {step.detail && (
                      <div style={{ fontSize: "0.72rem", color: stepColors[step.status], marginTop: "2px" }}>
                        {step.detail}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Status geral */}
            <div className="card" style={{ padding: "0.875rem 1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: isConnected ? "#22c55e" : "#ef4444",
                  boxShadow: isConnected ? "0 0 8px #22c55e88" : "0 0 8px #ef444488",
                  flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.925rem" }}>
                    WhatsApp: {isConnected ? "Conectado ✓" : status === "SCAN_QR" ? "Aguardando QR" : `Desconectado (${status})`}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "2px" }}>
                    Atualiza a cada 8 segundos automaticamente
                  </div>
                </div>
              </div>
            </div>

            {/* Solução para cada estado */}
            {!isConnected && (
              <div className="card" style={{ padding: "1rem", background: "#f59e0b08", border: "1px solid #f59e0b30" }}>
                <div style={{ fontSize: "0.72rem", color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: "0.75rem" }}>
                  ⚠ O que fazer agora
                </div>
                {status === "FAILED" || status === "UNKNOWN" ? (
                  <div style={{ fontSize: "0.825rem", color: "var(--foreground)", lineHeight: 1.6 }}>
                    <p style={{ marginBottom: "0.5rem" }}>A <strong>Evolution API (VPS)</strong> não está respondendo. Possíveis causas:</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      {["O serviço Evolution API caiu no VPS — precisa reiniciar via SSH", "O IP do VPS mudou — verificar variável EVOLUTION_BASE_URL no Railway", "Firewall bloqueou a porta 8080 no VPS"].map((t, i) => (
                        <div key={i} style={{ display: "flex", gap: "0.5rem", fontSize: "0.78rem", color: "var(--muted)" }}>
                          <span style={{ color: "#ef4444", flexShrink: 0 }}>•</span> {t}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: "0.825rem", lineHeight: 1.6 }}>
                    <p style={{ color: "var(--muted)", marginBottom: "0.5rem" }}>Clique em <strong style={{ color: "var(--foreground)" }}>⚡ Forçar Reconexão</strong> e depois escaneie o QR Code ao lado com seu celular:</p>
                    {["Abra o WhatsApp no celular", "Toque em ⋮ → Dispositivos conectados", "Toque em "Conectar dispositivo"", "Aponte a câmera para o QR Code"].map((step, i) => (
                      <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.375rem" }}>
                        <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--accent-dim)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                        <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* QR Code */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div className="card" style={{ textAlign: "center", flex: 1 }}>
              {isConnected ? (
                <div style={{ padding: "3rem 1rem" }}>
                  <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>✅</div>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#22c55e", marginBottom: "0.5rem" }}>
                    WhatsApp Conectado!
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: "0.875rem", lineHeight: 1.6 }}>
                    O painel está recebendo mensagens.<br />
                    A IA está funcionando como Gerente — gerando sugestões para você aprovar.
                  </p>
                </div>
              ) : qr ? (
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: "1rem" }}>
                    📱 QR Code — Escaneie com o celular
                  </div>
                  <div
                    style={{
                      display: "inline-block",
                      padding: "0.875rem",
                      background: "#fff",
                      borderRadius: "0.875rem",
                      border: "3px solid #adff2f55",
                      marginBottom: "0.875rem",
                      boxShadow: "0 0 30px #adff2f18",
                    }}
                  >
                    <img
                      src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`}
                      alt="QR Code WhatsApp"
                      style={{ width: 240, height: 240, display: "block", borderRadius: "0.375rem" }}
                    />
                  </div>
                  <p style={{ color: "var(--dim-text)", fontSize: "0.75rem" }}>
                    QR atualiza automaticamente a cada 8 segundos
                  </p>
                </div>
              ) : (
                <div style={{ padding: "3rem 1rem" }}>
                  <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>
                    {status === "FAILED" || status === "UNKNOWN" ? "🔴" : "⏳"}
                  </div>
                  <div style={{ fontWeight: 600, color: "var(--muted-light)", marginBottom: "0.5rem" }}>
                    {status === "FAILED" || status === "UNKNOWN"
                      ? "Evolution API offline"
                      : loading
                      ? "Carregando QR Code..."
                      : "Aguardando QR Code..."}
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Status: {status}</p>
                  {!loading && status !== "FAILED" && status !== "UNKNOWN" && (
                    <button onClick={forceReconnect} disabled={reconnecting} className="btn-primary" style={{ marginTop: "1rem", fontSize: "0.825rem" }}>
                      {reconnecting ? "⟳ Aguarde..." : "⚡ Gerar QR Code"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 767px) {
          .qr-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </DashboardLayout>
  );
}
