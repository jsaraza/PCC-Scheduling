"use client";
import {useEffect,useState} from "react";
export function LocalBackups({restore}:{restore:(file:File)=>Promise<void>}){
 const [info,setInfo]=useState<{directory:string;backups:string[]}|null>(null),[error,setError]=useState("");
 async function refresh(){try{const r=await fetch("/api/local");if(!r.ok)throw new Error("Could not read automatic backups.");setInfo(await r.json());}catch(e){setError(String(e));}}
 useEffect(()=>{void refresh();},[]);
 return <section className="management-card no-print"><div className="card-header"><div><h2>Automatic local backups</h2><p>Recent versions and daily snapshots are kept on this computer. Also copy an export to an approved separate drive.</p></div><button className="secondary" onClick={refresh}>Refresh</button></div>
 <div className="local-backup-body"><p>Data folder: <code>{info?.directory||"Loading…"}</code></p><p>Restoring loads a preview. Review it and click Save workspace to replace the saved version. A backup of the previous version is kept.</p>
 {error&&<p role="alert">{error}</p>}
 {info&&!info.backups.length&&<p>The first backup appears after the first successful save.</p>}
 {info?.backups.map(name=><div className="backup-row" key={name}><span>{name.replace("backup-","").replace(/-[a-f0-9]{8}\.json$/,"")}</span><a href={"/api/backup?name="+encodeURIComponent(name)} download="pcc-backup.json">Download</a><button className="text-button" onClick={async()=>{try{const r=await fetch("/api/backup?name="+encodeURIComponent(name));if(!r.ok)throw new Error("Could not open backup.");await restore(new File([await r.text()],name,{type:"application/json"}));}catch(e){setError(String(e));}}}>Preview restore</button></div>)}</div></section>;
}
