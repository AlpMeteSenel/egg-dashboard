import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import type {NodeRecord,Telemetry,Placement,Overview,EventRecord,Track,Mode} from './types';
import {align,mapTracks} from './geo';
const dataRoot=process.env.SWARMFLOW_DATA_DIR||join(process.cwd(),'.data');
const globals=globalThis as unknown as {swarmDb?:DatabaseSync;swarmSchema?:number};
function db(){if(globals.swarmDb&&globals.swarmSchema===2)return globals.swarmDb;mkdirSync(join(dataRoot,'previews'),{recursive:true});const d=globals.swarmDb||new DatabaseSync(join(dataRoot,'swarmflow.sqlite'));d.exec(`PRAGMA journal_mode=WAL;PRAGMA busy_timeout=3000;
 CREATE TABLE IF NOT EXISTS nodes(id TEXT PRIMARY KEY,name TEXT NOT NULL,placement TEXT,telemetry TEXT,last_seen REAL,last_capture REAL DEFAULT 0,counters TEXT DEFAULT '{}',tallies TEXT DEFAULT '{}');
 CREATE TABLE IF NOT EXISTS receipts(node_id TEXT,sample_id TEXT,at REAL,PRIMARY KEY(node_id,sample_id));
 CREATE TABLE IF NOT EXISTS history(node_id TEXT,bucket INTEGER,people INTEGER,vehicles INTEGER,fps REAL,occupied INTEGER,PRIMARY KEY(node_id,bucket));
 CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,node_id TEXT,kind TEXT,message TEXT,at REAL,severity TEXT,data TEXT);
 CREATE TABLE IF NOT EXISTS commands(id TEXT PRIMARY KEY,node_id TEXT,config TEXT,status TEXT,error TEXT,created_at REAL);
 CREATE INDEX IF NOT EXISTS event_time ON events(at);
 INSERT OR IGNORE INTO nodes(id,name) VALUES('egg','Egg · Camera 01');`);if(!d.prepare('PRAGMA table_info(nodes)').all().some(c=>c.name==='last_counter_capture')){d.exec('ALTER TABLE nodes ADD COLUMN last_counter_capture REAL DEFAULT 0; UPDATE nodes SET last_counter_capture=last_capture');}globals.swarmDb=d;globals.swarmSchema=2;return d;}
