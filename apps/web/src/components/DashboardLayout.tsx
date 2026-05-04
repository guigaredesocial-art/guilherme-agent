"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/dashboard",     icon: "◈",  label: "Dashboard" },
  { href: "/crm",           icon: "◉",  label: "CRM / Leads" },
  { href: "/insights",      icon: "◎",  label: "Insights" },
  { href: "/chat-interno",  icon: "🧠", label: "Chat Interno" },
  { href: "/reminders",     icon: "⏰", label: "Lembretes" },
  { href: "/agents",        icon: "◆",  label: "Agente" },
  { href: "/settings",      icon: "⚙",  label: "Configurações" },
  { href: "/qrcode",        icon: "◻",  label: "QR Code" },
];

interface Props {
  children: React.ReactNode;
  whatsappStatus?: string;
}

export default function DashboardLayout({ children, whatsappStatus }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [alertCount, setAlertCount] = useState(0);
  const [companyName, setCompanyName] = useState("Guilherme");
  const [agentLabel, setAgentLabel] = useState("Painel de Vendas IA");

  useEffect(() => {
    fetch("/api/config").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.companyName) setCompanyName(d.companyName);
      if (d?.agentLabel) setAgentLabel(d.agentLabel);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    function fetchAlerts() {
      const token = document.cookie.split(";").find((c) => c.trim().startsWith("token="))?.split("=")[1] ?? "";
      if (!token) return;
      fetch("/api/alerts", { headers: { authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d && setAlertCount(d.total ?? 0))
        .catch(() => {});
    }
    fetchAlerts();
    const t = setInterval(fetchAlerts, 30000);
    return () => clearInterval(t);
  }, []);

  function logout() {
    document.cookie = "token=; path=/; max-age=0";
    router.push("/");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* ─── Sidebar ─────────────────────── */}
      <aside
        style={{
          width: 224,
          background: "var(--sidebar)",
          borderRight: "1px solid var(--card-border)",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          zIndex: 50,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: "1.25rem 1.25rem 1rem",
            borderBottom: "1px solid var(--card-border)",
          }}
        >
          <div
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "var(--accent)",
              letterSpacing: "-0.02em",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: "0.375rem",
                background: "var(--accent-dim)",
                border: "1px solid #adff2f44",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
              }}
            >
              {companyName[0]?.toUpperCase() ?? "G"}
            </span>
            {companyName}
          </div>
          <div
            style={{
              fontSize: "0.7rem",
              color: "var(--muted)",
              marginTop: "3px",
              paddingLeft: "2px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {agentLabel}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "0.875rem 0.75rem", flex: 1, overflowY: "auto" }}>
          <div className="section-title" style={{ marginBottom: "0.625rem" }}>
            Menu
          </div>
          {NAV.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : item.href === "/agents"
                ? pathname === "/agents" || pathname.startsWith("/agents/")
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link${isActive ? " active" : ""}`}
              >
                <span
                  style={{
                    width: 20,
                    textAlign: "center",
                    fontSize: "0.8rem",
                    opacity: isActive ? 1 : 0.6,
                  }}
                >
                  {item.icon}
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.href === "/crm" && alertCount > 0 && (
                  <span style={{
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    borderRadius: "9999px",
                    padding: "1px 6px",
                    minWidth: 16,
                    textAlign: "center",
                    animation: "pulse 2s infinite",
                  }}>
                    {alertCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          style={{
            padding: "0.875rem 1.25rem",
            borderTop: "1px solid var(--card-border)",
          }}
        >
          {/* WhatsApp status */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 0.625rem",
              borderRadius: "0.375rem",
              background: "#141414",
              border: "1px solid var(--card-border)",
              marginBottom: "0.75rem",
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background:
                  whatsappStatus === "WORKING" ? "#22c55e" : "#f59e0b",
                boxShadow:
                  whatsappStatus === "WORKING"
                    ? "0 0 6px #22c55e88"
                    : "0 0 6px #f59e0b88",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
              WhatsApp{" "}
              {whatsappStatus === "WORKING"
                ? "Online"
                : whatsappStatus
                ? whatsappStatus
                : "..."}
            </span>
          </div>
          <button
            onClick={logout}
            style={{
              width: "100%",
              padding: "0.45rem 0.75rem",
              borderRadius: "0.375rem",
              background: "transparent",
              border: "1px solid #2a2a2a",
              color: "#555",
              fontSize: "0.72rem",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.5rem",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#ef444440";
              (e.currentTarget as HTMLButtonElement).style.color = "#ef4444";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2a2a";
              (e.currentTarget as HTMLButtonElement).style.color = "#555";
            }}
          >
            <span>⎋</span> Sair
          </button>
          <div style={{ fontSize: "0.68rem", color: "#3a3a3a" }}>
            {companyName} · IA v2.0
          </div>
        </div>
      </aside>

      {/* ─── Main content ────────────────── */}
      <main
        style={{
          marginLeft: 224,
          flex: 1,
          minHeight: "100vh",
          background: "var(--background)",
        }}
      >
        {children}
      </main>
    </div>
  );
}
