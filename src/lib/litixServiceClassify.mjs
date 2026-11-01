export function litixPlatform(name,category){
 const label=(String(name||"")+" "+String(category||"")).toLowerCase();
 const patterns=[
 ["Instagram",/instagram|\big\b/],["TikTok",/tik[\s._-]*tok/],["YouTube",/youtube|\byt\b/],
 ["Facebook",/facebook|\bfb\b/],["Twitter (X)",/twitter|\bx\s*(followers|likes|retweets|views)/],
 ["Spotify",/spotify/],["Telegram",/telegram/],["LinkedIn",/linkedin/],
 ["Discord",/discord/],["Snapchat",/snapchat/],["Pinterest",/pinterest/],
 ["Website Traffic",/website|traffic/],["Twitch",/twitch/],["Kick",/\bkick\b/],
 ["Reddit",/reddit/],["Apple Music",/apple\s*music/]
 ];
 return patterns.find(([,regex])=>regex.test(label))?.[0]||"Other";
}
export function litixKind(name,category){
 const label=(String(name||"")+" "+String(category||"")).toLowerCase();
 if(litixPlatform(name,category)==="Twitter (X)"&&/\b(?:retweets?|reposts?)\b/.test(String(name||"").toLowerCase()))return "retweets";
 for(const type of ["followers","likes","views","comments","subscribers","shares","saves","members","plays","traffic"]){
  const re=new RegExp("\\b"+type.replace(/s$/,"")+"s?\\b");
  if(re.test(label))return type;
 }
 return "other";
}
