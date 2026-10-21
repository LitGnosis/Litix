const fs=require('node:fs'),path=require('node:path');
const root=process.cwd(),assets=path.join(__dirname,'assets');
for(const file of ['app/CheckoutConfirmation.js','app/track/page.js','app/success/page.js','lib/orderConfirmation.mjs']){
  fs.copyFileSync(path.join(assets,file),path.join(root,file));
}
const target=path.join(root,'app/OrderWidget.js');
let source=fs.readFileSync(target,'utf8');
const marker='/* automatic-checkout-reference */';
if(!source.includes(marker)){
  const before='location.href=j.url';
  if(source.split(before).length!==2)throw Error('Checkout redirect source changed; refusing automatic confirmation patch');
  source=source.replace(before,`${marker}try{sessionStorage.setItem('litix.checkout.reference',JSON.stringify({order_id:j.orderId,email:email.trim(),createdAt:Date.now()}))}catch{};location.href=j.url`);
  fs.writeFileSync(target,source);
}
