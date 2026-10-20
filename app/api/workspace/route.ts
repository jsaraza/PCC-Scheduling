import {getChatGPTUser} from "../../chatgpt-auth";
import {getDb} from "../../../db";
import {workspaces} from "../../../db/schema";
import {and,eq} from "drizzle-orm";
import {dataSchema} from "../../../lib/validation";
import {checkSchedule} from "../../../lib/planner";
import {workspaceSchema,validateDay} from "../../../lib/teams";
export const dynamic="force-dynamic";
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(){
 const user=await getChatGPTUser();if(!user)return json({error:"Sign in to load your schedules."},401);
 try{const rows=await getDb().select().from(workspaces).where(eq(workspaces.owner,user.userId)).limit(1);const row=rows[0];return json({data:row?JSON.parse(row.data):null,version:row?.version||0});}catch{return json({error:"Saved schedules are unavailable. Please try again."},503);}
}
export async function PUT(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:"Sign in before saving."},401);
 const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return json({error:"Invalid origin."},403);
 try{
 const raw=await request.text();if(new TextEncoder().encode(raw).byteLength>1900000)return json({error:"This hosted workspace is approaching its storage limit. Export older schedules or move to the local edition before saving more history."},413);
 const body=JSON.parse(raw);const isTeam=body.data?.schemaVersion===2;
 const parsed=(isTeam?workspaceSchema:dataSchema).safeParse(body.data);if(!parsed.success||!Number.isSafeInteger(body.version)||body.version<0)return json({error:"Invalid workspace data. "+(parsed.success?"":parsed.error.issues[0]?.message)},400);
 const stored=await getDb().select().from(workspaces).where(eq(workspaces.owner,user.userId)).limit(1);
 if(stored[0]&&JSON.parse(stored[0].data).toolsVersion===1&&body.data?.toolsVersion!==1)return json({error:"This workspace has newer planning tools. Reload before saving."},409);
 if("schemaVersion" in parsed.data){
  for(const d of parsed.data.days){
   const issues=validateDay(d,parsed.data.days);
   if(d.status==="approved"&&(!d.rulesReviewed||issues.some(i=>i.kind==="error")||!d.approvedAt||!d.approvedBy))return json({error:"Approval requires confirmed staff and rules, complete teams, valid leadership and RN-majority checks."},400);
   if(issues.some(i=>i.kind==="error"&&["transfer","poc","closure","handover"].includes(i.code)))return json({error:"Invalid operational event: "+issues.find(i=>i.kind==="error"&&["transfer","poc","closure","handover"].includes(i.code))?.text},400);
   if((d.transfers.length||d.closureAt)&&issues.some(i=>i.kind==="error"&&i.code==="balance"))return json({error:"Recorded transfers or closure must preserve strict RN majorities throughout the day. Correct the roster or remove the event before saving."},400);
  }
 }else{
  const existing=await getDb().select().from(workspaces).where(eq(workspaces.owner,user.userId)).limit(1);
  if(existing[0]&&JSON.parse(existing[0].data).schemaVersion===2)return json({error:"This workspace uses team scheduling. Reload to use the updated app."},409);
  for(const s of parsed.data.schedules)if(s.status==="approved"&&(!s.rulesReviewed||checkSchedule(s).some(i=>i.kind==="error")||!s.approvedAt||!s.approvedBy))return json({error:"Approved schedules require confirmed rules, an approver, and no conflicts or coverage gaps."},400);
 }
 const db=getDb(),now=new Date().toISOString();
 if(body.version===0){const row=await db.insert(workspaces).values({owner:user.userId,data:JSON.stringify(parsed.data),version:1,updatedAt:now}).onConflictDoNothing().returning({version:workspaces.version});if(!row.length)return json({error:"This workspace changed on another device. Reload before saving."},409);return json({version:1});}
 const rows=await db.update(workspaces).set({data:JSON.stringify(parsed.data),version:body.version+1,updatedAt:now}).where(and(eq(workspaces.owner,user.userId),eq(workspaces.version,body.version))).returning({version:workspaces.version});
 if(!rows.length)return json({error:"This workspace changed on another device. Download a backup of your edits, then reload before saving."},409);
 return json({version:body.version+1});
 }catch{return json({error:"Unable to save. Your changes remain on screen; download a backup before leaving."},500);}
}
