/**
 * Preview form schema and validation. These previews NEVER authorize a sale or
 * a supplier order: every supportedInputShape remains non-purchasable until
 * a separately reviewed dispatch handler supports this exact order type.
 */
const profiles={
 Instagram:{host:"instagram.com",profile:/^\/[A-Za-z0-9._]{1,30}\/?$/},
 TikTok:{host:"tiktok.com",profile:/^\/@[A-Za-z0-9._]{2,24}\/?$/},
 YouTube:{host:"youtube.com",profile:/^\/(?:@[-\w.]{3,35}|channel\/[-\w]{6,40})\/?$/},
 Facebook:{host:"facebook.com",profile:/^\/[A-Za-z0-9.-]{3,80}\/?$/},
 "Twitter/X":{host:"x.com",profile:/^\/[A-Za-z0-9_]{1,15}\/?$/},
 Telegram:{host:"t.me",profile:/^\/[A-Za-z0-9_]{5,40}\/?$/},
 LinkedIn:{host:"linkedin.com",profile:/^\/(?:in|company)\/[-\w%]{2,80}\/?$/},
 Snapchat:{host:"snapchat.com",profile:/^\/add\/[A-Za-z0-9._-]{3,40}\/?$/},
 Spotify:{host:"open.spotify.com",profile:/^\/(?:artist|user|playlist)\/[A-Za-z0-9]{12,50}\/?$/}
};
const posts={
 Instagram:/^\/(?:p|reel)\/[A-Za-z0-9_-]{5,32}\/?$/,
 TikTok:/^\/@[A-Za-z0-9._]{2,24}\/video\/[0-9]{10,30}\/?$/,
 YouTube:/^\/watch\/?$/,
 Facebook:/^\/[\w.-]+\/(?:posts|videos)\/[\w.-]+\/?$/,
 "Twitter/X":/^\/[A-Za-z0-9_]{1,15}\/status\/[0-9]{5,25}\/?$/,
 Telegram:/^\/[A-Za-z0-9_]{5,40}\/[0-9]{1,20}\/?$/
};
const supportedPlatforms=new Set([...Object.keys(profiles),"Discord","Twitch","Pinterest","Reddit"]);
export function orderFormSchema(service){
 const kind=String(service?.kind||"other");
 const type=String(service?.type||"Default").toLowerCase();
 const platform=String(service?.platform||"Other");
 const profile=/^(followers|auto_engagement)$/.test(kind)||type==="subscriptions";
 const comment=type==="custom comments"||kind==="custom_comments";
 const auto=type==="subscriptions"||kind==="auto_engagement";
 const drip=service?.dripfeed===true;
 const post=/^(likes|views|shares|saves|comments|impressions|votes|custom_comments)$/.test(kind);
 const known=profile||comment||post;
 const fields=[{name:"quantity",kind:"number",required:true,min:service?.min,max:service?.max}];
 if(profile)fields.unshift({name:"profile",kind:"profile-url",required:true,platform});
 else if(known)fields.unshift({name:"postUrl",kind:"post-url",required:true,platform});
 if(comment)fields.push({name:"comments",kind:"multiline",required:true,maxLines:100});
 if(auto)fields.push({name:"posts",kind:"number",min:1,max:100,required:true},{name:"intervalMinutes",kind:"number",min:1,max:10080,required:true});
 if(drip)fields.push({name:"runs",kind:"number",min:2,max:100,required:true},{name:"intervalMinutes",kind:"number",min:1,max:10080,required:true});
 if(post&&!auto)fields.push({name:"additionalPostUrls",kind:"multiline",required:false,maxLines:25});
 const canConfigure=known&&supportedPlatforms.has(platform)&&
  (profile?Boolean(profiles[platform]):Boolean(posts[platform]));
 return {serviceId:String(service?.id||""),platform,kind,type,fields,canConfigure,
  publicCheckoutEnabled:false,previewOnly:true,
  note:"Preview draft only. Service availability, payment, and supplier fulfillment are not authorized."};
}
function normalizeTarget(raw,platform,profile){
 if(typeof raw!=="string"||raw.length>500)return null;
 let u;try{u=new URL(raw.trim())}catch{return null}
 const host=(profiles[platform]?.host||"").toLowerCase();
 if(!host||u.protocol!=="https:"||u.username||u.password||u.port||u.search||u.hash)return null;
 const actual=u.hostname.toLowerCase().replace(/^www\./,"");
 if(actual!==host)return null;
 const re=profile?profiles[platform]?.profile:posts[platform];
 if(!re?.test(u.pathname))return null;
 if(!profile&&platform==="YouTube"&&!/^[A-Za-z0-9_-]{11}$/.test(u.searchParams.get("v")||""))return null;
 return "https://www."+actual+u.pathname;
}
export function validateServiceDraft(service,input){
 const schema=orderFormSchema(service),errors={};
 if(!schema.canConfigure)return {ok:false,errors:{service:"order_form_unsupported"},schema};
 const qty=Number(input?.quantity);
 if(!Number.isSafeInteger(qty)||qty<Number(service.min)||qty>Number(service.max))errors.quantity="invalid_supplier_quantity";
 const baseName=schema.fields.some(x=>x.name==="profile")?"profile":"postUrl";
 const parsed=normalizeTarget(input?.[baseName],schema.platform,baseName==="profile");
 if(!parsed)errors[baseName]="invalid_"+baseName;
 let extras=[];
 if(schema.fields.some(x=>x.name==="additionalPostUrls")&&input?.additionalPostUrls){
  extras=String(input.additionalPostUrls).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(extras.length>25||new Set(extras).size!==extras.length||extras.some(x=>!normalizeTarget(x,schema.platform,false)))
   errors.additionalPostUrls="invalid_post_list";
 }
 if(schema.fields.some(x=>x.name==="comments")){
  const comments=String(input?.comments||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(!comments.length||comments.length>100||comments.some(x=>x.length>500))errors.comments="invalid_comments";
 }
 for(const x of schema.fields.filter(x=>["runs","posts","intervalMinutes"].includes(x.name))){
  const value=Number(input?.[x.name]);
  if(!Number.isSafeInteger(value)||value<Number(x.min)||value>Number(x.max))errors[x.name]="invalid_"+x.name;
 }
 return {ok:Object.keys(errors).length===0,errors,schema,
  // No raw user input is returned to untrusted public clients.
  validatedDestinations:parsed?1+extras.length:0,
  checkoutAuthorized:false,supplierDispatchAuthorized:false};
}
