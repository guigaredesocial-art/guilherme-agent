import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guilherme Agent — Painel",
  description: "Painel de controle do agente de vendas Guilherme",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body>{children}</body>
    </html>
  );
}
