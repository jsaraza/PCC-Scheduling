"use client";
import {scanTourStaff} from "../lib/scan-tour-example";
import ScanImport from "./scan-import";
import {useRef,useState} from "react";
import type {Staff} from "../lib/teams";
import type {Worksheet} from "exceljs";
export function downloadExcel(name:string,data:unknown){
 const url=URL.createObjectURL(new Blob([data as BlobPart],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
 const link=document.createElement("a");link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function RosterImport({existing,onReady,localMode=false,tutorial=false}:{existing:Staff[];onReady:(ready:boolean)=>void;localMode?:boolean;tutorial?:boolean}){
 const [text,setText]=useState(""),[rows,setRows]=useState<Staff[]>(tutorial?scanTourStaff:[]),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [sheets,setSheets]=useState<{name:string;sheet:Worksheet}[]>([]),[selected,setSelected]=useState("");const input=useRef<HTMLInputElement>(null);
 function reset(){setRows([]);setError("");onReady(false);}
 async function preview(value:string){reset();try{const {validateRosterImport}=await import("../lib/excel");setRows(validateRosterImport(value,existing));onReady(true);}catch(e){setError((e as Error).message);}}
 async function chooseSheet(name:string,list=sheets){setSelected(name);setText("");reset();try{const {worksheetCSV}=await import("../lib/excel");const item=list.find(s=>s.name===name);if(!item)return;const value=worksheetCSV(item.sheet);setText(value);await preview(value);}catch(e){setError((e as Error).message);}}
 async function load(file:File){setBusy(true);setText("");setSheets([]);reset();try{
  if(/\.xlsx$/i.test(file.name)){if(file.size>5*1024*1024)throw Error("Use an Excel file smaller than 5 MB.");const {readRosterWorkbook}=await import("../lib/excel");const list=await readRosterWorkbook(await file.arrayBuffer());if(!list.length)throw Error("No visible worksheets found.");setSheets(list);await chooseSheet(list.find(s=>s.name.toLowerCase()==="roster")?.name||list[0].name,list);}
  else if(/\.csv$/i.test(file.name)){if(file.size>200000)throw Error("Use a CSV smaller than 200 KB.");const value=await file.text();setText(value);await preview(value);}
  else throw Error("Choose .xlsx or .csv. For older .xls files, use Excel’s Save As → Excel Workbook (.xlsx).");
 }catch(e){setError((e as Error).message);}finally{setBusy(false);if(input.current)input.current.value="";}}
 async function template(){setBusy(true);try{const {rosterTemplate}=await import("../lib/excel");downloadExcel("PCC-roster-template.xlsx",await rosterTemplate());}catch{setError("Could not create the template. Please try again.");}finally{setBusy(false);}}
 return <div className="roster-import">
  <p>Import nurses from <strong>Excel (.xlsx) or CSV</strong>. Start with the template, one nurse per row. This imports the roster only; it does not import past assignments.</p>
  <div className="button-row"><button type="button" className="secondary" disabled={busy} onClick={()=>input.current?.click()}>Choose Excel / CSV</button><button type="button" className="text-button" disabled={busy} onClick={template}>Download Excel template</button></div>
  <input ref={input} hidden type="file" accept=".xlsx,.csv" onChange={e=>{if(e.target.files?.[0])void load(e.target.files[0]);}}/>
  {busy&&<p role="status">Reading spreadsheet…</p>}
  {sheets.length>0&&<label>Worksheet<select aria-label="Worksheet" disabled={busy} value={selected} onChange={e=>void chooseSheet(e.target.value)}>{sheets.map(s=><option key={s.name}>{s.name}</option>)}</select></label>}
  <details><summary>Required columns and paste option</summary><p className="form-help">Required: name, role, floor, cohort, start, end. Use RN/LPN, JP2/JP3 and early/late/morning-charge. Optional: leadership (poc/charge), weekdaysOnly (true/false), shortEnd. Blank optional cells clear those settings; omit a column to keep existing settings.</p>
   <label>CSV content<textarea value={text} rows={6} onChange={e=>{setText(e.target.value);reset();}}/></label><button type="button" className="secondary" disabled={busy||!text.trim()} onClick={()=>void preview(text)}>Preview roster</button>
  </details>
  <details className="photo-import" open={tutorial||undefined}><summary data-tour="photo-entry">Import from a phone photo / scan</summary><ScanImport localMode={localMode} tutorial={tutorial} existing={existing} onReset={reset} onUse={value=>{setText(value);setSheets([]);void preview(value);}}/></details>
  <input type="hidden" name="csv" value={rows.length?text:""}/>
  {error&&<p className="alert form-error" role="alert">{error}</p>}
  {rows.length>0&&<div data-tour="photo-confirm"><p role="status"><strong>{rows.length} {rows.length===1?"nurse":"nurses"} ready to review.</strong> Matching names keep their history. Nurses omitted from this file will be removed from this day.</p><div className="table-scroll import-preview"><table><thead><tr><th>Name</th><th>Role / floor</th><th>Shift</th><th>Cohort / leadership</th></tr></thead><tbody>{rows.map(n=><tr key={n.id}><td>{n.name}</td><td>{n.role} · {n.floor}</td><td>{n.start}–{n.end}{n.shortEnd&&<small>Short end: {n.shortEnd}</small>}</td><td>{n.cohort}{n.leadership&&<small>{n.leadership}</small>}{n.weekdaysOnly&&<small>Mon–Fri</small>}</td></tr>)}</tbody></table></div><label className="checkbox-label"><input name="replace" type="checkbox" required/>I checked these designations and hours. Replace this day’s roster and remove assignments/events for omitted nurses.</label>{tutorial&&<button type="button" className="primary">Import roster</button>}</div>}
 </div>;
}
