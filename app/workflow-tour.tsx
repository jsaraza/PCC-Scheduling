"use client";

import {useEffect,useLayoutEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {ArrowLeft,ArrowRight,Check,Compass,X} from "lucide-react";

export type TourTab="teams"|"roster"|"cubicles"|"flow"|"history"|"rules"|"fairness";
type Step={tab:TourTab;target:string;section:string;title:string;body:string};
const photoSteps:Step[]=[
 {tab:"roster",target:"photo-entry",section:"Photo import",title:"Have a photo instead?",body:"In Import Excel / CSV, open Import from a phone photo / scan. First take the picture with the phone’s camera and transfer it to this laptop using an approved method. The phone does not connect directly to this app. We’ll show fictional examples next."},
 {tab:"roster",target:"photo-choose",section:"Photo import",title:"Choose the roster photo",body:"Choose roster photo opens a file picker on the laptop. Select a clear JPG, PNG or WebP under 15 MB. Reading happens offline. Printed text works best; handwriting may need substantial correction."},
 {tab:"roster",target:"photo-text",section:"Photo import",title:"Check what was read",body:"Compare Review extracted text with the original photo. Correct names and times, remove headings, and put one nurse on each line. Nothing has been added to your roster yet."},
 {tab:"roster",target:"photo-build",section:"Photo import",title:"Build the review rows",body:"Choose Build review rows to organize the text into nurse details. Missing information stays blank, unless a name matches saved staff and their defaults are suggested. Check those defaults against today’s roster."},
 {tab:"roster",target:"photo-row",section:"Photo import",title:"Check every nurse",body:"Correct each name, RN/LPN designation, floor, start group and 24-hour shift. Use Add missed nurse for anyone omitted, or Remove this row for unwanted text. Count the nurses against the original sheet."},
 {tab:"roster",target:"photo-preview",section:"Photo import",title:"Preview the corrected roster",body:"Choose Preview these nurses after checking the rows. Any missing or invalid information must be corrected before importing. The next preview shows exactly which nurses will be included."},
 {tab:"roster",target:"photo-confirm",section:"Photo import",title:"Confirm before replacing the roster",body:"Review the preview, tick the confirmation box, then choose Import roster. This replaces the selected day’s roster; assignments and events for omitted nurses are removed. Back up first if needed. These fictional tour examples are never imported."},
];
export function workflowSteps(local:boolean,approved:boolean):Step[]{return [
 {tab:"teams",target:"tour",section:"Welcome",title:"Your day, one step at a time",body:"We’ll point out the controls you use to plan a day. Press Next to follow along. This tour won’t edit your schedule; you can exit and repeat it anytime."},
 {tab:"teams",target:"date",section:"Set up",title:"1. Choose the day",body:"Use this date box to choose the day you’re planning. Check the date before making changes. The arrows move one day back or forward."},
 {tab:"roster",target:"add-nurse",section:"Set up",title:"2. Check who is working",body:"In Nurse roster, use Add nurse for someone new. Enter their name, RN or LPN designation, floor and shift. Use Edit beside an existing nurse to correct their details."},
 {tab:"roster",target:"import",section:"Set up",title:"Have a spreadsheet?",body:"Import Excel / CSV lets you choose a spreadsheet, select its worksheet and preview the nurses. Download the Excel template for the right columns. Check the names, designations and hours before confirming."},
 ...(local?photoSteps:[]),
 {tab:"cubicles",target:"layout",section:"Set up",title:"3. Check the cubicle layout",body:"Use Edit layout to check a team’s four cubicles, services, OR numbers and demand level. Each early nurse primarily covers two cubicles; the late nurse shares all four."},
 {tab:"rules",target:"add-rule",section:"Set up",title:"4. Add preferences and limits",body:"Use Add rule for a nurse’s preferred or avoided team, or a weekly limit. Required rules must pass before approval. Preferred rules guide the plan but can show a warning instead."},
 {tab:"teams",target:"rotation",section:"Assign",title:"5. Choose whether to rotate duties",body:"Leave Use assignment history on to discourage repeated teams and demanding duties using earlier approved days. Turn it off for a fresh plan. Required preferences and weekly limits still apply."},
 {tab:"teams",target:"generate",section:"Assign",title:"6. Create a draft",body:approved?"This day is already approved, so you see Reopen here. Outside the tour, reopen it if changes are needed. On a draft day, Generate teams proposes assignments for you to review.":"Generate teams proposes assignments using the roster and recorded rules. It creates a draft, not an approval. If staffing or rules prevent a complete plan, review the listed checks."},
 {tab:"teams",target:"assignment",section:"Assign",title:"7. Adjust a team if needed",body:"Each team has nurse dropdowns for Early 1, Early 2 and Late. Choose a different nurse to adjust a draft. The lock keeps that team in place when you generate again. Approved days must be reopened first."},
 {tab:"teams",target:"break",section:"Review",title:"8. Record breaks and cover",body:"Record break lets you enter a nurse’s break time and, when needed, a relief nurse. Breaks are entered manually. The app checks the coverage and RN/LPN balance you’ve recorded."},
 {tab:"teams",target:"time",section:"Review",title:"9. Look at staffing through the day",body:"Choose a time here to see each floor’s available RNs and LPNs. Recorded shifts, breaks and moves affect these counts. Each open floor needs more available RNs than LPNs; morning charge nurses are excluded."},
 {tab:"teams",target:"checks",section:"Review",title:"10. Resolve the required checks",body:"This list explains what needs attention. Required checks block approval; review warnings need your judgment. Find team fixes, just above, can suggest changes for you to review and apply."},
 {tab:"teams",target:"confirm-roster",section:"Review",title:"11. Confirm the roster",body:"After checking every nurse’s designation, floor and working hours, choose Confirm roster & designations. Sample names and designations must be replaced or verified before actual use."},
 {tab:"teams",target:"review-rules",section:"Review",title:"12. Confirm the operating rules",body:"Review team rules asks you to check cubicles, demand weights, preferences and break arrangements. Read and confirm each item only after it matches the day you’re planning."},
 {tab:"teams",target:"approve",section:"Finish",title:"13. Approve the plan",body:"Review & approve becomes available when required checks pass and rules are reviewed. Review any warnings and enter the approving coordinator’s name. Later changes return the plan to draft for review."},
 {tab:"teams",target:"save",section:"Finish",title:"14. Make sure it is saved",body:local?"Edits save automatically on this computer. Wait for Saved locally before closing. After recovery or restoring a backup, review the plan and click Save workspace to keep it.":"Click Save workspace after your changes and approval. Wait for Saved workspace before closing. If saving fails, download a backup. Other devices must reload to see the latest save."},
 {tab:"teams",target:"print",section:"Finish",title:"15. Print or save a PDF",body:"Print / PDF opens your browser’s print window. For a spreadsheet, use Export Excel beside it. Check the date and draft or approved status before sharing. Excel is a snapshot; keep a JSON backup for full recovery."},
 {tab:"flow",target:"daily-change",section:"During the day",title:"16. Handle a change",body:"For a sick call, replacement, changed hours or leadership handover, choose an action in Handle a change today. Preview change shows the effect first. Apply only after reviewing it, then check and approve the updated plan."},
 {tab:"flow",target:"transfer",section:"During the day",title:"17. Move a nurse when ready",body:"Move nurse to JP3 records an actual transfer from 14:00 onward. The move must preserve RN/LPN balance on both floors. JP2’s point of contact stays until closure, unless a valid RN handover is recorded."},
 {tab:"flow",target:"closure",section:"During the day",title:"18. Record JP2’s closure",body:"Record JP2 closure only when its remaining patients have transferred and the point of contact can leave. There is no automatic closure time. The remaining on-duty staff then join JP3 shared coverage."},
 {tab:"fairness",target:"fairness",section:"Keep track",title:"19. Review the week",body:"Fairness overview compares team assignments and demanding duties over a date range. Earlier approved days inform rotation; approved days in the same week inform weekly caps. Missing schedules cannot be counted."},
 {tab:"history",target:"backup",section:"Keep track",title:"20. Keep a backup",body:local?"Use Backup to download your workspace and keep a copy in an approved location separate from this computer. Automatic backups are also listed here. Restore backup loads a copy for review before you save it.":"Use Backup to download your workspace, including staff and saved schedules. Keep it in a private, approved location. Restore backup loads schedules as drafts for review before you save them."},
 {tab:"teams",target:"tour",section:"You’re ready",title:"You can take it from here",body:"Choose a day, check the roster, draft teams, review, approve and save. You stay in control of every plan. Press Finish to return to where you started. Take a tour is always here when you need it."},
 ];}

type Box={left:number;top:number;width:number;height:number};
export default function WorkflowTour({steps,index,onStep,onClose}:{steps:Step[];index:number;onStep:(index:number)=>void;onClose:()=>void}){
 const step=steps[index],panel=useRef<HTMLDivElement>(null),heading=useRef<HTMLHeadingElement>(null);
 const [box,setBox]=useState<Box|null>(null),[position,setPosition]=useState({left:16,top:16,width:380}),[ready,setReady]=useState(false),[moving,setMoving]=useState(true);
 const controls=useRef({onStep,onClose,index,moving});controls.current={onStep,onClose,index,moving};
 useEffect(()=>{
  const handleKey=(e:KeyboardEvent)=>{
   const c=controls.current;
   if(e.key==="Escape"){e.preventDefault();c.onClose();}
   if(e.key==="ArrowRight"&&!c.moving&&c.index<steps.length-1){e.preventDefault();c.onStep(c.index+1);}
   if(e.key==="ArrowLeft"&&!c.moving&&c.index>0){e.preventDefault();c.onStep(c.index-1);}
   if(e.key==="Tab"){
    const buttons=[...(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')||[])];
    const first=buttons[0],last=buttons.at(-1);
    if(e.shiftKey&&(document.activeElement===first||!buttons.includes(document.activeElement as HTMLButtonElement))){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&(document.activeElement===last||!buttons.includes(document.activeElement as HTMLButtonElement))){e.preventDefault();first?.focus();}
   }
  };
  document.addEventListener("keydown",handleKey,true);
  return()=>document.removeEventListener("keydown",handleKey,true);
 },[steps.length]);
 useLayoutEffect(()=>{
  let frame=0,scrollFrame=0,settleTimer=0,disposed=false;setReady(false);setMoving(true);setBox(null);
  const viewport=()=>({width:document.documentElement.clientWidth,height:window.innerHeight});
  const target=()=>[...document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`)].find(e=>e.getBoundingClientRect().height>0);
  const measure=()=>{
   if(disposed)return;
   const {width,height}=viewport(),cardWidth=Math.min(380,width-24),cardHeight=Math.min(panel.current?.offsetHeight||330,height-24);
   const rect=target()?.getBoundingClientRect();let next:Box|null=null;
   if(rect&&rect.bottom>0&&rect.top<height){const left=Math.max(8,rect.left-6),top=Math.max(8,rect.top-6);next={left,top,width:Math.max(0,Math.min(width-8,rect.right+6)-left),height:Math.max(0,Math.min(height-8,rect.bottom+6)-top)};}
   const gap=14,clamp=(v:number,max:number)=>Math.max(12,Math.min(v,max));
   let left=(width-cardWidth)/2,top=(height-cardHeight)/2;
   if(next){
    left=clamp(next.left+(next.width-cardWidth)/2,width-cardWidth-12);
    if(next.top+next.height+gap+cardHeight<=height-12)top=next.top+next.height+gap;
    else if(next.top-gap-cardHeight>=12)top=next.top-gap-cardHeight;
    else if(next.left+next.width+gap+cardWidth<=width-12){left=next.left+next.width+gap;top=clamp(next.top,height-cardHeight-12);}
    else if(next.left-gap-cardWidth>=12){left=next.left-gap-cardWidth;top=clamp(next.top,height-cardHeight-12);}
    else top=height-cardHeight-12;
   }
   setBox(next);setPosition({left,top:clamp(top,height-cardHeight-12),width:cardWidth});setReady(true);
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
  const alignTarget=(behavior:ScrollBehavior)=>{
   const el=target();if(!el)return;
   const rect=el.getBoundingClientRect(),cardHeight=panel.current?.offsetHeight||350;
   const top=window.innerWidth<=760?24:Math.max(90,(window.innerHeight-cardHeight-rect.height-28)/2);
   window.scrollTo({top:Math.max(0,window.scrollY+rect.top-top),behavior});
  };
  // Stop an earlier step's animation before measuring the newly mounted panel.
  window.scrollTo({top:window.scrollY,behavior:"instant"});
  scrollFrame=requestAnimationFrame(()=>{scrollFrame=requestAnimationFrame(()=>{
   alignTarget(matchMedia('(prefers-reduced-motion: reduce)').matches?"instant":"smooth");
   heading.current?.focus({preventScroll:true});schedule();
   // Layout and browser scroll anchoring can shift a target after a tab change.
   settleTimer=window.setTimeout(()=>{const rect=target()?.getBoundingClientRect();if(rect&&(rect.top<8||rect.bottom>window.innerHeight-12))alignTarget("instant");schedule();setMoving(false);},650);
  });});
  const observer=new ResizeObserver(schedule);if(panel.current)observer.observe(panel.current);const el=target();if(el)observer.observe(el);
  window.addEventListener("resize",schedule);window.addEventListener("scroll",schedule,true);window.visualViewport?.addEventListener("resize",schedule);
  return()=>{disposed=true;cancelAnimationFrame(frame);cancelAnimationFrame(scrollFrame);clearTimeout(settleTimer);observer.disconnect();window.removeEventListener("resize",schedule);window.removeEventListener("scroll",schedule,true);window.visualViewport?.removeEventListener("resize",schedule);};
 },[index,step.target]);
 return createPortal(<div className="workflow-tour no-print">
  <svg className="tour-shade" width="100%" height="100%" aria-hidden="true"><defs><mask id="pcc-tour-mask"><rect width="100%" height="100%" fill="white"/>{ready&&box&&<rect {...{x:box.left,y:box.top,width:box.width,height:box.height}} rx="12" fill="black"/>}</mask></defs><rect width="100%" height="100%" fill="rgba(15,35,29,.64)" mask="url(#pcc-tour-mask)"/></svg>
  {ready&&box&&<div className="tour-spotlight" style={box} aria-hidden="true"/>}
  <div ref={panel} className={"tour-card "+(ready?"is-ready":"")} style={position} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-description">
   <div className="tour-topline"><span><Compass size={16}/> WORKFLOW TOUR</span><button onClick={onClose} className="tour-close" aria-label="Exit tutorial"><X size={19}/></button></div>
   <div className="tour-progress" role="progressbar" aria-label="Tutorial progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index+1}><span style={{width:`${(index+1)/steps.length*100}%`}}/></div>
   <div className="tour-meta"><span>{step.section}</span><span>Step {index+1} of {steps.length}</span></div>
   <div key={index} className="tour-copy"><h2 id="tour-title" tabIndex={-1} ref={heading}>{step.title}</h2><p id="tour-description">{step.body}</p></div>
   <div className="tour-actions"><button className="tour-back" disabled={index===0||moving} onClick={()=>onStep(index-1)}><ArrowLeft size={16}/>Back</button><button className="tour-next" disabled={moving} onClick={()=>index===steps.length-1?onClose():onStep(index+1)}>{index===steps.length-1?<>Finish<Check size={17}/></>:<>Next<ArrowRight size={17}/></>}</button></div>
   <div className="tour-footnote">{moving?"Finding your next control…":"Just a walkthrough · your assignments stay unchanged"}</div>
  </div>
 </div>,document.body);
}
