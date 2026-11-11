export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response("litix-owned-health-ok\n", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}
