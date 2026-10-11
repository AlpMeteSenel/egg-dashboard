'use client';
import {useEffect,useState} from 'react';
import {Check,ChevronDown,Plus,Settings2,X} from 'lucide-react';
import type {NodeRecord} from '@/lib/types';
type Preset={mode:number;brightness:number;for_s:number};
type RuleDraft={name:string;metric:string;op:string;value:number;led:string;on_s:number;off_s:number;priority:number;raw:string|null};
type CfgDoc={fps:number;quality:number;size:string;zones:unknown[];led:{presets:Record<string,Preset>;fallback:string;cooldown_s:number;traffic?:Traffic;rules:RuleDraft[]}};
type Traffic={enabled:boolean;green_s:number;yellow_s:number;red_s:number;extend_max_s:number};
const DEFAULT_TRAFFIC:Traffic={enabled:false,green_s:12,yellow_s:3,red_s:10,extend_max_s:15};
const phaseOf=(node?:NodeRecord)=>{const t=node?.telemetry?.vision?.traffic;if(t&&t.some(v=>v>0))return t[0]>0?'red':t[1]>0?'yellow':t[2]>0?'green':null;if(t)return 'off';const c=node?.telemetry?.vision?.led_command;if(!c)return null;const a=c.args[0] as unknown;if(c.method==='set_led'&&Array.isArray(a)){const[r,g,b]=a as number[];if(r>200&&g<60)return 'red';if(r>200&&g>120)return 'yellow';if(g>200)return 'green';if(!r&&!g&&!b)return 'off';}return null;};
const MODES:[number,string][]=[[1,'Rainbow ambient'],[2,'Breathing'],[3,'Scanning light'],[6,'Lights off'],[7,'Solid red'],[8,'Solid green'],[9,'Solid blue'],[11,'Crossing warning'],[12,'Red alert sweep'],[13,'Hazard flash'],[14,'Siren'],[15,'Crossing wave'],[16,'Flow left'],[17,'Flow right'],[18,'Comet trail'],[19,'Theatre chase'],[20,'Heartbeat'],[21,'Bus-stop beacon']];
const METRICS:{id:string;label:string;kind:'always'|'bool'|'num';value:number}[]=[
 {id:'true',label:'Always (idle state)',kind:'always',value:0},
 {id:'crossing_active',label:'A person is in the crossing',kind:'bool',value:1},
 {id:'zone_occ',label:'People inside the crossing zone',kind:'num',value:4},
 {id:'ped_count',label:'Pedestrians in view',kind:'num',value:3},
 {id:'veh_count',label:'Vehicles in view',kind:'num',value:3},
 {id:'time_night',label:'It is nighttime',kind:'bool',value:1},
 {id:'fps',label:'Camera frame rate',kind:'num',value:1},
 {id:'rssi',label:'Wi-Fi signal strength',kind:'num',value:-70}];
const OPS=['>','>=','<','<=','=='];
const whenFrom=(r:RuleDraft)=>{const m=METRICS.find(x=>x.id===r.metric);if(m?.kind==='always')return 'true';if(m?.kind==='bool')return r.metric+' == '+(r.value?1:0);return (r.metric==='zone_occ'?"zone('crossing').occupancy":r.metric)+' '+r.op+' '+r.value;};
function ruleFrom(when:string,led:string,name:string,rest:{on_s:number;off_s:number;priority:number}):RuleDraft{
 const base={name,led,on_s:rest.on_s,off_s:rest.off_s,priority:rest.priority,raw:null as string|null};
 if(when.trim()==='true')return {...base,metric:'true',op:'',value:0};
 let m=/^(\w+) == ([01])$/.exec(when.trim());
 if(m&&['crossing_active','time_night','stale'].includes(m[1]))return {...base,metric:m[1],op:'==',value:Number(m[2])};
 m=/^zone\('crossing'\)\.occupancy ([<>=]+) ([\d.-]+)$/.exec(when.trim());
 if(m)return {...base,metric:'zone_occ',op:m[1],value:Number(m[2])};
 m=/^(\w+) ([<>=]+) ([\d.-]+)$/.exec(when.trim());
 if(m&&METRICS.some(x=>x.id===m![1]&&x.kind==='num'))return {...base,metric:m[1],op:m[2],value:Number(m[3])};
 return {...base,raw:when,metric:'true',op:'',value:0};}
