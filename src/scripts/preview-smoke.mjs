// Run on an authorized CI runner, never print protection credentials or bodies.
const base=new URL(process.env.PREVIEW_URL||'');
if(base.protocol!=='https:'||!base.hostname.endsWith('.vercel.app')||base.username||base.password)throw Error('Exact HTTPS Vercel Preview URL required');
const secret=process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
if(!secret)throw Error('Configure deployment automation protection secret in CI');
const cases=[['/',200],['/auto-engagement/sandbox',200],['/api/auto-engagement/v1',200],['/api/account/dashboard',503],['/api/account/subscriptions',503,'POST'],['/api/subscriptions/v1/manage',503,'POST']];
let failed=false;
for(const [path,expected,method='GET'] of cases){const response=await fetch(new URL(path,base),{method,redirect:'manual',headers:{'x-vercel-protection-bypass':secret},signal:AbortSignal.timeout(30000)});console.log(JSON.stringify({path,method,expected,actual:response.status,passed:expected===response.status}));await response.body?.cancel();if(response.status!==expected)failed=true}
if(failed)process.exitCode=1;
