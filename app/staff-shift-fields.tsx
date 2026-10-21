"use client";
import {useState} from "react";
import type {Staff} from "../lib/teams";
import {shiftEnd} from "../lib/teams";
export default function StaffShiftFields({staff}:{staff:Staff|null}){
 const [cohort,setCohort]=useState(staff?.cohort||"early"),[start,setStart]=useState(staff?.start||"06:00"),[end,setEnd]=useState(staff?.end||"14:00"),[shortEnd,setShortEnd]=useState(staff?.shortEnd||"");
 const [weekdays,setWeekdays]=useState(staff?.weekdaysOnly||false);
 function changeStart(time:string){setStart(time);if(time){const finish=shortEnd||shiftEnd(time);setEnd(/^([01]\d|2[0-3]):[0-5]\d$/.test(finish)?finish:"");}}
 return <>
 <div className="form-grid"><label>Start group<select name="cohort" value={cohort} onChange={e=>{setCohort(e.target.value as Staff["cohort"]);changeStart(e.target.value==="late"?"10:00":"06:00");}}><option value="early">Early (counted)</option><option value="late">Late (counted)</option><option value="morning-charge">Morning charge (excluded)</option></select></label>
 <label>Afternoon leadership<select name="leadership" defaultValue={staff?.leadership||""}><option value="">None</option><option value="poc">JP2 POC from 13:30 + float</option><option value="charge">JP3 charge from 13:30 + float</option></select></label>
 <label>Start<input type="time" name="start" aria-label="Shift start" required value={start} onChange={e=>changeStart(e.target.value)}/></label><label>Finish<input type="time" name="end" aria-label="Shift finish" required value={end} onChange={e=>setEnd(e.target.value)}/></label></div>
 <div className="shift-presets"><small>Common starts</small><div className="time-chips">{(cohort==="late"?["10:00","11:00","12:00","13:00","15:00"]:["05:45","06:00"]).map(t=><button key={t} type="button" className={start===t?"active":""} onClick={()=>changeStart(t)}>{t}</button>)}</div></div>
 <label>Recurring short early finish<select name="shortEnd" value={shortEnd} onChange={e=>{setShortEnd(e.target.value);setEnd(e.target.value||shiftEnd(start));if(e.target.value)setWeekdays(true);}}><option value="">Regular eight-hour shift</option><option value="10:00">10:00 (Annie’s weekday finish)</option><option value="12:15">12:15 (Tiffany’s weekday finish)</option></select></label>
 <label className="checkbox-label"><input name="weekdaysOnly" type="checkbox" checked={weekdays} onChange={e=>setWeekdays(e.target.checked)}/>Monday–Friday only</label>
 <p className="form-help">05:45 ends at 13:45; 06:00 ends at 14:00. Short shifts keep their recurring finish. Other times can be entered directly; scheduling checks still apply.</p>
 </>;
}
