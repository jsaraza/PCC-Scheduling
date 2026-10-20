export type Role = "RN" | "LPN";
export type Nurse = {id:string; name:string; role:Role; start:string; end:string; active:boolean; areas:string[]};
export type Bay = {id:string; label:string; area:string; service:string; or:string; start:string; end:string; demand:number; roles:Role[]; active:boolean};
export type Assignment = {id:string; nurseId:string; bayId:string; start:string; end:string; locked:boolean; note:string; breakNote:string};
export type Schedule = {date:string; status:"draft"|"approved"; fairness:boolean; assignments:Assignment[]; roster:Nurse[]; bays:Bay[]; notes:string; approvedAt:string|null; approvedBy:string|null; rulesReviewed:boolean};
export type Data = {nurses:Nurse[]; bays:Bay[]; schedules:Schedule[]; rulesConfirmed:boolean; demo:boolean};
export type Issue = {kind:"error"|"warning"; text:string};
export const uid=()=>crypto.randomUUID();
export const minutes=(t:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t)?Number(t.slice(0,2))*60+Number(t.slice(3)):NaN;
export const clock=(n:number)=>String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
export const overlaps=(a:{start:string;end:string},b:{start:string;end:string})=>minutes(a.start)<minutes(b.end)&&minutes(b.start)<minutes(a.end);
export function localDate(offset=0){const d=new Date(); d.setDate(d.getDate()+offset); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");}
export function newSchedule(data:Data,date:string):Schedule{return {date,status:"draft",fairness:true,assignments:[],roster:structuredClone(data.nurses.filter(n=>n.active)),bays:structuredClone(data.bays.filter(b=>b.active)),notes:"",approvedAt:null,approvedBy:null,rulesReviewed:data.rulesConfirmed};}
export function historyStats(nurseId:string,history:Schedule[],before:string){
 const prior=history.filter(s=>s.status==="approved"&&s.date<before).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30);
 let demanding=0,total=0; const bays:Record<string,number>={},areas:Record<string,number>={};
 for(const s of prior)for(const a of s.assignments.filter(a=>a.nurseId===nurseId)){
  const b=s.bays.find(b=>b.id===a.bayId);if(!b)continue;
  const h=(minutes(a.end)-minutes(a.start))/60;total+=h;demanding+=h*Math.max(0,b.demand-1); bays[b.id]=(bays[b.id]||0)+h;areas[b.area]=(areas[b.area]||0)+h;
 }
 return {demanding,total,bays,areas};
}
export function checkSchedule(s:Schedule):Issue[]{
 const issues:Issue[]=[];
 if(!s.rulesReviewed)issues.push({kind:"warning",text:"Staffing rules are unconfirmed. Review required coverage, RN/LPN eligibility, breaks and the meaning of the source sheets ranges with the coordinator."});
 if(!s.bays.length)issues.push({kind:"error",text:"Add at least one active bay or area."});
 if(!s.roster.length)issues.push({kind:"error",text:"Add at least one nurse to the daily roster."});
 for(const n of s.roster)if(!Number.isFinite(minutes(n.start))||!Number.isFinite(minutes(n.end))||minutes(n.start)>=minutes(n.end))issues.push({kind:"error",text:n.name+": working hours must be a same-day start before end."});
 for(const b of s.bays)if(!Number.isFinite(minutes(b.start))||!Number.isFinite(minutes(b.end))||minutes(b.start)>=minutes(b.end))issues.push({kind:"error",text:b.label+": coverage hours must be a same-day start before end."});
 for(const a of s.assignments){
  const n=s.roster.find(n=>n.id===a.nurseId),b=s.bays.find(b=>b.id===a.bayId);
  if(!n||!b){issues.push({kind:"error",text:"An assignment refers to a removed nurse or bay."});continue;}
  if(!Number.isFinite(minutes(a.start))||!Number.isFinite(minutes(a.end))||minutes(a.start)>=minutes(a.end)){issues.push({kind:"error",text:n.name+": assignment time is invalid."});continue;}
  if(minutes(a.start)<minutes(n.start)||minutes(a.end)>minutes(n.end))issues.push({kind:"error",text:n.name+": assignment is outside working hours."});
  if(minutes(a.start)<minutes(b.start)||minutes(a.end)>minutes(b.end))issues.push({kind:"error",text:b.label+": assignment is outside coverage hours."});
  if(!b.roles.includes(n.role)||n.areas.length&&!n.areas.includes(b.area))issues.push({kind:"error",text:n.name+" is not eligible for "+b.label+" under the configured rules."});
 }
 for(let i=0;i<s.assignments.length;i++)for(let j=i+1;j<s.assignments.length;j++){
  const a=s.assignments[i],b=s.assignments[j];if(!overlaps(a,b))continue;
  if(a.nurseId===b.nurseId)issues.push({kind:"error",text:(s.roster.find(n=>n.id===a.nurseId)?.name||"Nurse")+" has overlapping assignments."});
  if(a.bayId===b.bayId)issues.push({kind:"error",text:(s.bays.find(n=>n.id===a.bayId)?.label||"Bay")+" has overlapping assignments."});
 }
 for(const b of s.bays){
  let t=minutes(b.start);
  const aa=s.assignments.filter(a=>a.bayId===b.id).sort((a,c)=>minutes(a.start)-minutes(c.start));
  for(const a of aa){if(minutes(a.start)>t)issues.push({kind:"error",text:b.label+": uncovered "+clock(t)+""+a.start+"."});t=Math.max(t,minutes(a.end));}
  if(t<minutes(b.end))issues.push({kind:"error",text:b.label+": uncovered "+clock(t)+""+b.end+"."});
 }
 const idle=s.roster.filter(n=>!s.assignments.some(a=>a.nurseId===n.id));
 if(idle.length)issues.push({kind:"warning",text:idle.length+" nurse"+(idle.length>1?"s":"")+" without an assignment: "+idle.map(n=>n.name).join(", ")+". Confirm float or relief duties."});
 return issues;
}
// Deterministic greedy draft. It reports gaps; it never relaxes eligibility or working hours.
export function generate(s:Schedule,history:Schedule[]):Schedule{
 const next=structuredClone(s);next.status="draft";next.approvedAt=null;next.approvedBy=null;
 next.assignments=next.assignments.filter(a=>a.locked);
 const stats=new Map(s.roster.map(n=>[n.id,historyStats(n.id,history,s.date)]));
 const ordered=[...s.bays].sort((a,b)=>a.roles.length-b.roles.length||b.demand-a.demand||a.id.localeCompare(b.id));
 for(const b of ordered){
  let t=minutes(b.start);const end=minutes(b.end);if(!Number.isFinite(t)||!Number.isFinite(end))continue;
  while(t<end){
   const occupied=next.assignments.find(a=>a.bayId===b.id&&minutes(a.start)<=t&&minutes(a.end)>t);
   if(occupied){t=minutes(occupied.end);continue;}
   const nextLock=Math.min(end,...next.assignments.filter(a=>a.bayId===b.id&&minutes(a.start)>t).map(a=>minutes(a.start)));
   const candidates=s.roster.filter(n=>minutes(n.start)<=t&&minutes(n.end)>t&&b.roles.includes(n.role)&&(!n.areas.length||n.areas.includes(b.area))&&!next.assignments.some(a=>a.nurseId===n.id&&minutes(a.start)<=t&&minutes(a.end)>t)).map(n=>{
    const until=Math.min(nextLock,minutes(n.end),...next.assignments.filter(a=>a.nurseId===n.id&&minutes(a.start)>t).map(a=>minutes(a.start)));
    const st=stats.get(n.id)!;
    const today=next.assignments.filter(a=>a.nurseId===n.id).reduce((sum,a)=>sum+(minutes(a.end)-minutes(a.start))/60,0);
    const fairness=s.fairness?(st.bays[b.id]||0)*3+(st.areas[b.area]||0)*0.3+(st.demanding/Math.max(1,st.total))*(b.demand-1)*15:0;
    return {n,until,score:fairness+today*2-(until-t)/600};
   }).sort((a,c)=>a.score-c.score||a.n.id.localeCompare(c.n.id));
   if(candidates.length){const c=candidates[0];next.assignments.push({id:uid(),nurseId:c.n.id,bayId:b.id,start:clock(t),end:clock(c.until),locked:false,note:"",breakNote:""});t=c.until;}
   else {const events=[...s.roster.map(n=>minutes(n.start)),...next.assignments.map(a=>minutes(a.end)),nextLock].filter(v=>v>t);t=Math.min(end,...events);}
  }
 }
 return next;
}
export function parseCSV(text:string):string[][]{
 const rows:string[][]=[];let row:string[]=[],value="",quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];
 if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else if(!quoted&&value.length)throw new Error("Unexpected quote in CSV.");else quoted=!quoted;}
 else if(c===','&&!quoted){row.push(value.trim());value="";}
 else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value.trim());if(row.some(Boolean))rows.push(row);row=[];value="";}
 else value+=c;
 }if(quoted)throw new Error("CSV contains an unclosed quote.");row.push(value.trim());if(row.some(Boolean))rows.push(row);return rows;
}
export function importRoster(text:string,existing:Nurse[]):Nurse[]{
 const [header,...rows]=parseCSV(text.replace(/^\uFEFF/,""));if(!header)throw new Error("The CSV is empty.");
 const cols=header.map(c=>c.toLowerCase());for(const c of ["name","role","start","end"])if(!cols.includes(c))throw new Error("CSV requires name,role,start,end columns.");
 if(rows.length>150)throw new Error("Limit the roster to 150 nurses.");
 const names=new Set<string>();
 return rows.map((r,i)=>{const field=(k:string)=>r[cols.indexOf(k)]||"";const name=field("name"),role=field("role").toUpperCase(),start=field("start"),end=field("end");
 if(!name||name.length>100||!["RN","LPN"].includes(role)||!Number.isFinite(minutes(start))||!Number.isFinite(minutes(end))||minutes(start)>=minutes(end))throw new Error("Row "+(i+2)+": use a name, RN/LPN and same-day HH:MM working hours.");
 if(names.has(name.toLowerCase()))throw new Error("Duplicate nurse name on row "+(i+2)+". Use distinct names."); names.add(name.toLowerCase());
 return {id:existing.find(n=>n.name.toLowerCase()===name.toLowerCase())?.id||uid(),name,role:role as Role,start,end,active:true,areas:field("areas").split("|").map(s=>s.trim()).filter(Boolean)};
 });
}
export function seedData():Data{
 const names=["Alex Morgan","Jamie Chen","Sam Rivera","Taylor Brooks","Jordan Patel","Casey Wilson","Robin Lee","Avery Singh","Morgan Ellis","Riley Park","Drew Martin","Quinn Davis","Cameron Wells","Skyler Tran","Reese Campbell","Parker Young"];
 const nurses:Nurse[]=names.map((name,i)=>({id:"demo-n"+i,name,role:i%5===4?"LPN":"RN",start:i<12?"06:00":"10:00",end:i<12?"14:00":"18:00",active:true,areas:[]}));
 const bays:Bay[]=Array.from({length:12},(_,i)=>({id:"demo-b"+i,label:"Bay "+(i<6?i+1:i+19),area:i<6?"JP 2  Second floor":"JP 3  Third floor",service:["General","Orthopedics","Urology","ENT","Gynecology","General"][i%6],or:String(i<6?i+1:i+19),start:"06:00",end:"14:00",demand:i%3===0?2:1,roles:["RN","LPN"],active:true}));
 return {nurses,bays,schedules:[],rulesConfirmed:false,demo:true};
}
