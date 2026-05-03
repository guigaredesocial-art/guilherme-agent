import { getEvolutionQR } from "@/lib/channels/evolution";

export async function GET() {
  const qrcode = await getEvolutionQR();
  return Response.json({ qrcode });
}
