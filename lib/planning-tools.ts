import {generateTeams,validateDay,recordTransfer,minute,uid,weekRange,dutyHistory} from "./teams.ts";
import type {Day,Workspace,Staff,Rule} from "./teams.ts";
export const asDraft=(d:Day):Day=>({...d,status:"draft",approvedAt:null,approvedBy:null});
export function assignmentExplanation(d:Day,teamId:string,history:Day[]){
 const p=d.placements.find(p=>p.teamId===teamId);if(!p)return "Generate or select team members first.";
 const names=[p.early1,p.early2,p.late].flatMap(id=>{
  const n=d.roster.find(n=>n.id===id);if(!n)return [];
  const h=dutyHistory(n.id,history,d.date);
  return [n.name+": "+(h.byTeam[teamId]||0)+" previous assignments to this team; "+h.demand+" demand points over "+h.days+" roster days."];
 });
 return (p.locked?"This team is locked. ":"")+(d.fairness?"Rotation is enabled: generation discourages repeating teams and concentrates fewer demanding duties on nurses with higher past demand. ":"Rotation is off: past team and demand scores are ignored. ")+"Entered required rules still apply; preferred rules guide selection. These are the factors considered, not a claim of optimal fairness.\n"+names.join("\n");
}
export function removeFromDay(input:Day,id:string,replacement?:Staff):Day{
 const d=structuredClone(input),old=d.roster.find(n=>n.id===id);
 if(!old)throw new Error("Select a nurse on this day's roster.");
 if(replacement){
  if(replacement.id===id)throw new Error("Choose a different replacement.");
  if(replacement.floor!==old.floor||replacement.cohort!==old.cohort)throw new Error("Replacement must have the same original floor and start group. Edit their directory details first.");
  if(d.placements.some(p=>[p.early1,p.early2,p.late].includes(replacement.id))||replacement.leadership||d.handovers.some(h=>h.nurseId===replacement.id))throw new Error("Replacement already has a team or leadership assignment.");
 }
 d.roster=d.roster.filter(n=>n.id!==id&&n.id!==replacement?.id);
 if(replacement)d.roster.push({...structuredClone(replacement),leadership:old.leadership});
 d.placements=d.placements.map(p=>({...p,...Object.fromEntries((["early1","early2","late"] as const).filter(k=>p[k]===id).map(k=>[k,replacement?.id||null]))}));
 d.breaks=d.breaks.filter(b=>b.nurseId!==id&&b.reliefId!==id);
 d.transfers=d.transfers.filter(t=>t.nurseId!==id);
 d.handovers=d.handovers.filter(h=>h.nurseId!==id);
 d.rulesReviewed=false;
 return asDraft(d);
}
export function repairTeams(d:Day,history:Day[]){
 const preserved=new Set<string>();
 const partial={...structuredClone(d),placements:d.placements.map(p=>{
  const t=d.teams.find(t=>t.id===p.teamId);
  const ns=[p.early1,p.early2,p.late].map(id=>d.roster.find(n=>n.id===id));
  const valid=!!t&&ns.every((n,i)=>n&&n.floor===t.floor&&n.cohort===(i===2?"late":"early")&&!n.leadership)&&ns.slice(0,2).some(n=>n?.role==="RN")&&new Set(ns.map(n=>n?.id)).size===3;
  const duplicate=[p.early1,p.early2,p.late].some(id=>d.placements.some(q=>q.teamId!==p.teamId&&[q.early1,q.early2,q.late].includes(id)));
  if(p.locked||valid&&!duplicate){preserved.add(p.teamId);return {...p,locked:true};}
  return {...p,locked:false};
 })};
 const result=generateTeams(partial,history);
 result.day.placements=result.day.placements.map(p=>({...p,locked:d.placements.find(q=>q.teamId===p.teamId)?.locked||false}));
 return {...result,preserved:preserved.size};
}
export function fairnessRows(w:Workspace,selected:Day,start:string,end:string,includeDrafts:boolean){
 const days=[...w.days.filter(d=>d.date!==selected.date),selected].filter(d=>d.date>=start&&d.date<=end&&(includeDrafts||d.status==="approved"));
 const people=new Map(w.nurses.map(n=>[n.id,n]));
 for(const d of days)for(const n of d.roster)people.set(n.id,n);
 return [...people.values()].filter(n=>n.cohort!=="morning-charge").map(n=>{
  const byTeam:Record<string,number>={};let daysWorked=0,demanding=0,points=0;
  for(const d of days){
   if(d.roster.some(p=>p.id===n.id))daysWorked++;
   for(const p of d.placements)if([p.early1,p.early2,p.late].includes(n.id)){
    const t=d.teams.find(t=>t.id===p.teamId);if(!t)continue;
    const label=t.floor+" "+t.label;byTeam[label]=(byTeam[label]||0)+1;
    if(t.demand>1)demanding++;points+=t.demand-1;
   }
  }
  return {id:n.id,name:n.name,daysWorked,byTeam,demanding,points,repeats:Object.values(byTeam).reduce((s,n)=>s+Math.max(0,n-1),0)};
 }).sort((a,b)=>a.name.localeCompare(b.name));
}
const errorKeys=(d:Day,history:Day[])=>new Set(validateDay(d,history).filter(i=>i.kind==="error").map(i=>i.code+":"+i.text));
export type Suggestion={id:string;title:string;detail:string;day:Day};
export function suggestRepairs(d:Day,history:Day[]):Suggestion[]{
 const before=errorKeys(d,history);if(!before.size)return [];
 const found:Suggestion[]=[];
 const accept=(day:Day,title:string,detail:string)=>{
  const after=errorKeys(day,history);
  if(after.size<before.size&&[...after].every(k=>before.has(k)))found.push({id:uid(),title,detail:detail+" Resolves "+(before.size-after.size)+" required checks; "+after.size+" remain.",day:asDraft(day)});
 };
 // Fix an early LPN pair / prohibited team by swapping with another eligible member or float.
 let checked=0;
 for(const p of d.placements){
  if(p.locked)continue;
  const team=d.teams.find(t=>t.id===p.teamId);if(!team)continue;
  for(const slot of ["early1","early2","late"] as const){
   const old=d.roster.find(n=>n.id===p[slot]);if(!old)continue;
   for(const n of d.roster.filter(n=>n.id!==old.id&&n.floor===team.floor&&n.cohort===(slot==="late"?"late":"early")&&!n.leadership)){
    if(++checked>500||found.length>=5)return found;
    const other=d.placements.find(q=>[q.early1,q.early2,q.late].includes(n.id));if(other?.locked||other?.teamId===p.teamId)continue;
    const day=structuredClone(d);
    for(const q of day.placements)for(const key of ["early1","early2","late"] as const){if(q.teamId===p.teamId&&key===slot)q[key]=n.id;else if(q[key]===n.id)q[key]=old.id;}
    accept(day,"Move "+n.name+" into "+team.floor+" team "+team.label,"Exchange "+old.name+" with "+n.name+"; unchanged teams stay in place.");
   }
  }
 }
 const repaired=repairTeams(d,history);
 accept(repaired.day,"Repair affected teams","Keep "+repaired.preserved+" complete or locked teams and refill the remaining positions.");
 return found.slice(0,5);
}
export function transferAlternatives(d:Day,at:string,history:Day[]){
 if(!Number.isFinite(minute(at)))return [];
 return d.roster.filter(n=>n.floor==="JP2"&&!d.transfers.some(t=>t.nurseId===n.id)).flatMap(n=>{
  try{const next=recordTransfer(d,n.id,at);
   const original=errorKeys(d,history),after=errorKeys(next,history);
   if([...after].some(k=>!original.has(k)))return [];
   return [{id:n.id,name:n.name,role:n.role,day:next}];
  }catch{return [];}
 });
}
export function describeChanges(before:Workspace,after:Workspace,date:string){
 const a=before.days.find(d=>d.date===date),b=after.days.find(d=>d.date===date);
 const changed=(x:unknown,y:unknown)=>JSON.stringify(x)!==JSON.stringify(y);
 const parts:string[]=[];
 if(!a&&b)parts.push("Created day");
 if(a&&b){
  if(a.status!==b.status)parts.push(b.status==="approved"?"Approved by "+b.approvedBy:"Reopened as draft");
  if(changed(a.roster,b.roster)){
   const changedNames=b.roster.filter(n=>changed(n,a.roster.find(x=>x.id===n.id))).map(n=>n.name);
   const removed=a.roster.filter(n=>!b.roster.some(x=>x.id===n.id)).map(n=>n.name);
   parts.push("Roster: "+[...changedNames,...removed.map(n=>"removed "+n)].join(", "));
  }
  if(changed(a.placements,b.placements)){
   for(const p of b.placements){
    const old=a.placements.find(x=>x.teamId===p.teamId),t=b.teams.find(t=>t.id===p.teamId);
    const changes=(["early1","early2","late"] as const).filter(k=>p[k]!==old?.[k]).map(k=>k+": "+(a.roster.find(n=>n.id===old?.[k])?.name||"unassigned")+" → "+(b.roster.find(n=>n.id===p[k])?.name||"unassigned"));
    if(p.locked!==old?.locked)changes.push(p.locked?"locked":"unlocked");
    if(changes.length)parts.push((t?t.floor+" "+t.label:p.teamId)+" "+changes.join(", "));
   }
   if(a.placements.some(p=>!b.placements.some(x=>x.teamId===p.teamId)))parts.push("Removed team assignments");
  }
  if(changed(a.teams,b.teams))parts.push("Changed cubicle layout / demand");
  if(changed(a.breaks,b.breaks))parts.push("Changed breaks / relief");
  if(changed(a.transfers,b.transfers))parts.push("Changed floor transfers");
  if(changed(a.handovers,b.handovers))parts.push("Changed leadership handover");
  if(a.closureAt!==b.closureAt)parts.push("JP2 closure: "+(b.closureAt||"not recorded"));
  if(a.fairness!==b.fairness)parts.push("History rotation "+(b.fairness?"on":"off"));
  if(a.notes!==b.notes)parts.push("Edited coordinator notes");
  if(a.rulesReviewed!==b.rulesReviewed)parts.push("Changed rules review");
  if(changed(a.rules,b.rules))parts.push("Updated preferences / weekly limits");
 }
 if(changed(before.rules,after.rules)&&!parts.some(p=>p.includes("preferences")))parts.push("Updated default preferences");
 return (parts.join("; ")||"Updated workspace").slice(0,2000);
}
export function auditChange(before:Workspace,after:Workspace,date:string,actor:string,summary?:string):Workspace{
 const entry={id:uid(),at:new Date().toISOString(),date,actor:actor.slice(0,100),summary:(summary||describeChanges(before,after,date)).slice(0,2000)};
 return {...after,audit:[...before.audit,entry].slice(-250)};
}
export {weekRange};
