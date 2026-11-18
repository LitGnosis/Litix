// Shared navigation for Litix's live, already-approved service catalog.
// Filters discover existing catalog rows; they never approve supplier operations.
const groups=[
 ["Instagram","Instagram",["followers","likes","views","comments","shares","saves"]],
 ["TikTok","TikTok",["followers","likes","views","comments","shares","saves"]],
 ["YouTube","YouTube",["subscribers","likes","views","comments"]],
 ["Twitter (X)","X",["likes","views","retweets","followers"]],
 ["Facebook","Facebook",["followers","likes","views"]]
];
export const SERVICE_NAV_GROUPS=Object.freeze(groups.map(([platform,label,kinds])=>Object.freeze({
 platform,label,kinds:Object.freeze(kinds.map(kind=>Object.freeze({
  kind,label:kind==="retweets"?"Retweets":kind.charAt(0).toUpperCase()+kind.slice(1)
 })))
})));
// Long-tail Boostero platforms are only exposed in the directory when they
// actually occur in the verified public catalog; no synthetic products.
export const ADDITIONAL_SERVICE_PLATFORMS=Object.freeze([
 "Spotify","Telegram","LinkedIn","Discord","Snapchat","Pinterest",
 "Website Traffic","Twitch","Clubhouse","Kick","CoinMarketCap","Apple Music",
 "Shopee","Rumble","Reddit","Bluesky","Truth Social","Quora","Tumblr",
 "Medium","GitHub","SoundCloud","Threads","VK","Other"
]);
export const SERVICE_NAV_KINDS=Object.freeze([
 "followers","likes","views","subscribers","retweets","comments","shares",
 "saves","members","plays","listeners","traffic","other"
]);
export const allowedServiceFilter=(platform,kind)=>{
 const group=SERVICE_NAV_GROUPS.find(group=>group.platform===platform);
 if(group)return !kind||group.kinds.some(item=>item.kind===kind);
 if(platform==="All platforms")return !kind;
 return ADDITIONAL_SERVICE_PLATFORMS.includes(platform)&&(!kind||SERVICE_NAV_KINDS.includes(kind));
};
