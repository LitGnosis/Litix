// Shared navigation for Litix's live, already-approved service catalog.
// Categories are filters only; they do not approve new supplier services.
export const SERVICE_NAV_GROUPS=Object.freeze([
 {platform:"TikTok",label:"TikTok",kinds:Object.freeze([
  {kind:"followers",label:"Followers"},
  {kind:"likes",label:"Likes"},
  {kind:"views",label:"Views"}
 ])},
 {platform:"Instagram",label:"Instagram",kinds:Object.freeze([
  {kind:"followers",label:"Followers"},
  {kind:"likes",label:"Likes"},
  {kind:"views",label:"Views"}
 ])},
 {platform:"YouTube",label:"YouTube",kinds:Object.freeze([
  {kind:"subscribers",label:"Subscribers"},
  {kind:"likes",label:"Likes"},
  {kind:"views",label:"Views"}
 ])},
 {platform:"Twitter (X)",label:"X",kinds:Object.freeze([
  {kind:"likes",label:"Likes"},
  {kind:"views",label:"Views"},
  {kind:"retweets",label:"Retweets"}
 ])}
]);
export const allowedServiceFilter=(platform,kind)=>{
 const group=SERVICE_NAV_GROUPS.find(group=>group.platform===platform);
 if(!group)return platform==="All platforms"&&!kind;
 return !kind||group.kinds.some(item=>item.kind===kind);
};
export const SERVICE_NAV_KINDS=Object.freeze(["followers","likes","views","subscribers","retweets"]);
