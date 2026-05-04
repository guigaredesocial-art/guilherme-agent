"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";

interface Operator {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

function getToken() {
  return document.cookie.split(";").find((c) => c.trim().startsWith("token="))?.split("=")[1] ?? "";
}

export default function SettingsPage() {
  const router = useRouter();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState("");
  const [myRole, setMyRole] = useState("");

  // Formulário novo usuário
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "operator" });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk] = useState(false);

  // Alterar senha própria
  const [newPass, setNewPass] = useState("");
  const [savingPass, setSavingPass] = useState(false);
  const [passMsg, setPassMsg] = useState("");

  async function load() {
    const token = getToken();
    if (!token) { router.push("/"); return; }

    // Descobrir quem sou
    const payload = JSON.parse(atob(token.split(".")[1]));
    setMyId(payload.operatorId);

    const res = await fetch("/api/operators", { headers: { authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data: Operator[] = await res.json();
      setOperators(data);
      const me = data.find((o) => o.id === payload.operatorId);
      setMyRole(me?.role ?? "operator");
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createOperator() {
    if (!form.email || !form.password) { setFormError("Email e senha são obrigatórios"); return; }
    setCreating(true);
    setFormError("");
    const token = getToken();
    const res = await fetch("/api/operators", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ email: "", name: "", password: "", role: "operator" });
      setFormOk(true);
      setTimeout(() => setFormOk(false), 3000);
      await load();
    } else {
      setFormError(await res.text());
    }
    setCreating(false);
  }

  async function deleteOperator(id: string) {
    if (!confirm("Remover esse usuário?")) return;
    const token = getToken();
    await fetch(`/api/operators/${id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    setOperators((prev) => prev.filter((o) => o.id !== id));
  }

  async function savePassword() {
    if (!newPass || newPass.length < 6) { setPassMsg("Mínimo 6 caracteres"); return; }
    setSavingPass(true);
    const token = getToken();
    const res = await fetch(`/api/operators/${myId}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ password: newPass }),
    });
    setPassMsg(res.ok ? "✓ Senha alterada!" : "Erro ao alterar senha");
    setNewPass("");
    setSavingPass(false);
    setTimeout(() => setPassMsg(""), 3000);
  }

  const isAdmin = myRole === "admin";

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "1.75rem 2rem", minHeight: "100vh" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, marginBottom: "0.25rem" }}>⚙ Configurações</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.825rem" }}>Gerencie usuários e acesso ao painel</p>
        </div>

        {/* ── Minha conta ───────────────────── */}
        <div className="card" style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: "0.875rem" }}>
            Minha Conta
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--accent-dim)", border: "1px solid #adff2f44", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--accent)", fontSize: "1rem", flexShrink: 0 }}>
              {operators.find((o) => o.id === myId)?.name?.slice(0, 1).toUpperCase() ?? "?"}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                {operators.find((o) => o.id === myId)?.name ?? operators.find((o) => o.id === myId)?.email}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                {operators.find((o) => o.id === myId)?.email}
                <span
                  style={{
                    marginLeft: "0.5rem",
                    padding: "1px 8px",
                    borderRadius: "9999px",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    background: isAdmin ? "var(--accent-dim)" : "#1a1a1a",
                    color: isAdmin ? "var(--accent)" : "#555",
                    border: `1px solid ${isAdmin ? "#adff2f30" : "#222"}`,
                  }}
                >
                  {isAdmin ? "Admin" : "Operador"}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                Nova senha
              </label>
              <input
                type="password"
                className="input"
                placeholder="Mínimo 6 caracteres"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && savePassword()}
              />
            </div>
            <button onClick={savePassword} disabled={savingPass} className="btn-primary" style={{ fontSize: "0.825rem", whiteSpace: "nowrap" }}>
              {savingPass ? "..." : "Alterar Senha"}
            </button>
          </div>
          {passMsg && (
            <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: passMsg.startsWith("✓") ? "#22c55e" : "#ef4444" }}>
              {passMsg}
            </div>
          )}
        </div>

        {/* ── Lista de usuários ─────────────── */}
        <div className="card" style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: "0.875rem" }}>
            Usuários do Painel ({operators.length})
          </div>

          {loading ? (
            <div style={{ color: "var(--muted)", fontSize: "0.825rem" }}>Carregando...</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {operators.map((op) => (
                <div
                  key={op.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.875rem",
                    padding: "0.75rem 0.875rem",
                    background: op.id === myId ? "#adff2f05" : "#141414",
                    borderRadius: "0.5rem",
                    border: `1px solid ${op.id === myId ? "var(--accent)" : "var(--card-border)"}`,
                  }}
                >
                  {/* Avatar */}
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: op.role === "admin" ? "var(--accent-dim)" : "#1a1a1a", border: `1px solid ${op.role === "admin" ? "#adff2f44" : "#2a2a2a"}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: op.role === "admin" ? "var(--accent)" : "#555", fontSize: "0.8rem", flexShrink: 0 }}>
                    {(op.name ?? op.email).slice(0, 1).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                      {op.name ?? "—"}
                      {op.id === myId && <span style={{ fontSize: "0.68rem", color: "var(--accent)", marginLeft: "0.375rem" }}>você</span>}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{op.email}</div>
                  </div>

                  {/* Role badge */}
                  <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 10px", borderRadius: "9999px", background: op.role === "admin" ? "var(--accent-dim)" : "#1a1a1a", color: op.role === "admin" ? "var(--accent)" : "#555", border: `1px solid ${op.role === "admin" ? "#adff2f30" : "#222"}`, flexShrink: 0 }}>
                    {op.role === "admin" ? "Admin" : "Operador"}
                  </span>

                  {/* Delete */}
                  {isAdmin && op.id !== myId && (
                    <button
                      onClick={() => deleteOperator(op.id)}
                      className="btn-danger"
                      style={{ flexShrink: 0, padding: "0.2rem 0.5rem", fontSize: "0.72rem" }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Criar novo usuário (só admin) ─── */}
        {isAdmin && (
          <div className="card">
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: "0.875rem" }}>
              Adicionar Usuário
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>Nome</label>
                <input className="input" placeholder="Ex: João Silva" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>Email</label>
                <input className="input" type="email" placeholder="joao@empresa.com" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>Senha</label>
                <input className="input" type="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>Função</label>
                <select className="input" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
                  <option value="operator">Operador</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            {formError && <div style={{ fontSize: "0.78rem", color: "#ef4444", marginBottom: "0.5rem" }}>{formError}</div>}
            {formOk && <div style={{ fontSize: "0.78rem", color: "#22c55e", marginBottom: "0.5rem" }}>✓ Usuário criado com sucesso!</div>}
            <button onClick={createOperator} disabled={creating} className="btn-primary" style={{ fontSize: "0.825rem" }}>
              {creating ? "Criando..." : "+ Criar Usuário"}
            </button>
            <p style={{ fontSize: "0.72rem", color: "#444", marginTop: "0.75rem", lineHeight: 1.5 }}>
              Admin pode criar/remover usuários e ver todas as configurações. Operador só acessa conversas e CRM.
            </p>
          </div>
        )}

        {!isAdmin && (
          <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🔒</div>
            <div style={{ color: "var(--muted)", fontSize: "0.825rem" }}>
              Somente administradores podem adicionar ou remover usuários.
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
