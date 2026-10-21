import ExcelJS from "exceljs";
import {importStaff,minute,validateDay} from "./teams.ts";
import type {Day,Staff} from "./teams.ts";

export const rosterColumns=["name","role","floor","cohort","start","end","leadership","weekdaysOnly","shortEnd"];
const csv=(rows:string[][])=>rows.map(row=>row.map(v=>'"'+v.replaceAll('"','""')+'"').join(",")).join("\r\n");
export function excelTime(value:unknown):string{
 if(value===null||value===undefined||value==="")return "";
 if(value instanceof Date){if(!Number.isFinite(+value))throw Error("Invalid time.");return value.toISOString().slice(11,16);}
 if(typeof value==="number"){
  if(value<0||value>=1)throw Error("Use a time such as 06:00, not a date or whole number.");
  const mins=Math.round(value*1440);if(mins>=1440)throw Error("Use a same-day time before midnight.");
  return String(Math.floor(mins/60)).padStart(2,"0")+":"+String(mins%60).padStart(2,"0");
 }
 const text=String(value).trim(),match=text.match(/^(\d{1,2}):(\d{2})(?::00)?\s*(am|pm)?$/i);
 if(!match)throw Error("Use HH:mm, for example 06:00 or 14:00.");
 let hour=Number(match[1]);const min=Number(match[2]);if(match[3]){if(hour<1||hour>12)throw Error("Invalid AM/PM time.");hour=hour%12+(match[3].toLowerCase()==="pm"?12:0);}
 if(hour>23||min>59)throw Error("Invalid time.");return String(hour).padStart(2,"0")+":"+match[2];
}
// Check ZIP expansion before ExcelJS decompresses an uploaded workbook.
export function checkWorkbookSize(data:ArrayBuffer){
 if(data.byteLength>5*1024*1024)throw Error("Use an Excel file smaller than 5 MB.");
 const view=new DataView(data);let end=-1;
 for(let i=data.byteLength-22;i>=Math.max(0,data.byteLength-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw Error("This is not a readable .xlsx file. Save it as Excel Workbook (.xlsx).");
 const count=view.getUint16(end+10,true);let offset=view.getUint32(end+16,true),total=0;
 if(count>1000)throw Error("This workbook is too complex. Copy the roster into the template.");
 for(let i=0;i<count;i++){
  if(offset+46>data.byteLength||view.getUint32(offset,true)!==0x02014b50)throw Error("Invalid Excel file.");
  total+=view.getUint32(offset+24,true);if(total>20*1024*1024)throw Error("Expanded workbook exceeds 20 MB. Copy the roster into the template.");
  offset+=46+view.getUint16(offset+28,true)+view.getUint16(offset+30,true)+view.getUint16(offset+32,true);
 }
}
function cellValue(cell:ExcelJS.Cell){
 const value=cell.value;
 if(value&&typeof value==="object"&&!(value instanceof Date)){
  if("formula" in value||"sharedFormula" in value)throw Error("Replace formulas with their values before importing.");
  if("richText" in value)return value.richText.map(v=>v.text).join("");
  if("text" in value)return value.text;
  throw Error("Replace error cells with valid values.");
 }
 return value;
}
export async function readRosterWorkbook(data:ArrayBuffer){
 checkWorkbookSize(data);const book=new ExcelJS.Workbook();
 try{await book.xlsx.load(data);}catch{throw Error("Could not open this workbook. Use an unencrypted .xlsx file saved from Excel.");}
 return book.worksheets.filter(s=>s.state==="visible").map(s=>({name:s.name,sheet:s}));
}
export function worksheetCSV(sheet:ExcelJS.Worksheet){
 if(sheet.rowCount>501||sheet.columnCount>40)throw Error("Use up to 100 nurses, with headers in row 1. Remove extra formatted rows or copy into the template.");
 const headers=Array.from({length:sheet.columnCount},(_,i)=>String(cellValue(sheet.getRow(1).getCell(i+1))??"").trim().toLowerCase());
 for(const required of rosterColumns.slice(0,6))if(headers.filter(h=>h===required).length!==1)throw Error(`Row 1 must contain exactly one '${required}' column. Use the Excel template.`);
 for(const key of rosterColumns.map(h=>h.toLowerCase()))if(headers.filter(h=>h===key).length>1)throw Error(`Duplicate '${key}' column.`);
 const selected=headers.map((h,i)=>({h,i})).filter(({h})=>rosterColumns.map(c=>c.toLowerCase()).includes(h));const rows=[selected.map(x=>x.h)];
 for(let row=2;row<=sheet.rowCount;row++){
  const cells=selected.map(({i})=>sheet.getRow(row).getCell(i+1));if(cells.every(c=>c.value===null||c.value===""))continue;
  rows.push(cells.map((cell,i)=>{try{const value=cellValue(cell),key=selected[i].h;
   if(["start","end","shortend"].includes(key))return excelTime(value);
   if(key==="weekdaysonly"){const s=String(value??"").trim().toLowerCase();if(!["true","false",""].includes(s))throw Error("Use true or false.");return s||"false";}
   return String(value??"").trim();
  }catch(e){throw Error(`Row ${row}, ${selected[i].h}: ${(e as Error).message}`);}}));
 }
 // Lowercase header matching while preserving the template's familiar casing.
 return csv(rows);
}
export function validateRosterImport(text:string,existing:Staff[]){
 try{const nurses=importStaff(text,existing);if(!nurses.length)throw Error("No nurse rows found.");return nurses;}
 catch(e){if(e instanceof Error&&e.name==="ZodError")throw Error("Check every row: name, RN/LPN, JP2/JP3, early/late/morning-charge, and valid HH:mm times are required.");throw e;}
}
function style(sheet:ExcelJS.Worksheet,widths:number[],titleRow=1){
 sheet.columns.forEach((c,i)=>c.width=widths[i]||24);sheet.views=[{state:"frozen",ySplit:titleRow}];
 sheet.getRow(titleRow).eachCell(c=>{c.font={bold:true,color:{argb:"FFFFFFFF"}};c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF123F47"}};});
 sheet.eachRow((row,index)=>{row.alignment={vertical:"top",wrapText:true};if(index>titleRow&&index%2===0)row.eachCell(c=>c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF0F6F5"}});});
 sheet.autoFilter={from:{row:titleRow,column:1},to:{row:sheet.rowCount,column:sheet.columnCount}};
 sheet.pageSetup={paperSize:9,orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:`1:${titleRow}`};
}
function addRoster(book:ExcelJS.Workbook,nurses:Staff[]){
 const sheet=book.addWorksheet("Roster");sheet.addRow(rosterColumns);
 nurses.forEach(n=>sheet.addRow([n.name,n.role,n.floor,n.cohort,n.start,n.end,n.leadership,n.weekdaysOnly,n.shortEnd||""]));
 style(sheet,[26,12,12,22,12,12,18,18,14]);return sheet;
}
export async function rosterTemplate(){
 const book=new ExcelJS.Workbook();addRoster(book,[{id:"example",name:"Example nurse — replace me",role:"RN",floor:"JP2",cohort:"early",start:"06:00",end:"14:00",leadership:"",weekdaysOnly:false,shortEnd:null,confirmed:false}]);
 const help=book.addWorksheet("Instructions");[
 ["PCC Scheduler • roster template"],["Replace the example row with one row per nurse. Keep row 1 unchanged. Maximum 100 nurses."],
 ["Required: name, role (RN/LPN), floor (JP2/JP3), cohort (early/late/morning-charge), start, end."],
 ["Times: use 06:00 or 14:00; Excel time cells and AM/PM times also work. Same-day shifts only."],
 ["Optional: leadership = poc or charge; weekdaysOnly = true or false; shortEnd = 10:00 or 12:15."],
 ["Blank optional values clear those settings. Remove an optional column to preserve an existing nurse's setting."],
 ["Import replaces the selected day's roster after preview and confirmation. Matching names retain their history."],
 ["This imports nurses only. It does not import assignments, approvals, breaks or historical schedules."],
 ].forEach(r=>help.addRow(r));help.getColumn(1).width=105;help.eachRow(r=>{r.alignment={wrapText:true};r.height=32;});
 return book.xlsx.writeBuffer();
}
export async function scheduleWorkbook(day:Day,history:Day[]){
 const book=new ExcelJS.Workbook();book.creator="PCC Scheduler";book.title=`PCC schedule ${day.date}`;
 const schedule=book.addWorksheet("Schedule");
 schedule.addRow([`Patient Care Coordinator Scheduler • ${day.date} • ${day.status.toUpperCase()}`]);schedule.mergeCells("A1:J1");
 schedule.addRow([`Approved by: ${day.approvedBy||"Not approved"} | JP2 closure: ${day.closureAt||"Not recorded"} | History rotation: ${day.fairness?"On":"Off"}`]);schedule.mergeCells("A2:J2");
 schedule.addRow(["Floor","Team","Nurse","Role","Cohort","Start","End","Primary cubicles","Leadership from 13:30","Move to JP3"]);
 const name=(id:string|null)=>day.roster.find(n=>n.id===id)?.name||"Not assigned";
 for(const n of [...day.roster].sort((a,b)=>a.floor.localeCompare(b.floor)||a.start.localeCompare(b.start)||a.name.localeCompare(b.name))){
  const p=day.placements.find(p=>[p.early1,p.early2,p.late].includes(n.id)),team=day.teams.find(t=>t.id===p?.teamId);
  const cubicles=team?(p?.early1===n.id?team.cubicles.slice(0,2):p?.early2===n.id?team.cubicles.slice(2):team.cubicles).map(c=>c.number).join(" / "):"";
  const transfer=day.transfers.find(t=>t.nurseId===n.id)?.at||(n.floor==="JP2"&&day.closureAt&&minute(n.start)<=minute(day.closureAt)&&minute(n.end)>minute(day.closureAt)?day.closureAt:"");
  schedule.addRow([n.floor,team?.label||(n.cohort==="morning-charge"?"Morning charge":"Float / leadership"),n.name,n.role,n.cohort,n.start,n.end,cubicles,n.leadership==="poc"?"JP2 point of contact":n.leadership==="charge"?"JP3 afternoon charge":"",transfer]);
 }
 style(schedule,[12,23,26,10,20,12,12,24,28,18],3);
 for(let i=1;i<=2;i++){schedule.getRow(i).height=30;schedule.getRow(i).font={bold:true,size:i===1?16:11,color:{argb:"FF123F47"}};}
 addRoster(book,day.roster);
 const events=book.addWorksheet("Events");events.addRow(["Type","Floor","Nurse","Start / at","End","Relief / detail"]);
 day.breaks.forEach(b=>events.addRow(["Break",day.roster.find(n=>n.id===b.nurseId)?.floor,name(b.nurseId),b.start,b.end,b.reliefId?name(b.reliefId):"No relief recorded"]));
 day.transfers.forEach(t=>events.addRow(["Move to JP3","JP2 → JP3",name(t.nurseId),t.at,"",""]));
 day.handovers.forEach(h=>events.addRow(["Leadership handover",h.floor,name(h.nurseId),h.at,"",h.floor==="JP2"?"Point of contact":"Afternoon charge"]));
 if(day.closureAt)events.addRow(["JP2 closure","JP2 → JP3","Remaining on-duty staff",day.closureAt,"","Shared coverage in JP3"]);
 style(events,[26,18,26,16,16,44]);
 const review=book.addWorksheet("Review & layout");review.addRow(["Section","Item","Details"]);
 review.addRow(["Use","Snapshot only","Edits in Excel do not update the app. Use JSON Backup to preserve full history and rules. The Roster sheet can be imported as a new roster; assignments are not imported."]);
 review.addRow(["Coverage","From 14:00","Coverage is shared across each open floor. Team/cubicle labels record primary assignments. Actual breaks, transfers and handovers are on Events."]);
 review.addRow(["Approval",day.status.toUpperCase(),day.approvedAt||"Coordinator review required"]);
 review.addRow(["Notes","Coordinator notes",day.notes]);
 day.teams.forEach(t=>review.addRow(["Layout",`${t.floor} ${t.label}`,t.cubicles.map(c=>`${c.number}: ${c.service||"No service"} (OR ${c.or||"—"})`).join("; ")]));
 const issues=validateDay(day,history);issues.forEach(i=>review.addRow(["Check",i.kind==="error"?"REQUIRED":"REVIEW",i.text]));
 if(!issues.length)review.addRow(["Check","Configured checks passed","Coordinator review remains required."]);
 style(review,[18,28,100]);review.eachRow((r,i)=>{if(i>1)r.height=48;});
 return book.xlsx.writeBuffer();
}
