import test from "node:test";
import assert from "node:assert/strict";
import {mapBoosteroBatchStatus} from "../lib/boosteroBatchStatuses.mjs";
test("status mappings preserve partial and canceled outcomes",()=>{
 assert.equal(mapBoosteroBatchStatus({status:"Partial"}).customer,"partial");
 assert.equal(mapBoosteroBatchStatus({status:"In progress"}).customer,"in_progress");
 assert.equal(mapBoosteroBatchStatus({status:"Completed"}).state,"COMPLETED");
 assert.equal(mapBoosteroBatchStatus({status:"Canceled"}).customer,"canceled");
 assert.equal(mapBoosteroBatchStatus({error:"Invalid order"}),null);
 assert.equal(mapBoosteroBatchStatus({status:"Unknown"}),null);
});
