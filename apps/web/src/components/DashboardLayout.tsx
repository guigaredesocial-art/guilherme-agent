"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";

const NAV = [
  { href: "/dashboard",    icon: "◈",  label: "Dashboard" },
  { href: "/crm",          icon: "◉",  label: "CRM / Leads" },
  { href: "/insights",     icon: "◎",  label: "Insights" },
  { href: "/chat-interno", icon: "🧠", label: "Chat Interno" },
  { href: "/reminders",    icon: "⏰", label: "Lembretes" },
  { href: "/agents",       icon: "◆",  label: "Agente" },
  { href: "/settings",     icon: "⚙",  label: "Configurações" },
  { href: "/qrcode",       icon: "◻",  label: "QR Code" },
];

interface Props {
  children: React.ReactNode;
  whatsappStatus?: string;
}

export default function DashboardLayout({ children, whatsappStatus }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [alertCount, setAlertCount] = useState(0);
  const [companyName, setCompanyName] = useState("DefesaBit");
  const [agentLabel, setAgentLabel] = useState("Painel de Atendimento IA");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detecta mobile
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Fecha sidebar ao navegar no mobile
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

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

  const sidebarContent = (
    <>
      {/* Logo */}
      <div style={{ padding: "1.25rem 1.25rem 1rem", borderBottom: "1px solid var(--card-border)" }}>
        <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--accent)", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <img src="/defesabit-icon.svg" alt="DefesaBit" style={{ width: 28, height: 28, flexShrink: 0, borderRadius: "0.375rem" }} />
          {companyName}
        </div>
        <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "3px", paddingLeft: "2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {agentLabel}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "0.875rem 0.75rem", flex: 1, overflowY: "auto" }}>
        <div className="section-title" style={{ marginBottom: "0.625rem" }}>Menu</div>
        {NAV.map((item) => {
          const isActive =
            item.href === "/dashboard" ? pathname === "/dashboard"
            : item.href === "/agents" ? pathname === "/agents" || pathname.startsWith("/agents/")
            : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`nav-link${isActive ? " active" : ""}`}>
              <span style={{ width: 20, textAlign: "center", fontSize: "0.8rem", opacity: isActive ? 1 : 0.6 }}>
                {item.icon}
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.href === "/crm" && alertCount > 0 && (
                <span style={{ background: "#ef4444", color: "#fff", fontSize: "0.6rem", fontWeight: 700, borderRadius: "9999px", padding: "1px 6px", minWidth: 16, textAlign: "center" }}>
                  {alertCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: "0.875rem 1.25rem", borderTop: "1px solid var(--card-border)" }}>
        {/* WhatsApp status */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.625rem", borderRadius: "0.375rem", background: "var(--input-bg)", border: "1px solid var(--card-border)", marginBottom: "0.75rem" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: whatsappStatus === "WORKING" ? "#22c55e" : "#f59e0b", boxShadow: whatsappStatus === "WORKING" ? "0 0 6px #22c55e88" : "0 0 6px #f59e0b88", flexShrink: 0 }} />
          <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
            WhatsApp {whatsappStatus === "WORKING" ? "Online" : whatsappStatus ?? "..."}
          </span>
        </div>

        <button onClick={toggle} style={{ width: "100%", padding: "0.45rem 0.75rem", borderRadius: "0.375rem", background: "transparent", border: "1px solid var(--card-border)", color: "var(--muted)", fontSize: "0.72rem", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <span>{theme === "dark" ? "☀" : "🌙"}</span>
          {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
        </button>

        <button
          onClick={logout}
          style={{ width: "100%", padding: "0.45rem 0.75rem", borderRadius: "0.375rem", background: "transparent", border: "1px solid var(--card-border)", color: "var(--muted)", fontSize: "0.72rem", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#ef444440"; (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--card-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}
        >
          <span>⎋</span> Sair
        </button>
        <div style={{ fontSize: "0.68rem", color: "var(--muted)", opacity: 0.5 }}>{companyName} · IA v2.0</div>
      </div>
    </>
  );

  // ── MOBILE ──
  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--background)" }}>
        {/* Top bar mobile */}
        <header style={{ position: "fixed", top: 0, left: 0, right: 0, height: 52, background: "var(--sidebar)", borderBottom: "1px solid var(--card-border)", display: "flex", alignItems: "center", padding: "0 1rem", gap: "0.75rem", zIndex: 100 }}>
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ background: "none", border: "none", color: "var(--foreground)", fontSize: "1.25rem", cursor: "pointer", padding: "4px", lineHeight: 1, flexShrink: 0 }}
          >
            ☰
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}>
            <img src="/defesabit-icon.svg" alt="DefesaBit" style={{ width: 24, height: 24, borderRadius: "0.25rem" }} />
            <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: "0.95rem" }}>{companyName}</span>
          </div>
          {/* Status WA + alertas */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: whatsappStatus === "WORKING" ? "#22c55e" : "#f59e0b", boxShadow: whatsappStatus === "WORKING" ? "0 0 6px #22c55e88" : "0 0 6px #f59e0b88" }} />
            {alertCount > 0 && (
              <span style={{ background: "#ef4444", color: "#fff", fontSize: "0.65rem", fontWeight: 700, borderRadius: "9999px", padding: "1px 7px" }}>{alertCount}</span>
            )}
          </div>
        </header>

        {/* Overlay escuro */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 150 }}
          />
        )}

        {/* Sidebar gaveta */}
        <aside style={{
          position: "fixed", top: 0, left: 0, height: "100vh", width: 260,
          background: "var(--sidebar)", borderRight: "1px solid var(--card-border)",
          display: "flex", flexDirection: "column", zIndex: 200,
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1.25rem", borderBottom: "1px solid var(--card-border)" }}>
            <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: "0.9rem" }}>{companyName}</span>
            <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "1.25rem", cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            {/* Nav */}
            <nav style={{ padding: "0.875rem 0.75rem", flex: 1 }}>
              <div className="section-title" style={{ marginBottom: "0.625rem" }}>Menu</div>
              {NAV.map((item) => {
                const isActive =
                  item.href === "/dashboard" ? pathname === "/dashboard"
                  : item.href === "/agents" ? pathname === "/agents" || pathname.startsWith("/agents/")
                  : pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} className={`nav-link${isActive ? " active" : ""}`} style={{ fontSize: "1rem", padding: "0.625rem 0.75rem" }}>
                    <span style={{ width: 24, textAlign: "center", fontSize: "1rem", opacity: isActive ? 1 : 0.6 }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.href === "/crm" && alertCount > 0 && (
                      <span style={{ background: "#ef4444", color: "#fff", fontSize: "0.65rem", fontWeight: 700, borderRadius: "9999px", padding: "1px 7px" }}>{alertCount}</span>
                    )}
                  </Link>
                );
              })}
            </nav>
            {/* Footer mobile sidebar */}
            <div style={{ padding: "0.875rem 1.25rem", borderTop: "1px solid var(--card-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.625rem", borderRadius: "0.375rem", background: "var(--input-bg)", border: "1px solid var(--card-border)", marginBottom: "0.75rem" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: whatsappStatus === "WORKING" ? "#22c55e" : "#f59e0b", flexShrink: 0 }} />
                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>WA {whatsappStatus === "WORKING" ? "Online" : "Offline"}</span>
              </div>
              <button onClick={toggle} style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "0.375rem", background: "transparent", border: "1px solid var(--card-border)", color: "var(--muted)", fontSize: "0.8rem", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span>{theme === "dark" ? "☀" : "🌙"}</span> {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
              </button>
              <button onClick={logout} style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "0.375rem", background: "#ef444418", border: "1px solid #ef444430", color: "#ef4444", fontSize: "0.8rem", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span>⎋</span> Sair
              </button>
            </div>
          </div>
        </aside>

        {/* Conteúdo principal mobile */}
        <main style={{ paddingTop: 52, minHeight: "100vh", background: "var(--background)" }}>
          {children}
        </main>
      </div>
    );
  }

  // ── DESKTOP ──
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside style={{ width: 224, background: "var(--sidebar)", borderRight: "1px solid var(--card-border)", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 50 }}>
        {sidebarContent}
      </aside>
      <main style={{ marginLeft: 224, flex: 1, minHeight: "100vh", background: "var(--background)" }}>
        {children}
      </main>
    </div>
  );
}
