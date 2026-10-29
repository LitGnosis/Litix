import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export async function POST() {
  // Fail closed until the merchant's current production PayKings server key
  // and the order database are configured and verified on this project.
  return NextResponse.json({
    error: "Secure checkout is being finalized. No payment was submitted."
  }, { status: 503, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
