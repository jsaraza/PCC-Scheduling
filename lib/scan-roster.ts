import type {Staff} from "./teams";
export type ScanRow={name:string;role:string;floor:string;cohort:string;start:string;end:string;source:string};
export const scanColumns=["name","role","floor","cohort","start","end"] as const;
export function scanRows(text:string,existing:Staff[]):ScanRow[]{
 if(text.length>20000)throw Error("Use a smaller section of the roster (up to 20,000 characters).");
 const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 if(lines.length>100)throw Error("Use up to 100 nurse lines. Remove headings and unrelated text first.");
 return lines.filter(line=>!/^name\s+(role|designation)\b/i.test(line)).map(line=>{
  const matches=existing.filter(n=>new RegExp("(?:^|[^\\p{L}\\p{N}])"+n.name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(?:$|[^\\p{L}\\p{N}])","iu").test(line));
  if(matches.length>1)throw Error("More than one saved nurse appears on a line. Put each nurse on a separate line before building rows.");
  const saved=matches[0],role=line.match(/\b(RN|LPN)\b/i)?.[1].toUpperCase(),floor=line.match(/\bJP\s*([23])\b/i)?.[1];
  const cohort=line.match(/\b(morning-charge|early|late)\b/i)?.[1].toLowerCase();
  const times=[...line.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\s*(AM|PM)?\b|\b([01]\d|2[0-3])([0-5]\d)\b/gi)].map(m=>{
   let h=Number(m[1]??m[4]);if(m[3]){if(h<1||h>12)return "";h=h%12+(m[3].toUpperCase()==="PM"?12:0);}return String(h).padStart(2,"0")+":"+(m[2]??m[5]);
  });
  const name=saved?.name||line.split(/\b(?:RN|LPN|JP\s*[23]|early|late|morning-charge|\d{1,2}:\d{2}|\d{4})\b/i)[0].replace(/^\s*\d+[.)]?\s*/,"").replace(/[|,;\s-]+$/g,"").trim();
  return {name,role:role||saved?.role||"",floor:floor?"JP"+floor:saved?.floor||"",cohort:cohort||saved?.cohort||"",start:times[0]||saved?.start||"",end:times[1]||saved?.end||"",source:saved?"Matched saved nurse; missing details use saved defaults—check all fields.":"Read from text; fill missing details and correct recognition errors."};
 });
}
export function scanCSV(rows:ScanRow[]){
 if(!rows.length)throw Error("Add at least one nurse.");
 return [scanColumns,...rows.map(row=>scanColumns.map(c=>row[c].trim()))].map(row=>row.map(v=>'"'+v.replaceAll('"','""')+'"').join(",")).join("\r\n");
}
