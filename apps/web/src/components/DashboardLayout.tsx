"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard",     icon: "◈",  label: "Dashboard" },
  { href: "/crm",           icon: "◉",  label: "CRM / Leads" },
  { href: "/insights",      icon: "◎",  label: "Insights" },
  { href: "/chat-interno",  icon: "🧠", label: "Chat Interno" },
  { href: "/reminders",     icon: "⏰", label: "Lembretes" },
  { href: "/agents",        icon: "◆",  label: "Agente" },
  { href: "/qrcode",        icon: "◻",  label: "QR Code" },
];

interface Props {
  children: React.ReactNode;
  whatsappStatus?: string;
}

export default function DashboardLayout({ children, whatsappStatus }: Props) {
  const pathname = usePathname();

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
              G
            </span>
            Guilherme
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
            Painel de Vendas IA
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
                <span>{item.label}</span>
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
          <div style={{ fontSize: "0.68rem", color: "#3a3a3a" }}>
            Deefasabit IA · v2.0
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
