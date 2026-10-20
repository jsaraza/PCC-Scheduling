import {workspaceSchema,validateDay} from "./teams.ts";

// Drafts may be incomplete. Approval, rather than saving recovery work, is the
// boundary at which every required scheduling check must pass.
export function checkedWorkspace(data:unknown){
 const parsed=workspaceSchema.safeParse(data);
 if(!parsed.success)throw new Error("Invalid workspace: "+parsed.error.issues[0]?.message);
 for(const day of parsed.data.days){
  if(day.status==="approved"&&(!day.rulesReviewed||!day.approvedAt||!day.approvedBy?.trim()||validateDay(day,parsed.data.days).some(i=>i.kind==="error")))
   throw new Error("Approved schedules must pass all staffing, coverage, leadership and weekly checks. Return the affected day to draft before saving.");
 }
 return parsed.data;
}
