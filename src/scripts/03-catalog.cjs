const fs = require('node:fs');
const p = 'app/api/[action]/route.js';
let s = fs.readFileSync(p, 'utf8');
const check = (needle, label) => { if (!s.includes(needle)) throw Error('Catalog source differs: ' + label); };
if (s.includes('const socialRequested=') && s.includes('const platformRank=')) {
  console.log('Platform priority and social expansion already installed');
} else {
  const old = 'return x.service!=null&&Number.isFinite(Number(x.rate))&&Number(x.rate)>0&&Number(x.min)>0&&Number(x.max)>=Number(x.min)&&regular&&usa&&!mixedGeography&&hasRefill(x)&&hasNoDrop(x);';
  check(old, 'supplier eligibility');
  s = s.replace(old, 'const socialRequested=/(?:instagram|(?:^|[^a-z])ig(?:[^a-z]|$)|tik[\\s-]*tok)/i.test(label)&&/\\b(?:likes?|views?|shares?|reposts?|comments?)\\b/i.test(label);return x.service!=null&&Number.isFinite(Number(x.rate))&&Number(x.rate)>0&&Number(x.min)>0&&Number(x.max)>=Number(x.min)&&regular&&(socialRequested||(usa&&!mixedGeography&&hasRefill(x)&&hasNoDrop(x)));');
  s = s.replace('function shape(x){', 'const platformRank=x=>{const z=String(x.name||"")+" "+String(x.category||"");return /instagram|(?:^|[^a-z])ig(?:[^a-z]|$)/i.test(z)?0:/tik[\\s-]*tok/i.test(z)?1:/youtube|\\byt\\b/i.test(z)?2:/facebook|\\bfb\\b/i.test(z)?3:/spotify/i.test(z)?4:5};\nconst platformName=x=>["Instagram","TikTok","YouTube","Facebook","Spotify","Other"][platformRank(x)];\nfunction shape(x){');
  const q = 'const cat=bounded(p.get("category"),100),term=bounded(p.get("q"),120).toLowerCase(),page=';
  check(q, 'query parameters');
  s = s.replace(q, 'const cat=bounded(p.get("category"),100),platform=bounded(p.get("platform"),30),term=bounded(p.get("q"),120).toLowerCase(),page=');
  const original = 'const all=await getServices(),filtered=all.filter(x=>(!cat||String(x.category||"Other")===cat)&&(!term||[x.service,x.name,x.category].some(z=>String(z||"").toLowerCase().includes(term))));';
  check(original, 'supplier filters');
  s = s.replace(original, 'const all=await getServices(),filtered=all.filter(x=>(!cat||String(x.category||"Other")===cat)&&(!platform||platform==="All platforms"||platformName(x)===platform)&&(!term||[x.service,x.name,x.category].some(z=>String(z||"").toLowerCase().includes(term)))).sort((a,b)=>platformRank(a)-platformRank(b)||String(a.name||"").localeCompare(String(b.name||"")));');
  check('per1000:Number(x.rate)*5', 'existing 5× wholesale display pricing');
  check('Number(service.rate)*qty/1000*500', 'existing server-side 5× wholesale pricing');
  fs.writeFileSync(p, s);
  console.log('Instagram then TikTok then remaining platforms, with 5× wholesale retail pricing');
}
