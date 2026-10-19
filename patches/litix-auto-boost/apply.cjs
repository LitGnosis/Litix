const fs=require('node:fs'),path=require('node:path');
const root=process.cwd();
if(!fs.existsSync(path.join(root,'app/auto-boost/page.js')))throw Error('Existing Auto Boost page missing');
for(const file of ['AutoBoostClient.js','offer.mjs','preview.css'])fs.copyFileSync(path.join(__dirname,file),path.join(root,'app/auto-boost',file));
let page=fs.readFileSync(path.join(root,'app/auto-boost/page.js'),'utf8');
if(!page.includes("import './preview.css'"))page="import './preview.css';\n"+page;
page=page.replace('Choose the engagement once. Litix watches a supported authorized/public content source and creates routed orders for future posts using your quantity, speed and pacing preferences.','Explore the simplified automatic engagement preview. Checkout and new campaign activation are not enabled for these packages.');
fs.writeFileSync(path.join(root,'app/auto-boost/page.js'),page);
console.log('LITIX_AUTO_BOOST_PREVIEW_READY');
