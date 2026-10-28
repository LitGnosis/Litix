// Backward-compatible public catalog alias. Never contact retired suppliers.
import {GET as boosteroCatalog} from "../catalog/v1/route.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request){return boosteroCatalog(request);}
