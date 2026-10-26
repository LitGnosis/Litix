// Presentation only. Numeric retail USD per 1,000, never minimum-order subtotals.
export function matchesServiceQuickKind(x,kind){
 if(!["likes","followers"].includes(kind))return true;
 const name=String(x?.name||"").toLowerCase();
 const category=String(x?.category||"").toLowerCase();
 const text=name+" "+category;
 if(kind==="likes")return /\blikes?\b/.test(text)&&!/\bfollowers?\b/.test(text)&&!/\b(?:views?|shares?|comments?|saves?|reposts?)\b/.test(name);
 return /\bfollowers?\b/.test(text)&&!/\blikes?\b/.test(name);
}
export function sortServicesPer1000(rows,platformRank,retailRate){
 return [...rows].sort((a,b)=>{
  const group=platformRank(a)-platformRank(b);
  if(group)return group;
  const price=Number(retailRate(a))-Number(retailRate(b));
  if(price)return price;
  return String(a.name||"").localeCompare(String(b.name||""))||
    String(a.service??a.id).localeCompare(String(b.service??b.id));
 });
}
