import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    companyName: process.env.COMPANY_NAME ?? "Guilherme",
    agentLabel: process.env.AGENT_LABEL ?? "Painel de Vendas IA",
  });
}
