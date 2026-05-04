import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function GET() {
  try {
    const output = execSync("npx -y prisma db push --accept-data-loss", { encoding: "utf8", stdio: "pipe" });
    return NextResponse.json({ ok: true, output });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message, stdout: err.stdout?.toString(), stderr: err.stderr?.toString() }, { status: 500 });
  }
}
