import test from "node:test";
import assert from "node:assert/strict";
import {CALENDAR_MAX_ENTRIES,calendarCsv,monthGrid,restoreCalendarEntries,validCalendarDate,validateCalendarDraft} from "../lib/growthCalendar.mjs";
const item=(extras={})=>({id:"test-entry-0001",title:"Launch campaign",date:"2026-10-28",platform:"Instagram",status:"Planned",note:"Original caption",...extras});

test("validates actual calendar days, leap years and date range",()=>{
  assert.equal(validCalendarDate("2028-02-29"),true);
  for(const bad of ["2026-02-29","2026-13-01","2026-04-31","2026-1-1","2026-00-03","1999-12-31","hello"])assert.equal(validCalendarDate(bad),false,bad);
});
test("restricts platform and publishing labels without pretending to connect to an API",()=>{
  assert.equal(validateCalendarDraft(item()).ok,true);
  assert.equal(validateCalendarDraft(item({platform:"x"})).ok,false);
  assert.equal(validateCalendarDraft(item({status:"Auto-Published"})).ok,false);
  assert.equal(validateCalendarDraft(item({title:"   "})).ok,false);
  assert.equal(validateCalendarDraft(item({date:"2026-02-30"})).ok,false);
  const long=validateCalendarDraft(item({note:"x".repeat(2100)}));
  assert.equal(long.value.note.length,2000);
});
test("restores only safe, unique, well-formed local drafts; handles corrupt JSON",()=>{
  assert.deepEqual(restoreCalendarEntries("{bad json"),[]);
  assert.deepEqual(restoreCalendarEntries({items:[]}),[]);
  assert.equal(restoreCalendarEntries([item(),item(),item({id:"test-entry-0002",title:"Second"})]).length,2);
  assert.equal(restoreCalendarEntries([item({id:"test<id>"})]).length,0);
  const rows=Array.from({length:250},(_,i)=>item({id:"item-"+String(i).padStart(8,"0")}));
  assert.equal(restoreCalendarEntries(rows).length,CALENDAR_MAX_ENTRIES);
});
test("month grid handles weekdays, leap February and 6-row months",()=>{
  const leap=monthGrid(2028,1);
  assert.equal(leap.filter(Boolean).length,29);
  assert.ok(leap.includes("2028-02-29"));
  assert.equal(monthGrid(2026,7).filter(Boolean).length,31);
  assert.ok(monthGrid(2026,7).length>=35);
  assert.deepEqual(monthGrid(2026,12),[]);
});
test("CSV export escapes quotes and neutralizes spreadsheet formula injection",()=>{
  const rows=[item({title:'=HYPERLINK("https://bad.example")',note:'  +SUM(1,1)'}),item({id:"another-0002",title:"Normal",date:"2026-11-01",note:'"quoted"\nnext'})];
  const csv=calendarCsv(rows);
  assert.ok(csv.startsWith("\uFEFFDate,Platform,Title,Status,Notes"));
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes("'+SUM")); // sanitized notes are trimmed before CSV formula escaping
  assert.ok(csv.includes('""quoted"" next'));
  assert.ok(csv.includes('"2026-10-28"'));
});
test("calendar implementation has no payment, supplier or social posting network code",async()=>{
  const {readFile}=await import("node:fs/promises");
  const page=await readFile(new URL("../app/growth/page.jsx",import.meta.url),"utf8");
  const lib=await readFile(new URL("../lib/growthCalendar.mjs",import.meta.url),"utf8");
  const home=await readFile(new URL("../app/page.jsx",import.meta.url),"utf8");
  assert.match(home,/href="\/growth"/);
  assert.match(page,/browser/);
  assert.doesNotMatch(page+lib,/api\/checkout|submitSupplierOrder|OPENAI_API_KEY|NMI_|collect\.js|BOOSTERO_API|SMMGLOB_API|fetch\(|\/api\//i);
});
