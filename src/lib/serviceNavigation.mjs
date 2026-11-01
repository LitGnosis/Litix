// Shared navigation for Litix's live, already-approved service catalog.
// Filters discover existing catalog rows; they never approve supplier operations.
const groups=[
 ["TikTok","TikTok",["followers","likes","views","comments","shares","saves"]],
 ["Instagram","Instagram",["followers","likes","views","comments","shares","saves"]],
 ["YouTube","YouTube",["subscribers","likes","views","comments"]],
 ["Twitter (X)","X",["likes","views","retweets","followers"]],
 ["Facebook","Facebook",["followers","likes","views"]]
];
export const SERVICE_NAV_GROUPS=Object.freeze(groups.map(([platform,label,kinds])=>Object.freeze({
 platform,label,kinds:Object.freeze(kinds.map(kind=>Object.freeze({
  kind,label:kind==="retweets"?"Retweets":kind.charAt(0).toUpperCase()+kind.slice(1)
 })))
})));
export const allowedServiceFilter=(platform,kind)=>{
 const group=SERVICE_NAV_GROUPS.find(group=>group.platform===platform);
 if(!group)return platform==="All platforms"&&!kind;
 return !kind||group.kinds.some(item=>item.kind===kind);
};
export const SERVICE_NAV_KINDS=Object.freeze(["followers","likes","views","subscribers","retweets","comments","shares","saves"]);
