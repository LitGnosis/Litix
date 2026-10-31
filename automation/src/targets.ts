import { Platform, ServiceKind } from "@prisma/client";

function safeUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw Error("INVALID_URL");
  url.hash = "";
  url.search = "";
  return url;
}

export function parseProfile(input: string, platform: Platform): string {
  const value = input.trim();
  if (/^@?[a-zA-Z0-9._]{2,30}$/.test(value)) {
    const user = value.replace(/^@/, "");
    return platform === "INSTAGRAM"
      ? "https://www.instagram.com/" + user + "/"
      : "https://www.tiktok.com/@" + user + "/";
  }
  const url = safeUrl(value);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (platform === "INSTAGRAM" && host === "instagram.com" &&
      /^\/[a-zA-Z0-9._]{2,30}\/?$/.test(url.pathname)) {
    return "https://www.instagram.com/" + url.pathname.split("/")[1] + "/";
  }
  if (platform === "TIKTOK" && host === "tiktok.com" &&
      /^\/@[a-zA-Z0-9._]{2,30}\/?$/.test(url.pathname)) {
    return "https://www.tiktok.com/" + url.pathname.split("/")[1] + "/";
  }
  throw Error("INVALID_PROFILE_TARGET");
}

export function parsePost(input: string, platform: Platform, profile: string): string {
  const url = safeUrl(input.trim());
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (platform === "INSTAGRAM" && host === "instagram.com" &&
      /^\/(p|reel|tv)\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname)) {
    return "https://www.instagram.com" + url.pathname.replace(/\/?$/, "/");
  }
  if (platform === "TIKTOK" && host === "tiktok.com" &&
      /^\/@[a-zA-Z0-9._]+\/video\/\d+\/?$/.test(url.pathname)) {
    const owner = url.pathname.split("/")[1].toLowerCase();
    const requested = new URL(profile).pathname.split("/")[1].toLowerCase();
    if (owner !== requested) throw Error("POST_PROFILE_MISMATCH");
    return "https://www.tiktok.com" + url.pathname.replace(/\/?$/, "/");
  }
  throw Error("INVALID_POST_TARGET");
}

export function splitQuantity(quantity: number, urls: string[]): {link:string;quantity:number;splitIndex:number}[] {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || urls.length < 1 ||
      urls.length > 10 || quantity < urls.length) throw Error("INVALID_SPLIT");
  const base = Math.floor(quantity / urls.length);
  return urls.map((link, splitIndex) => ({
    link, splitIndex, quantity: base + (splitIndex < quantity % urls.length ? 1 : 0),
  }));
}

export function targetsFor(kind: ServiceKind, quantity: number, profile: string, posts: string[]) {
  if (kind === "FOLLOWERS") return [{ link: profile, splitIndex: 0, quantity }];
  return splitQuantity(quantity, posts);
}
