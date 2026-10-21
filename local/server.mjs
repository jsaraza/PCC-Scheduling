import http from "node:http";
import {readFileSync,existsSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {randomBytes,timingSafeEqual} from "node:crypto";
import {LocalStore,ConflictError} from "./storage.mjs";

export const MAX_BODY=64*1024*1024;
const root=fileURLToPath(new URL("../",import.meta.url));
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".wasm":"application/wasm",".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".woff2":"font/woff2",".png":"image/png",".ico":"image/x-icon"};
const equal=(a,b)=>typeof a==="string"&&/^[a-f0-9]{64}$/.test(a)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export async function startLocal({directory,port=43127,assets=path.join(root,"dist-local")}){
 const store=new LocalStore(directory),secret=randomBytes(32).toString("hex"),launchKey=randomBytes(32).toString("hex");
 let origin="";
 const send=(res,status,value)=>{res.writeHead(status,{"Content-Type":"application/json; charset=utf-8"});res.end(JSON.stringify(value));};
 const server=http.createServer(async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("X-Frame-Options","DENY");
  res.setHeader("Referrer-Policy","no-referrer");
  res.setHeader("Content-Security-Policy","default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  // Exact authority checks stop DNS rebinding. Cookies and Origin checks stop
  // another website from accessing the local API. Never bind to the LAN.
  if(req.headers.host!==new URL(origin).host||!["127.0.0.1","::ffff:127.0.0.1"].includes(req.socket.remoteAddress)||req.headers["sec-fetch-site"]==="cross-site"||(req.headers.origin&&req.headers.origin!==origin)){
   send(res,403,{error:"This app accepts requests from its local window only."});return;
  }
  let url;
  try{url=new URL(req.url,origin);}catch{send(res,400,{error:"Invalid URL."});return;}
  if(url.origin!==origin){send(res,403,{error:"Invalid origin."});return;}
  if(url.pathname==="/launch"&&req.method==="GET"&&equal(url.searchParams.get("key"),launchKey)){
   res.writeHead(303,{"Set-Cookie":`pcc_local=${secret}; HttpOnly; SameSite=Strict; Path=/`,"Location":"/"});res.end();return;
  }
  const cookie=(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("pcc_local="))?.slice(10);
  if(!equal(cookie,secret)){
   if(url.pathname.startsWith("/api/")){send(res,401,{error:"The local session ended. Reopen Start PCC Scheduling, then recover your interrupted draft."});return;}
   res.writeHead(401,{"Content-Type":"text/html; charset=utf-8"});res.end("<h1>PCC Scheduling</h1><p>Open Start PCC Scheduling on this computer to unlock this window.</p>");return;
  }
  try{
   if(url.pathname==="/api/stop"&&req.method==="POST"){
    if(req.headers.origin!==origin){send(res,403,{error:"Invalid origin."});return;}
    store.backupNow();send(res,200,{stopped:true});
    setImmediate(()=>server.close(()=>store.close()));return;
   }
   if(url.pathname==="/api/local"&&req.method==="GET"){send(res,200,{identity:store.identity,directory,backups:store.listBackups()});return;}
   if(url.pathname==="/api/backup"&&req.method==="GET"){
    const data=store.getBackup(url.searchParams.get("name"));
    res.setHeader("Content-Disposition",'attachment; filename="pcc-backup.json"');send(res,200,data);return;
   }
   if(url.pathname==="/api/workspace"){
    if(req.method==="GET"){send(res,200,store.read());return;}
    if(req.method==="PUT"){
     if(req.headers.origin!==origin||!(req.headers["content-type"]||"").startsWith("application/json")){send(res,403,{error:"A same-origin JSON request is required."});return;}
     let bytes=0;const chunks=[];
     for await(const chunk of req){bytes+=chunk.length;if(bytes>MAX_BODY){send(res,413,{error:"Workspace exceeds 64 MB. Export and archive older data."});return;}chunks.push(chunk);}
     const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));
     send(res,200,store.save(body.data,body.version));return;
    }
    send(res,405,{error:"Method not allowed."});return;
   }
   if(req.method!=="GET"&&req.method!=="HEAD"){send(res,405,{error:"Method not allowed."});return;}
   if(url.pathname.startsWith("/api/")){send(res,404,{error:"Unknown endpoint."});return;}
   const relative=decodeURIComponent(url.pathname),file=path.resolve(assets,"."+relative);
   if(!file.startsWith(path.resolve(assets)+path.sep)&&file!==path.resolve(assets)){send(res,403,{error:"Invalid path."});return;}
   const selected=relative==="/" ? path.join(assets,"index.html"):file;
   if(!existsSync(selected)){send(res,404,{error:"File not found."});return;}
   res.writeHead(200,{"Content-Type":types[path.extname(selected)]||"application/octet-stream"});res.end(req.method==="HEAD"?undefined:readFileSync(selected));
  }catch(e){send(res,e instanceof ConflictError?409:400,{error:e instanceof Error?e.message:"Unable to save. Export your changes before closing."});}
 });
 server.requestTimeout=30000;
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(port,"127.0.0.1",resolve);});
 origin=`http://127.0.0.1:${server.address().port}`;
 return {server,store,origin,launchURL:`${origin}/launch?key=${launchKey}`,close:()=>new Promise(resolve=>{server.closeAllConnections();server.close(()=>{store.close();resolve();});})};
}
