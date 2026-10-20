import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync,mkdirSync,writeFileSync,readFileSync} from "node:fs";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import {setTimeout as delay} from "node:timers/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import {LocalStore,ConflictError} from "../local/storage.mjs";
import {startLocal} from "../local/server.mjs";
import {seedWorkspace,newDay} from "../lib/teams.ts";
const fixture=()=>{const w=seedWorkspace();w.days=[newDay(w,"2026-10-20")];return w;};
function directory(t,cleanup=true){
 const parent=path.resolve(os.tmpdir()),dir=mkdtempSync(path.join(parent,"pcc-test-"));
 if(cleanup)t.after(()=>{if(path.dirname(path.resolve(dir))!==parent)throw new Error("Unsafe cleanup");rmSync(dir,{recursive:true,force:true});});
 return dir;
}
test("local schedules survive restart, are stored per day, and reject stale writes",t=>{
 const dir=directory(t);let store=new LocalStore(dir);const w=fixture();
 assert.equal(store.save(w,0).version,1);
 assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM schedules").get().n,1);
 assert.equal(JSON.parse(store.db.prepare("SELECT data FROM workspace").get().data).days,undefined);
 store.close();store=new LocalStore(dir);
 try{assert.deepEqual(store.read().data,w);assert.throws(()=>store.save(w,0),ConflictError);assert.equal(store.read().version,1);}finally{store.close();}
});
test("automatic backups restore into a fresh database and retain pre-replacement state",t=>{
 const dir=directory(t),store=new LocalStore(dir),w=fixture();
 try{
  store.save(w,0);
  const updated=structuredClone(w);updated.days[0].notes="Replacement";
  store.save(updated,1);
  const original=store.listBackups().map(f=>store.getBackup(f)).find(b=>b.days[0].notes!=="Replacement");
  assert.ok(original);
  const other=new LocalStore(path.join(dir,"restored"));
  try{other.save(original,0);assert.deepEqual(other.read().data,w);}finally{other.close();}
 }finally{store.close();}
});
test("invalid approval is rejected without changing stored data; incomplete drafts persist",t=>{
 const store=new LocalStore(directory(t)),w=fixture();
 try{
  store.save(w,0);
  const bad=structuredClone(w);Object.assign(bad.days[0],{status:"approved",approvedBy:"PCC",approvedAt:new Date().toISOString(),rulesReviewed:true});
  assert.throws(()=>store.save(bad,1),/Approved schedules/);
  assert.deepEqual(store.read().data,w);assert.equal(store.read().version,1);
  const incomplete=structuredClone(w);incomplete.days[0].transfers=[{id:"test",nurseId:"missing",at:"15:00"}];
  assert.equal(store.save(incomplete,1).version,2);
 }finally{store.close();}
});
test("a backup failure aborts replacement without losing the committed workspace",t=>{
 const store=new LocalStore(directory(t)),w=fixture();
 try{
  store.save(w,0);store.snapshot=()=>{throw new Error("Disk full");};
  const changed=structuredClone(w);changed.days[0].notes="Should not commit";
  assert.throws(()=>store.save(changed,1),/Disk full/);
  assert.deepEqual(store.read().data,w);assert.equal(store.read().version,1);
 }finally{store.close();}
});
test("multi-megabyte history persists and survives restore beyond the old D1 row limit",t=>{
 const store=new LocalStore(directory(t)),w=fixture();
 try{
  w.days=Array.from({length:500},(_,i)=>{const d=new Date("2025-01-01T12:00:00Z");d.setUTCDate(d.getUTCDate()+i);return {...newDay(w,d.toISOString().slice(0,10)),notes:"x".repeat(5000)};});
  assert.ok(Buffer.byteLength(JSON.stringify(w))>3500000);
  store.save(w,0);assert.deepEqual(store.read().data,w);
 }finally{store.close();}
});
test("local server enforces session, host, origin, approval and optimistic concurrency",async t=>{
 const dir=directory(t,false),assets=path.join(dir,"assets");mkdirSync(assets);writeFileSync(path.join(assets,"index.html"),"<h1>Local</h1>");
 const app=await startLocal({directory:path.join(dir,"data"),port:0,assets});
 t.after(async()=>{await app.close();if(path.dirname(path.resolve(dir))!==path.resolve(os.tmpdir()))throw new Error("Unsafe cleanup");rmSync(dir,{recursive:true,force:true});});
 assert.equal((await fetch(app.origin+"/api/workspace")).status,401);
 assert.equal((await fetch(app.origin+"/launch?key="+encodeURIComponent("é".repeat(64)))).status,401);
 assert.equal((await fetch(app.origin+"/api/workspace",{headers:{Cookie:"pcc_local="+"é".repeat(64)}})).status,401);
 assert.equal((await fetch(app.origin+"/api/workspace",{headers:{"oai-authenticated-user-id":"fake","oai-authenticated-user-email":"fake"}})).status,401);
 const badHost=await new Promise((resolve,reject)=>{http.get(app.origin+"/",{headers:{host:"attacker.example"}},res=>{res.resume();resolve(res.statusCode);}).on("error",reject);});
 assert.equal(badHost,403);
 const login=await fetch(app.launchURL,{redirect:"manual"});assert.equal(login.status,303);
 const cookie=login.headers.get("set-cookie").split(";")[0],headers={Cookie:cookie,Origin:app.origin,"Content-Type":"application/json"};
 assert.equal((await fetch(app.origin+"/",{headers:{Cookie:cookie}})).status,200);
 assert.equal((await fetch(app.origin+"/api/workspace",{headers:{...headers,Origin:"https://attacker.example"}})).status,403);
 assert.equal((await fetch(app.origin+"/api/workspace",{method:"PUT",headers:{Cookie:cookie,"Content-Type":"application/json"},body:"{}"})).status,403);
 const w=fixture();
 const put=()=>fetch(app.origin+"/api/workspace",{method:"PUT",headers,body:JSON.stringify({data:w,version:0})});
 assert.equal((await put()).status,200);assert.equal((await put()).status,409);
 const read=await fetch(app.origin+"/api/workspace",{headers});assert.deepEqual((await read.json()).data,w);
 const info=await fetch(app.origin+"/api/local",{headers});const backup=(await info.json()).backups[0];assert.ok(backup);
 const downloaded=await fetch(app.origin+"/api/backup?name="+encodeURIComponent(backup),{headers});assert.deepEqual(await downloaded.json(),w);
 assert.equal((await fetch(app.origin+"/api/backup?name=../../secret",{headers})).status,400);
 assert.equal((await fetch(app.origin+"/api/stop",{method:"POST",headers:{Cookie:cookie}})).status,403);
});

