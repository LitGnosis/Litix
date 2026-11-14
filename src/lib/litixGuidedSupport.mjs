// Locally generated, non-AI navigation help when external model credentials
// or the model service are unavailable. Does NOT claim to check live accounts.
export function guidedLitixReply(value){
 const q=String(value||"").trim().toLowerCase().slice(0,750);
 if(/order|track|delivery|status|receipt|refund|missing|not received|charge/.test(q)){
  return "To check a real order, select Track order in this chat or open /track. Enter your Litix order number and the checkout email. Your private payment and delivery records stay outside the AI conversation. If an order needs review, contact support at litixsocial@gmail.com. Please do not pay again for the same order.";
 }
 if(/bundle|launch|momentum|power|apex|package/.test(q)){
  return "See /bundles for the current Launch, Momentum, Power and Apex packages. The final price and service availability must be checked before checkout. No order has been placed.";
 }
 if(/instagram|tiktok|facebook|youtube|\bx\b|twitter|follower|like|view|subscriber|service|catalog|price|cost/.test(q)){
  return "Open /services to compare Litix's currently listed services. Select a platform and service type, then enter a public profile or post URL. Prices and supplier availability are verified again at checkout; the catalog alone does not authorize payment.";
 }
 if(/campaign|marketing|growth|content|promote|lead|business|agency/.test(q)){
  return "For a practical starting point, open /growth-studio to generate content drafts from your own brief, or use the campaign planner on the homepage. Drafts are not automatically posted or purchased.";
 }
 if(/help|contact|support|human|email|whatsapp/.test(q)){
  return "You can reach Litix support at litixsocial@gmail.com, or use the WhatsApp link on the website. For order support, include only the Litix order number—not card details, passwords or private tracking tokens.";
 }
 return "I can guide you to services (/services), bundles (/bundles), private tracking (/track), or campaign planning (/growth-studio). Live AI answers are not currently available, but these tools and the support team can still help. What would you like to do?";
}
