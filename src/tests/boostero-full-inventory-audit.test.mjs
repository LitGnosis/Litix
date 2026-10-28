import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../app/api/premium/catalog/route.js",import.meta.url),"utf8");
test("complete Boostero inventory is audited via services read only, no supplier purchases",()=>{
 assert.match(source,/boosteroReadOnly\("services"\)/);
 assert.match(source,/totalSupplierServices:raw\.length/);
 assert.match(source,/supplierServiceTypes:inventory\.typeCounts/);
 assert.match(source,/purchasingEnabled:false/);
 assert.match(source,/previewOnly/);
 assert.doesNotMatch(source,/boosteroProduction\("add"/);
 assert.doesNotMatch(source,/console\.log\(raw|JSON\.stringify\(raw\)/);
 assert.doesNotMatch(source,/\bapiKey\s*:/i);
});
test("raw supplier IDs, wholesale and credentials never serialize into aggregate response",()=>{
 const returnStatement=source.slice(source.indexOf("  return Response.json({...view,"));
 assert.ok(returnStatement.length>0);
 assert.match(returnStatement,/totalSupplierServices/);
 assert.match(returnStatement,/typeCounts/);
 assert.doesNotMatch(returnStatement,/raw\W|apiKey|BOOSTERO_API_KEY|wholesale|secret/i);
});
