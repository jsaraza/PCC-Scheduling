import React from "react";
import {createRoot} from "react-dom/client";
import TeamPlanner from "../app/team-planner";
import "../app/globals.css";
const root=createRoot(document.getElementById("root")!);
try{
 const info=await fetch("/api/local").then(r=>{if(!r.ok)throw new Error("Open the app using Start PCC Scheduling.");return r.json() as Promise<{identity:string}>;});
 void navigator.locks.request("pcc-editor-"+info.identity,{ifAvailable:true},async lock=>{
  if(!lock){root.render(<div className="loading"><h1>PCC Scheduling is already open</h1><p>Use the existing planner window, or close it and reload this page.</p></div>);return;}
  root.render(<TeamPlanner user="PCC coordinator" signIn="/" signOut="/" localMode recoveryIdentity={info.identity}/>);
  await new Promise<void>(()=>{}); // Browser releases the editor lock when the tab closes.
 });
}catch(e){root.render(<div className="loading"><h1>Unable to open PCC Scheduling</h1><p>{e instanceof Error?e.message:"Please restart the app."}</p></div>);}
