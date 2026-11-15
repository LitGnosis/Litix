/**
 * Server-side typed interface. Runtime matching and pricing are implemented
 * in tiktokCatalog.mjs, shared with the existing ESM PayKings/Boostero engine.
 */
export type SupplierCatalogRecord={
 service:string|number;
 name:string;
 category:string;
 type:string;
 rate:string|number;
 min:string|number;
 max:string|number;
 refill?:boolean|string|number;
};
export type CuratedTikTokKind=
 "followers"|"likes"|"views"|"comments"|"custom_comments"|
 "shares"|"saves"|"story_views";
export type CuratedTikTokSku=`tiktok_${CuratedTikTokKind}`;
export {
 TIKTOK_EXACT_MATCH,activeSupplierRow,tiktokSkuForService,
 strictTikTok35Service,curatedTikTokRateCents,curatedTikTokTotalCents,
 tiktokTierLabel,resolveExactTikTokServices
} from "./tiktokCatalog.mjs";
