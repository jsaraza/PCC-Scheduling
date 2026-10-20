import test from "node:test";
import assert from "node:assert/strict";
import {seedWorkspace,newDay,generateTeams,validateDay,preferenceIssues,weekRange,leaderAt,minute,recordTransfer,closeJP2,migrateWorkspace,workspaceSchema} from "../lib/teams.ts";
import {removeFromDay,repairTeams,suggestRepairs,transferAlternatives,fairnessRows,auditChange,describeChanges} from "../lib/planning-tools.ts";
const fixture=()=>{const w=seedWorkspace();w.nurses.forEach(n=>n.confirmed=true);const d=generateTeams(newDay(w,"2026-10-20"),[]).day;d.rulesReviewed=true;return {w,d};};
const rule=(d,patch={})=>({id:"rule",nurseId:d.placements[0].early1,kind:"avoid",teamId:d.placements[0].teamId,strength:"required",max:0,...patch});
test("required avoid blocks approval and generation honors it with rotation off",()=>{
 const {d}=fixture();d.rules=[rule(d)];d.fairness=false;
 assert.ok(validateDay(d).some(i=>i.code==="preference"&&i.kind==="error"));
 const next=generateTeams(d,[]).day;assert.equal(preferenceIssues(next,[]).length,0);
});
test("required team preference is filled even when nurse was previously floating",()=>{
 const {d}=fixture(),ids=d.placements.flatMap(p=>[p.early1,p.early2]);
 const n=d.roster.find(n=>n.cohort==="early"&&n.floor==="JP2"&&!ids.includes(n.id));
 d.rules=[rule(d,{nurseId:n.id,kind:"prefer"})];
 const next=generateTeams(d,[]).day;
 assert.ok([next.placements[0].early1,next.placements[0].early2].includes(n.id));
 assert.deepEqual(preferenceIssues(next,[]),[]);
});
test("preferred rules warn rather than block and required locked conflicts remain visible",()=>{
 const {d}=fixture();d.rules=[rule(d,{strength:"preferred"})];
 assert.equal(preferenceIssues(d,[])[0].kind,"warning");
 d.rules[0].strength="required";d.placements[0].locked=true;
 assert.ok(preferenceIssues(generateTeams(d,[]).day,[]).some(i=>i.kind==="error"));
});
test("weekly limits include approved future days, exclude drafts and cross-week days, not selected day twice",()=>{
 const {d}=fixture();d.rules=[rule(d,{kind:"team-limit",max:1})];
 const future={...structuredClone(d),date:"2026-10-23",status:"approved"};
 assert.ok(preferenceIssues(d,[future]).some(i=>i.kind==="error"));
 assert.deepEqual(preferenceIssues(d,[{...future,status:"draft"}]),[]);
 assert.deepEqual(preferenceIssues(d,[{...future,date:"2026-10-26"}]),[]);
 assert.deepEqual(preferenceIssues(d,[{...d,status:"approved"}]),[]);
 assert.deepEqual(weekRange("2026-11-01"),{start:"2026-10-26",end:"2026-11-01"});
});
test("demand limits count demanding days, and missing team rules remain explicit",()=>{
 const {d}=fixture();d.teams[0].demand=3;d.rules=[rule(d,{kind:"demand-limit",teamId:null,max:0})];
 assert.ok(preferenceIssues(d,[]).length);
 d.rules=[rule(d,{teamId:"deleted"})];assert.equal(preferenceIssues(d,[])[0].code,"rule");
});
test("old v2 backups receive empty rules, handovers and audit without altering assignments",()=>{
 const {w,d}=fixture();w.days=[d];const raw=structuredClone(w);delete raw.toolsVersion;delete raw.rules;delete raw.audit;delete raw.days[0].rules;delete raw.days[0].handovers;
 const next=migrateWorkspace(raw);assert.deepEqual(next.days[0].placements,d.placements);assert.deepEqual(next.rules,[]);assert.deepEqual(next.audit,[]);assert.equal(next.toolsVersion,1);
});
test("sick call removes only affected slots and events; templates stay intact",()=>{
 const {w,d}=fixture(),p=d.placements[0],id=p.early1;w.days=[d];
 d.breaks=[{id:"b",nurseId:id,start:"09:00",end:"09:15",reliefId:null}];
 const next=removeFromDay(d,id);
 assert.equal(next.placements[0].early1,null);assert.deepEqual(next.placements.slice(1),d.placements.slice(1));assert.equal(next.breaks.length,0);
 assert.ok(w.nurses.some(n=>n.id===id));assert.ok(d.roster.some(n=>n.id===id));assert.equal(next.status,"draft");
});
test("replacement keeps unrelated assignments and rejects an already assigned or wrong-floor nurse",()=>{
 const {w,d}=fixture(),old=d.placements[0].early1;
 const replacement={...w.nurses.find(n=>n.id===old),id:"replacement",name:"Replacement RN"};
 const next=removeFromDay(d,old,replacement);
 assert.equal(next.placements[0].early1,replacement.id);assert.deepEqual(next.placements.slice(1),d.placements.slice(1));
 assert.throws(()=>removeFromDay(d,old,d.roster.find(n=>n.id===d.placements[1].early1)));
 assert.throws(()=>removeFromDay(d,old,{...replacement,floor:"JP3"}));
});
test("repair preserves complete teams and original locks while filling a gap",()=>{
 const {d}=fixture();d.placements[1].locked=true;
 const removed=removeFromDay(d,d.placements[0].early1);
 const repaired=repairTeams(removed,[]).day;
 assert.deepEqual(repaired.placements.find(p=>p.teamId===d.placements[1].teamId),d.placements[1]);
 for(const p of d.placements.slice(2))assert.deepEqual(repaired.placements.find(x=>x.teamId===p.teamId),p);
});
test("timed POC handover frees outgoing RN but prevents incoming leader transferring",()=>{
 const {d}=fixture(),old=leaderAt(d,"JP2",minute("15:00")),incoming=d.roster.find(n=>n.floor==="JP2"&&n.cohort==="late"&&!n.leadership&&n.end==="20:00");
 d.handovers=[{id:"h",floor:"JP2",nurseId:incoming.id,at:"15:00"}];
 assert.equal(leaderAt(d,"JP2",minute("14:59")).id,old.id);
 assert.equal(leaderAt(d,"JP2",minute("15:00")).id,incoming.id);
 assert.ok(!validateDay(d).some(i=>i.code==="handover"));
 assert.doesNotThrow(()=>recordTransfer(d,old.id,"15:00"));
 assert.throws(()=>recordTransfer(d,incoming.id,"15:00"),/point of contact/);
 assert.doesNotThrow(()=>closeJP2(d,"19:00"));
});
test("handover rejects wrong floor, LPN, off duty and absent outgoing leader",()=>{
 const {d}=fixture(),n=d.roster.find(n=>n.floor==="JP3"&&n.cohort==="late");
 d.handovers=[{id:"h",floor:"JP2",nurseId:n.id,at:"15:00"}];
 assert.ok(validateDay(d).some(i=>i.code==="handover"));
 n.floor="JP2";n.role="LPN";assert.ok(validateDay(d).some(i=>i.code==="handover"));
 n.role="RN";d.handovers[0].at="19:00";assert.ok(validateDay(d).some(i=>i.code==="handover"));
});
test("day-only hours exception allows shortened shift but continues RN balance checks",()=>{
 const {d}=fixture(),early=d.roster.find(n=>n.cohort==="early"&&n.role==="RN");
 early.end="11:30";assert.ok(validateDay(d).some(i=>i.code==="time"));
 early.shiftOverride=true;assert.ok(!validateDay(d).some(i=>i.code==="time"&&i.text.includes(early.name)));
});
test("suggestions reduce required errors without introducing any new ones",()=>{
 const {d}=fixture();d.rules=[rule(d)];
 const original=new Set(validateDay(d).filter(i=>i.kind==="error").map(i=>i.code+":"+i.text));
 const fixes=suggestRepairs(d,[]);assert.ok(fixes.length);
 for(const fix of fixes){const remaining=validateDay(fix.day).filter(i=>i.kind==="error");assert.ok(remaining.length<original.size);assert.ok(remaining.every(i=>original.has(i.code+":"+i.text)));}
});
test("transfer suggestions exclude POC and every proposed move passes validation",()=>{
 const {d}=fixture();const options=transferAlternatives(d,"15:00",[]);
 assert.ok(options.length);assert.ok(!options.some(n=>n.id===leaderAt(d,"JP2",900).id));
 for(const n of options)assert.equal(validateDay(n.day).filter(i=>i.kind==="error").length,0);
});
test("fairness honors dates/status and does not double count selected day",()=>{
 const {w,d}=fixture();d.teams[0].demand=3;d.status="approved";w.days=[d,{...structuredClone(d),date:"2026-10-21",status:"draft"}];
 const id=d.placements[0].early1;
 const row=fairnessRows(w,d,"2026-10-19","2026-10-25",false).find(r=>r.id===id);
 assert.equal(row.daysWorked,1);assert.equal(row.points,2);assert.equal(row.repeats,0);
 const preview=fairnessRows(w,d,"2026-10-19","2026-10-25",true).find(r=>r.id===id);
 assert.equal(preview.daysWorked,2);assert.equal(preview.points,4);assert.equal(preview.repeats,1);
});
test("audit records meaningful before/after assignment names and remains bounded",()=>{
 const {w,d}=fixture();w.days=[d];const next=structuredClone(w);
 const p=next.days[0].placements[0];[p.early1,p.early2]=[p.early2,p.early1];
 const text=describeChanges(w,next,d.date);assert.ok(text.includes("→"));assert.ok(text.includes("JP2"));
 let recorded=auditChange(w,next,d.date,"Test coordinator");assert.equal(recorded.audit.length,1);
 for(let i=0;i<260;i++)recorded=auditChange(recorded,recorded,d.date,"Test coordinator","Edit "+i);
 assert.equal(recorded.audit.length,250);assert.ok(workspaceSchema.safeParse(recorded).success);
});
