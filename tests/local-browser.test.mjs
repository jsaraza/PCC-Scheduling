import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {openBrowser} from '../scripts/local-browser.mjs';
test('reopening waits for Windows to finish dispatching the browser launch',async()=>{
 const child=new EventEmitter();let finished=false;
 const promise=openBrowser('http://127.0.0.1:43127/launch?key=test',{env:{},spawnProcess:()=>child}).then(()=>finished=true);
 await new Promise(r=>setImmediate(r));assert.equal(finished,false);
 child.emit('exit',0);await promise;assert.equal(finished,true);
});
test('browser launch failures are reported and nonlocal URLs are rejected',async()=>{
 for(const event of ['error','exit']){
  const child=new EventEmitter();const promise=openBrowser('http://127.0.0.1:43127/',{env:{},spawnProcess:()=>child});
  child.emit(event,event==='error'?new Error('missing'):1);await assert.rejects(promise,/browser/i);
 }
 await assert.rejects(openBrowser('https://example.com',{env:{}}),/Invalid local/);
});
