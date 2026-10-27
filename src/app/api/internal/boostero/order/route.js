import {handleBoosteroOrder} from "../../../../../lib/boosteroOrderHandler.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export function POST(req){return handleBoosteroOrder(req,{adminOnly:true});}
