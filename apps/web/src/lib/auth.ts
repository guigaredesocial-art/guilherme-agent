import { NextRequest } from "next/server";

const SECRET = () => process.env.AUTH_SECRET ?? "dev-secret-change-me";

// JWT simples sem dependência extra (para MVP)
function base64url(data: string): string {
  return Buffer.from(data).toString("base64url");
}

function base64urlDecode(data: string): string {
  return Buffer.from(data, "base64url").toString("utf-8");
}

export function sign(payload: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const sig = require("crypto")
    .createHmac("sha256", SECRET())
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verify(token: string): Record<string, unknown> | null {
  try {
    const [header, body, sig] = token.split(".");
    const expectedSig = require("crypto")
      .createHmac("sha256", SECRET())
      .update(`${header}.${body}`)
      .digest("base64url");
    if (sig !== expectedSig) return null;
    return JSON.parse(base64urlDecode(body));
  } catch {
    return null;
  }
}

export async function verifyOperator(req: NextRequest): Promise<{ operatorId: string; email: string } | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : req.cookies.get("token")?.value ?? "";
  if (!token) return null;
  const payload = verify(token);
  if (!payload?.operatorId) return null;
  return { operatorId: payload.operatorId as string, email: payload.email as string };
}
