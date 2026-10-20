import {readFileSync} from "node:fs";
import path from "node:path";
import {dataDirectory} from "./local-paths.mjs";
try{
 const state=JSON.parse(readFileSync(path.join(dataDirectory,"running.json"),"utf8"));
 const url=new URL(state.launchURL);
 if(url.hostname!=="127.0.0.1"||url.protocol!=="http:")throw new Error("Invalid local address.");
 const login=await fetch(url,{redirect:"manual",signal:AbortSignal.timeout(2000)});
 const cookie=login.headers.get("set-cookie")?.split(";")[0];
 if(login.status!==303||!cookie)throw new Error("The recorded session is no longer running.");
 const response=await fetch(url.origin+"/api/stop",{method:"POST",headers:{Cookie:cookie,Origin:url.origin}});
 if(!response.ok)throw new Error("Could not stop the app.");
 console.log("PCC Scheduling stopped. Saved schedules remain on this computer.");
}catch(e){console.error(e.message);process.exitCode=1;}
