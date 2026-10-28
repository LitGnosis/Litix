import {GLOBAL_CODES,GLOBAL_LANG_ALTERNATES} from "../lib/globalLocales.mjs";
export default function sitemap() {
  const base = "https://litix.net";
  return [
    {url:base,changeFrequency:"daily",priority:1},
    ...GLOBAL_CODES.map(locale=>({
      url:base+"/global/"+locale,
      changeFrequency:"monthly",
      priority:0.6,
      alternates:{languages:Object.fromEntries(Object.entries(GLOBAL_LANG_ALTERNATES).map(([key,path])=>[key,base+path]))}
    })),
    {url:base+"/privacy",changeFrequency:"yearly",priority:0.3},
    {url:base+"/terms",changeFrequency:"yearly",priority:0.3},
    {url:base+"/refunds",changeFrequency:"yearly",priority:0.3},
  ];
}
