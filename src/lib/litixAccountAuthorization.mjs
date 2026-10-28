/**
 * Litix customer & agency authorization primitives (DRAFT — no routes).
 *
 * These functions consume ONLY server-verified Auth0 JWT claims and
 * database-loaded membership/order rows. Never pass request JSON as claims or
 * membership. Authentication signature/JWKS verification occurs BEFORE
 * calling principalFromVerifiedJwt; this helper does NOT verify a JWT.
 *
 * No production DB write, role grant, customer mutation or route is created.
 */
const VERIFIED=Symbol("litix_server_verified_auth0");
const text=x=>typeof x==="string"?x.trim():"";
const audienceMatches=(aud,expected)=>typeof aud==="string"?aud===expected:Array.isArray(aud)&&aud.includes(expected);
const allowedRoles=new Set(["owner","admin","member","viewer"]);
const safeTime=x=>typeof x==="number"&&Number.isFinite(x)?x:null;

/** The caller MUST be trusted server middleware AFTER cryptographic verification. */
export function principalFromVerifiedJwt(claims,{
 signatureVerified=false,expectedIssuer="",expectedAudience="",now=Math.floor(Date.now()/1000)
}={}){
 if(signatureVerified!==true)throw Error("auth0_signature_not_verified");
 if(!claims||typeof claims!=="object"||Array.isArray(claims))throw Error("auth0_claims_invalid");
 const issuer=text(expectedIssuer),aud=text(expectedAudience),subject=text(claims.sub);
 if(!issuer.startsWith("https://")||!issuer.endsWith("/")||!aud||!subject||subject.length>256)
  throw Error("auth0_expected_identity_invalid");
 if(text(claims.iss)!==issuer||!audienceMatches(claims.aud,aud))throw Error("auth0_issuer_or_audience_mismatch");
 if(!Number.isSafeInteger(now)||now<=0)throw Error("auth0_now_invalid");
 const exp=safeTime(claims.exp),nbf=claims.nbf==null?null:safeTime(claims.nbf);
 if(exp===null||exp<=now||(nbf!==null&&nbf>now)||claims.nbf!=null&&nbf===null)
  throw Error("auth0_token_expired_or_not_yet_valid");
 return Object.freeze({kind:"auth0",sub:subject,issuer,audience:aud,expiresAt:exp,[VERIFIED]:true});
}

export function verifiedPrincipal(principal){
 return Boolean(principal?.[VERIFIED]===true&&principal.kind==="auth0"&&text(principal.sub));
}

/** Personal orders require a stored, server-established Auth0 identity mapping.
 * Emails, phone numbers and a guessed customer ID are NOT identity proof. */
export function mayReadOwnOrder(principal,order){
 return Boolean(verifiedPrincipal(principal)&&order&&typeof order==="object"&&
  text(order.customer_auth0_sub)&&text(order.customer_auth0_sub)===principal.sub);
}

/** Membership MUST come from a trusted DB query filtered by the principal's sub,
 * not from a JWT custom role or the browser. Empty/disabled memberships deny. */
export function validatedAgencyMembership(principal,membership,tenantId){
 if(!verifiedPrincipal(principal)||!membership||typeof membership!=="object")return null;
 const tenant=text(tenantId),memberSub=text(membership.auth0_sub),memberTenant=text(membership.tenant_id);
 if(!tenant||tenant.length>128||memberSub!==principal.sub||memberTenant!==tenant||
  membership.status!=="active"||membership.revoked_at||!allowedRoles.has(membership.role))return null;
 return Object.freeze({tenantId:tenant,role:membership.role});
}

/** Agency orders are NEVER accessible across tenant boundaries, including by
 * a platform owner unless a separately audited support impersonation flow exists. */
export function mayReadAgencyOrder(principal,order,dbMembership){
 const tenant=text(order?.tenant_id);
 return Boolean(tenant&&validatedAgencyMembership(principal,dbMembership,tenant));
}
export function mayManageAgencyOrder(principal,order,dbMembership){
 const member=validatedAgencyMembership(principal,dbMembership,text(order?.tenant_id));
 return Boolean(member&&["owner","admin"].includes(member.role));
}
export function mayViewAgencyWorkspace(principal,workspace,dbMembership){
 return Boolean(validatedAgencyMembership(principal,dbMembership,text(workspace?.tenant_id)));
}
