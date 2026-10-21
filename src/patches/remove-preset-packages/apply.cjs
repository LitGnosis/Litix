const fs = require('node:fs');
// Run after all legacy build overlays so they cannot restore preset sales.
function write(file, value) { fs.mkdirSync(require('node:path').dirname(file), {recursive:true}); fs.writeFileSync(file, value); }
let home = fs.readFileSync('app/page.js', 'utf8');
home = home.replace(/import PackageStrip from\s*['"]\.\/PackageStrip['"];?/, '').replace(/<PackageStrip\s*\/>/g, '').replace(/<a href=["']\/packages["']>.*?<\/a>/g, '');
write('app/page.js', home);
write('app/PackageStrip.js', 'export default function PackageStrip(){return null}\n');
write('app/api/packages/route.js', "import {NextResponse} from 'next/server';\nexport const dynamic='force-dynamic';\nexport async function GET(){return NextResponse.json({packages:[]},{headers:{'cache-control':'no-store'}})}\n");
write('app/api/packages/purchase/route.js', "import {NextResponse} from 'next/server';\nexport async function POST(){return NextResponse.json({error:'Preset packages have been retired. Use custom orders or Auto Boost.',code:'PACKAGES_RETIRED'},{status:410})}\n");
for (const file of ['app/packages/page.js','app/packages/followers/page.js']) write(file, "import {redirect} from 'next/navigation';\nexport default function RetiredPackages(){redirect('/#order')}\n");
const checkout = fs.readFileSync('app/api/checkout/route.js', 'utf8');
if (!checkout.includes('PACKAGES_RETIRED')) {
 const anchor = 'b=await req.json(),offer=';
 if (!checkout.includes(anchor)) throw Error('Checkout signature changed; refusing unsafe merge');
 write('app/api/checkout/route.js', checkout.replace(anchor, "b=await req.json();if(b.packageId)return NextResponse.json({error:'Preset packages have been retired. Use custom orders or Auto Boost.',code:'PACKAGES_RETIRED'},{status:410});const offer="));
}
console.log('PRESET_PACKAGES_REMOVED');
