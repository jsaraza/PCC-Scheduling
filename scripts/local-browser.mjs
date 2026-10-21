import {spawn} from "node:child_process";

// Wait for Windows to accept the browser launch before a reconnecting process exits.
export async function openBrowser(url,{spawnProcess=spawn,env=process.env}={}){
 if(env.PCC_NO_BROWSER==="1")return;
 const address=new URL(url);
 if(address.protocol!=="http:"||address.hostname!=="127.0.0.1")throw new Error("Invalid local browser address.");
 await new Promise((resolve,reject)=>{
  const child=spawnProcess("powershell.exe",["-NoProfile","-NonInteractive","-WindowStyle","Hidden","-Command",`$ErrorActionPreference='Stop'; Start-Process '${url.replaceAll("'","''")}'`],{windowsHide:true,stdio:"ignore"});
  child.once("error",()=>reject(new Error("Could not open the browser. Check your Windows default browser setting and try the shortcut again.")));
  child.once("exit",code=>code===0?resolve():reject(new Error("Windows could not open the default browser. Check its settings and try the shortcut again.")));
 });
}
