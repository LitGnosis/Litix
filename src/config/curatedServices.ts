/**
 * Typed integration entry point for Litix's existing JavaScript/ESM storefront.
 * The runtime data is maintained in curatedServices.mjs as the sole source of truth.
 */
export type CuratedPlatform="Instagram"|"TikTok";
export type CuratedCoreKind="followers"|"likes"|"views"|"comments";
export type CuratedTier="standard"|"vip";
export type CuratedServiceSku=`${Lowercase<CuratedPlatform>}_${CuratedCoreKind}`;
export type CuratedServiceSelection={
 sku:CuratedServiceSku;
 platform:CuratedPlatform;
 kind:CuratedCoreKind;
 name:string;
};
export {
 CORE_PLATFORMS,CORE_KINDS,CORE_QUANTITIES,TIKTOK_EXTRA_KINDS,
 CURATED_SERVICES,isCuratedSku
} from "./curatedServices.mjs";
