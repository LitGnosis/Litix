import {SERVICE_NAV_GROUPS} from "./serviceNavigation.mjs";

// Navigation is discovery only; it never approves a supplier service or price.
export const SHOP_PLATFORM_SLUGS=Object.freeze({
 "Instagram":"instagram","TikTok":"tiktok","YouTube":"youtube","Twitter (X)":"x","Facebook":"facebook"
});
export const SHOP_CATEGORIES=Object.freeze(SERVICE_NAV_GROUPS.flatMap(group=>{
 const slug=SHOP_PLATFORM_SLUGS[group.platform];
 return slug?group.kinds.map(item=>Object.freeze({
  slug,platform:group.platform,platformLabel:group.label,kind:item.kind,
  kindLabel:item.label,href:"/shop/"+slug+"/"+item.kind
 })):[];
}));
export const shopCategory=(slug,kind)=>SHOP_CATEGORIES.find(x=>x.slug===slug&&x.kind===kind)||null;