test("launcher reconnects, stops cleanly and reopens the same database",async t=>{
 const dir=directory(t,false),cwd=fileURLToPath(new URL("../",import.meta.url));
 const env={...process.env,PCC_DATA_DIR:dir,PCC_NO_BROWSER:"1",PCC_PORT:"0"};
 const children=[];
 const start=script=>{
  const child=spawn(process.execPath,[script],{cwd,env,stdio:["ignore","pipe","pipe"]});children.push(child);
  let output="";child.stdout.on("data",b=>output+=b);child.stderr.on("data",b=>output+=b);
  const done=new Promise(resolve=>child.once("exit",(code)=>resolve({code,output})));
  return {child,done};
 };
 t.after(async()=>{for(const child of children)if(child.exitCode===null){child.kill();await new Promise(r=>child.once("exit",r));}if(path.dirname(path.resolve(dir))!==path.resolve(os.tmpdir()))throw new Error("Unsafe cleanup");rmSync(dir,{recursive:true,force:true});});
 async function ready(){
  for(let i=0;i<100;i++){
   try{const state=JSON.parse(readFileSync(path.join(dir,"running.json"),"utf8"));const login=await fetch(state.launchURL,{redirect:"manual",signal:AbortSignal.timeout(500)});if(login.status===303)return {origin:new URL(state.launchURL).origin,cookie:login.headers.get("set-cookie").split(";")[0],pid:state.pid};}catch{}
   await delay(50);
  }
  throw new Error("Launcher did not become ready.");
 }
 const first=start("scripts/local-start.mjs"),a=await ready();
 const headers={Cookie:a.cookie,Origin:a.origin,"Content-Type":"application/json"};
 assert.equal((await fetch(a.origin+"/api/workspace",{method:"PUT",headers,body:JSON.stringify({data:fixture(),version:0})})).status,200);
 const reconnect=await start("scripts/local-start.mjs").done;assert.equal(reconnect.code,0,reconnect.output);
 assert.equal((await ready()).pid,a.pid);
 const stop=await start("scripts/local-stop.mjs").done;assert.equal(stop.code,0,stop.output);assert.equal((await first.done).code,0);
 const restarted=start("scripts/local-start.mjs"),b=await ready();
 const saved=await fetch(b.origin+"/api/workspace",{headers:{Cookie:b.cookie}});assert.equal((await saved.json()).version,1);
 assert.equal((await start("scripts/local-stop.mjs").done).code,0);assert.equal((await restarted.done).code,0);
});
