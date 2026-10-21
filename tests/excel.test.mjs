import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {excelTime,readRosterWorkbook,worksheetCSV,validateRosterImport,rosterTemplate,scheduleWorkbook,checkWorkbookSize} from '../lib/excel.ts';
import {seedWorkspace,newDay,generateTeams} from '../lib/teams.ts';
const arrayBuffer=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
test('Excel times preserve clock values, including short shifts and AM/PM',()=>{
 assert.equal(excelTime(0.25),'06:00');assert.equal(excelTime(12.25/24),'12:15');assert.equal(excelTime('1:00 PM'),'13:00');assert.equal(excelTime(new Date('1899-12-30T10:00:00Z')),'10:00');assert.throws(()=>excelTime(600));assert.throws(()=>excelTime('24:30'));assert.throws(()=>excelTime('13:00 PM'));
});
test('template round trips with all optional columns',async()=>{
 const bytes=await rosterTemplate(),sheets=await readRosterWorkbook(arrayBuffer(bytes));const roster=validateRosterImport(worksheetCSV(sheets[0].sheet),[]);
 assert.equal(roster.length,1);assert.equal(roster[0].start,'06:00');assert.equal(roster[0].weekdaysOnly,false);
 const row=sheets[0].sheet.getRow(2);row.getCell(8).value=true;row.getCell(9).value=12.25/24;
 const changed=validateRosterImport(worksheetCSV(sheets[0].sheet),[])[0];assert.equal(changed.weekdaysOnly,true);assert.equal(changed.shortEnd,'12:15');
});
test('roster sheet keeps IDs, handles Excel times, rejects formulas and duplicate names',()=>{
 const w=seedWorkspace(),n=w.nurses[0],book=new ExcelJS.Workbook(),s=book.addWorksheet('Input');s.addRow(['name','role','floor','cohort','start','end']);s.addRow([n.name,n.role,n.floor,n.cohort,0.25,14/24]);
 assert.equal(validateRosterImport(worksheetCSV(s),w.nurses)[0].id,n.id);
 s.getRow(2).getCell(5).value={formula:'6/24',result:0.25};assert.throws(()=>worksheetCSV(s),/Row 2, start.*formulas/);
 s.getRow(2).getCell(5).value='06:00';s.addRow([n.name,n.role,n.floor,n.cohort,'06:00','14:00']);assert.throws(()=>validateRosterImport(worksheetCSV(s),w.nurses),/Duplicate/);
});
test('import rejects malformed files, invalid designations and duplicate headers',async()=>{
 assert.throws(()=>checkWorkbookSize(new ArrayBuffer(1)),/readable/);
 await assert.rejects(readRosterWorkbook(new ArrayBuffer(5*1024*1024+1)),/5 MB/);
 assert.throws(()=>validateRosterImport('name,role,floor,cohort,start,end\nX,Doctor,JP2,early,06:00,14:00',[]),/Check every row/);
 assert.throws(()=>validateRosterImport('name,role,floor,cohort,start,end,weekdaysOnly\nX,RN,JP2,early,06:00,14:00,maybe',[]),/true or false/);
 assert.throws(()=>validateRosterImport('name,name,role,floor,cohort,start,end\nX,Y,RN,JP2,early,06:00,14:00',[]),/duplicate column/);
});
test('schedule export preserves roster and events, flags draft and avoids phantom transfers',async()=>{
 const w=seedWorkspace(),d=generateTeams(newDay(w,'2026-10-20'),[]).day;d.closureAt='16:00';d.notes='=1+1';
 const early=d.roster.find(n=>n.floor==='JP2'&&n.cohort==='early');d.breaks=[{id:'b',nurseId:early.id,start:'09:00',end:'09:15',reliefId:null}];d.handovers=[{id:'h',floor:'JP2',nurseId:early.id,at:'13:30'}];
 const bytes=await scheduleWorkbook(d,[]),book=new ExcelJS.Workbook();await book.xlsx.load(bytes);
 assert.match(book.getWorksheet('Schedule').getCell('A1').text,/DRAFT/);
 const roster=validateRosterImport(worksheetCSV(book.getWorksheet('Roster')),w.nurses);assert.equal(roster.length,d.roster.length);assert.deepEqual(roster.map(n=>n.id),d.roster.map(n=>n.id));
 let earlyRow;book.getWorksheet('Schedule').eachRow(r=>{if(r.getCell(3).text===early.name)earlyRow=r;});assert.equal(earlyRow.getCell(10).text,'');
 assert.equal(book.getWorksheet('Events').getCell('A2').text,'Break');assert.equal(book.getWorksheet('Events').getCell('A3').text,'Leadership handover');
 const notes=book.getWorksheet('Review & layout').getCell('C5');assert.equal(notes.value,'=1+1');assert.equal(notes.formula,undefined);
});
