"use client";
import {useState} from "react";
import {Plus,Trash2,ArrowRight,ShieldCheck,RotateCcw,Users,AlertCircle} from "lucide-react";
import {uid,validateDay,minute,leaderAt} from "../lib/teams";
import type {Workspace,Day,Rule} from "../lib/teams";
import {asDraft,removeFromDay,repairTeams,fairnessRows,suggestRepairs,transferAlternatives,weekRange} from "../lib/planning-tools";
type Props={w:Workspace;d:Day;apply:(day:Day,summary?:string)=>void};
export function RulesPanel({w,d,update}:{w:Workspace;d:Day;update:(rules:Rule[])=>void}){
 const [editing,setEditing]=useState<Rule|null>(null),[adding,setAdding]=useState(false),[error,setError]=useState(""),[kind,setKind]=useState<Rule["kind"]>("prefer");
 function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setError("");const f=new FormData(e.currentTarget),get=(k:string)=>String(f.get(k)||"");
  const rule:Rule={id:editing?.id||uid(),nurseId:get("nurse"),kind:get("kind") as Rule["kind"],teamId:kind==="demand-limit"?null:get("team"),strength:get("strength") as Rule["strength"],max:Number(get("max")||0)};
  const nurse=w.nurses.find(n=>n.id===rule.nurseId),team=d.teams.find(t=>t.id===rule.teamId);
  if(!nurse||kind!=="demand-limit"&&!team){setError("Choose a nurse and the relevant team.");return;}
  if(kind==="prefer"&&rule.strength==="required"&&(nurse.floor!==team?.floor||nurse.leadership||nurse.cohort==="morning-charge")){setError("A required team assignment must match the nurse's floor and a non-leadership team role.");return;}
  if(d.rules.some(r=>r.id!==rule.id&&r.nurseId===rule.nurseId&&r.kind===rule.kind&&r.teamId===rule.teamId)){setError("This rule already exists. Edit it instead.");return;}
  update([...d.rules.filter(r=>r.id!==rule.id),rule]);setAdding(false);setEditing(null);
 }
 return <section className="management-card"><div className="card-header"><div><h2>Nurse preferences & weekly limits</h2><p>Applies to this day and new days. Saved earlier days keep their own rules.</p></div><button className="primary" disabled={d.status==="approved"} onClick={()=>{setEditing(null);setKind("prefer");setAdding(true);setError("");}}><Plus size={15}/>Add rule</button></div>
 <div className="tool-note"><ShieldCheck size={17}/><p><strong>Required</strong> rules block approval. <strong>Preferred</strong> rules guide generation and show a warning when unmet. Weekly caps use Monday–Sunday and include all other approved days in that week, including future ones. Turning rotation off does not disable these rules.</p></div>
 {d.rules.length===0&&<div className="empty-state"><Users size={25}/><h3>No preferences entered yet</h3><p>Add the coordinator's actual rules. No restrictions have been invented for individual nurses.</p></div>}
 {d.rules.map(r=>{const n=w.nurses.find(n=>n.id===r.nurseId),t=d.teams.find(t=>t.id===r.teamId),label=t?t.floor+" team "+t.label:"removed team";return <div className="rule-row" key={r.id}><div><strong>{n?.name||"Nurse no longer in directory"}</strong><p>{r.kind==="prefer"?"Assign to "+label:r.kind==="avoid"?"Avoid "+label:r.kind==="team-limit"?"At most "+r.max+" assignments to "+label+" per week":"At most "+r.max+" demanding-team assignments per week"}</p></div><span className={"pill "+(r.strength==="required"?"amber":"green")}>{r.strength}</span><button className="text-button" disabled={d.status==="approved"} onClick={()=>{setEditing(r);setKind(r.kind);setAdding(true);setError("");}}>Edit</button><button className="icon-button" disabled={d.status==="approved"} aria-label={"Remove rule for "+n?.name} onClick={()=>update(d.rules.filter(x=>x.id!==r.id))}><Trash2 size={15}/></button></div>;})}
 {adding&&<form className="tool-form" onSubmit={submit} key={editing?.id||"new"}><h3>{editing?"Edit rule":"New rule"}</h3><div className="form-grid">
 <label>Nurse<select aria-label="Rule nurse" name="nurse" required defaultValue={editing?.nurseId||""}><option value="">Select nurse</option>{w.nurses.filter(n=>n.cohort!=="morning-charge").map(n=><option key={n.id} value={n.id}>{n.name} · {n.floor}</option>)}</select></label>
 <label>Rule type<select aria-label="Rule type" name="kind" value={kind} onChange={e=>setKind(e.target.value as Rule["kind"])}><option value="prefer">Assign to a team</option><option value="avoid">Avoid a team</option><option value="team-limit">Weekly team limit</option><option value="demand-limit">Weekly demanding-duty limit</option></select></label>
 {kind!=="demand-limit"&&<label>Team<select aria-label="Rule team" name="team" required defaultValue={editing?.teamId||""}><option value="">Select team</option>{d.teams.map(t=><option key={t.id} value={t.id}>{t.floor} team {t.label}</option>)}</select></label>}
 {(kind==="team-limit"||kind==="demand-limit")&&<label>Maximum assignments per week<input aria-label="Weekly maximum" name="max" type="number" min={0} max={7} required defaultValue={editing?.max??2}/></label>}
 <label>Importance<select aria-label="Rule importance" name="strength" defaultValue={editing?.strength||"preferred"}><option value="preferred">Preferred — can be relaxed with review</option><option value="required">Required — must be met</option></select></label></div>
 <p className="form-help">One assigned day counts once. “Demanding” means a team with demand level 2 or 3. Rules for nurses absent that day do not force them onto the roster.</p>
 {error&&<p role="alert" className="form-error">{error}</p>}<div className="button-row"><button type="button" className="secondary" onClick={()=>setAdding(false)}>Cancel</button><button className="primary">Save rule</button></div></form>}
 </section>;
}
export function FairnessPanel({w,d}:{w:Workspace;d:Day}){
 const range=weekRange(d.date),[start,setStart]=useState(range.start),[end,setEnd]=useState(range.end),[drafts,setDrafts]=useState(false);
 const rows=fairnessRows(w,d,start,end,drafts),valid=start<=end;
 return <section className="management-card"><div className="card-header"><div><h2>Fairness at a glance</h2><p>Compare repeated teams and demanding duties. These totals describe assignments, not patient workload.</p></div></div><div className="report-controls"><label>From<input type="date" aria-label="Fairness from" value={start} onInput={e=>setStart(e.currentTarget.value)}/></label><label>Through<input type="date" aria-label="Fairness through" value={end} onInput={e=>setEnd(e.currentTarget.value)}/></label><button className="secondary" onClick={()=>{setStart(range.start);setEnd(range.end);}}>Selected week's Monday–Sunday</button><label className="checkbox-label"><input type="checkbox" checked={drafts} onChange={e=>setDrafts(e.target.checked)}/>Include drafts (preview)</label></div>
 <div className="tool-note"><p>{drafts?"Drafts and approvals are included for comparison.":"Only approved schedules are included; this draft will not appear until approved."} Repeat count is the number of assignments beyond the first to each team in this period. Demand points: level 2 adds one; level 3 adds two. Weekly rule checks always use Monday–Sunday, regardless of this report's dates.</p></div>
 {!valid?<p className="alert">Choose an end date on or after the start date.</p>:<div className="table-scroll"><table className="fairness-table"><thead><tr><th>Nurse</th><th>Roster days</th><th>Teams assigned</th><th>Repeats</th><th>Demanding days</th><th>Demand points</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><strong>{r.name}</strong></td><td>{r.daysWorked}</td><td>{Object.entries(r.byTeam).map(([team,count])=><span className={"pill "+(count>1?"amber":"")} key={team}>{team} × {count}</span>)}{!Object.keys(r.byTeam).length&&<span className="muted">No team duties</span>}</td><td>{r.repeats}</td><td>{r.demanding}</td><td>{r.points}</td></tr>)}</tbody></table></div>}
 </section>;
}
export function OperationsPanel({w,d,apply}:Props){
 const [mode,setMode]=useState("sick"),[id,setId]=useState(""),[replacement,setReplacement]=useState(""),[start,setStart]=useState(""),[end,setEnd]=useState(""),[at,setAt]=useState("13:30"),[floor,setFloor]=useState<"JP2"|"JP3">("JP2"),[reason,setReason]=useState(""),[error,setError]=useState(""),[proposal,setProposal]=useState<{day:Day;summary:string;source:string}|null>(null);
 const fingerprint=JSON.stringify(d);
 function preview(){
  setError("");setProposal(null);
  try{
   const n=d.roster.find(n=>n.id===id);let next:Day,summary="";
   if(mode==="repair"){const r=repairTeams(d,w.days);next=r.day;summary="Repair affected teams; preserved "+r.preserved+" complete or locked teams";}
   else if(mode==="handover"){
    const incoming=d.roster.find(n=>n.id===replacement);if(!incoming)throw new Error("Select the incoming leader.");
    next=asDraft({...d,handovers:[...d.handovers,{id:uid(),floor,nurseId:incoming.id,at}]});
    const faults=validateDay(next,w.days).filter(i=>i.code==="handover");if(faults.length)throw new Error(faults.map(i=>i.text).join("\n"));
    summary=floor+" leadership handed to "+incoming.name+" at "+at;
   }else{
    if(!n)throw new Error("Select the affected nurse.");
    if(mode==="hours"){
     if(!Number.isFinite(minute(start))||!Number.isFinite(minute(end))||minute(end)<=minute(start))throw new Error("Enter valid same-day working hours.");
     next=asDraft({...d,roster:d.roster.map(x=>x.id===id?{...x,start,end,shiftOverride:true}:x)});
     summary=n.name+": shift changed "+n.start+"–"+n.end+" → "+start+"–"+end+" for this day only";
    }else{
     const substitute=mode==="replace"?(d.roster.find(n=>n.id===replacement)||w.nurses.find(n=>n.id===replacement)):undefined;
     if(mode==="replace"&&!substitute)throw new Error("Select a replacement from the staff directory.");
     next=removeFromDay(d,id,substitute);
     summary=mode==="replace"?n.name+" replaced by "+substitute!.name:n.name+" unavailable today";
    }
   }
   setProposal({day:next,summary:summary+(reason.trim()?"; "+reason.trim():""),source:fingerprint});
  }catch(e){setError(e instanceof Error?e.message:"Check the inputs.");}
 }
 const candidateIssues=proposal?validateDay(proposal.day,w.days):[];
 return <section className="management-card daily-operations"><div className="card-header"><div><h2>Handle a change today</h2><p>Preserve other teams. Changes return the day to draft and leave future staff defaults unchanged.</p></div></div><div className="tool-form">
 <div className="form-grid"><label>Action<select aria-label="Daily change action" value={mode} onChange={e=>{setMode(e.target.value);setProposal(null);setError("");}}><option value="sick">Sick call / unavailable today</option><option value="replace">Replace a nurse</option><option value="hours">Change today's hours</option><option value="handover">Leadership handover</option><option value="repair">Repair affected teams only</option></select></label>
 {["sick","replace","hours"].includes(mode)&&<label>Affected nurse<select aria-label="Affected nurse" value={id} onChange={e=>{setId(e.target.value);const n=d.roster.find(n=>n.id===e.target.value);setStart(n?.start||"");setEnd(n?.end||"");setProposal(null);}}><option value="">Select nurse</option>{d.roster.map(n=><option value={n.id} key={n.id}>{n.name}</option>)}</select></label>}
 {mode==="replace"&&<label>Replacement from directory<select aria-label="Replacement nurse" value={replacement} onChange={e=>{setReplacement(e.target.value);setProposal(null);}}><option value="">Select replacement</option>{w.nurses.filter(n=>n.id!==id).map(n=><option value={n.id} key={n.id}>{n.name} · {n.floor} · {n.role}</option>)}</select></label>}
 {mode==="hours"&&<><label>New start<input aria-label="New shift start" type="time" value={start} onInput={e=>{setStart(e.currentTarget.value);setProposal(null);}}/></label><label>New finish<input aria-label="New shift finish" type="time" value={end} onInput={e=>{setEnd(e.currentTarget.value);setProposal(null);}}/></label></>}
 {mode==="handover"&&<><label>Floor<select aria-label="Handover floor" value={floor} onChange={e=>{setFloor(e.target.value as "JP2"|"JP3");setProposal(null);}}><option>JP2</option><option>JP3</option></select></label><label>Handover time<input aria-label="Handover time" type="time" min="13:30" value={at} onInput={e=>{setAt(e.currentTarget.value);setProposal(null);}}/></label><label>Incoming RN<select aria-label="Incoming leader" value={replacement} onChange={e=>{setReplacement(e.target.value);setProposal(null);}}><option value="">Select RN</option>{d.roster.filter(n=>n.role==="RN"&&n.cohort==="late").map(n=><option key={n.id} value={n.id}>{n.name} · {n.floor}</option>)}</select></label></>}
 </div><label>Reason or handover note (optional)<input aria-label="Change reason" maxLength={300} value={reason} onInput={e=>{setReason(e.currentTarget.value);setProposal(null);}} placeholder="Scheduling details only; no medical or patient information"/></label>
 <p className="form-help">{mode==="hours"?"A day-only shift exception is recorded explicitly. Coverage, leadership, preferences and RN/LPN checks still apply.":mode==="sick"||mode==="replace"?"Affected break, transfer and handover records are cleared for the outgoing nurse and must be reviewed. Add a new replacement to the directory first if needed.":mode==="repair"?"Complete and locked teams stay fixed. If a fixed team causes a conflict, adjust or unlock it explicitly.":"The incoming late RN must be available on that floor. JP2's outgoing POC may move only after this handover."}</p>
 <button className="secondary" onClick={preview}>Preview change <ArrowRight size={14}/></button>{error&&<p className="alert form-error" role="alert">{error}</p>}
 {proposal&&proposal.source===fingerprint&&<div className="change-preview"><strong>{proposal.summary}</strong><p>{candidateIssues.filter(i=>i.kind==="error").length} required checks remain. Review these before approval.</p><ul>{candidateIssues.filter(i=>i.kind==="error").slice(0,8).map((i,k)=><li key={k}>{i.text}</li>)}</ul><button className="primary" onClick={()=>{apply(proposal.day,proposal.summary);setProposal(null);setReason("");}}>Apply to draft</button></div>}
 </div></section>;
}
export function SuggestionsPanel({w,d,apply}:Props){
 const [show,setShow]=useState(false),[time,setTime]=useState("15:00"),[moves,setMoves]=useState(false);
 const suggestions=show?suggestRepairs(d,w.days):[],alternatives=moves?transferAlternatives(d,time,w.days):[];
 return <section className="management-card suggestion-panel"><div className="card-header"><div><h2>Understand & resolve conflicts</h2><p>Suggestions are checked against the current recorded rules and do not introduce new required conflicts.</p></div></div><div className="tool-form"><p>RN/LPN balance failures depend on who is available at that time. Rearranging teams alone cannot fix a floor-wide shortage. Change staffing, hours, breaks or transfer timing and recheck.</p>
 <div className="button-row"><button className="secondary" disabled={d.status==="approved"} onClick={()=>setShow(true)}>Find team fixes</button><button className="text-button" onClick={()=>{setShow(false);setMoves(false);}}>Clear suggestions</button></div>
 {show&&!suggestions.length&&<p className="tool-note">No checked team fix found. Review roster shortages, locked teams, eligibility and required preferences. This bounded search does not prove that no solution exists.</p>}
 {suggestions.map(s=><div className="suggestion" key={s.id}><strong>{s.title}</strong><p>{s.detail}</p><button className="primary" onClick={()=>{apply(s.day,"Applied checked suggestion: "+s.title);setShow(false);}}>Apply suggestion</button></div>)}
 <hr/><h3>Check transfer options</h3><label>Proposed transfer time<input aria-label="Suggested transfer time" type="time" min="14:00" value={time} onInput={e=>{setTime(e.currentTarget.value);setMoves(false);}}/></label><button className="secondary" disabled={!!d.closureAt} onClick={()=>setMoves(true)}>Find eligible JP2 → JP3 moves</button>
 {moves&&<><p className="form-help">JP2 POC at {time}: {leaderAt(d,"JP2",minute(time))?.name||"Not assigned"}. That nurse stays unless leadership is handed over or JP2 closes. Patient readiness is still the coordinator's decision.</p>{!alternatives.length?<p className="alert">No transfer passed the configured checks at this time. Review the conflict list or choose another time.</p>:alternatives.map(n=><div className="rule-row" key={n.id}><span>{n.name} · {n.role}</span><button className="text-button" onClick={()=>{apply(n.day,n.name+" transferred to JP3 at "+time+" after checks");setMoves(false);}}>Record move <ArrowRight size={14}/></button></div>)}</>}
 </div></section>;
}
export function ChangeLog({w}:{w:Workspace}){
 return <section className="management-card"><div className="card-header"><div><h2>Change history</h2><p>Latest 250 recorded edits, included in saved workspaces and backups. Undo/redo covers the last 20 edits in this browser session.</p></div></div>{!w.audit.length?<div className="empty-state"><RotateCcw size={25}/><p>New edits will appear here.</p></div>:[...w.audit].reverse().map(a=><div className="audit-row" key={a.id}><span className="pill">{a.date}</span><div><strong>{a.summary}</strong><small>{new Date(a.at).toLocaleString()} · {a.actor}</small></div></div>)}</section>;
}
