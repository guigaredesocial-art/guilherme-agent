"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";

interface SocialProof {
  id: string;
  name: string;
  mediaUrl: string;
  mediaType: "image" | "video" | "document";
  caption: string;
  triggerHint: string;
  createdAt: string;
}

function getToken() {
  return document.cookie.split(";").find((c) => c.trim().startsWith("token="))?.split("=")[1] ?? "";
}

const MEDIA_ICONS: Record<string, string> = { image: "🖼️", video: "🎥", document: "📄" };
const MEDIA_LABELS: Record<string, string> = { image: "Imagem", video: "Vídeo", document: "Documento" };

const TRIGGER_EXAMPLES = [
  "cliente pede resultado, antes/depois",
  "cliente está desconfiante sobre eficácia",
  "cliente pede depoimento ou prova",
  "cliente hesita na hora de fechar",
  "cliente pergunta se funciona de verdade",
];

export default function ProvasSociaisPage() {
  const router = useRouter();
  const [proofs, setProofs] = useState<SocialProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    mediaUrl: "",
    mediaType: "image" as "image" | "video" | "document",
    caption: "",
    triggerHint: "",
  });

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/"); return; }
    fetchProofs();
  }, []);

  async function fetchProofs() {
    const token = getToken();
    setLoading(true);
    try {
      const r = await fetch("/api/social-proofs", { headers: { authorization: `Bearer ${token}` } });
      const d = await r.json();
      setProofs(Array.isArray(d) ? d : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function save() {
    if (!form.name.trim() || !form.mediaUrl.trim()) {
      alert("Preencha o nome e a URL da mídia.");
      return;
    }
    setSaving(true);
    const token = getToken();
    try {
      const r = await fetch("/api/social-proofs", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error("Erro ao salvar");
      await fetchProofs();
      setForm({ name: "", mediaUrl: "", mediaType: "image", caption: "", triggerHint: "" });
      setShowForm(false);
    } catch (e) {
      alert("Erro ao salvar: " + String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Remover "${name}"?`)) return;
    const token = getToken();
    await fetch(`/api/social-proofs/${id}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
    setProofs((p) => p.filter((x) => x.id !== id));
  }

  return (
    <DashboardLayout>
      <div style={{ padding: "1.75rem 2rem", minHeight: "100vh" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "1.375rem", fontWeight: 700, marginBottom: "0.25rem" }}>Provas Sociais</h1>
            <p style={{ color: "var(--muted)", fontSize: "0.825rem" }}>
              Fotos e vídeos que o agente envia automaticamente para quebrar objeções
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary"
            style={{ flexShrink: 0 }}
          >
            + Adicionar Prova
          </button>
        </div>

        {/* Como funciona */}
        <div className="card" style={{ marginBottom: "1.25rem", padding: "1rem 1.25rem", borderLeft: "3px solid var(--accent)" }}>
          <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem" }}>Como funciona</div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.6 }}>
            O agente Guilherme analisa cada conversa. Quando detectar o momento certo (cliente desconfiante, pedindo prova de resultado ou depoimento), ele envia automaticamente a foto ou vídeo cadastrado aqui — junto com a legenda que você definiu.
            <br />
            <strong style={{ color: "var(--accent)" }}>Dica:</strong> Use URLs públicas (Google Drive compartilhado, Dropbox, link direto de imagem). O WhatsApp precisa conseguir baixar o arquivo pela URL.
          </div>
        </div>

        {/* Formulário */}
        {showForm && (
          <div className="card" style={{ marginBottom: "1.25rem", padding: "1.25rem" }}>
            <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "1rem" }}>Nova Prova Social</div>

            <div style={{ display: "grid", gap: "0.875rem" }}>
              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginBottom: "0.35rem" }}>
                  Nome interno *
                </label>
                <input
                  className="input"
                  placeholder="Ex: Resultado 30 dias - Cliente Maria"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginBottom: "0.35rem" }}>
                    URL da mídia *
                  </label>
                  <input
                    className="input"
                    placeholder="https://drive.google.com/... ou link direto"
                    value={form.mediaUrl}
                    onChange={(e) => setForm((f) => ({ ...f, mediaUrl: e.target.value }))}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginBottom: "0.35rem" }}>
                    Tipo
                  </label>
                  <select
                    className="input"
                    value={form.mediaType}
                    onChange={(e) => setForm((f) => ({ ...f, mediaType: e.target.value as "image" | "video" | "document" }))}
                    style={{ minWidth: 110 }}
                  >
                    <option value="image">🖼️ Imagem</option>
                    <option value="video">🎥 Vídeo</option>
                    <option value="document">📄 Documento</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginBottom: "0.35rem" }}>
                  Legenda (texto enviado junto com a mídia)
                </label>
                <input
                  className="input"
                  placeholder="Ex: Resultado real de um dos nossos clientes em 30 dias! 🔥"
                  value={form.caption}
                  onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginBottom: "0.35rem" }}>
                  Quando o agente deve enviar esta prova?
                </label>
                <input
                  className="input"
                  placeholder="Ex: cliente pede resultado, está desconfiante, quer ver antes e depois"
                  value={form.triggerHint}
                  onChange={(e) => setForm((f) => ({ ...f, triggerHint: e.target.value }))}
                  style={{ width: "100%" }}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.5rem" }}>
                  {TRIGGER_EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setForm((f) => ({ ...f, triggerHint: ex }))}
                      style={{ padding: "0.2rem 0.6rem", borderRadius: "9999px", border: "1px solid var(--card-border)", background: "var(--input-bg)", color: "var(--muted)", fontSize: "0.7rem", cursor: "pointer" }}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.625rem", marginTop: "1rem" }}>
              <button className="btn-primary" onClick={save} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
              <button
                onClick={() => { setShowForm(false); setForm({ name: "", mediaUrl: "", mediaType: "image", caption: "", triggerHint: "" }); }}
                style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "1px solid var(--card-border)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: "0.825rem" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[1, 2].map((i) => <div key={i} className="card" style={{ height: 88, opacity: 0.4 }} />)}
          </div>
        ) : proofs.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🖼️</div>
            <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.35rem" }}>Nenhuma prova cadastrada</div>
            <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
              Adicione fotos de resultados, vídeos de depoimentos e prints para o agente enviar automaticamente
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {proofs.map((p) => (
              <div key={p.id} className="card" style={{ padding: "1rem 1.25rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>

                  {/* Preview miniatura para imagens */}
                  <div style={{ flexShrink: 0 }}>
                    {p.mediaType === "image" ? (
                      <div
                        onClick={() => setPreviewId(previewId === p.id ? null : p.id)}
                        style={{ width: 56, height: 56, borderRadius: "0.5rem", border: "1px solid var(--card-border)", overflow: "hidden", cursor: "pointer", background: "var(--input-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <img
                          src={p.mediaUrl}
                          alt={p.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.parentElement as HTMLElement).innerText = "🖼️"; }}
                        />
                      </div>
                    ) : (
                      <div style={{ width: 56, height: 56, borderRadius: "0.5rem", border: "1px solid var(--card-border)", background: "var(--input-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.75rem" }}>
                        {MEDIA_ICONS[p.mediaType]}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{p.name}</span>
                      <span style={{ fontSize: "0.68rem", padding: "0.1rem 0.5rem", borderRadius: "9999px", background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid #adff2f30" }}>
                        {MEDIA_ICONS[p.mediaType]} {MEDIA_LABELS[p.mediaType]}
                      </span>
                    </div>
                    {p.caption && (
                      <div style={{ fontSize: "0.78rem", color: "var(--muted-light)", marginBottom: "0.25rem" }}>
                        💬 {p.caption}
                      </div>
                    )}
                    {p.triggerHint && (
                      <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                        🎯 Enviar quando: {p.triggerHint}
                      </div>
                    )}
                    <div style={{ fontSize: "0.65rem", color: "var(--muted)", marginTop: "0.25rem", opacity: 0.6 }}>
                      ID: {p.id}
                    </div>
                  </div>

                  {/* Ações */}
                  <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                    <a
                      href={p.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ padding: "0.35rem 0.75rem", borderRadius: "0.375rem", border: "1px solid var(--card-border)", background: "transparent", color: "var(--muted)", fontSize: "0.72rem", cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center" }}
                    >
                      Ver
                    </a>
                    <button
                      onClick={() => remove(p.id, p.name)}
                      style={{ padding: "0.35rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #ef444430", background: "transparent", color: "#ef4444", fontSize: "0.72rem", cursor: "pointer" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#ef44441a"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                    >
                      Remover
                    </button>
                  </div>
                </div>

                {/* Preview expandido */}
                {previewId === p.id && p.mediaType === "image" && (
                  <div style={{ marginTop: "0.875rem", borderTop: "1px solid var(--card-border)", paddingTop: "0.875rem" }}>
                    <img
                      src={p.mediaUrl}
                      alt={p.name}
                      style={{ maxWidth: "100%", maxHeight: 320, borderRadius: "0.5rem", border: "1px solid var(--card-border)" }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
