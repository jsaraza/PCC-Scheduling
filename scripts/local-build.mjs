import {spawnSync} from "node:child_process";
import {renameSync,rmSync,existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
const root=fileURLToPath(new URL("../",import.meta.url));
const next=path.join(root,".local-build"),current=path.join(root,"dist-local"),previous=path.join(root,".local-previous");
for(const target of [next,current,previous])if(path.dirname(path.resolve(target))!==path.resolve(root))throw new Error("Build path escaped the checkout.");
const result=spawnSync(process.execPath,[path.join(root,"node_modules/vite/bin/vite.js"),"build","--config","vite.local.config.ts","--outDir",next],{cwd:root,stdio:"inherit"});
if(result.status!==0)process.exit(result.status||1);
// All recursive cleanup targets are fixed children of this checkout.
if(existsSync(previous))rmSync(previous,{recursive:true});
if(existsSync(current))renameSync(current,previous);
try{renameSync(next,current);}catch(e){if(existsSync(previous))renameSync(previous,current);throw e;}
console.log("Local application built. Saved data is stored separately.");
