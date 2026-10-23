import { NextResponse } from "next/server";

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function verifyHs256Jwt(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3 || !secret) throw new Error("Invalid token configuration");
  const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
  if (header.alg !== "HS256" || header.typ && header.typ !== "JWT") throw new Error("Unsupported JWT");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", key, decodeBase64Url(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!valid) throw new Error("Invalid signature");
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now) throw new Error("Expired token");
  if (payload.nbf != null && (typeof payload.nbf !== "number" || payload.nbf > now)) throw new Error("Token not active");
  if (process.env.JWT_ISSUER && payload.iss !== process.env.JWT_ISSUER) throw new Error("Invalid issuer");
  if (process.env.JWT_AUDIENCE) {
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(process.env.JWT_AUDIENCE)) throw new Error("Invalid audience");
  }
  return payload;
}

const ROLE_PERMISSIONS = {
  OWNER: new Set(["read", "write", "manage"]),
  ADMIN: new Set(["read", "write", "manage"]),
  MANAGER: new Set(["read", "write"]),
  ANALYST: new Set(["read"]),
};

function requiredPermission(method) {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return "read";
  if (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE") return "write";
  return "manage";
}

export async function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase().replace(/\.$/, "");
  const primaryHosts = new Set(["litix.net", "www.litix.net", "localhost"]);
  const vercelHost = host.endsWith(".vercel.app");

  // Custom domains are opt-in. Do not trust arbitrary Host headers or silently serve another tenant.
  if (!primaryHosts.has(host) && !vercelHost) {
    const resolver = process.env.LITIX_DOMAIN_RESOLUTION_URL;
    if (!resolver) return new NextResponse("Custom domains are not configured.", { status: 503 });
    try {
      const resolutionUrl = new URL(resolver);
      resolutionUrl.searchParams.set("hostname", host);
      const response = await fetch(resolutionUrl.toString(), { headers: { accept: "application/json" }, cache: "no-store" });
      if (!response.ok) return new NextResponse("Tenant resolution unavailable.", { status: 503 });
      const tenant = await response.json();
      if (!tenant || tenant.isProvisioned !== true || typeof tenant.tenantId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(tenant.tenantId)) {
        return NextResponse.rewrite(new URL("/404", request.url));
      }
      if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
        // API routes must continue through authorization below; never bypass workspace checks on custom hosts.
      } else {
        return NextResponse.rewrite(new URL("/_storefronts/" + tenant.tenantId + pathname + request.nextUrl.search, request.url));
      }
    } catch {
      return new NextResponse("Tenant resolution failed.", { status: 503 });
    }
  }

  if (pathname.startsWith("/api/v2/workspaces")) {
    const authHeader = request.headers.get("authorization") || "";
    const targetWorkspaceId = request.headers.get("x-workspace-id") || searchParams.get("workspaceId") ||
      pathname.match(/^\/api\/v2\/workspaces\/([^/]+)/)?.[1];
    if (!authHeader.startsWith("Bearer ") || !targetWorkspaceId) {
      return NextResponse.json({ error: "Authentication and workspace scope are required." }, { status: 401 });
    }
    try {
      const payload = await verifyHs256Jwt(authHeader.slice(7).trim(), process.env.JWT_SECRET);
      if (typeof payload.userId !== "string" || !payload.userId) throw new Error("Missing user identity");
      const memberships = Array.isArray(payload.memberships) ? payload.memberships : [];
      const membership = memberships.find((item) => item && item.workspaceId === targetWorkspaceId && typeof item.role === "string");
      if (!membership) return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });
      const role = membership.role.toUpperCase();
      const permissions = ROLE_PERMISSIONS[role];
      if (!permissions || !permissions.has(requiredPermission(request.method))) {
        return NextResponse.json({ error: "Insufficient workspace permission." }, { status: 403 });
      }
      const headers = new Headers(request.headers);
      headers.set("x-authenticated-user-id", payload.userId);
      headers.set("x-authorized-workspace-id", targetWorkspaceId);
      headers.set("x-authorized-workspace-role", role);
      return NextResponse.next({ request: { headers } });
    } catch {
      return NextResponse.json({ error: "Invalid or expired session token." }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ["/api/v2/workspaces/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"] };
