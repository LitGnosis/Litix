// No dummy credentials: absent server configuration must fail closed at runtime.
export function providerConfiguration(env = process.env) {
  return [
    {id:'autosm',url:env.AUTOSM_API_URL,key:env.AUTOSM_API_KEY},
    {id:'smmglory',url:env.SMMGLORY_API_URL,key:env.SMMGLORY_API_KEY},
    {id:'smmcpan',url:env.SMMCPAN_API_URL,key:env.SMMCPAN_API_KEY},
    {id:'smmglob',url:env.SMMGLOB_API_URL,key:env.SMMGLOB_API_KEY}
  ];
}
function positiveInt(value) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Invalid numeric package configuration');
  return String(value);
}
function endpoint(provider) {
  if (!provider.key || !provider.url) return null;
  const url = new URL(provider.url);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Invalid provider endpoint');
  const hosts = {autosm:'auto-sm.com',smmglory:'smmglory.com',smmcpan:'smmcpan.com',smmglob:'smmglob.com'};
  if (url.hostname !== hosts[provider.id] && url.hostname !== `www.${hosts[provider.id]}`) throw new Error('Unexpected provider host');
  return url.href;
}
export function providerPayload(pkg, order, provider) {
  if (pkg.isAutoLikes) {
    const username = String(order.customerTargetUsername || '').replace(/^@/, '');
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(username)) throw new Error('An Instagram handle, not a URL, is required');
    if (pkg.minLikes > pkg.maxLikes) throw new Error('Invalid like range');
    return {action:'add',service:positiveInt(pkg.providerServiceIds?.[provider]),username,min:positiveInt(pkg.minLikes),max:positiveInt(pkg.maxLikes),posts:positiveInt(pkg.postsToCover)};
  }
  const link = new URL(order.customerTargetHandle);
  if (link.protocol !== 'https:') throw new Error('Invalid target URL');
  return {action:'add',service:positiveInt(pkg.smmGlobServiceId),link:link.href,quantity:positiveInt(pkg.quantity)};
}
// repository.claim must atomically claim a paid, pending order. Never reclaim submitting/review orders.
export async function processVerifiedBundleOrder(id, {repository, packages, providers=providerConfiguration(), fetchImpl=fetch}={}) {
  if (!repository || !packages) throw new Error('Bundle repository adapter is required');
  const order = await repository.claim(id);
  if (!order) return {success:true,skipped:true};
  try {
    const pkg = packages.find(p=>p.id===order.packageId);
    if (!pkg || pkg.status !== 'active' || pkg.price <= 0) throw new Error('Package unavailable');
    const lanes = providers.filter(p=>pkg.isAutoLikes ? p.id!=='smmglob' : p.id==='smmglob');
    for (const provider of lanes) {
      const url = endpoint(provider);
      if (!url) continue; // A lane without credentials/verified API URL cannot submit.
      const payload = providerPayload(pkg,order,provider.id);
      let data;
      try {
        const response = await fetchImpl(url,{method:'POST',body:new URLSearchParams({key:provider.key,...payload}),headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:AbortSignal.timeout(15000),redirect:'error'});
        if (!response.ok) throw new Error('Uncertain provider HTTP response');
        data = await response.json();
      } catch {
        // Includes timeout, network failure, redirect, malformed JSON: panel may have charged us.
        await repository.review(id,'UNCERTAIN_SUBMISSION: manual provider sync required');
        return {success:false,reconciliationRequired:true};
      }
      const token = data?.subscription ?? data?.order;
      if (data?.error || !/^[1-9][0-9]*$/.test(String(token ?? ''))) {
        // Unknown error contracts cannot prove rejection. Do not fail over a potentially accepted order.
        await repository.review(id,'UNCERTAIN_SUBMISSION: invalid provider acknowledgement');
        return {success:false,reconciliationRequired:true};
      }
      await repository.submitted(id,{provider:provider.id,externalId:String(token),pkg});
      return {success:true,status:'submitted'};
    }
    await repository.review(id,'Provider configuration unavailable; manual sync required');
    return {success:false,configurationRequired:true};
  } catch {
    await repository.review(id,'Manual sync required: bundle validation or persistence failed');
    return {success:false,reconciliationRequired:true};
  }
}
