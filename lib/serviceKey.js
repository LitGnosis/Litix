export const encodedServiceKey=service=>`${service.provider}:${service.providerServiceId}`;
export function decodeServiceKey(value){const s=String(value||''),i=s.indexOf(':');return i>0?{provider:s.slice(0,i),serviceId:s.slice(i+1)}:{provider:'owlet',serviceId:s}}
