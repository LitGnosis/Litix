import { GET as catalog } from "../../[action]/route.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request) {
 const url = new URL(request.url);
 url.pathname = "/api/smmservices";
 return catalog(new Request(url, request));
}
