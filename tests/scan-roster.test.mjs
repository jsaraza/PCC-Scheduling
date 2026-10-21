import test from 'node:test';
import assert from 'node:assert/strict';
import {scanRows,scanCSV} from '../lib/scan-roster.ts';
import {seedWorkspace,importStaff,shiftEnd} from '../lib/teams.ts';
test('scan review preserves 05:45 and requires missing designations instead of guessing',()=>{
 const rows=scanRows('Jordan Lee RN JP2 early 05:45 13:45\nCasey Morgan',[]);
 assert.equal(rows[0].start,'05:45');assert.equal(rows[0].end,'13:45');assert.equal(shiftEnd('05:45'),'13:45');
 assert.equal(rows[1].role,'');assert.equal(rows[1].floor,'');assert.throws(()=>importStaff(scanCSV(rows),[]));
 assert.equal(importStaff(scanCSV([rows[0]]),[])[0].name,'Jordan Lee');
});
test('saved exact names keep defaults but observed details override them',()=>{
 const w=seedWorkspace();const rows=scanRows('Annie RN JP3 early 0545 1000',w.nurses);
 assert.equal(rows[0].name,'Annie');assert.equal(rows[0].role,'RN');assert.equal(rows[0].floor,'JP3');assert.equal(rows[0].start,'05:45');assert.match(rows[0].source,/saved defaults/);
 assert.throws(()=>scanRows('Annie Tiffany',w.nurses),/separate line/);
 assert.equal(scanRows('Joannie',w.nurses)[0].role,'');
 assert.equal(scanRows('Casey Morgan LPN JP3 late 10:00 18:00',w.nurses)[0].name,'Casey Morgan');
});
test('scan CSV quotes names and rejects duplicates and oversized text on review',()=>{
 const rows=scanRows('Lee, Jordan RN JP2 early 5:45 AM 1:45 PM',[]);
 assert.equal(importStaff(scanCSV(rows),[])[0].end,'13:45');
 assert.throws(()=>importStaff(scanCSV([...rows,...rows]),[]),/Duplicate/);
 assert.throws(()=>scanRows('x'.repeat(20001),[]),/smaller section/);
});
