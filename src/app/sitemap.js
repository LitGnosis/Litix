import {SHOP_CATEGORIES} from "../lib/litixShopRoutes.mjs";
import {GLOBAL_CODES,GLOBAL_LANG_ALTERNATES} from "../lib/globalLocales.mjs";
export default function sitemap() {
  const base = "https://litix.net";
  const localAlternates={languages:Object.fromEntries(
    Object.entries(GLOBAL_LANG_ALTERNATES).map(([key,path])=>[key,base+path])
  )};
  return [
    {url:base,changeFrequency:"daily",priority:1},
    {url:base+"/shop",changeFrequency:"weekly",priority:0.9},
    {url:base+"/tools/tiktok-engagement",changeFrequency:"monthly",priority:0.7},
    {url:base+"/services",changeFrequency:"daily",priority:0.9},
    {url:base+"/track",changeFrequency:"monthly",priority:0.4},
    {url:base+"/bundles",changeFrequency:"weekly",priority:0.8},
    ...SHOP_CATEGORIES.map(item=>({url:base+item.href,changeFrequency:"weekly",priority:0.8})),
    ...GLOBAL_CODES.map(locale=>({
      url:base+"/global/"+locale,
      changeFrequency:"monthly",
      priority:0.6,
      alternates:localAlternates
    })),
    // Preserve previously listed October 19 SEO pages during retirement of proxy sitemap.
    {url:base+"/about",changeFrequency:"monthly",priority:0.5},
    {url:base+"/platform",changeFrequency:"monthly",priority:0.5},
    {url:base+"/acceptable-use",changeFrequency:"yearly",priority:0.3},
    {url:base+"/resources/visibility-acceleration",changeFrequency:"monthly",priority:0.4},
    {url:base+"/privacy",changeFrequency:"yearly",priority:0.3},
    {url:base+"/terms",changeFrequency:"yearly",priority:0.3},
    {url:base+"/refunds",changeFrequency:"yearly",priority:0.3},
  ];
}
