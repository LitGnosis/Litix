import {boosteroReadOnly} from "../lib/boosteroReadOnly.mjs";
if(process.env.VERCEL_ENV==="preview"){
 try{
  const data=await boosteroReadOnly("services");
  const byType={},byCategory={};
  for(const x of data){
   const type=String(x.type||"Default").slice(0,60),cat=String(x.category||"Other").slice(0,80);
   byType[type]=(byType[type]||0)+1;
   if(!byCategory[cat])byCategory[cat]={count:0,standard:0,examples:[]};
   const group=byCategory[cat];group.count++;
   if(type==="Default"&&Number(x.rate)>0&&Number(x.min)>=1&&Number(x.max)>=Number(x.min)){
    group.standard++;
    if(group.examples.length<2)group.examples.push({id:String(x.service||x.id),name:String(x.name||"").slice(0,90),rate:Number(x.rate),min:Number(x.min),max:Number(x.max),refill:x.refill});
   }
  }
  console.log("PREMIUM_CATALOG_SUMMARY",JSON.stringify({total:data.length,types:byType,categoryCount:Object.keys(byCategory).length}));
  for(const [category,item] of Object.entries(byCategory))if(item.standard>0)console.log("PREMIUM_CATALOG_CATEGORY",JSON.stringify({category,...item}));
 }catch(e){console.log("PREMIUM_CATALOG_READ_FAILED",String(e.message).slice(0,95));process.exitCode=1}
}else console.log("PREMIUM_CATALOG_AUDIT_SKIPPED");