const starterRules=()=>[{name:'Person in the crossing',metric:'crossing_active',op:'==',value:1,led:'warning',on_s:0,off_s:5,priority:9,raw:null},{name:'Crowd at the crossing',metric:'zone_occ',op:'>',value:8,led:'hazard',on_s:8,off_s:20,priority:7,raw:null},{name:'Calm idle',metric:'true',op:'',value:0,led:'calm',on_s:0,off_s:0,priority:0,raw:null}] as RuleDraft[];
const starterCfg=()=>({fps:0,quality:60,size:'vga',zones:[],led:{presets:{warning:{mode:12,brightness:90,for_s:8},hazard:{mode:13,brightness:80,for_s:10},calm:{mode:21,brightness:18,for_s:0}},fallback:'calm',traffic:{...DEFAULT_TRAFFIC},cooldown_s:10,rules:starterRules()}});
export default function CameraSettings({node,onNotice,onError}:{node?:NodeRecord;onNotice:(m:string)=>void;onError:(m:string)=>void}){
 const [open,setOpen]=useState(false),[cfg,setCfg]=useState<CfgDoc|null>(null),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[newName,setNewName]=useState('');
 useEffect(()=>{setCfg(null);setLoaded(false);setOpen(false);if(!node)return;let stop=false;
  fetch('/api/nodes/'+node.id+'/config',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(stop)return;
   if(d&&d.cfg){const c=d.cfg;const led=c.led;
    setCfg({fps:c.fps,quality:c.quality,size:c.size,zones:c.zones||[],led:{presets:led.presets,fallback:led.fallback,cooldown_s:led.cooldown_s,traffic:led.traffic,rules:(led.rules||[]).map((r:RuleDraft&{when:string})=>ruleFrom(r.when,r.led,r.name,{on_s:r.on_s,off_s:r.off_s,priority:r.priority}))}});}
   setLoaded(true);}).catch(()=>{if(!stop)setLoaded(true);});
  return()=>{stop=true;};},[node?.id]);
 if(!node)return null;
 const openPanel=()=>{if(!open&&!cfg)setCfg(starterCfg());setOpen(!open);};
 const set=(patch:Partial<CfgDoc>)=>setCfg(c=>c?{...c,...patch}:c);
 const setLed=(patch:Partial<CfgDoc['led']>)=>setCfg(c=>c?{...c,led:{...c.led,...patch}}:c);
 const setPreset=(n:string,patch:Partial<Preset>)=>setLed({presets:Object.fromEntries(Object.entries(cfg!.led.presets).map(([k,v])=>[k,k===n?{...v,...patch}:v]))});
 const removePreset=(n:string)=>{const presets={...cfg!.led.presets};delete presets[n];setLed({presets,rules:cfg!.led.rules.filter(r=>r.led!==n)});};
 const setRule=(i:number,patch:Partial<RuleDraft>)=>setLed({rules:cfg!.led.rules.map((r,j)=>j===i?{...r,...patch}:r)});
 const save=async()=>{if(!cfg)return;setBusy(true);
  const payload={fps:cfg.fps,quality:cfg.quality,size:cfg.size,zones:cfg.zones,led:{presets:cfg.led.presets,fallback:cfg.led.fallback,cooldown_s:cfg.led.cooldown_s,traffic:cfg.led.traffic??DEFAULT_TRAFFIC,rules:cfg.led.rules.map(r=>({name:r.name,when:r.raw??whenFrom(r),led:r.led,on_s:r.on_s,off_s:r.off_s,priority:r.priority}))}};
  try{const r=await fetch('/api/nodes/'+node.id+'/config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({cfg:payload})});const d=await r.json();if(!r.ok)throw Error(d.error);onNotice('Settings sent to '+node.name+'. The camera confirms within a minute.');}
  catch(e){onError(e instanceof Error?e.message:'Could not save camera settings');}finally{setBusy(false);}};
 const summary=cfg?'stream '+(cfg.fps?cfg.fps+' fps':'as fast as possible')+' · '+cfg.size.toUpperCase()+' · '+cfg.led.rules.length+' lighting rules':'stream + lighting rules';
 return <div className="camera-settings">
  <button className="settings-toggle" onClick={openPanel} aria-expanded={open}><Settings2 size={16}/><span><strong>Camera settings</strong><small>{summary}</small></span><ChevronDown size={16}/></button>
  {open&&cfg&&<div className="settings-body">
   <span className="eyebrow">STREAM · THE CAMERA APPLIES CHANGES IN ~30 S</span>
   <div className="cfg-grid">
    <label>Frame rate<select value={cfg.fps} onChange={e=>set({fps:Number(e.target.value)})}><option value={0}>As fast as possible</option>{Array.from({length:15},(_,i)=>i+1).map(f=><option key={f} value={f}>{f} per second</option>)}</select></label>
    <label>Resolution<select value={cfg.size} onChange={e=>set({size:e.target.value})}><option value="vga">VGA · full view</option><option value="qvga">QVGA · faster frames</option></select></label>
   </div>
   <label className="cfg-range">JPEG quality <output>{cfg.quality}%</output><input type="range" min={5} max={95} value={cfg.quality} onChange={e=>set({quality:Number(e.target.value)})}/></label>
   <span className="eyebrow">LIGHT PRESETS</span>
   {Object.entries(cfg.led.presets).map(([n,p])=><div className="cfg-row" key={n}>
    <strong className="preset-name">{n}</strong>
    <select aria-label={'Effect for '+n} value={p.mode} onChange={e=>setPreset(n,{mode:Number(e.target.value)})}>{MODES.map(([m,l])=><option key={m} value={m}>{l}</option>)}</select>
    <label className="cfg-level">Level<input type="range" min={0} max={100} value={p.brightness} onChange={e=>setPreset(n,{brightness:Number(e.target.value)})}/><output>{p.brightness}%</output></label>
    <label className="cfg-mini">Hold s<input type="number" min={0} max={600} value={p.for_s} onChange={e=>setPreset(n,{for_s:Number(e.target.value)})}/></label>
    <button className="cfg-del" aria-label={'Remove preset '+n} disabled={cfg.led.fallback===n||cfg.led.rules.some(r=>r.led===n)} onClick={()=>removePreset(n)}><X size={14}/></button>
   </div>)}
   <div className="cfg-add"><input placeholder="new preset name" value={newName} onChange={e=>setNewName(e.target.value)}/><button className="quiet" disabled={!/^[a-z0-9-]{2,20}$/.test(newName)||!!cfg.led.presets[newName]} onClick={()=>{setLed({presets:{...cfg.led.presets,[newName]:{mode:11,brightness:70,for_s:5}}});setNewName('');}}><Plus size={14}/>Add preset</button></div>
   <span className="eyebrow">LIGHTING RULES · CHECKED EVERY SECOND, HIGHEST PRIORITY WINS</span>
   {cfg.led.rules.map((r,i)=>{const m=METRICS.find(x=>x.id===(r.raw?'':r.metric));return <div className="cfg-row cfg-rule" key={i}>
    {r.raw?<code className="cfg-raw">{r.raw}</code>:<>
     <select aria-label="Condition" value={r.metric} onChange={e=>{const nm=METRICS.find(x=>x.id===e.target.value)!;setRule(i,{metric:nm.id,op:nm.kind==='num'?'':'',value:nm.value});}}>{METRICS.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select>
     {m?.kind==='num'&&<select aria-label="Comparison" value={r.op} onChange={e=>setRule(i,{op:e.target.value})}>{OPS.map(o=><option key={o} value={o}>{o}</option>)}</select>}
     {m?.kind==='num'&&<input className="cfg-val" type="number" aria-label="Value" value={r.value} onChange={e=>setRule(i,{value:Number(e.target.value)})}/>}
     {m?.kind==='bool'&&<select aria-label="State" value={r.value} onChange={e=>setRule(i,{value:Number(e.target.value)})}><option value={1}>yes</option><option value={0}>no</option></select>}
     <span className="cfg-arrow">→</span>
     <select aria-label="Preset" value={r.led} onChange={e=>setRule(i,{led:e.target.value})}>{Object.keys(cfg.led.presets).map(n=><option key={n} value={n}>{n}</option>)}</select></>}
    <label className="cfg-mini">arm s<input type="number" min={0} max={300} value={r.on_s} onChange={e=>setRule(i,{on_s:Number(e.target.value)})}/></label>
    <label className="cfg-mini">release s<input type="number" min={0} max={300} value={r.off_s} onChange={e=>setRule(i,{off_s:Number(e.target.value)})}/></label>
    <label className="cfg-mini">prio<input type="number" min={-10} max={20} value={r.priority} onChange={e=>setRule(i,{priority:Number(e.target.value)})}/></label>
    <button className="cfg-del" aria-label="Remove rule" onClick={()=>setLed({rules:cfg.led.rules.filter((_,j)=>j!==i)})}><X size={14}/></button>
   </div>;})}
   <div className="cfg-add"><button className="quiet" disabled={!cfg.led.rules.length||cfg.led.rules.length>=12} onClick={()=>setLed({rules:[...cfg.led.rules,{name:'new rule',metric:'ped_count',op:'>',value:3,led:Object.keys(cfg.led.presets)[0]||cfg.led.fallback,on_s:5,off_s:10,priority:5,raw:null}]})}><Plus size={14}/>Add rule</button></div>
   <div className="cfg-grid">
    <label>When nothing is triggered<select aria-label="Fallback preset" value={cfg.led.fallback} onChange={e=>setLed({fallback:e.target.value})}>{Object.keys(cfg.led.presets).map(n=><option key={n} value={n}>{n}</option>)}</select></label>
    <label>Re-arm cooldown s<input type="number" min={0} max={300} value={cfg.led.cooldown_s} onChange={e=>setLed({cooldown_s:Number(e.target.value)})}/></label>
   </div>
   {(()=>{const t=cfg.led.traffic??DEFAULT_TRAFFIC,setT=(patch:Partial<Traffic>)=>setLed({traffic:{...t,...patch}}),phase=phaseOf(node);return <>
    <span className="eyebrow">TRAFFIC LIGHT · RED → GREEN → YELLOW CYCLE</span>
    <div className="cfg-row">
     <label className="cfg-check"><input type="checkbox" checked={t.enabled} onChange={e=>setT({enabled:e.target.checked})}/>Signal on</label>
     <label className="cfg-mini">green s<input type="number" min={1} max={120} value={t.green_s} onChange={e=>setT({green_s:Number(e.target.value)})}/></label>
     <label className="cfg-mini">yellow s<input type="number" min={1} max={30} value={t.yellow_s} onChange={e=>setT({yellow_s:Number(e.target.value)})}/></label>
     <label className="cfg-mini">red s<input type="number" min={1} max={120} value={t.red_s} onChange={e=>setT({red_s:Number(e.target.value)})}/></label>
     <label className="cfg-mini">max extend s<input type="number" min={0} max={60} value={t.extend_max_s} onChange={e=>setT({extend_max_s:Number(e.target.value)})}/></label>
     {t.enabled&&phase&&<span className={'pill '+(phase==='green'?'live':phase==='red'?'warning':'neutral')}>{phase}</span>}
    </div>
    <p className="cfg-help">Green stretches while someone is in the crossing, up to the extend cap. Red shortens toward one second when the street is clear. Yellow never changes — safety. Turning the signal on takes over the camera's light; turning it off restores the automatic crossing lights.</p>
   </>;})()}
   <p className="cfg-help">Arm s is how long a condition must hold before the light reacts — 0 reacts instantly, use it for safety rules. Release s keeps the light on briefly after the condition stops, so detection noise never makes the lights flicker.</p>
   <button className="primary full" disabled={busy} onClick={save}><Check size={16}/>{busy?'Sending…':'Send settings to camera'}</button>
   <button className="quiet full" disabled={busy} onClick={()=>setCfg(starterCfg())}>Reset to sensible defaults</button>
   {node.id!=='esp32cam-1'&&<p className="cfg-help">This node applies stream settings on its next boot. Lighting rules run on the dashboard&apos;s side for it.</p>}
  </div>}
  {open&&loaded&&!cfg&&<p className="cfg-help">Settings will appear after the camera checks in.</p>}
 </div>;}
