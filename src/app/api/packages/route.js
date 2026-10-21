import {NextResponse} from 'next/server';
import {packageCatalog} from '../../../lib/specialPackages';
export const dynamic='force-dynamic';
const publicPackage=p=>({id:p.id,platform:p.platform,tier:p.tier,name:p.name,priceCents:p.priceCents,markupPercent:p.markupPercent,items:p.items,available:p.available,missing:p.missing,profitProtected:p.profitProtected,readiness:p.readiness});
export async function GET(){try{return NextResponse.json({packages:(await packageCatalog()).map(publicPackage)},{headers:{'cache-control':'public, s-maxage=120, stale-while-revalidate=600'}})}catch(e){console.error('packages_catalog_error',e?.message||e);return NextResponse.json({error:'Packages are temporarily unavailable.'},{status:503})}}
