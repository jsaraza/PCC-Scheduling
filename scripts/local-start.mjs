import {readFileSync,writeFileSync,unlinkSync,existsSync} from "node:fs";
import path from "node:path";
import {openBrowser} from "./local-browser.mjs";
import {startLocal} from "../local/server.mjs";
import {dataDirectory} from "./local-paths.mjs";
const stateFile=path.join(dataDirectory,"running.json");
let running;
try{running=JSON.parse(readFileSync(stateFile,"utf8"));}catch{}
if(running){
 let reconnect=false;
 try{
  const address=new URL(running.launchURL);
  if(address.hostname!=="127.0.0.1"||address.protocol!=="http:")throw new Error("Invalid local address");
  const response=await fetch(address,{redirect:"manual",signal:AbortSignal.timeout(1500)});
  reconnect=response.status===303&&response.headers.get("set-cookie")?.startsWith("pcc_local=");
 }catch{}
 if(reconnect){await openBrowser(running.launchURL);process.exit(0);}
}
if(!existsSync(new URL("../dist-local/index.html",import.meta.url)))throw new Error("Run Setup PCC Scheduling first.");
const app=await startLocal({directory:dataDirectory,port:process.env.PCC_PORT?Number(process.env.PCC_PORT):43127});
writeFileSync(stateFile,JSON.stringify({pid:process.pid,launchURL:app.launchURL}),{mode:0o600});
const shutdown=async()=>{try{unlinkSync(stateFile);}catch{}await app.close();process.exit(0);};
process.on("SIGINT",shutdown);process.on("SIGTERM",shutdown);
app.server.on("close",()=>{try{unlinkSync(stateFile);}catch{}});
try{await openBrowser(app.launchURL);}catch(error){await app.close();try{unlinkSync(stateFile);}catch{}throw error;}
console.log("PCC Scheduler is ready. Close the browser whenever you like; use the shortcut to reopen it.");
