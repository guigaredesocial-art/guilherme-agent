"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";

interface AIRule {
  id: string;
  priority: number;
  enabled: boolean;
  mode: string;
  params: { keywords?: string[] };
  action: string;
  staticReply?: string;
}

interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  isDefault: boolean;
  ragDocs: Array<{ id: string; fileName: string; _count?: { chunks: number } }>;
  rules: AIRule[];
}

const MODE_LABELS: Record<string, string> = {
  always_on:       "Sempre ativo",
  keyword_trigger: "Ativar por palavra-chave",
  keyword_pause:   "Pausar por palavra-chave",
};

const ACTION_LABELS: Record<string, string> = {
  respond:       "Responder com IA",
  drop:          "Ignorar mensagem",
  handoff:       "Transferir para humano",
  static_reply:  "Resposta fixa",
};

function getToken() {
  return document.cookie.split(";").find((c) => c.trim().startsWith("token="))?.split("=")[1] ?? "";
}

const EMPTY_RULE = {
  mode: "always_on",
  action: "respond",
  enabled: true,
  priority: 0,
  params: { keywords: [] as string[] },
  staticReply: "",
  keywordsRaw: "",
};

export default function AgentDetailPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const [agent, setAgent] = useState<Agent | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);

  // Rules
  const [newRule, setNewRule] = useState({ ...EMPTY_RULE });
  const [addingRule, setAddingRule] = useState(false);
  const [savingRule, setSavingRule] = useState(false);

  async function load() {
    const token = getToken();
    if (!token) { router.push("/"); return; }
    const res = await fetch(`/api/agents/${id}`, { headers: { authorization: `Bearer ${token}` } });
    if (res.ok) setAgent(await res.json());
  }

  useEffect(() => { load(); }, [id]);

  async function save() {
    if (!agent) return;
    setSaving(true);
    const token = getToken();
    await fetch(`/api/agents/${id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        name: agent.name,
        systemPrompt: agent.systemPrompt,
        model: agent.model,
        temperature: agent.temperature,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function uploadDoc(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0] || !agent) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", e.target.files[0]);
    form.append("agentSessionId", agent.id);
    const token = getToken();
    await fetch("/api/rag", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    await load();
    setUploading(false);
    e.target.value = "";
  }

  async function toggleRule(ruleId: string, enabled: boolean) {
    const token = getToken();
    await fetch(`/api/agents/${id}/rules/${ruleId}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    setAgent((prev) =>
      prev ? { ...prev, rules: prev.rules.map((r) => (r.id === ruleId ? { ...r, enabled } : r)) } : prev
    );
  }

  async function deleteRule(ruleId: string) {
    const token = getToken();
    await fetch(`/api/agents/${id}/rules/${ruleId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    setAgent((prev) =>
      prev ? { ...prev, rules: prev.rules.filter((r) => r.id !== ruleId) } : prev
    );
  }

  async function saveNewRule() {
    setSavingRule(true);
    const token = getToken();
    const keywords = newRule.keywordsRaw
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    await fetch(`/api/agents/${id}/rules`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        mode: newRule.mode,
        action: newRule.action,
        enabled: true,
        priority: newRule.priority,
        params: { keywords },
        staticReply: newRule.staticReply || undefined,
      }),
    });
    await load();
    setNewRule({ ...EMPTY_RULE });
    setAddingRule(false);
    setSavingRule(false);
  }

  if (!agent) {
    return (
      <DashboardLayout>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
          <p style={{ color: "var(--muted)" }}>Carregando agente...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "1.75rem 2rem", minHeight: "100vh" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
          <Link href="/agents" style={{ color: "var(--muted)", textDecoration: "none", fontSize: "0.8rem" }}>
            ← Agentes
          </Link>
          <h1 style={{ flex: 1, fontWeight: 700, fontSize: "1.25rem" }}>
            {agent.name}
            {agent.isDefault && (
              <span className="chip" style={{ marginLeft: "0.625rem", background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid #adff2f30", verticalAlign: "middle" }}>
                ● Padrão
              </span>
            )}
          </h1>
          <button onClick={save} className="btn-primary" disabled={saving}>
            {saved ? "✓ Salvo!" : saving ? "Salvando..." : "Salvar Tudo"}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Identidade */}
          <div className="card">
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: "0.875rem" }}>
              Identidade
            </div>
            <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>Nome do agente</label>
            <input
              className="input"
              value={agent.name}
              onChange={(e) => setAgent({ ...agent, name: e.target.value })}
              style={{ marginBottom: "1rem" }}
            />
            <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>
              System Prompt — instrução completa do agente
            </label>
            <textarea
              className="input"
              value={agent.systemPrompt}
              onChange={(e) => setAgent({ ...agent, systemPrompt: e.target.value })}
              rows={12}
              placeholder="Você é um assistente de vendas da Deefasabit IA. Seu objetivo é..."
            />
          </div>

          {/* Modelo */}
          <div className="card">
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: "0.875rem" }}>
              Modelo e Comportamento
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>Modelo Claude</label>
                <select
                  className="input"
                  value={agent.model}
                  onChange={(e) => setAgent({ ...agent, model: e.target.value })}
                >
                  <option value="claude-sonnet-4-6">Sonnet 4.6 — Balanceado (recomendado)</option>
                  <option value="claude-haiku-4-5-20251001">Haiku 4.5 — Rápido e econômico</option>
                  <option value="claude-opus-4-6">Opus 4.6 — Mais inteligente</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  Criatividade: <strong style={{ color: "var(--foreground)" }}>{agent.temperature.toFixed(1)}</strong>
                </label>
                <input
                  type="range" min="0" max="1" step="0.1"
                  value={agent.temperature}
                  onChange={(e) => setAgent({ ...agent, temperature: parseFloat(e.target.value) })}
                  style={{ width: "100%", marginTop: "0.5rem", accentColor: "var(--accent)" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--muted)" }}>
                  <span>Objetivo</span><span>Criativo</span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Regras de IA ─────────────────────────────── */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                  Regras de IA
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>
                  Controle quando e como o bot responde
                </div>
              </div>
              <button
                onClick={() => setAddingRule(true)}
                style={{
                  fontSize: "0.78rem", padding: "0.3rem 0.75rem", borderRadius: "0.375rem",
                  background: "var(--accent-dim)", color: "var(--accent)",
                  border: "1px solid #adff2f30", cursor: "pointer", fontWeight: 600,
                }}
              >
                + Adicionar Regra
              </button>
            </div>

            {/* Add rule form */}
            {addingRule && (
              <div
                style={{
                  padding: "1rem",
                  background: "#141414",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--card-border)",
                  marginBottom: "0.875rem",
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "var(--accent)", fontWeight: 600, marginBottom: "0.75rem" }}>
                  Nova Regra
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  <div>
                    <label style={{ fontSize: "0.72rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>Modo</label>
                    <select
                      className="input"
                      value={newRule.mode}
                      onChange={(e) => setNewRule((p) => ({ ...p, mode: e.target.value }))}
                      style={{ fontSize: "0.825rem" }}
                    >
                      {Object.entries(MODE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.72rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>Ação</label>
                    <select
                      className="input"
                      value={newRule.action}
                      onChange={(e) => setNewRule((p) => ({ ...p, action: e.target.value }))}
                      style={{ fontSize: "0.825rem" }}
                    >
                      {Object.entries(ACTION_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {(newRule.mode === "keyword_trigger" || newRule.mode === "keyword_pause") && (
                  <div style={{ marginBottom: "0.75rem" }}>
                    <label style={{ fontSize: "0.72rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                      Palavras-chave (separadas por vírgula)
                    </label>
                    <input
                      className="input"
                      placeholder="suporte, ajuda, preço, ..."
                      value={newRule.keywordsRaw}
                      onChange={(e) => setNewRule((p) => ({ ...p, keywordsRaw: e.target.value }))}
                      style={{ fontSize: "0.825rem" }}
                    />
                  </div>
                )}
                {newRule.action === "static_reply" && (
                  <div style={{ marginBottom: "0.75rem" }}>
                    <label style={{ fontSize: "0.72rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                      Texto da resposta fixa
                    </label>
                    <textarea
                      className="input"
                      rows={3}
                      placeholder="Olá! Nosso atendimento funciona de segunda a sexta..."
                      value={newRule.staticReply}
                      onChange={(e) => setNewRule((p) => ({ ...p, staticReply: e.target.value }))}
                      style={{ fontSize: "0.825rem" }}
                    />
                  </div>
                )}
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    Prioridade (menor = maior prioridade)
                  </label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    value={newRule.priority}
                    onChange={(e) => setNewRule((p) => ({ ...p, priority: parseInt(e.target.value) || 0 }))}
                    style={{ width: 120, fontSize: "0.825rem" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                  <button onClick={saveNewRule} className="btn-primary" disabled={savingRule} style={{ fontSize: "0.825rem" }}>
                    {savingRule ? "Salvando..." : "Criar Regra"}
                  </button>
                  <button onClick={() => setAddingRule(false)} className="btn-ghost" style={{ fontSize: "0.825rem" }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Rules list */}
            {agent.rules.length === 0 && !addingRule ? (
              <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--muted)", fontSize: "0.825rem" }}>
                Nenhuma regra configurada. O bot responde a todas as mensagens por padrão.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {agent.rules
                  .sort((a, b) => a.priority - b.priority)
                  .map((rule) => (
                    <div
                      key={rule.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.875rem",
                        padding: "0.75rem 0.875rem",
                        background: "#141414",
                        borderRadius: "0.375rem",
                        border: `1px solid ${rule.enabled ? "var(--card-border)" : "#1a1a1a"}`,
                        opacity: rule.enabled ? 1 : 0.5,
                      }}
                    >
                      {/* Toggle */}
                      <label className="toggle" style={{ flexShrink: 0 }}>
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) => toggleRule(rule.id, e.target.checked)}
                        />
                        <span className="toggle-slider" />
                      </label>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.825rem", fontWeight: 500, color: "var(--foreground)" }}>
                          {MODE_LABELS[rule.mode] ?? rule.mode}
                          <span style={{ color: "var(--muted)", fontWeight: 400, marginLeft: "0.5rem" }}>
                            → {ACTION_LABELS[rule.action] ?? rule.action}
                          </span>
                        </div>
                        {rule.params?.keywords && rule.params.keywords.length > 0 && (
                          <div style={{ marginTop: "4px", display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                            {rule.params.keywords.map((kw) => (
                              <span
                                key={kw}
                                style={{
                                  fontSize: "0.68rem",
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                  background: "#222",
                                  color: "var(--muted)",
                                  border: "1px solid #333",
                                }}
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                        {rule.staticReply && (
                          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "3px", fontStyle: "italic" }}>
                            "{rule.staticReply.slice(0, 60)}{rule.staticReply.length > 60 ? "..." : ""}"
                          </div>
                        )}
                      </div>

                      {/* Priority badge */}
                      <span style={{ fontSize: "0.68rem", color: "#555", flexShrink: 0 }}>
                        P{rule.priority}
                      </span>

                      {/* Delete */}
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="btn-danger"
                        style={{ flexShrink: 0, padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* ─── Base de Conhecimento (RAG) ────────── */}
          <div className="card">
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: "0.5rem" }}>
              Base de Conhecimento (RAG)
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginBottom: "1rem", lineHeight: 1.6 }}>
              Suba PDFs, TXTs ou arquivos .md com informações do seu negócio. O agente consulta antes de responder.
            </p>

            {agent.ragDocs.length > 0 && (
              <div style={{ marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {agent.ragDocs.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.5rem 0.75rem",
                      background: "#141414",
                      borderRadius: "0.375rem",
                      border: "1px solid var(--card-border)",
                      fontSize: "0.825rem",
                    }}
                  >
                    <span style={{ fontSize: "1rem" }}>📄</span>
                    <span style={{ flex: 1, color: "var(--foreground)" }}>{doc.fileName}</span>
                    {deletingDoc === doc.id ? (
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>...</span>
                    ) : (
                      <button
                        onClick={async () => {
                          setDeletingDoc(doc.id);
                          const token = getToken();
                          await fetch(`/api/rag?docId=${doc.id}`, {
                            method: "DELETE",
                            headers: { authorization: `Bearer ${token}` },
                          });
                          await load();
                          setDeletingDoc(null);
                        }}
                        className="btn-danger"
                        style={{ padding: "0.15rem 0.5rem", fontSize: "0.72rem" }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <label style={{ cursor: "pointer", display: "inline-block" }}>
              <span
                className="btn-ghost"
                style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.825rem" }}
              >
                {uploading ? "Processando..." : "📎 Subir documento"}
              </span>
              <input
                type="file"
                accept=".txt,.pdf,.md"
                onChange={uploadDoc}
                style={{ display: "none" }}
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
