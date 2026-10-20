import {z} from "zod";
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const id=z.string().min(1).max(100);
const nurse=z.object({id,name:z.string().trim().min(1).max(100),role:z.enum(["RN","LPN"]),start:time,end:time,active:z.boolean(),areas:z.array(z.string().max(100)).max(40)});
const bay=z.object({id,label:z.string().trim().min(1).max(100),area:z.string().trim().min(1).max(100),service:z.string().max(100),or:z.string().max(100),start:time,end:time,demand:z.number().int().min(1).max(3),roles:z.array(z.enum(["RN","LPN"])).min(1).max(2),active:z.boolean()});
const assignment=z.object({id,nurseId:id,bayId:id,start:time,end:time,locked:z.boolean(),note:z.string().max(1000),breakNote:z.string().max(200)});
export const scheduleSchema=z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(s+"T12:00:00Z");return !isNaN(d.valueOf())&&d.toISOString().slice(0,10)===s;}),status:z.enum(["draft","approved"]),fairness:z.boolean(),assignments:z.array(assignment).max(500),roster:z.array(nurse).max(150),bays:z.array(bay).max(100),notes:z.string().max(5000),approvedAt:z.string().nullable(),approvedBy:z.string().max(200).nullable(),rulesReviewed:z.boolean()});
export const dataSchema=z.object({nurses:z.array(nurse).max(150),bays:z.array(bay).max(100),schedules:z.array(scheduleSchema).max(730),rulesConfirmed:z.boolean(),demo:z.boolean()}).superRefine((data,ctx)=>{
 const unique=(arr:{id:string}[],label:string)=>{if(new Set(arr.map(x=>x.id)).size!==arr.length)ctx.addIssue({code:"custom",message:"Duplicate "+label+" IDs."});};
 unique(data.nurses,"nurse");unique(data.bays,"bay");
 if(new Set(data.schedules.map(s=>s.date)).size!==data.schedules.length)ctx.addIssue({code:"custom",message:"Duplicate schedule dates."});
 for(const s of data.schedules){unique(s.roster,"roster");unique(s.bays,"bay");unique(s.assignments,"assignment");}
});
