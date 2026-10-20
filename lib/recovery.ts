import type {Workspace} from "./teams";
export type Recovery={data:Workspace;version:number;at:string;date:string};
const open=()=>new Promise<IDBDatabase>((resolve,reject)=>{
 const request=indexedDB.open("pcc-draft-recovery",1);
 request.onupgradeneeded=()=>request.result.createObjectStore("drafts");
 request.onerror=()=>reject(request.error);
 request.onsuccess=()=>resolve(request.result);
});
export async function readRecovery(key:string):Promise<Recovery|null>{
 const db=await open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("drafts","readonly"),request=tx.objectStore("drafts").get(key);
  tx.oncomplete=()=>{db.close();resolve(request.result||null);};
  tx.onerror=()=>{db.close();reject(tx.error);};
 });
}
export async function writeRecovery(key:string,value:Recovery|null){
 const db=await open();
 return new Promise<void>((resolve,reject)=>{
  const tx=db.transaction("drafts","readwrite"),store=tx.objectStore("drafts");
  if(value)store.put(value,key);else store.delete(key);
  tx.oncomplete=()=>{db.close();resolve();};
  tx.onerror=()=>{db.close();reject(tx.error);};
 });
}
