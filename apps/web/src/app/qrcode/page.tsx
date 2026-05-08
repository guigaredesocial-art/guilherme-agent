"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";

export default function QRCodePage() {
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState("Verificando...");
  const [loading, setLoading] = useState(true);

  async function checkStatus() {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setStatus(data.evolution ?? "UNKNOWN");
      if (data.evolution === "WORKING") {
        setQr(null);
        return;
      }
      const qrRes = await fetch("/api/whatsapp/qr");
      if (qrRes.ok) {
        const { qrcode } = await qrRes.json();
        setQr(qrcode);
      }
    } catch {
      setStatus("FAILED");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkStatus();
    const t = setInterval(checkStatus, 5000);
    return () => clearInterval(t);
  }, []);

  const isConnected = status === "WORKING";

  return (
    <DashboardLayout whatsappStatus={status}>
      <div className="page-container">
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, marginBottom: "0.25rem" }}>Conectar WhatsApp</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.825rem" }}>Escaneie o QR code para vincular o número ao bot</p>
        </div>

        <div style={{ maxWidth: 480 }}>
          <div className="card" style={{ textAlign: "center" }}>
            {/* Status indicator */}
            <div style={{ marginBottom: "1.5rem" }}>
              <span className={isConnected ? "badge-online" : "badge-offline"} style={{ fontSize: "0.825rem", padding: "0.3rem 1rem" }}>
                {isConnected ? "WhatsApp Conectado" : `Status: ${status}`}
              </span>
            </div>

            {isConnected ? (
              <div style={{ padding: "2rem 0" }}>
                <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#22c55e", marginBottom: "0.5rem" }}>
                  WhatsApp conectado!
                </div>
                <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
                  O agente Guilherme está ativo e respondendo mensagens automaticamente.
                </p>
              </div>
            ) : qr ? (
              <div>
                <p style={{ color: "var(--muted)", fontSize: "0.825rem", marginBottom: "1.25rem", lineHeight: 1.6 }}>
                  Abra o WhatsApp no celular →{" "}
                  <strong>Dispositivos conectados</strong> →{" "}
                  <strong>Conectar dispositivo</strong> → Escaneie:
                </p>
                <div
                  style={{
                    display: "inline-block",
                    padding: "0.75rem",
                    background: "#fff",
                    borderRadius: "0.75rem",
                    border: "3px solid #adff2f44",
                    marginBottom: "1rem",
                  }}
                >
                  <img
                    src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`}
                    alt="QR Code WhatsApp"
                    style={{ width: 240, height: 240, display: "block", borderRadius: "0.375rem" }}
                  />
                </div>
                <p style={{ color: "var(--dim-text)", fontSize: "0.75rem" }}>
                  QR atualiza automaticamente a cada 5 segundos
                </p>
              </div>
            ) : (
              <div style={{ padding: "3rem 0", color: "var(--muted)" }}>
                {loading ? (
                  <div>
                    <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⏳</div>
                    <p>Carregando QR Code...</p>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📱</div>
                    <p>Aguardando QR Code do Evolution API...</p>
                    <p style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>Status: {status}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Instructions */}
          {!isConnected && (
            <div className="card" style={{ marginTop: "1rem" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: "0.75rem" }}>
                Como conectar
              </div>
              {[
                "Abra o WhatsApp no celular",
                "Toque em ⋮ (três pontos) ou Configurações",
                'Selecione "Dispositivos conectados"',
                'Toque em "Conectar dispositivo"',
                "Aponte a câmera para o QR code acima",
              ].map((step, i) => (
                <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "var(--accent-dim)",
                      color: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <span style={{ fontSize: "0.825rem", color: "var(--muted)", paddingTop: "2px" }}>{step}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
