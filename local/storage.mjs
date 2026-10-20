import {DatabaseSync} from "node:sqlite";
import {mkdirSync,writeFileSync,renameSync,readdirSync,unlinkSync,readFileSync} from "node:fs";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {checkedWorkspace} from "../lib/workspace-check.ts";

export class ConflictError extends Error {}
export class LocalStore {
 constructor(directory){
  this.directory=directory;
  this.backups=path.join(directory,"backups");
  mkdirSync(this.backups,{recursive:true,mode:0o700});
  this.db=new DatabaseSync(path.join(directory,"schedules.sqlite"));
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS schedules (date TEXT PRIMARY KEY, data TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  const identity=this.db.prepare("SELECT value FROM settings WHERE key='identity'").get();
  this.identity=identity?.value||randomUUID();
  if(!identity)this.db.prepare("INSERT INTO settings VALUES ('identity',?)").run(this.identity);
 }
 read(){
  this.db.exec("BEGIN");
  try{
   const row=this.db.prepare("SELECT * FROM workspace WHERE id=1").get();
   const result=row?{data:{...JSON.parse(row.data),days:this.db.prepare("SELECT data FROM schedules ORDER BY date").all().map(r=>JSON.parse(r.data))},version:row.version,updatedAt:row.updated_at}:{data:null,version:0,updatedAt:null};
   this.db.exec("COMMIT");return result;
  }catch(e){this.db.exec("ROLLBACK");throw e;}
 }
 snapshot(data,version){
  if(!data)return;
  const stamp=new Date().toISOString().replaceAll(":","-");
  const name=`backup-${stamp}-v${version}-${randomUUID().slice(0,8)}.json`;
  const temporary=path.join(this.backups,name+".tmp");
  writeFileSync(temporary,JSON.stringify(data),{mode:0o600,flush:true,flag:"wx"});
  renameSync(temporary,path.join(this.backups,name));
  // Retain the most recent 30 versions plus one snapshot per day for 30 days.
  const files=readdirSync(this.backups).filter(n=>/^backup-.*\.json$/.test(n)).sort().reverse();
  const keep=new Set(files.slice(0,30)),days=new Set();
  for(const file of files){const day=file.slice(7,17);if(!days.has(day)&&days.size<30){keep.add(file);days.add(day);}}
  for(const file of files)if(!keep.has(file))unlinkSync(path.join(this.backups,file));
 }
 save(input,expectedVersion){
  const data=checkedWorkspace(input);
  if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0)throw new Error("Invalid save version.");
  this.db.exec("BEGIN IMMEDIATE");
  try{
   const row=this.db.prepare("SELECT * FROM workspace WHERE id=1").get();
   const version=row?.version||0;
   if(version!==expectedVersion)throw new ConflictError("Another window saved changes. Download your edits, then reload or resolve the recovered draft.");
   // Backup the last committed state before replacing it. A failed backup
   // aborts the transaction so a destructive import cannot bypass protection.
   if(row)this.snapshot({...JSON.parse(row.data),days:this.db.prepare("SELECT data FROM schedules ORDER BY date").all().map(r=>JSON.parse(r.data))},version);
   const {days,...metadata}=data,now=new Date().toISOString();
   this.db.prepare("INSERT INTO workspace VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=excluded.version,updated_at=excluded.updated_at").run(JSON.stringify(metadata),version+1,now);
   this.db.exec("DELETE FROM schedules");
   const insert=this.db.prepare("INSERT INTO schedules VALUES (?,?)");
   for(const day of days)insert.run(day.date,JSON.stringify(day));
   this.db.exec("COMMIT");
   let backupWarning=null;
   try{this.snapshot(data,version+1);}catch{backupWarning="Saved to the database, but the latest backup failed. Export a backup and check disk space.";}
   return {version:version+1,updatedAt:now,backupWarning};
  }catch(e){if(this.db.isTransaction)this.db.exec("ROLLBACK");throw e;}
 }
 backupNow(){const current=this.read();this.snapshot(current.data,current.version);return current;}
 listBackups(){return readdirSync(this.backups).filter(n=>/^backup-.*\.json$/.test(n)).sort().reverse();}
 getBackup(name){if(!this.listBackups().includes(name))throw new Error("Unknown backup.");return JSON.parse(readFileSync(path.join(this.backups,name),"utf8"));}
 close(){this.db.close();}
}
