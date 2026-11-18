// Locally generated, non-AI navigation help when external model credentials
// or the model service are unavailable. Does NOT claim to check live accounts.
export function guidedLitixReply(value){
 const q=String(value||"").trim().toLowerCase().slice(0,750);
 if(/\bcompare\b.*\busa\b.*\bfollower\b|\busa\b.*\bfollower\b.*\btier\b/.test(q)){
  return "To compare USA Instagram follower tiers, open /services, choose Instagram and Followers, then review the USA-labeled packages. The live catalog shows the current price per 1,000, quality descriptors and quantity limits. Checkout verifies eligibility and the final USD total before payment.";
 }
 if(/\bhow\b.*\bfast\b.*\b(order|start|delivery)|\bwhen\b.*\b(order|start|processing)/.test(q)){
  return "Order processing begins only after payment and service eligibility are confirmed. Start and delivery times vary by package and current service capacity, so Litix does not guarantee an instant start. Use Track order for your latest recorded fulfillment status.";
 }
 if(/order|track|delivery|status|receipt|refund|missing|not received|charge/.test(q)){
  return "To check a real order, select Track order in this chat or open /track. Enter your Litix order number and the checkout email. Your private payment and delivery records stay outside the AI conversation. If an order needs review, contact support at litixsocial@gmail.com. Please do not pay again for the same order.";
 }
 if(/bundle|\blaunch\b|\bmomentum\b|\bpower\b|\bapex\b/.test(q)){
  return "Litix no longer sells Growth Bundles. Choose an individual service at /services. Past bundle orders can still be reviewed through their original private tracking links or with Litix support.";
 }
 if(/instagram|tiktok|facebook|youtube|\bx\b|twitter|follower|like|view|subscriber|service|catalog|price|cost|package/.test(q)){
  return "Open /services to compare Litix's currently listed services. Select a platform and service type, then enter a public profile or post URL. Prices and current availability are verified again at checkout; the catalog alone does not authorize payment.";
 }
 if(/campaign|marketing|growth|content|promote|lead|business|agency/.test(q)){
  return "For a practical starting point, open /growth-studio to generate content drafts from your own brief, or use the campaign planner on the homepage. Drafts are not automatically posted or purchased.";
 }
 if(/help|contact|support|human|email|whatsapp/.test(q)){
  return "You can reach Litix support at litixsocial@gmail.com, or use the WhatsApp link on the website. For order support, include only the Litix order number—not card details, passwords or private tracking tokens.";
 }
 return "I can help you find services (/services), verify order progress privately (/track), or plan a campaign (/workspace). What would you like to do next?";
}