const obj=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const safeID=(id:unknown):id is string=>typeof id==='string'&&/^[a-z0-9_-]{1,48}$/.test(id);
const parse=<T>(s:unknown,fallback:T):T=>typeof s==='string'?JSON.parse(s):fallback;
function counts(value:unknown){const o=obj(value),r:Record<string,number>={};for(const k of ['person','car','bicycle','bus','motorcycle','truck'])if(Number.isInteger(o[k])&&(o[k] as number)>=0&&(o[k] as number)<1e8)r[k]=o[k] as number;return r;}
export function validSecret(header:string|null){const expected=process.env.NODE_INGEST_SECRET;if(!expected||!header?.startsWith('Bearer '))return false;const a=Buffer.from(header.slice(7)),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);}
export function cleanTelemetry(input:unknown):Telemetry{
 const p=obj(input),v=obj(p.vision),s=obj(p.sensors),b=obj(v.bus_stop);
 if(!finite(p.capture_ts)||p.capture_ts<1e9||p.capture_ts*1000>Date.now()+60000||typeof p.sample_id!=='string'||p.sample_id.length>160)throw Error('A valid capture timestamp and sample ID are required.');
 const tracks:Track[]=(Array.isArray(v.tracks)?v.tracks:[]).slice(0,100).flatMap(raw=>{const t=obj(raw),box=t.box;
 if(!Number.isInteger(t.id)||typeof t.cls!=='string'||!['person','bicycle','car','bus','truck','motorcycle'].includes(t.cls)||!finite(t.conf)||t.conf<0||t.conf>1||!Array.isArray(box)||box.length!==4||!box.every(n=>finite(n)&&n>=0&&n<=1)||box[2]<=box[0]||box[3]<=box[1])return [];
 return [{id:t.id as number,cls:t.cls,conf:t.conf,box:box as Track['box'],speed_kmh:finite(t.speed_kmh)&&t.speed_kmh>=0?t.speed_kmh:null,speed_status:typeof t.speed_status==='string'?t.speed_status.slice(0,100):undefined,confirmed:t.confirmed===true,inside:t.inside===true,retained:t.retained===true,last_seen_s:finite(t.last_seen_s)?t.last_seen_s:0}];});
 const limit=(n:unknown,f=0)=>finite(n)?Math.max(0,Math.min(n,1e6)):f;
 return {capture_ts:p.capture_ts,sample_id:p.sample_id,pending_samples:limit(p.pending_samples),source_kind:typeof p.source_kind==='string'?p.source_kind:'unavailable',mcu_ok:p.mcu_ok===true,fps:limit(p.fps),inference_ms:limit(p.inference_ms),frame_age_ms:limit(p.frame_age_ms),sensors:{temp_c:finite(s.temp_c)?s.temp_c:null,hum_pct:finite(s.hum_pct)?s.hum_pct:null,brightness_percent:limit(s.brightness_percent),led_mode:limit(s.led_mode)},vision:{camera_mode:v.camera_mode==='bus_stop'?'bus_stop':'crosswalk',auto_led:v.auto_led===true,occupied:v.occupied===true,crossing_status:typeof v.crossing_status==='string'?v.crossing_status.slice(0,100):'Waiting for camera',tracks,counts:counts(v.counts),directions:obj(v.directions) as Record<string,number>,events:(Array.isArray(v.events)?v.events:[]).slice(0,30).map(obj),profile:obj(v.profile),command_latency_ms:finite(v.command_latency_ms)?v.command_latency_ms:null,led_command:obj(v.led_command) as Telemetry['vision']['led_command'],bus_stop:{count:finite(b.count)?b.count:null,threshold:limit(b.threshold,10),threshold_reached:b.threshold_reached===true,status:typeof b.status==='string'?b.status.slice(0,100):'Inactive',warnings:(Array.isArray(b.warnings)?b.warnings:[]).slice(0,30).map(obj)}}};
}
export function ingest(input:unknown){
 const p=obj(input);if(!safeID(p.node_id))throw Error('Use a node ID with letters, digits, dashes or underscores.');const id=p.node_id,t=cleanTelemetry(p),d=db(),now=Date.now();
 d.prepare('INSERT OR IGNORE INTO nodes(id,name) VALUES(?,?)').run(id,id==='egg'?'Egg · Camera 01':id);
 const previous=d.prepare('SELECT * FROM nodes WHERE id=?').get(id)!;
 const duplicate=!!d.prepare('SELECT 1 FROM receipts WHERE node_id=? AND sample_id=?').get(id,t.sample_id);
 const results=Array.isArray(p.control_results)?p.control_results:[];
 for(const raw of results.slice(0,10)){const r=obj(raw);if(typeof r.id==='string')d.prepare("UPDATE commands SET status=?,error=? WHERE id=? AND node_id=? AND status='pending'").run(r.ok===true?'applied':'failed',typeof r.error==='string'?r.error.slice(0,180):null,r.id,id);}
 const liveOnly=p.live_only===true;
 if(liveOnly&&t.capture_ts>=(previous.last_capture as number||0))d.prepare('UPDATE nodes SET telemetry=?,last_seen=?,last_capture=? WHERE id=?').run(JSON.stringify(t),now,t.capture_ts,id);
 if(!duplicate&&!liveOnly){
  d.exec('BEGIN IMMEDIATE');try{
   d.prepare('INSERT INTO receipts VALUES(?,?,?)').run(id,t.sample_id,now);
   const latest=t.capture_ts>=(previous.last_capture as number||0);
   if(latest)d.prepare('UPDATE nodes SET telemetry=?,last_seen=?,last_capture=? WHERE id=?').run(JSON.stringify(t),now,t.capture_ts,id);
   if(t.source_kind==='live'&&t.capture_ts>=(previous.last_counter_capture as number||0)){
    const old=parse<Record<string,number>>(previous.counters,{}),tally=parse<Record<string,number>>(previous.tallies,{});
    for(const [k,n] of Object.entries(t.vision.counts))tally[k]=(tally[k]||0)+(n>=(old[k]||0)?n-(old[k]||0):n);
    d.prepare('UPDATE nodes SET counters=?,tallies=?,last_counter_capture=? WHERE id=?').run(JSON.stringify(t.vision.counts),JSON.stringify(tally),t.capture_ts,id);
   }
   if(t.source_kind==='live'){
    const valid=t.vision.tracks.filter(x=>x.confirmed&&!x.retained),people=valid.filter(x=>x.cls==='person').length,vehicles=valid.filter(x=>['car','bus','truck','motorcycle'].includes(x.cls)).length;
    d.prepare('INSERT OR REPLACE INTO history VALUES(?,?,?,?,?,?)').run(id,Math.floor(t.capture_ts/10)*10000,people,vehicles,t.fps,t.vision.occupied?1:0);
    for(const e of [...t.vision.events,...t.vision.bus_stop.warnings]){const at=finite(e.ts)?e.ts*1000:0;if(!at||typeof e.message!=='string')continue;const eventID=typeof e.id==='string'?id+'-'+e.id:id+'-'+at+'-'+e.message;d.prepare('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?,?,?)').run(eventID,id,typeof e.kind==='string'?e.kind:'activity',e.message.slice(0,240),at,typeof e.severity==='string'?e.severity:'info',JSON.stringify(e));}
   }
   d.exec('COMMIT');
   if(latest&&typeof p.preview==='string'&&p.preview.length<900000&&t.source_kind==='live'&&now-t.capture_ts*1000<60000){const image=Buffer.from(p.preview,'base64');if(image[0]===255&&image[1]===216)writeFileSync(join(dataRoot,'previews',id+'.jpg'),image);}
  }catch(e){try{d.exec('ROLLBACK');}catch{}throw e;}
 }
 if(liveOnly&&t.capture_ts>=(previous.last_capture as number||0)&&typeof p.preview==='string'&&p.preview.length<900000&&t.source_kind==='live'&&now-t.capture_ts*1000<60000){const image=Buffer.from(p.preview,'base64');if(image[0]===255&&image[1]===216)writeFileSync(join(dataRoot,'previews',id+'.jpg'),image);}
 d.prepare('UPDATE nodes SET last_seen=? WHERE id=?').run(now,id);
 d.prepare("UPDATE commands SET status='expired',error='Node did not acknowledge within 60 seconds' WHERE status='pending' AND created_at<?").run(now-60000);
 const commands=d.prepare("SELECT id,config FROM commands WHERE node_id=? AND status='pending' ORDER BY created_at").all(id).map(c=>({id:c.id,config:parse(c.config,{})}));
 // Bounded development retention; keep aggregated passage totals on each node.
 if(Math.random()<.005){d.prepare('DELETE FROM receipts WHERE at<?').run(now-7*86400000);d.prepare('DELETE FROM history WHERE bucket<?').run(now-7*86400000);}
 return {ok:true,duplicate,commands};
}
export function ingestBatch(input:unknown){
 const p=obj(input),samples=p.samples;
 if(!Array.isArray(samples)||!samples.length||samples.length>25)throw Error('Send between one and 25 historical samples.');
 // Validate the entire batch before writes; retries are safe through sample receipts.
 for(const raw of samples){const s=obj(raw);if(!safeID(s.node_id)||s.live_only===true||s.preview!==undefined)throw Error('Historical batches require telemetry samples only.');cleanTelemetry(s);}
 for(const sample of samples)ingest(sample);
 return {ok:true,acknowledged:samples.map(raw=>obj(raw).sample_id)};
}
export function validatePlacement(value:unknown):Placement|null{
 if(value===null)return null;const p=obj(value);
 if(!finite(p.lng)||!finite(p.lat)||Math.abs(p.lng)>180||Math.abs(p.lat)>85||!finite(p.heading)||p.heading<0||p.heading>=360)throw Error('Choose a valid camera position and viewing direction.');
 const raw=Array.isArray(p.pairs)?p.pairs:[];if(raw.length!==0&&raw.length!==4)throw Error('Save all four matched landmarks, or leave ground alignment empty.');
 const pairs=raw.map(r=>{const a=obj(r);if(!Array.isArray(a.image)||!Array.isArray(a.map)||a.image.length!==2||a.map.length!==2||!a.image.every(x=>finite(x)&&x>=0&&x<=1)||!a.map.every(finite)||Math.abs(a.map[0])>180||Math.abs(a.map[1])>85)throw Error('Invalid landmark coordinates.');return {image:a.image as [number,number],map:a.map as [number,number]};});
 if(pairs.length)align(pairs);return {lng:p.lng,lat:p.lat,heading:p.heading,pairs};
}
export function updateNode(id:string,input:unknown){if(!safeID(id))throw Error('Invalid node ID.');const p=obj(input),name=typeof p.name==='string'?p.name.trim().slice(0,60):null;if(!name)throw Error('Give the camera a name.');const placement=validatePlacement(p.placement);db().prepare('UPDATE nodes SET name=?,placement=? WHERE id=?').run(name,placement?JSON.stringify(placement):null,id);return overview();}
export function controlNode(id:string,input:unknown){const p=obj(input),config:Record<string,unknown>={};if(p.camera_mode!==undefined){if(p.camera_mode!=='crosswalk'&&p.camera_mode!=='bus_stop')throw Error('Unknown camera mode.');config.camera_mode=p.camera_mode as Mode;}if(p.auto_led!==undefined){if(typeof p.auto_led!=='boolean')throw Error('Automatic lights needs true or false.');config.auto_led=p.auto_led;}if(!Object.keys(config).length)throw Error('Choose a mode or light setting.');if(!db().prepare('SELECT id FROM nodes WHERE id=?').get(id))throw Error('Unknown node.');const commandID=randomUUID();db().prepare('INSERT INTO commands VALUES(?,?,?,?,?,?)').run(commandID,id,JSON.stringify(config),'pending',null,Date.now());return {ok:true,command_id:commandID};}
export function overview():Overview{
 const d=db(),now=Date.now();const nodes=d.prepare('SELECT * FROM nodes ORDER BY id').all().map(r=>{const t=parse<Telemetry|null>(r.telemetry,null),placement=parse<Placement|null>(r.placement,null),online=typeof r.last_seen==='number'&&now-r.last_seen<8000,fresh=online&&!!t&&t.source_kind==='live'&&now-t.capture_ts*1000>=-250&&now-t.capture_ts*1000<2500;let mapped:NodeRecord['mapped']=[],error:string|undefined;
 try{if(fresh&&t)mapped=mapTracks(t.vision.tracks,placement);}catch(e){error=e instanceof Error?e.message:'Ground alignment unavailable';}
 return {id:r.id as string,name:r.name as string,placement,telemetry:t,last_seen:r.last_seen as number|null,online,fresh,tallies:parse<Record<string,number>>(r.tallies,{}),mapped,mapping_error:error,commands:d.prepare('SELECT id,config,status,error,created_at FROM commands WHERE node_id=? ORDER BY created_at DESC LIMIT 5').all(r.id as string).map(c=>({...c,config:parse(c.config,{})}))} as NodeRecord;});
 const events=d.prepare('SELECT * FROM events ORDER BY at DESC LIMIT 80').all().map(r=>({...r,data:parse(r.data,{})})) as unknown as EventRecord[];
 const history=d.prepare('SELECT bucket as at,node_id,people,vehicles,fps,occupied FROM history WHERE bucket>? ORDER BY bucket').all(now-86400000) as unknown as Overview['history'];return {nodes,events,history,server_time:now};
}
export function preview(id:string){if(!safeID(id))return null;const p=join(dataRoot,'previews',id+'.jpg');return existsSync(p)?readFileSync(p):null;}
