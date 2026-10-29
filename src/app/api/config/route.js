import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY || process.env.PAYKINGS_NMI_COLLECT_PUBLIC_KEY || null;
  const database = Boolean(process.env.LITIX_V2_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL);
  const supplier = Boolean(process.env.BOOSTERO_API_KEY && process.env.BOOSTERO_API_URL);
  const gateway = Boolean(process.env.NMI_SECURITY_KEY);
  return NextResponse.json({ ready: Boolean(database && supplier && gateway && publicKey), publicKey }, {
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" }
  });
}
