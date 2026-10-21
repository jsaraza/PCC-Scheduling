import {z} from "zod";
import {dataSchema as legacySchema} from "./validation.ts";
import {parseCSV} from "./planner.ts";
export type Floor = "JP2" | "JP3";
export const floors:Floor[]=["JP2","JP3"];
export const targets={JP2:{early:8,late:5},JP3:{early:11,late:6}};
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const id=z.string().min(1).max(100);
const floor=z.enum(["JP2","JP3"]);
export const staffSchema=z.object({
 id,name:z.string().trim().min(1).max(100),role:z.enum(["RN","LPN"]),floor,
 cohort:z.enum(["early","late","morning-charge"]),start:time,end:time,
 leadership:z.enum(["","poc","charge"]),weekdaysOnly:z.boolean(),shortEnd:time.nullable(),
 confirmed:z.boolean(),shiftOverride:z.boolean().optional()
});
const cubicleSchema=z.object({number:z.string().trim().min(1).max(30),service:z.string().max(100),or:z.string().max(30)});
export const teamSchema=z.object({id,floor,label:z.string().trim().min(1).max(30),cubicles:z.array(cubicleSchema).length(4),demand:z.number().int().min(1).max(3)});
const placementSchema=z.object({teamId:id,early1:id.nullable(),early2:id.nullable(),late:id.nullable(),locked:z.boolean()});
const breakSchema=z.object({id,nurseId:id,start:time,end:time,reliefId:id.nullable()});
const transferSchema=z.object({id,nurseId:id,at:time});
export const ruleSchema=z.object({id,nurseId:id,kind:z.enum(["prefer","avoid","team-limit","demand-limit"]),teamId:id.nullable(),strength:z.enum(["required","preferred"]),max:z.number().int().min(0).max(7)});
const handoverSchema=z.object({id,floor,nurseId:id,at:time});
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(s+"T12:00:00Z");return !isNaN(d.valueOf())&&d.toISOString().slice(0,10)===s;});
export const daySchema=z.object({
 date,status:z.enum(["draft","approved"]),approvedBy:z.string().max(100).nullable(),approvedAt:z.string().nullable(),
 roster:z.array(staffSchema).max(100),teams:z.array(teamSchema).max(20),
 placements:z.array(placementSchema).max(20),breaks:z.array(breakSchema).max(200),
 transfers:z.array(transferSchema).max(100),closureAt:time.nullable(),
 fairness:z.boolean(),notes:z.string().max(5000),rulesReviewed:z.boolean(),
 rules:z.array(ruleSchema).max(300).default([]),handovers:z.array(handoverSchema).max(50).default([])
});
export const workspaceSchema=z.object({
 schemaVersion:z.literal(2),toolsVersion:z.literal(1).default(1),nurses:z.array(staffSchema).max(100),teams:z.array(teamSchema).max(20),
 days:z.array(daySchema).max(730),legacy:legacySchema.nullable(),demo:z.boolean(),
 rules:z.array(ruleSchema).max(300).default([]),
 audit:z.array(z.object({id,at:z.string().max(40),date:z.string().max(10),actor:z.string().max(100),summary:z.string().max(2000)})).max(250).default([])
}).superRefine((w,ctx)=>{
 const unique=(values:string[],name:string)=>{if(new Set(values).size!==values.length)ctx.addIssue({code:"custom",message:"Duplicate "+name+"."});};
 unique(w.nurses.map(n=>n.id),"directory nurse ID");unique(w.teams.map(t=>t.id),"template team ID");
 unique(w.days.map(d=>d.date),"schedule date");
 for(const d of w.days){unique(d.roster.map(n=>n.id),"daily nurse ID");unique(d.teams.map(t=>t.id),"daily team ID");unique(d.placements.map(p=>p.teamId),"team placement");unique(d.transfers.map(t=>t.nurseId),"nurse transfer");unique(d.breaks.map(b=>b.id),"break ID");}
});
export type Staff=z.infer<typeof staffSchema>;
export type Team=z.infer<typeof teamSchema>;
export type Placement=z.infer<typeof placementSchema>;
export type Day=z.infer<typeof daySchema>;
export type Workspace=z.infer<typeof workspaceSchema>;
export type Rule=z.infer<typeof ruleSchema>;
export type Issue={kind:"error"|"warning";code:string;text:string};
export const uid=()=>crypto.randomUUID();
export const minute=(s:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s)?Number(s.slice(0,2))*60+Number(s.slice(3)):NaN;
export const hhmm=(n:number)=>String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
export const shiftEnd=(start:string)=>hhmm(minute(start)+480);
export const localDate=(offset=0)=>{const d=new Date();d.setDate(d.getDate()+offset);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
const isWeekday=(s:string)=>![0,6].includes(new Date(s+"T12:00:00").getDay());
const intervalOverlap=(a:{start:string;end:string},b:{start:string;end:string})=>minute(a.start)<minute(b.end)&&minute(b.start)<minute(a.end);
export const atWork=(n:Staff,t:number)=>minute(n.start)<=t&&t<minute(n.end);
export function leaderAt(d:Day,f:Floor,t:number){
 const handover=[...d.handovers].filter(h=>h.floor===f&&minute(h.at)<=t).sort((a,b)=>minute(b.at)-minute(a.at))[0];
 return d.roster.find(n=>handover?n.id===handover.nurseId:n.leadership===(f==="JP2"?"poc":"charge"));
}
export function weekRange(date:string){const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);const start=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()+6);return {start,end:d.toISOString().slice(0,10)};}
export function ruleCount(rule:Rule,day:Day,history:Day[]){
 const range=weekRange(day.date);
 return history.filter(d=>d.status==="approved"&&d.date!==day.date&&d.date>=range.start&&d.date<=range.end).filter(d=>d.placements.some(p=>[p.early1,p.early2,p.late].includes(rule.nurseId)&&(rule.kind==="team-limit"?p.teamId===rule.teamId:(d.teams.find(t=>t.id===p.teamId)?.demand||1)>1))).length;
}
function violatesRule(r:Rule,t:Team|null,d:Day,history:Day[]){
 if(r.kind==="prefer")return t?.id!==r.teamId;
 if(r.kind==="avoid")return t?.id===r.teamId;
 const contributes=!!t&&(r.kind==="team-limit"?t.id===r.teamId:t.demand>1);
 return ruleCount(r,d,history)+(contributes?1:0)>r.max;
}
export function preferenceIssues(d:Day,history:Day[]):Issue[]{
 return d.rules.flatMap(r=>{
  const n=d.roster.find(n=>n.id===r.nurseId);if(!n)return [];
  if(r.kind!=="demand-limit"&&!d.teams.some(t=>t.id===r.teamId))return [{kind:"error" as const,code:"rule",text:n.name+": a preference refers to a removed team. Update the rule."}];
  const p=d.placements.find(p=>[p.early1,p.early2,p.late].includes(n.id)),team=d.teams.find(t=>t.id===p?.teamId)||null;
  if(!violatesRule(r,team,d,history))return [];
  const target=d.teams.find(t=>t.id===r.teamId),label=target?target.floor+" team "+target.label:"demanding teams";
  return [{kind:r.strength==="required"?"error" as const:"warning" as const,code:"preference",text:n.name+": "+(r.kind==="prefer"?"assign to "+label:r.kind==="avoid"?"avoid "+label:"maximum "+r.max+" "+(r.kind==="team-limit"?label:"demanding")+" assignments per Monday–Sunday week")+" ("+r.strength+")."}];
 });
}
export function floorAt(d:Day,n:Staff,t:number):Floor|null{
 if(!atWork(n,t))return null;
 if(n.floor==="JP3")return "JP3";
 if(d.closureAt&&t>=minute(d.closureAt))return "JP3";
 const move=d.transfers.find(x=>x.nurseId===n.id);
 return move&&t>=minute(move.at)?"JP3":"JP2";
}
export const onBreak=(d:Day,id:string,t:number)=>d.breaks.some(b=>b.nurseId===id&&minute(b.start)<=t&&t<minute(b.end));
export function floorStaff(d:Day,f:Floor,t:number){return d.roster.filter(n=>n.cohort!=="morning-charge"&&floorAt(d,n,t)===f&&!onBreak(d,n.id,t));}
export function floorCount(d:Day,f:Floor,t:number){const people=floorStaff(d,f,t);return {RN:people.filter(n=>n.role==="RN").length,LPN:people.filter(n=>n.role==="LPN").length,people};}
export function eventTimes(d:Day){
 return [...new Set([...d.roster.flatMap(n=>[minute(n.start),minute(n.end)]),...d.breaks.flatMap(b=>[minute(b.start),minute(b.end)]),...d.transfers.map(t=>minute(t.at)),...d.handovers.map(h=>minute(h.at)),...(d.closureAt?[minute(d.closureAt)]:[]),810,840])].filter(Number.isFinite).sort((a,b)=>a-b);
}
function floorOpen(d:Day,f:Floor,t:number){
 if(f==="JP2"&&d.closureAt&&t>=minute(d.closureAt))return false;
 const ns=d.roster.filter(n=>n.floor===f&&n.cohort!=="morning-charge");
 if(!ns.length)return false;
 const start=Math.min(...ns.map(n=>minute(n.start)));
 const end=f==="JP3"?Math.max(...d.roster.filter(n=>n.cohort!=="morning-charge").map(n=>minute(n.end))):Math.max(...ns.map(n=>minute(n.end)));
 return start<=t&&t<end;
}
export function balanceIssues(d:Day):Issue[]{
 const issues:Issue[]=[],times=eventTimes(d);
 for(let i=0;i<times.length-1;i++)for(const f of floors){
  const t=times[i];if(!floorOpen(d,f,t))continue;const c=floorCount(d,f,t);
  if(c.RN<=c.LPN)issues.push({kind:"error",code:"balance",text:f+" "+hhmm(t)+"–"+hhmm(times[i+1])+": "+c.RN+" RN / "+c.LPN+" LPN. RNs must strictly outnumber LPNs; morning charge and staff on break are excluded."});
 }
 return issues;
}
export function validateDay(d:Day,history:Day[]=[]):Issue[]{
 const issues:Issue[]=[];const add=(code:string,text:string,kind:"error"|"warning"="error")=>issues.push({kind,code,text});
 if(!d.rulesReviewed)add("review","Confirm the roster, designations, team layout and coordinator review before approval.","warning");
 if(!d.teams.length)add("teams","Configure the cubicle teams.");
 if(new Set(d.roster.map(n=>n.id)).size!==d.roster.length)add("duplicate","A nurse appears more than once in the roster.");
 for(const n of d.roster){
  if(!n.confirmed)add("designation",n.name+": confirm RN/LPN designation, floor and shift.");
  if(!Number.isFinite(minute(n.start))||!Number.isFinite(minute(n.end))||minute(n.end)<=minute(n.start))add("time",n.name+": invalid working hours.");
  if(!n.shiftOverride&&n.cohort==="early"&&!["05:45","06:00"].includes(n.start))add("time",n.name+": early starts must be 05:45 or 06:00.");
  if(!n.shiftOverride&&n.cohort==="early"&&n.end!==(n.shortEnd||shiftEnd(n.start)))add("time",n.name+": early finish must match the eight-hour shift or recurring short finish.");
  if(n.shortEnd&&(n.cohort!=="early"||!n.weekdaysOnly))add("recurring",n.name+": recurring short early shifts must be Monday–Friday.");
  if(n.weekdaysOnly&&!isWeekday(d.date))add("recurring",n.name+": weekday-only nurse included on a weekend.");
  if(!n.shiftOverride&&n.cohort==="late"&&(!["10:00","11:00","12:00","13:00","15:00"].includes(n.start)||n.end!==shiftEnd(n.start)))add("time",n.name+": late shifts must use a configured start and finish eight hours later.");
  if(n.cohort==="morning-charge"&&(n.role!=="RN"||n.leadership))add("leadership",n.name+": morning charge must be an RN, separate from afternoon leadership.");
  if(n.leadership&&(n.cohort!=="late"||n.role!=="RN"||minute(n.start)>810||minute(n.end)<=810||(n.leadership==="poc"&&n.floor!=="JP2")||(n.leadership==="charge"&&n.floor!=="JP3")))add("leadership",n.name+": afternoon leadership requires a late RN on the correct floor, available at 13:30.");
 }
 for(const f of floors){
  for(const c of ["early","late"] as const){const count=d.roster.filter(n=>n.floor===f&&n.cohort===c).length;if(count!==targets[f][c])add("headcount",f+": requires "+targets[f][c]+" "+c+" nurses; roster has "+count+". Morning charge is excluded.");}
  const charges=d.roster.filter(n=>n.floor===f&&n.cohort==="morning-charge");if(charges.length!==1)add("morning-charge",f+": record exactly one morning charge RN, outside the 19 early nurses.");
  const leadership=f==="JP2"?"poc":"charge";const leads=d.roster.filter(n=>n.leadership===leadership);
  if(leads.length!==1)add("leadership",f+": select exactly one "+(f==="JP2"?"point of contact":"afternoon charge")+" RN from the late roster.");
 }
 const occupied=new Map<string,string>();
 const cubicles=new Set<string>();
 for(const team of d.teams){
  for(const b of team.cubicles){const key=team.floor+":"+b.number;if(cubicles.has(key))add("cubicle","Cubicle "+key+" belongs to more than one team.");cubicles.add(key);}
  const p=d.placements.find(p=>p.teamId===team.id);
  if(!p){add("placement",team.floor+" team "+team.label+": no team assignment.");continue;}
  const early:Staff[]=[];
  for(const slot of ["early1","early2","late"] as const){
   const n=d.roster.find(n=>n.id===p[slot]);
   if(!n){add("placement",team.floor+" team "+team.label+": missing "+slot+" nurse.");continue;}
   if(occupied.has(n.id))add("duplicate",n.name+" is assigned to more than one team position.");occupied.set(n.id,team.id);
   if(n.floor!==team.floor||n.cohort!==(slot==="late"?"late":"early"))add("eligibility",n.name+": wrong floor or start group for team "+team.label+".");
   if(n.leadership)add("leadership",n.name+": afternoon leaders begin as floats; remove the cubicle-team assignment.");
   if(slot!=="late")early.push(n);
  }
  if(early.length===2&&!early.some(n=>n.role==="RN"))add("pair",team.floor+" team "+team.label+": the early pair cannot be LPN + LPN.");
 }
 for(const p of d.placements)if(!d.teams.some(t=>t.id===p.teamId))add("placement","Assignment refers to a removed team.");
 for(const b of d.breaks){
  const n=d.roster.find(n=>n.id===b.nurseId);
  if(!n||minute(b.start)<minute(n.start)||minute(b.end)>minute(n.end)||minute(b.end)<=minute(b.start))add("break","A break is outside the nurse's working hours or has invalid times.");
  if(d.breaks.some(x=>x.id!==b.id&&x.nurseId===b.nurseId&&intervalOverlap(x,b)))add("break","Overlapping breaks for "+(n?.name||"a removed nurse")+".");
  if(b.reliefId){
   const r=d.roster.find(n=>n.id===b.reliefId);
   if(!r||r.id===b.nurseId||r.cohort==="morning-charge")add("relief","Choose a different counted nurse for relief.");
   else for(const t of [...new Set([minute(b.start),...eventTimes(d).filter(t=>t>minute(b.start)&&t<minute(b.end))])]){
    if(!n||!atWork(r,t)||onBreak(d,r.id,t)||floorAt(d,r,t)!==floorAt(d,n,t))add("relief",r.name+": relief must be on duty, on the same floor and off break for the full interval.");
   }
   if(d.breaks.some(x=>x.id!==b.id&&x.reliefId===b.reliefId&&intervalOverlap(x,b)))add("relief","One relief nurse cannot cover two recorded breaks at once.");
  }
 }
 const seenMoves=new Set<string>();
 for(const move of d.transfers){
  const n=d.roster.find(n=>n.id===move.nurseId);
  if(seenMoves.has(move.nurseId))add("transfer","Duplicate transfer for one nurse.");seenMoves.add(move.nurseId);
  if(!n||n.floor!=="JP2"||n.cohort==="morning-charge"||minute(move.at)<840||!atWork(n,minute(move.at))||onBreak(d,move.nurseId,minute(move.at)))add("transfer","Transfers require a JP2 nurse on duty and off break, from 14:00 onward.");
  if(n?.id===leaderAt(d,"JP2",minute(move.at))?.id&&(!d.closureAt||minute(move.at)<minute(d.closureAt)))add("poc","JP2's current point of contact must remain until floor closure or a recorded handover.");
  if(d.closureAt&&minute(move.at)>=minute(d.closureAt))add("transfer","Remove redundant individual transfers at/after JP2 closure; closure moves all remaining staff.");
 }
 if(d.closureAt){
  const t=minute(d.closureAt),poc=leaderAt(d,"JP2",t);
  if(t<840||!poc||minute(poc.start)>t||minute(poc.end)<t)add("closure","JP2 closure must be from 14:00 onward, no later than its point of contact's finish.");
  if(poc&&d.breaks.some(b=>b.nurseId===poc.id&&minute(b.start)<=t&&t<minute(b.end)))add("closure","The point of contact must be available to coordinate closure.");
 }else add("closure-pending","JP2 closure is not recorded. Future checks assume nurses remain on their original floor until a transfer or closure is recorded.","warning");
 for(const h of d.handovers){
  const t=minute(h.at),n=d.roster.find(n=>n.id===h.nurseId),previous=leaderAt({...d,handovers:d.handovers.filter(x=>x.id!==h.id)},h.floor,t-0.001);
  if(t<810||!n||n.role!=="RN"||n.cohort!=="late"||floorAt(d,n,t)!==h.floor||onBreak(d,n.id,t)||(h.floor==="JP2"&&d.closureAt&&t>=minute(d.closureAt)))add("handover","Leadership handover requires an available late RN on the operating floor from 13:30.");
  if(!previous||previous.id===n?.id||minute(previous.end)<t||onBreak(d,previous.id,t)||floorAt(d,previous,Math.max(t-0.001,minute(previous.start)))!==h.floor)add("handover","The outgoing leader must still be available on the floor at handover; select a different incoming RN.");
  if(d.handovers.some(x=>x.id!==h.id&&x.floor===h.floor&&x.at===h.at))add("handover","Only one leadership handover per floor at a given time.");
 }
 // Ensure the POC does not leave before other JP2 nurses, even when closure is still undecided.
 const poc=leaderAt(d,"JP2",1439);
 if(poc){const end=minute(poc.end);if(!d.closureAt&&d.roster.some(n=>n.id!==poc.id&&n.cohort!=="morning-charge"&&floorAt(d,n,end)==="JP2"))add("poc-pending","JP2 closure or a revised leadership roster is required by "+poc.end+" if staff or patients remain. The point of contact must not leave the floor open.","warning");}
 issues.push(...balanceIssues(d));
 issues.push(...preferenceIssues(d,history));
 // Shared responsibility: either teammate or explicit relief can cover the four cubicles.
 const times=eventTimes(d);
 for(const team of d.teams){
  const p=d.placements.find(p=>p.teamId===team.id);if(!p)continue;
  const ids=[p.early1,p.early2,p.late].filter(Boolean) as string[];
  const members=d.roster.filter(n=>ids.includes(n.id));if(!members.length)continue;
  const from=Math.min(...members.map(n=>minute(n.start))),to=Math.max(...members.map(n=>minute(n.end)));
  for(let i=0;i<times.length-1;i++){
   const t=times[i];if(t<from||t>=to||team.floor==="JP2"&&d.closureAt&&t>=minute(d.closureAt))continue;
   let available=t>=840?floorStaff(d,team.floor,t).length>0:members.some(n=>floorAt(d,n,t)===team.floor&&!onBreak(d,n.id,t));
   if(!available)available=d.breaks.some(b=>ids.includes(b.nurseId)&&minute(b.start)<=t&&t<minute(b.end)&&b.reliefId&&d.roster.some(n=>n.id===b.reliefId&&floorAt(d,n,t)===team.floor&&!onBreak(d,n.id,t)));
   if(!available)add("coverage",team.floor+" team "+team.label+": no team member or recorded relief available "+hhmm(t)+"–"+hhmm(times[i+1])+".");
  }
 }
 if(!d.breaks.length)add("break-review","No timed breaks recorded. Review break coverage; unrecorded breaks cannot be checked.","warning");
 return issues.filter((x,i,a)=>a.findIndex(y=>x.code===y.code&&x.text===y.text)===i);
}
export function newDay(w:Workspace,date:string):Day{
 const roster=structuredClone(w.nurses.filter(n=>!n.weekdaysOnly||isWeekday(date))).map(n=>({...n,end:n.shortEnd||n.end}));
 return {date,status:"draft",approvedBy:null,approvedAt:null,roster,teams:structuredClone(w.teams),placements:[],breaks:[],transfers:[],closureAt:null,fairness:true,notes:"",rulesReviewed:false,rules:structuredClone(w.rules),handovers:[]};
}
export function dutyHistory(id:string,history:Day[],before:string){
 const byTeam:Record<string,number>={};let demand=0,days=0;
 for(const d of history.filter(d=>d.status==="approved"&&d.date<before).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30)){
  if(d.roster.some(n=>n.id===id))days++;
  for(const p of d.placements)if([p.early1,p.early2,p.late].includes(id)){const t=d.teams.find(t=>t.id===p.teamId);byTeam[p.teamId]=(byTeam[p.teamId]||0)+1;demand+=Math.max(0,(t?.demand||1)-1);}
 }
 return {byTeam,demand,days};
}
export function generateTeams(input:Day,history:Day[]):{day:Day;message:string}{
 const d=structuredClone(input);d.status="draft";d.approvedAt=null;d.approvedBy=null;
 d.placements=d.placements.filter(p=>p.locked);
 const used=new Set(d.placements.flatMap(p=>[p.early1,p.early2,p.late]).filter(Boolean) as string[]);
 const allowed=(n:Staff,t:Team)=>!d.rules.some(r=>r.nurseId===n.id&&r.strength==="required"&&violatesRule(r,t,d,history));
 const score=(n:Staff,t:Team)=>{const h=dutyHistory(n.id,history,d.date);return (n.shortEnd?100:0)+d.rules.filter(r=>r.nurseId===n.id&&r.strength==="preferred"&&violatesRule(r,t,d,history)).length*200+(d.fairness?((h.byTeam[t.id]||0)*10+h.demand/Math.max(1,h.days)*(t.demand-1)*5):0);};
 let exhausted=false;
 for(const f of floors){
  const teams=d.teams.filter(t=>t.floor===f&&!d.placements.some(p=>p.teamId===t.id));
  const early=d.roster.filter(n=>n.floor===f&&n.cohort==="early"&&!used.has(n.id));
  let visits=0,best:Placement[]|null=null,bestScore=Infinity;
  function search(index:number,available:Staff[],selected:Placement[],cost:number){
   if(++visits>20000){exhausted=true;return;}if(cost>=bestScore)return;
   if(index===teams.length){if(available.some(n=>d.rules.some(r=>r.nurseId===n.id&&r.strength==="required"&&r.kind==="prefer")))return;best=structuredClone(selected);bestScore=cost;return;}
   if(available.length<(teams.length-index)*2||available.filter(n=>n.role==="RN").length<teams.length-index)return;
   const team=teams[index];const pairs:{a:Staff;b:Staff;score:number}[]=[];
   for(let i=0;i<available.length;i++)for(let j=i+1;j<available.length;j++)if((available[i].role==="RN"||available[j].role==="RN")&&allowed(available[i],team)&&allowed(available[j],team))pairs.push({a:available[i],b:available[j],score:score(available[i],team)+score(available[j],team)});
   pairs.sort((a,b)=>a.score-b.score||a.a.id.localeCompare(b.a.id)||a.b.id.localeCompare(b.b.id));
   for(const pair of pairs){if(visits>20000)break;search(index+1,available.filter(n=>n.id!==pair.a.id&&n.id!==pair.b.id),[...selected,{teamId:team.id,early1:pair.a.id,early2:pair.b.id,late:null,locked:false}],cost+pair.score);}
  }
  search(0,early,[],0);
  const chosen=(best||teams.map(t=>({teamId:t.id,early1:null,early2:null,late:null,locked:false}))) as Placement[];
  for(const p of chosen){if(p.early1)used.add(p.early1);if(p.early2)used.add(p.early2);
   const t=d.teams.find(t=>t.id===p.teamId)!;
   const candidates=d.roster.filter(n=>n.floor===f&&n.cohort==="late"&&!n.leadership&&!used.has(n.id)&&allowed(n,t)).sort((a,b)=>Number(d.rules.some(r=>r.nurseId===b.id&&r.kind==="prefer"&&r.strength==="required"))-Number(d.rules.some(r=>r.nurseId===a.id&&r.kind==="prefer"&&r.strength==="required"))||score(a,t)-score(b,t)||minute(a.start)-minute(b.start)||a.id.localeCompare(b.id));
   p.late=candidates[0]?.id||null;if(p.late)used.add(p.late);d.placements.push(p);
  }
 }
 return {day:d,message:exhausted?"Search limit reached; review this best-found draft. Optimal fairness is not guaranteed.":"Team draft created. Review checks, primary pairs and float coverage."};
}
export function recordTransfer(d:Day,nurseId:string,at:string):Day{
 if(!Number.isFinite(minute(at)))throw new Error("Enter a valid transfer time.");
 const poc=leaderAt(d,"JP2",minute(at));
 if(!d.closureAt&&(!poc||!atWork(poc,minute(at))))throw new Error("JP2 must have its point of contact on duty until closure.");
 const next={...structuredClone(d),transfers:[...d.transfers,{id:uid(),nurseId,at}]};
 const invalid=validateDay(next).filter(i=>["transfer","poc","balance","relief","coverage","handover"].includes(i.code)&&i.kind==="error");
 if(invalid.length)throw new Error(invalid.map(i=>i.text).join("\n"));
 return {...next,status:"draft",approvedAt:null,approvedBy:null};
}
export function closeJP2(d:Day,at:string):Day{
 if(!Number.isFinite(minute(at)))throw new Error("Enter a valid closure time.");
 if(d.closureAt)throw new Error("JP2 closure is already recorded.");
 const next={...structuredClone(d),closureAt:at};
 const invalid=validateDay(next).filter(i=>["closure","transfer","poc","balance","relief","coverage","handover"].includes(i.code)&&i.kind==="error");
 if(invalid.length)throw new Error(invalid.map(i=>i.text).join("\n"));
 return {...next,status:"draft",approvedAt:null,approvedBy:null};
}
export function importStaff(csv:string,existing:Staff[]):Staff[]{
 const [header,...rows]=parseCSV(csv.replace(/^\uFEFF/,""));if(!header)throw new Error("CSV is empty.");
 const cols=header.map(s=>s.trim().toLowerCase());for(const name of ["name","role","floor","cohort","start","end"])if(!cols.includes(name))throw new Error("Required columns: name,role,floor,cohort,start,end.");
 if(new Set(cols.filter(Boolean)).size!==cols.filter(Boolean).length)throw new Error("Remove duplicate column headings.");
 if(rows.length>100)throw new Error("Maximum 100 nurses.");const names=new Set<string>();
 return rows.map((r,i)=>{
  const get=(k:string)=>(r[cols.indexOf(k)]||"").trim(),name=get("name"),previous=existing.find(n=>n.name.toLowerCase()===name.toLowerCase());
  if(cols.includes("weekdaysonly")&&!["","true","false"].includes(get("weekdaysonly").toLowerCase()))throw new Error("Row "+(i+2)+": weekdaysOnly must be true or false.");
  if(names.has(name.toLowerCase()))throw new Error("Duplicate nurse name on row "+(i+2));names.add(name.toLowerCase());
  const n=staffSchema.parse({id:previous?.id||uid(),name,role:get("role").toUpperCase(),floor:get("floor").toUpperCase(),cohort:get("cohort").toLowerCase(),start:get("start"),end:get("end"),leadership:cols.includes("leadership")?get("leadership"):previous?.leadership||"",weekdaysOnly:cols.includes("weekdaysonly")?get("weekdaysonly").toLowerCase()==="true":previous?.weekdaysOnly||false,shortEnd:cols.includes("shortend")?get("shortend")||null:previous?.shortEnd||null,confirmed:true});
  if(minute(n.start)>=minute(n.end))throw new Error("Row "+(i+2)+": invalid shift interval.");
  return n;
 });
}
export function templateTeams():Team[]{
 const layout:{floor:Floor;label:string;numbers:number[]}[]=[
  {floor:"JP2",label:"A",numbers:[1,2,3,4]},{floor:"JP2",label:"B",numbers:[5,6,7,8]},{floor:"JP2",label:"C",numbers:[9,10,11,12]},
  {floor:"JP3",label:"A",numbers:[41,42,43,44]},{floor:"JP3",label:"B",numbers:[45,46,47,48]},{floor:"JP3",label:"C",numbers:[50,51,59,60]},{floor:"JP3",label:"D",numbers:[52,53,57,58]}
 ];
 return layout.map(t=>({id:t.floor+"-"+t.label,floor:t.floor,label:t.label,demand:1,cubicles:t.numbers.map(number=>({number:String(number),service:"",or:""}))}));
}
export function seedWorkspace():Workspace{
 const nurses:Staff[]=[];
 for(const f of floors){
  for(let i=0;i<targets[f].early;i++){
   const short=i===targets[f].early-1;
   nurses.push({id:f+"-early-"+i,name:short?(f==="JP2"?"Annie":"Tiffany"):f+" Early "+(i+1),role:i%3===1?"LPN":"RN",floor:f,cohort:"early",start:"06:00",end:short?(f==="JP2"?"10:00":"12:15"):"14:00",weekdaysOnly:short,shortEnd:short?(f==="JP2"?"10:00":"12:15"):null,leadership:"",confirmed:false});
  }
  const starts=f==="JP2"?["10:00","10:00","12:00","11:00","10:00"]:["10:00","10:00","11:00","11:00","15:00","13:00"];
  starts.forEach((start,i)=>nurses.push({id:f+"-late-"+i,name:f+" Late "+(i+1),role:"RN",floor:f,cohort:"late",start,end:shiftEnd(start),weekdaysOnly:false,shortEnd:null,leadership:i===starts.length-1?(f==="JP2"?"poc":"charge"):"",confirmed:false}));
  nurses.push({id:f+"-morning-charge",name:f+" Morning charge",role:"RN",floor:f,cohort:"morning-charge",start:"06:00",end:"14:00",leadership:"",weekdaysOnly:false,shortEnd:null,confirmed:false});
 }
 return {schemaVersion:2,toolsVersion:1,nurses,teams:templateTeams(),days:[],legacy:null,demo:true,rules:[],audit:[]};
}
export function migrateWorkspace(raw:unknown):Workspace{
 if(raw&&typeof raw==="object"&&"schemaVersion" in raw&&raw.schemaVersion===2)return workspaceSchema.parse(raw);
 const legacy=legacySchema.parse(raw);
 // Old per-bay assignments cannot safely be inferred as team membership.
 return {...seedWorkspace(),legacy};
}
