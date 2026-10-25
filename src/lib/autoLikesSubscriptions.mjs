import { createHash } from "node:crypto";
import { retailPer1000 } from "./pricing.mjs";
import { isEligibleLikesService } from "./autolikes.mjs";

export const MAX_MONTHLY_CHARGE_CENTS = 2_000_000;

// Every quote is recalculated from the provider's current service catalog. Never trust prices from a browser.
export function quoteAutoLikesMonth(campaign, services) {
  if (!campaign || campaign.status !== "draft") throw Error("Only active drafts can be enrolled.");
  if (!["instagram","tiktok"].includes(String(campaign.platform))) throw Error("Unsupported campaign platform.");
  const service = services.find(s => String(s.service) === String(campaign.service_catalog_id));
  if (!service || !isEligibleLikesService(service, campaign.platform)) throw Error("The selected Likes service is unavailable.");
  const quantity = Number(campaign.quantity_per_post), maxPosts = Number(campaign.max_posts_per_month);
  if (!Number.isSafeInteger(quantity) || quantity < Number(service.min) || quantity > Number(service.max)) throw Error("Quantity outside supplier limits.");
  if (!Number.isSafeInteger(maxPosts) || maxPosts < 1 || maxPosts > 60) throw Error("Invalid monthly post limit.");
  const retailRate = Number(retailPer1000(service));
  if (!Number.isFinite(retailRate) || retailRate <= 0) throw Error("Supplier retail price is unavailable.");
  const perPostCents = Math.ceil(retailRate * 100 * quantity / 1000);
  const monthlyCents = perPostCents * maxPosts;
  if (!Number.isSafeInteger(monthlyCents) || monthlyCents < 100 || monthlyCents > MAX_MONTHLY_CHARGE_CENTS) throw Error("Monthly amount is outside supported limits.");
  return { campaignId:campaign.id, serviceId:String(service.service), serviceName:String(service.name||"Likes service").slice(0,100), platform:campaign.platform, target:campaign.account_ref, quantity, maxPosts, perPostCents, monthlyCents, currency:"USD" };
}

export function subscriptionRequestId(customerId,campaignId,requestKey) {
  if (typeof customerId !== "string" || customerId.length < 3 || !/^al_[a-f0-9]{40}$/.test(String(campaignId))) throw Error("Invalid account or campaign.");
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(String(requestKey))) throw Error("Invalid subscription request key.");
  return "alsub_"+createHash("sha256").update(customerId+"\n"+campaignId+"\n"+requestKey).digest("hex").slice(0,48);
}
export const privateWorkspaceId = customerId => "alws_"+createHash("sha256").update(String(customerId)).digest("hex").slice(0,40);
export function upcomingBillingDate(now=new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw Error("Invalid billing date.");
  // Day 29-31 could be absent in shorter months; restrict to <=28.
  const day = Math.min(now.getUTCDate(),28);
  return {day, initialDate:now.toISOString().slice(0,10).replaceAll("-","")};
}
