import test from "node:test";
import assert from "node:assert/strict";
import {seedWorkspace,newDay,generateTeams,validateDay,floorCount,floorAt,minute,recordTransfer,closeJP2,importStaff,migrateWorkspace,workspaceSchema,dutyHistory,shiftEnd} from "../lib/teams.ts";
import {seedData} from "../lib/planner.ts";
const fixture=()=>{
 const w=seedWorkspace();w.nurses.forEach(n=>n.confirmed=true);
 const d=generateTeams(newDay(w,"2026-10-20"),[]).day;d.rulesReviewed=true;
 return {w,d};
};
const errors=d=>validateDay(d).filter(i=>i.kind==="error");
test("19 early and 11 late excludes two morning charges, includes late leaders",()=>{
 const {d}=fixture();
 assert.equal(d.roster.filter(n=>n.cohort==="early").length,19);
 assert.equal(d.roster.filter(n=>n.cohort==="late").length,11);
 assert.equal(d.roster.filter(n=>n.cohort==="morning-charge").length,2);
 assert.equal(floorCount(d,"JP2",minute("06:00")).people.length,8);
 assert.equal(floorCount(d,"JP3",minute("06:00")).people.length,11);
 assert.ok(floorCount(d,"JP2",minute("13:30")).people.some(n=>n.leadership==="poc"));
 assert.deepEqual(errors(d),[]);
 assert.equal(d.closureAt,null);
});
test("seven shared teams have two primary early nurses and a late nurse; short shifts remain floats",()=>{
 const {d}=fixture();assert.equal(d.placements.length,7);
 const ids=d.placements.flatMap(p=>[p.early1,p.early2,p.late]);
 assert.equal(new Set(ids).size,21);
 for(const n of d.roster.filter(n=>n.shortEnd||n.leadership))assert.ok(!ids.includes(n.id));
 assert.deepEqual(errors(d),[]);
});
test("LPN/LPN early pairs fail even when floor balance passes; RN/RN is valid",()=>{
 const {d}=fixture(),p=d.placements[0];
 d.roster.find(n=>n.id===p.early1).role="LPN";
 d.roster.find(n=>n.id===p.early2).role="LPN";
 assert.ok(errors(d).some(i=>i.code==="pair"));
 d.roster.find(n=>n.id===p.early1).role="RN";
 d.roster.find(n=>n.id===p.early2).role="RN";
 assert.ok(!errors(d).some(i=>i.code==="pair"));
});
test("strict RN majority checked at short-shift finish and every break edge",()=>{
 const {d}=fixture();
 const early=d.roster.filter(n=>n.floor==="JP2"&&n.cohort==="early");
 early.forEach((n,i)=>n.role=i<4?"RN":"LPN");
 assert.ok(errors(d).some(i=>i.code==="balance"&&i.text.includes("06:00")));
 const x=fixture().d,ns=x.roster.filter(n=>n.floor==="JP2"&&n.cohort==="early"&&n.role==="RN");
 x.breaks=ns.slice(0,2).map((n,i)=>({id:"b"+i,nurseId:n.id,start:"09:00",end:"09:15",reliefId:null}));
 assert.ok(errors(x).some(i=>i.code==="balance"&&i.text.includes("09:00–09:15")));
});
test("recurring short shifts apply Monday-Friday and directory snapshots do not alter saved days",()=>{
 const {w,d}=fixture();
 for(const date of ["2026-10-19","2026-10-20","2026-10-21","2026-10-22","2026-10-23"]){
  const day=newDay(w,date);
  assert.equal(day.roster.find(n=>n.name==="Annie").end,"10:00");
  assert.equal(day.roster.find(n=>n.name==="Tiffany").end,"12:15");
 }
 assert.ok(!newDay(w,"2026-10-24").roster.some(n=>n.shortEnd));
 w.nurses[0].name="Changed";assert.notEqual(d.roster[0].name,"Changed");
 assert.deepEqual(["10:00","11:00","12:00","13:00","15:00"].map(shiftEnd),["18:00","19:00","20:00","21:00","23:00"]);
});
test("afternoon leaders must be separate late RNs available at 13:30 and float",()=>{
 const {d}=fixture(),poc=d.roster.find(n=>n.leadership==="poc");
 poc.role="LPN";assert.ok(errors(d).some(i=>i.code==="leadership"));
 poc.role="RN";poc.start="15:00";poc.end="23:00";
 assert.ok(errors(d).some(i=>i.code==="leadership"));
 const x=fixture().d;
 x.placements[0].late=x.roster.find(n=>n.leadership==="poc").id;
 assert.ok(errors(x).some(i=>i.code==="leadership"));
});
test("staggered move changes floors once, and closure moves only remaining staff",()=>{
 const {d}=fixture(),n=d.roster.find(n=>n.floor==="JP2"&&n.cohort==="late"&&!n.leadership);
 const before=floorCount(d,"JP2",minute("15:00")).people.length;
 const moved=recordTransfer(d,n.id,"15:00");
 assert.equal(floorAt(moved,n,minute("14:59")),"JP2");
 assert.equal(floorAt(moved,n,minute("15:00")),"JP3");
 assert.equal(floorCount(moved,"JP2",minute("15:00")).people.length,before-1);
 const closed=closeJP2(moved,"16:15");
 assert.equal(floorCount(closed,"JP2",minute("16:15")).people.length,0);
 const all=floorCount(closed,"JP3",minute("16:15")).people;
 assert.equal(all.length,11);assert.equal(new Set(all.map(n=>n.id)).size,11);
 assert.deepEqual(errors(closed),[]);
 assert.equal(d.transfers.length,0);assert.equal(d.closureAt,null);
});
test("POC stays last; early, off-duty, duplicate and post-closure transfers rejected",()=>{
 const {d}=fixture(),poc=d.roster.find(n=>n.leadership==="poc"),n=d.roster.find(n=>n.floor==="JP2"&&n.cohort==="late"&&!n.leadership);
 assert.throws(()=>recordTransfer(d,poc.id,"15:00"),/point of contact/);
 assert.throws(()=>recordTransfer(d,n.id,"13:59"));
 assert.throws(()=>recordTransfer(d,n.id,"23:00"));
 assert.throws(()=>recordTransfer(recordTransfer(d,n.id,"15:00"),n.id,"15:30"));
 assert.throws(()=>recordTransfer(closeJP2(d,"16:00"),n.id,"16:30"));
});
test("cannot transfer an RN if the sending floor would tie or fall below LPN count",()=>{
 const {d}=fixture(),late=d.roster.filter(n=>n.floor==="JP2"&&n.cohort==="late"&&!n.leadership);
 late[0].role="LPN";late[1].role="LPN";
 assert.throws(()=>recordTransfer(d,late[2].id,"15:00"),/strictly outnumber/);
});
test("closure has no preset time, needs present POC and rejects invalid/early/late times",()=>{
 const {d}=fixture();
 assert.ok(validateDay(d).some(i=>i.code==="closure-pending"&&i.kind==="warning"));
 assert.throws(()=>closeJP2(d,"13:59"));
 assert.throws(()=>closeJP2(d,"19:00"));
 assert.throws(()=>closeJP2(d,"nonsense"));
 const poc=d.roster.find(n=>n.leadership==="poc");
 d.breaks.push({id:"poc-break",nurseId:poc.id,start:"16:00",end:"16:30",reliefId:null});
 assert.throws(()=>closeJP2(d,"16:15"),/available/);
});
test("break coverage checks all teammates; simultaneous absence requires explicit available relief",()=>{
 const {d}=fixture(),p=d.placements[0],ids=[p.early1,p.early2,p.late];
 d.breaks=ids.map((id,i)=>({id:"b"+i,nurseId:id,start:"12:30",end:"12:45",reliefId:null}));
 assert.ok(errors(d).some(i=>i.code==="coverage"));
 const float=d.roster.find(n=>n.floor==="JP2"&&n.cohort==="late"&&!ids.includes(n.id));
 d.breaks[0].reliefId=float.id;
 assert.ok(!errors(d).some(i=>i.code==="coverage"));
 d.breaks[1].reliefId=float.id;
 assert.ok(errors(d).some(i=>i.code==="relief"&&i.text.includes("two")));
});
test("break relief rejects wrong floor, off-duty, on-break and self relief",()=>{
 for(const which of ["wrong-floor","off-duty","on-break","self"]){
  const {d}=fixture(),n=d.roster.find(n=>n.floor==="JP2"&&n.cohort==="early");
  let r=d.roster.find(n=>n.floor===(which==="wrong-floor"?"JP3":"JP2")&&n.cohort==="late");
  if(which==="self")r=n;
  d.breaks=[{id:"b",nurseId:n.id,start:which==="off-duty"?"09:00":"12:30",end:which==="off-duty"?"09:15":"12:45",reliefId:r.id}];
  if(which==="on-break")d.breaks.push({id:"r",nurseId:r.id,start:"12:30",end:"12:45",reliefId:null});
  assert.ok(errors(d).some(i=>i.code==="relief"),which);
 }
});
test("locked teams survive generation; history rotates prior teams and can be disabled",()=>{
 const {w,d}=fixture();d.placements[0].locked=true;
 const regenerated=generateTeams(d,[]).day;
 assert.deepEqual(regenerated.placements.find(p=>p.teamId===d.placements[0].teamId),d.placements[0]);
 const earlier=fixture().d;earlier.date="2026-10-19";earlier.status="approved";
 const base=newDay(w,"2026-10-20");
 const without=generateTeams({...base,fairness:false},[earlier]).day;
 assert.deepEqual(without.placements,generateTeams(base,[]).day.placements);
 const rotated=generateTeams(base,[earlier]).day;
 const repeats=day=>day.placements.reduce((sum,p)=>sum+[p.early1,p.early2,p.late].filter(id=>{const old=earlier.placements.find(x=>x.teamId===p.teamId);return [old.early1,old.early2,old.late].includes(id);}).length,0);
 assert.ok(repeats(rotated)<repeats(without));assert.deepEqual(errors(rotated),[]);
 assert.equal(dutyHistory(d.roster[0].id,[earlier],"2026-10-19").days,0);
});
test("CSV retains identity and recurrence; malformed values, duplicates and backwards shifts fail",()=>{
 const {w}=fixture(),annie=w.nurses.find(n=>n.name==="Annie");
 const [n]=importStaff("name,role,floor,cohort,start,end\nAnnie,RN,JP2,early,06:00,10:00",w.nurses);
 assert.equal(n.id,annie.id);assert.equal(n.shortEnd,"10:00");assert.equal(n.weekdaysOnly,true);
 assert.throws(()=>importStaff("name,role,floor,cohort,start,end\nSam,Other,JP2,early,06:00,14:00",[]));
 assert.throws(()=>importStaff("name,role,floor,cohort,start,end\nSam,RN,JP2,early,14:00,06:00",[]));
 assert.throws(()=>importStaff("name,role,floor,cohort,start,end\nSam,RN,JP2,early,06:00,14:00\nSam,RN,JP2,early,06:00,14:00",[]));
});
test("legacy records survive migration unchanged and do not become team schedules",()=>{
 const legacy=seedData(),copy=structuredClone(legacy),w=migrateWorkspace(legacy);
 assert.deepEqual(w.legacy,copy);assert.deepEqual(legacy,copy);assert.equal(w.days.length,0);
 assert.deepEqual(migrateWorkspace(w),w);
});
test("workspace rejects duplicate IDs, invalid dates and malformed event times",()=>{
 const {w,d}=fixture();w.days=[d];
 assert.ok(workspaceSchema.safeParse(w).success);
 const duplicate=structuredClone(w);duplicate.days[0].roster.push(duplicate.days[0].roster[0]);
 assert.ok(!workspaceSchema.safeParse(duplicate).success);
 const wrong=structuredClone(w);wrong.days[0].date="2026-02-31";assert.ok(!workspaceSchema.safeParse(wrong).success);
 const event=structuredClone(w);event.days[0].closureAt="25:00";assert.ok(!workspaceSchema.safeParse(event).success);
});
