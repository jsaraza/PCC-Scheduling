"use client";
import {useEffect,useRef,useState} from "react";
import type {Worker} from "tesseract.js";
import type {Staff} from "../lib/teams";
import {scanRows,scanCSV,scanColumns} from "../lib/scan-roster";
import {scanTourText} from "../lib/scan-tour-example";
import type {ScanRow} from "../lib/scan-roster";
export default function ScanImport({existing,onUse,onReset,tutorial=false,localMode=false}:{existing:Staff[];onUse:(csv:string)=>void;onReset:()=>void;tutorial?:boolean;localMode?:boolean}){
 const [text,setText]=useState(tutorial?scanTourText:""),[rows,setRows]=useState<ScanRow[]>(()=>tutorial?scanRows(scanTourText,[]):[]),[photo,setPhoto]=useState(""),[busy,setBusy]=useState(false),[progress,setProgress]=useState(""),[error,setError]=useState("");
 const fileInput=useRef<HTMLInputElement>(null),worker=useRef<Worker|null>(null),job=useRef(0);
 useEffect(()=>()=>{job.current++;void worker.current?.terminate();},[]);
 useEffect(()=>()=>{if(photo)URL.revokeObjectURL(photo);},[photo]);
 function invalidate(){onReset();setError("");}
 function cancel(){job.current++;void worker.current?.terminate();worker.current=null;setBusy(false);setProgress("");}
 async function readPhoto(file:File){
  invalidate();setRows([]);setText("");setPhoto("");
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>15*1024*1024){setError("Choose a JPG, PNG or WebP photo under 15 MB. Export HEIC photos or PDF scans as JPG first.");return;}
  const id=++job.current;setBusy(true);setProgress("Preparing photo…");let timedOut=false;let reader:Worker|null=null,timer:ReturnType<typeof setTimeout>|undefined;
  try{
   const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>40000000){bitmap.close();throw Error("This photo is too large. Resize it below 40 megapixels.");}
   const canvas=document.createElement("canvas"),scale=Math.min(1,3000/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext("2d")!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
   if(id!==job.current)return;setPhoto(URL.createObjectURL(file));
   const {createWorker,PSM}=await import("tesseract.js");
   const result=await Promise.race([
    (async()=>{reader=await createWorker("eng",1,{workerPath:"/ocr/worker.min.js",corePath:"/ocr",langPath:"/ocr",workerBlobURL:false,cacheMethod:"none",logger:m=>{if(id===job.current)setProgress(m.status==="recognizing text"?`Reading photo… ${Math.round(m.progress*100)}%`:"Loading offline text reader…");}});
     if(id!==job.current){await reader.terminate();throw Error("Cancelled");}worker.current=reader;await reader.setParameters({tessedit_pageseg_mode:PSM.AUTO});return await reader.recognize(canvas);})(),
    new Promise<never>((_,reject)=>{timer=setTimeout(()=>{timedOut=true;if(id===job.current)job.current++;void reader?.terminate();reject(Error("Reading took too long. Try a smaller, sharper photo or enter the text manually."));},120000);})
   ]);
   if(id===job.current){setText(result.data.text);if(!result.data.text.trim())setError("No readable text found. Try a sharper photo, or type the nurse lines below.");}
  }catch(e){if(id===job.current||(timedOut&&id+1===job.current))setError(e instanceof Error?e.message:"Could not read this photo. Try a clearer JPG or enter the text below.");}
  finally{clearTimeout(timer);if(reader)await (reader as Worker).terminate().catch(()=>{});if(worker.current===reader)worker.current=null;if(id===job.current||(timedOut&&id+1===job.current)){setBusy(false);setProgress("");}if(fileInput.current)fileInput.current.value="";}
 }
 return <section className="scan-import">
  <h3>Read a roster photo</h3><p>{localMode?"Transfer the photo from the phone to this laptop, then choose it here. Text recognition runs on this computer—no AI account or internet needed.":"On your phone, open this website and choose a roster photo from your camera or photo library. On a laptop, choose a photo already transferred to it. Text recognition runs in your browser; internet is needed to load the reader, but the photo is not uploaded for recognition."} Photos are not saved with the roster.</p>
  {!localMode&&<p className="form-help">After importing, choose Save workspace. To see it on another device, sign in to this website with the same account and reload after saving any edits there. The portable laptop edition keeps a separate workspace and does not sync with this website.</p>}
  <p className="form-help">Use a straight, well-lit photo with one nurse per line. Printed text works best. Handwriting, columns and abbreviations may be misread or missed; compare every name and time with the original.</p>
  <div className="button-row"><button data-tour="photo-choose" type="button" className="secondary" disabled={busy} onClick={()=>fileInput.current?.click()}>Choose roster photo</button>{busy&&<button type="button" className="text-button" onClick={cancel}>Cancel reading</button>}</div>
  <input ref={fileInput} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={e=>{if(e.target.files?.[0])void readPhoto(e.target.files[0]);}}/>
  {busy&&<p role="status">{progress}</p>}{photo&&<img className="scan-photo" src={photo} alt="Original roster photo for comparison"/>}
  <label data-tour="photo-text">Review extracted text<textarea aria-label="Scanned roster text" rows={7} value={text} disabled={busy} onChange={e=>{setText(e.target.value);setRows([]);invalidate();}} placeholder={"One nurse per line, for example:\nJordan Lee RN JP2 early 05:45 13:45"}/></label>
  <p className="form-help">Remove headings and unrelated text. Put each nurse on a separate line. Include RN/LPN, JP2/JP3, early/late/morning-charge and start/finish when known. Missing details stay blank unless the name matches a saved nurse.</p>
  <button data-tour="photo-build" type="button" className="secondary" disabled={busy||!text.trim()} onClick={()=>{invalidate();try{setRows(scanRows(text,existing));}catch(e){setError((e as Error).message);}}}>Build review rows</button>
  {rows.map((row,index)=><fieldset data-tour="photo-row" className="scan-row" key={index}><legend>Nurse {index+1}</legend><small>{row.source}</small><div className="form-grid">{scanColumns.map(col=><label key={col}>{({name:"Name",role:"Designation",floor:"Floor",cohort:"Start group",start:"Start (24-hour)",end:"Finish (24-hour)"})[col]}{["role","floor","cohort"].includes(col)?<select aria-label={`Scan nurse ${index+1} ${col}`} value={row[col]} onChange={e=>{invalidate();setRows(rows.map((r,i)=>i===index?{...r,[col]:e.target.value}:r));}}><option value="">Choose…</option>{(col==="role"?["RN","LPN"]:col==="floor"?["JP2","JP3"]:["early","late","morning-charge"]).map(v=><option key={v}>{v}</option>)}</select>:<input aria-label={`Scan nurse ${index+1} ${col}`} type={col==="start"||col==="end"?"time":"text"} maxLength={col==="name"?100:undefined} value={row[col]} onChange={e=>{invalidate();setRows(rows.map((r,i)=>i===index?{...r,[col]:e.target.value}:r));}}/>}</label>)}</div><button type="button" className="text-button" onClick={()=>{invalidate();setRows(rows.filter((_,i)=>i!==index));}}>Remove this row</button></fieldset>)}
  {rows.length>0&&<div className="button-row"><button type="button" className="secondary" onClick={()=>{invalidate();setRows([...rows,{name:"",role:"",floor:"",cohort:"",start:"",end:"",source:"Added manually"}]);}}>Add missed nurse</button><button data-tour="photo-preview" type="button" className="primary" onClick={()=>{invalidate();try{onUse(scanCSV(rows));}catch(e){setError((e as Error).message);}}}>Preview these nurses</button></div>}
  {error&&<p className="alert" role="alert">{error}</p>}
 </section>;
}
