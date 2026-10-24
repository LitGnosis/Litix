import { POST as checkout } from "../../[action]/route.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export function POST(request) {
 const url = new URL(request.url);
 url.pathname = "/api/checkout";
 return checkout(new Request(url, request));
}
