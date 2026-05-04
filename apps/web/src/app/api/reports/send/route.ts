import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperator } from "@/lib/auth";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  const op = await verifyOperator(req);
  if (!op) return new Response("unauthorized", { status: 401 });

  const { to } = await req.json().catch(() => ({}));
  const destino = to || process.env.REPORT_EMAIL || process.env.SMTP_USER;
  if (!destino) return new Response("Configure REPORT_EMAIL nas variáveis de ambiente do Railway", { status: 400 });

  // ── Coleta dados ──────────────────────────────────────────────
  const now = new Date();
  const semanaAtras = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const hoje = new Date(now.toDateString());

  const [totalConvs, convsHoje, convsSemana, totalLeads, leadsHoje, leadsPorStatus, leadsQuentes, reunioes, pendentes] =
    await Promise.all([
      prisma.conversation.count(),
      prisma.conversation.count({ where: { createdAt: { gte: hoje } } }),
      prisma.conversation.count({ where: { createdAt: { gte: semanaAtras } } }),
      prisma.lead.count(),
      prisma.lead.count({ where: { createdAt: { gte: hoje } } }),
      prisma.lead.groupBy({ by: ["status"], _count: { id: true } }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any).conversation.count({ where: { tags: { contains: "quente" } } }),
      prisma.lead.findMany({
        where: { meetingDate: { gte: now } },
        orderBy: { meetingDate: "asc" },
        take: 5,
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any).reminder.count({ where: { status: "pending" } }),
    ]);

  const statusMap: Record<string, string> = {
    novo: "Novo",
    em_negociacao: "Em Negociação",
    reuniao_agendada: "Reunião Agendada",
    fechado: "Fechado",
    perdido: "Perdido",
  };

  const leadsStatusHtml = (leadsPorStatus as { status: string; _count: { id: number } }[])
    .map(
      (s) => `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #1e1e1e;">${statusMap[s.status] ?? s.status}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #1e1e1e;text-align:right;font-weight:700;color:#adff2f;">${s._count.id}</td>
      </tr>`
    )
    .join("");

  const reunioesHtml =
    reunioes.length === 0
      ? `<p style="color:#555;font-size:13px;">Nenhuma reunião agendada.</p>`
      : reunioes
          .map(
            (r) => `
      <div style="padding:8px 12px;background:#141414;border-radius:6px;margin-bottom:6px;border-left:3px solid #a855f7;">
        <strong style="color:#e5e5e5;">${r.name}</strong>
        <span style="color:#a855f7;font-size:12px;margin-left:8px;">
          📅 ${r.meetingDate ? new Date(r.meetingDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
        </span>
        ${r.whatsapp ? `<div style="color:#555;font-size:12px;margin-top:2px;">📱 ${r.whatsapp}</div>` : ""}
      </div>`
          )
          .join("");

  const dataHoje = now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;color:#e5e5e5;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">

    <!-- Header -->
    <div style="background:#111;border:1px solid #222;border-radius:10px;padding:24px 28px;margin-bottom:16px;border-top:3px solid #adff2f;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
        <div style="width:32px;height:32px;background:#adff2f22;border:1px solid #adff2f44;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#adff2f;font-size:14px;">G</div>
        <span style="font-size:18px;font-weight:700;color:#adff2f;">Guilherme Agent</span>
      </div>
      <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#fff;">Relatório de Vendas</h1>
      <p style="margin:0;font-size:13px;color:#555;text-transform:capitalize;">${dataHoje}</p>
    </div>

    <!-- Cards -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
      ${[
        { icon: "💬", label: "Conversas Hoje", val: convsHoje, sub: `${convsSemana} essa semana` },
        { icon: "🧑‍💼", label: "Leads Hoje", val: leadsHoje, sub: `${totalLeads} no total` },
        { icon: "🔥", label: "Leads Quentes", val: leadsQuentes, sub: "com tag quente" },
        { icon: "⏰", label: "Lembretes Pendentes", val: pendentes, sub: "a enviar" },
      ]
        .map(
          (c) => `
        <div style="background:#111;border:1px solid #222;border-radius:8px;padding:16px 18px;">
          <div style="font-size:20px;margin-bottom:6px;">${c.icon}</div>
          <div style="font-size:28px;font-weight:700;color:#adff2f;">${c.val}</div>
          <div style="font-size:12px;font-weight:600;color:#e5e5e5;margin-top:2px;">${c.label}</div>
          <div style="font-size:11px;color:#555;margin-top:2px;">${c.sub}</div>
        </div>`
        )
        .join("")}
    </div>

    <!-- Pipeline -->
    <div style="background:#111;border:1px solid #222;border-radius:8px;padding:20px;margin-bottom:16px;">
      <h2 style="margin:0 0 14px;font-size:14px;font-weight:700;color:#adff2f;text-transform:uppercase;letter-spacing:.06em;">Pipeline de Leads</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tbody>${leadsStatusHtml}</tbody>
      </table>
    </div>

    <!-- Reuniões -->
    <div style="background:#111;border:1px solid #222;border-radius:8px;padding:20px;margin-bottom:16px;">
      <h2 style="margin:0 0 14px;font-size:14px;font-weight:700;color:#a855f7;text-transform:uppercase;letter-spacing:.06em;">Próximas Reuniões</h2>
      ${reunioesHtml}
    </div>

    <!-- Footer -->
    <p style="text-align:center;font-size:11px;color:#333;margin-top:24px;">
      Gerado por Guilherme Agent · ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
    </p>
  </div>
</body>
</html>`;

  // ── Envia email ───────────────────────────────────────────────
  const smtpHost = process.env.SMTP_HOST ?? "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT ?? "587");
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    return new Response(
      "Configure SMTP_USER e SMTP_PASS nas variáveis de ambiente do Railway.",
      { status: 400 }
    );
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: `"Guilherme Agent" <${smtpUser}>`,
    to: destino,
    subject: `📊 Relatório Guilherme Agent — ${now.toLocaleDateString("pt-BR")}`,
    html,
  });

  return Response.json({ ok: true, sentTo: destino });
}
