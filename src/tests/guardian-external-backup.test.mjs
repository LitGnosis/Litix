import test from "node:test";
import assert from "node:assert/strict";
import {backupSignal} from "../scripts/guardian-external-backup-signal.mjs";
const at=new Date("2026-10-31T20:00:00Z");
const run=(conclusion,event="schedule",created="2026-10-31T08:00:00Z",status="completed")=>({conclusion,event,created_at:created,status});
test("only recent completed successful scheduled encrypted backup counts as healthy",()=>{
 assert.equal(backupSignal({workflow_runs:[run("success")]},at).ok,true);
 assert.equal(backupSignal({workflow_runs:[run("success","workflow_dispatch")]},at).ok,false);
 assert.equal(backupSignal({workflow_runs:[run("failure")]},at).code,"R2_BACKUP_NOT_VERIFIED");
 assert.equal(backupSignal({workflow_runs:[run("success","schedule","2026-10-29T08:00:00Z")]},at).code,"R2_SCHEDULE_STALE");
 assert.equal(backupSignal({workflow_runs:[run(null,"schedule","2026-10-31T08:00:00Z","in_progress")]},at).ok,false);
 assert.equal(backupSignal({workflow_runs:[run("failure"),run("success","schedule","2026-10-30T08:00:00Z")]},at).ok,false);
});
