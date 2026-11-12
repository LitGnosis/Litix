const fs = require('node:fs');
const p = 'app/page.jsx';
const css = 'app/metallic.css';
let s = fs.readFileSync(p, 'utf8');
const check = (ok, message) => { if (!ok) throw Error('Storefront source changed: ' + message); };
if (s.includes('litix-network-tabs') && s.includes('litix-feature-panel')) {
  console.log('New storefront layout already present');
} else {
  const oldLogo = '<img src="/assets/brand/logo.svg" alt="Litix" className="brand-logo" /><span className="brand-wordmark">LITIX<span className="brand-submark">ANALYTICS AMPLIFIED</span></span>';
  check(s.includes(oldLogo), 'expected old logo not found');
  s = s.replace(oldLogo, '<img src="/assets/brand/litix-logo.webp" alt="Litix — Innovation, Ignited." className="litix-new-logo" />');
  const a = s.indexOf('<section className="hero">');
  const b = s.indexOf('<div className="cols">', a);
  check(a > 0 && b > a, 'hero section not found');
  const m = s.slice(a, b).match(/<div className="tags">([\s\S]*?)<\/div><\/section>/);
  check(m && m[1].includes('Instant Delivery'), 'expected feature badges not found');
  s = s.slice(0, a) + s.slice(b);
  check(s.includes('<footer className="end">'), 'footer not found');
  s = s.replace('<footer className="end">', '<section className="panel litix-feature-panel"><h2>Why shop with Litix</h2><div className="tags">' + m[1] + '</div></section><footer className="end">');
  const req = 'new URLSearchParams({category:cat,q:query,page:String(pg)})';
  check(s.includes(req), 'catalog request changed');
  s = s.replace(req, 'new URLSearchParams({category:cat,q:query,page:String(pg),platform})');
  s = s.replace('[cat,query,pg,catalogRetry]', '[cat,query,pg,platform,catalogRetry]');
  check(s.includes('<option>YouTube</option><option>Other</option>'), 'platform selector changed');
  s = s.replace('<option>YouTube</option><option>Other</option>', '<option>YouTube</option><option>Facebook</option><option>Spotify</option><option>Other</option>');
  check(s.includes('<h2>Browse services</h2>'), 'catalog heading changed');
  s = s.replace('<h2>Browse services</h2>', '<h2>Browse services</h2><div className="litix-network-tabs">{["Instagram","TikTok","All platforms"].map(v=><button type="button" key={v} className={platform===v?"litix-network-active":""} onClick={()=>{setPlatform(v);setCat("");setQuery("");setPg(1)}}>{v==="All platforms"?"All services":v+" services"}</button>)}</div>');
  const start = s.indexOf('services.filter(s=>{const label=');
  const endToken = '}).map(s=><div className="service-option"';
  const end = s.indexOf(endToken, start);
  check(start >= 0 && end > start, 'service rendering expression changed');
  s = s.slice(0, start) + 'services.filter(s=>(!favoritesOnly||favorites.some(f=>String(f.id)===String(s.id)))).map(s=><div className="service-option"' + s.slice(end + endToken.length);
  fs.writeFileSync(p, s);
  let style = fs.readFileSync(css, 'utf8');
  const styles = `
.litix-new-logo{display:block;max-height:86px;width:min(36vw,165px);object-fit:contain}
.litix-network-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.litix-network-tabs button{border:1px solid #416c89;border-radius:20px;padding:10px 12px;background:#133049;color:#e9f8ff;font-weight:700;cursor:pointer}
.litix-network-tabs button.litix-network-active{background:#078cc4;color:white}
.litix-feature-panel{margin-top:24px}
.litix-feature-panel .tags{display:flex;flex-wrap:wrap;gap:10px}
.litix-feature-panel .tags span{padding:10px 14px;border:1px solid #416078;border-radius:24px;background:#172d40}
@media(max-width:520px){.litix-new-logo{width:110px;max-height:80px}.litix-network-tabs button{font-size:13px;padding:9px 10px}}
`;
  if (!style.includes('.litix-network-tabs')) fs.writeFileSync(css, style + styles);
  console.log('Logo, product-first layout and lower feature badges installed');
}
