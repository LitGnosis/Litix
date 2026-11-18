// Source-derived service classification. A supplier category can advertise
// multiple products; the exact service title wins over that broad category.
const PLATFORM_RULES=Object.freeze([
 ["Instagram",/\binstagram\b|\big\b/i],
 ["TikTok",/\btik[\s._-]*tok\b/i],
 ["YouTube",/\byoutube\b|\byt\b/i],
 ["Facebook",/\bfacebook\b|\bfb\b/i],
 ["Twitter (X)",/\btwitter\b|\bx\s*(?:followers?|likes?|retweets?|reposts?|views?|space|listeners?)\b/i],
 ["Spotify",/\bspotify\b/i],
 ["Telegram",/\btelegram\b/i],
 ["LinkedIn",/\blinkedin\b/i],
 ["Discord",/\bdiscord\b/i],
 ["Snapchat",/\bsnapchat\b/i],
 ["Pinterest",/\bpinterest\b/i],
 ["Website Traffic",/\bwebsite(?:\s+traffic)?\b|\bweb(?:site)?\s+(?:visits?|traffic)\b/i],
 ["Twitch",/\btwitch\b/i],
 ["Kick",/\bkick\b/i],
 ["Reddit",/\breddit\b/i],
 ["Apple Music",/\bapple\s*music\b/i],
 ["SoundCloud",/\bsoundcloud\b/i],
 ["Threads",/\bthreads\b/i],
 ["VK",/\bvk(?:\.com|ontakte)?\b/i],
 ["Clubhouse",/\bclubhouse\b/i],
 ["CoinMarketCap",/\bcoinmarketcap\b/i],
 ["Shopee",/\bshopee\b/i],
 ["Rumble",/\brumble\b/i],
 ["Bluesky",/\bbluesky\b/i],
 ["Truth Social",/\btruth\s*social\b/i],
 ["Quora",/\bquora\b/i],
 ["Tumblr",/\btumblr\b/i],
 ["Medium",/\bmedium\b/i],
 ["GitHub",/\bgithub\b/i]
]);

const KIND_RULES=Object.freeze([
 ["subscribers",/\bsubscribers?\b/i],
 ["followers",/\bfollowers?\b/i],
 ["likes",/\blikes?\b/i],
 ["views",/\bviews?\b/i],
 ["comments",/\bcomments?\b/i],
 ["shares",/\bshares?\b/i],
 ["saves",/\bsaves?\b/i],
 ["members",/\bmembers?\b/i],
 ["plays",/\bplays?\b/i],
 ["listeners",/\blisteners?\b/i],
 ["traffic",/\btraffic\b|\bvisitors?\b|\bvisits?\b/i]
]);

export function litixPlatform(name,category){
 const label=String(name||"")+" "+String(category||"");
 return PLATFORM_RULES.find(([,regex])=>regex.test(label))?.[0]||"Other";
}
export function litixKind(name,category){
 const platform=litixPlatform(name,category);
 const title=String(name||"");
 if(platform==="Twitter (X)"&&/\b(?:retweets?|reposts?)\b/i.test(title))return "retweets";
 // A broad category such as "Threads - Followers / Likes / Views" is NOT
 // evidence that every row within it is a follower service.
 const titleMatches=KIND_RULES.filter(([,regex])=>regex.test(title)).map(([kind])=>kind);
 if(titleMatches.length===1)return titleMatches[0];
 if(titleMatches.length>1)return "other";
 const categoryMatches=KIND_RULES.filter(([,regex])=>regex.test(String(category||""))).map(([kind])=>kind);
 return categoryMatches.length===1?categoryMatches[0]:"other";
}
