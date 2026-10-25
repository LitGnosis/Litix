// Preview integration is sandbox-only. No fallback to live keys or live hosts.
export function monthlySandboxConfig(env=process.env){
 if(env.NMI_GATEWAY_MODE!=='TEST'||!env.NMI_TEST_SECURITY_KEY)throw Error('Dedicated NMI sandbox credentials required');
 const url=new URL(env.NMI_TEST_GATEWAY_URL||'');
 if(url.protocol!=='https:'||url.hostname!=='sandbox.nmi.com'||url.port||url.username||url.password||url.pathname!=='/api/transact.php'||url.search||url.hash)throw Error('Approved NMI sandbox endpoint required');
 return {securityKey:env.NMI_TEST_SECURITY_KEY,endpoint:url.toString(),queryEndpoint:'https://sandbox.nmi.com/api/query.php'};
}
