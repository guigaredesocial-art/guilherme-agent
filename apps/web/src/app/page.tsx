"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("guigaredesocial@gmail.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) { setError("Email ou senha incorretos"); return; }
      const { token } = await res.json();
      document.cookie = `token=${token}; path=/; max-age=86400`;
      router.push("/dashboard");
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="card" style={{ width: 380 }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <img src="/defesabit-logo.svg" alt="DefesaBit" style={{ width: "100%", maxWidth: 340, margin: "0 auto 1rem", display: "block" }} />
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent)" }}>DefesaBit</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>Painel de Atendimento IA</p>
        </div>
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%", marginTop: "0.25rem", padding: "0.625rem",
                background: "var(--input-bg)", border: "1px solid var(--card-border)",
                borderRadius: "0.375rem", color: "var(--foreground)", outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%", marginTop: "0.25rem", padding: "0.625rem",
                background: "var(--input-bg)", border: "1px solid var(--card-border)",
                borderRadius: "0.375rem", color: "var(--foreground)", outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>
          {error && <p style={{ color: "#ef4444", fontSize: "0.875rem" }}>{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
