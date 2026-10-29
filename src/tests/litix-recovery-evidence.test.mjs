import test from "node:test";
import assert from "node:assert/strict";
import {litixRecoveryEvidence} from "../lib/litixRecoveryEvidence.mjs";

test("a deployment commit does not prove database recovery",()=>{
 const state=litixRecoveryEvidence({VERCEL_GIT_COMMIT_SHA:"f".repeat(40)});
 assert.equal(state.source.commit,"f".repeat(40));
 assert.equal(state.databaseRecovery.status,"NOT_INDEPENDENTLY_VERIFIED");
 assert.equal(state.databaseRecovery.localFilesystemScanCountsAsBackup,false);
 assert.equal(state.databaseRecovery.githubSourceArchiveCountsAsDatabaseBackup,false);
 assert.equal(state.changesAuthorizedByThisEvidence,false);
});

test("invalid source metadata does not masquerade as verified commit",()=>{
 const state=litixRecoveryEvidence({
  VERCEL_GIT_COMMIT_SHA:"8081ff8-MASTER-REPAIR",
  VERCEL_GIT_COMMIT_REF:"invalid?ref"
 });
 assert.equal(state.source.commit,null);
 assert.equal(state.source.branch,null);
 assert.deepEqual(state.databaseRecovery.requiredDatabases,["neondb","litixapi"]);
});
