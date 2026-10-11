'use client';
import {useEffect,useState} from 'react';
import {Check,ChevronDown,Plus,Settings2,X} from 'lucide-react';
import type {NodeRecord} from '@/lib/types';
type Preset={mode:number;brightness:number;for_s:number};
type RuleDraft={name:string;metric:string;op:string;value:number;led:string;on_s:number;off_s:number;priority:number;raw:string|null};
type Cycle={enabled:boolean;green_s:number;yellow_s:number;red_s:number;extend_max_s:number;shorten_red:boolean};
type SignalDoc={fallback:string;strip:boolean;cooldown_s:number;cycle:Cycle;rules:RuleDraft[]};
type CfgDoc={fps:number;quality:number;size:string;zones:unknown[];led:{presets:Record<string,Preset>;fallback:string;cooldown_s:number;rules:RuleDraft[]};signal:SignalDoc};
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
const COLORS=['red','yellow','green'];
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
const starterCfg=()=>({fps:0,quality:60,size:'vga',zones:[],led:{presets:{warning:{mode:12,brightness:90,for_s:8},hazard:{mode:13,brightness:80,for_s:10},calm:{mode:21,brightness:18,for_s:0}},fallback:'calm',cooldown_s:10,rules:starterRules()},signal:{fallback:'red',strip:false,cooldown_s:10,cycle:{enabled:false,green_s:12,yellow_s:3,red_s:10,extend_max_s:15,shorten_red:true},rules:[{name:'Walk on green',metric:'crossing_active',op:'==',value:1,led:'green',on_s:0,off_s:3,priority:9,raw:null}]}});
const phaseOf=(node?:NodeRecord)=>{const t=node?.telemetry?.vision?.traffic;if(t&&t.some(v=>v>0))return t[0]>0?'red':t[1]>0?'yellow':t[2]>0?'green':null;return null;};
export default function CameraSettings({node,onNotice,onError}:{node?:NodeRecord;onNotice:(m:string)=>void;onError:(m:string)=>void}){
 const [open,setOpen]=useState(false),[cfg,setCfg]=useState<CfgDoc|null>(null),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[newName,setNewName]=useState('');
 useEffect(()=>{setCfg(null);setLoaded(false);setOpen(false);if(!node)return;let stop=false;
  fetch('/api/nodes/'+node.id+'/config',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(stop)return;
   if(d&&d.cfg){const c=d.cfg,led=c.led,sig=c.signal;
    setCfg({fps:c.fps,quality:c.quality,size:c.size,zones:c.zones||[],
     led:{presets:led.presets,fallback:led.fallback,cooldown_s:led.cooldown_s,rules:(led.rules||[]).map((r:RuleDraft&{when:string})=>ruleFrom(r.when,r.led,r.name,{on_s:r.on_s,off_s:r.off_s,priority:r.priority}))},
     signal:sig?{fallback:sig.fallback,strip:!!sig.strip,cooldown_s:sig.cooldown_s,cycle:sig.cycle??{enabled:false,green_s:12,yellow_s:3,red_s:10,extend_max_s:15},rules:(sig.rules||[]).map((r:RuleDraft&{when:string})=>ruleFrom(r.when,r.led,r.name,{on_s:r.on_s,off_s:r.off_s,priority:r.priority}))}:starterCfg().signal});}
   setLoaded(true);}).catch(()=>{if(!stop)setLoaded(true);});
  return()=>{stop=true;};},[node?.id]);
 if(!node)return null;
 const openPanel=()=>{if(!open&&!cfg)setCfg(starterCfg());setOpen(!open);};
 const set=(patch:Partial<CfgDoc>)=>setCfg(c=>c?{...c,...patch}:c);
 const setLed=(patch:Partial<CfgDoc['led']>)=>setCfg(c=>c?{...c,led:{...c.led,...patch}}:c);
 const setSig=(patch:Partial<SignalDoc>)=>setCfg(c=>c?{...c,signal:{...c.signal,...patch}}:c);
 const setPreset=(n:string,patch:Partial<Preset>)=>setLed({presets:Object.fromEntries(Object.entries(cfg!.led.presets).map(([k,v])=>[k,k===n?{...v,...patch}:v]))});
 const removePreset=(n:string)=>{const presets={...cfg!.led.presets};delete presets[n];setLed({presets,rules:cfg!.led.rules.filter(r=>r.led!==n)});};
 const setRule=(i:number,patch:Partial<RuleDraft>)=>setLed({rules:cfg!.led.rules.map((r,j)=>j===i?{...r,...patch}:r)});
 const setSigRule=(i:number,patch:Partial<RuleDraft>)=>setSig({rules:cfg!.signal.rules.map((r,j)=>j===i?{...r,...patch}:r)});
 const save=async()=>{if(!cfg)return;setBusy(true);
  const rules=(list:RuleDraft[])=>list.map(r=>({name:r.name,when:r.raw??whenFrom(r),led:r.led,on_s:r.on_s,off_s:r.off_s,priority:r.priority}));
  const payload={fps:cfg.fps,quality:cfg.quality,size:cfg.size,zones:cfg.zones,signal:{fallback:cfg.signal.fallback,strip:cfg.signal.strip,cooldown_s:cfg.signal.cooldown_s,cycle:cfg.signal.cycle,rules:rules(cfg.signal.rules)},led:{presets:cfg.led.presets,fallback:cfg.led.fallback,cooldown_s:cfg.led.cooldown_s,rules:rules(cfg.led.rules)}};
  try{const r=await fetch('/api/nodes/'+node.id+'/config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({cfg:payload})});const d=await r.json();if(!r.ok)throw Error(d.error);onNotice('Settings sent to '+node.name+'. The camera confirms within a minute.');}
  catch(e){onError(e instanceof Error?e.message:'Could not save camera settings');}finally{setBusy(false);}};
 const summary=cfg?'stream '+(cfg.fps?cfg.fps+' fps':'as fast as possible')+' · '+cfg.size.toUpperCase()+' · '+cfg.led.rules.length+' strip rules':'stream + lighting rules';
 const phase=phaseOf(node);
 return <div className="camera-settings">
  <button className="settings-toggle" onClick={openPanel} aria-expanded={open}><Settings2 size={16}/><span><strong>Camera settings</strong><small>{summary}</small></span><ChevronDown size={16}/></button>
  {open&&cfg&&<div className="settings-body">
   <span className="eyebrow">STREAM · THE CAMERA APPLIES CHANGES IN ~30 S</span>
   <div className="cfg-grid">
    <label>Frame rate<select value={cfg.fps} onChange={e=>set({fps:Number(e.target.value)})}><option value={0}>As fast as possible</option>{Array.from({length:15},(_,i)=>i+1).map(f=><option key={f} value={f}>{f} per second</option>)}</select></label>
    <label>Resolution<select value={cfg.size} onChange={e=>set({size:e.target.value})}><option value="vga">VGA · full view</option><option value="qvga">QVGA · faster frames</option></select></label>
   </div>
   <label className="cfg-range">JPEG quality <output>{cfg.quality}%</output><input type="range" min={5} max={95} value={cfg.quality} onChange={e=>set({quality:Number(e.target.value)})}/></label>
   <span className="eyebrow">STRIP PRESETS</span>
   {Object.entries(cfg.led.presets).map(([n,p])=><div className="cfg-row" key={n}>
    <strong className="preset-name">{n}</strong>
    <select aria-label={'Effect for '+n} value={p.mode} onChange={e=>setPreset(n,{mode:Number(e.target.value)})}>{MODES.map(([m,l])=><option key={m} value={m}>{l}</option>)}</select>
    <label className="cfg-level">Level<input type="range" min={0} max={100} value={p.brightness} onChange={e=>setPreset(n,{brightness:Number(e.target.value)})}/><output>{p.brightness}%</output></label>
    <label className="cfg-mini">Hold s<input type="number" min={0} max={600} value={p.for_s} onChange={e=>setPreset(n,{for_s:Number(e.target.value)})}/></label>
    <button className="cfg-del" aria-label={'Remove preset '+n} disabled={cfg.led.fallback===n||cfg.led.rules.some(r=>r.led===n)} onClick={()=>removePreset(n)}><X size={14}/></button>
   </div>)}
   <div className="cfg-add"><input placeholder="new preset name" value={newName} onChange={e=>setNewName(e.target.value)}/><button className="quiet" disabled={!/^[a-z0-9-]{2,20}$/.test(newName)||!!cfg.led.presets[newName]} onClick={()=>{setLed({presets:{...cfg.led.presets,[newName]:{mode:11,brightness:70,for_s:5}}});setNewName('');}}><Plus size={14}/>Add preset</button></div>
   <span className="eyebrow">STRIP RULES · CHECKED EVERY SECOND, HIGHEST PRIORITY WINS</span>
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
    <label>Strip light when nothing is triggered<select aria-label="Fallback preset" value={cfg.led.fallback} onChange={e=>setLed({fallback:e.target.value})}>{Object.keys(cfg.led.presets).map(n=><option key={n} value={n}>{n}</option>)}</select></label>
    <label>Re-arm cooldown s<input type="number" min={0} max={300} value={cfg.led.cooldown_s} onChange={e=>setLed({cooldown_s:Number(e.target.value)})}/></label>
   </div>
   <p className="cfg-help">Arm s is how long a condition must hold before the light reacts — 0 reacts instantly, use it for safety rules. Release s keeps the light on briefly after the condition stops, so detection noise never makes the lights flicker.</p>
   <span className="eyebrow">TRAFFIC SIGNAL · THE THREE LEDS ON PINS 8 · 9 · 10{phase?` · NOW ${phase}`:''}</span>
   <div className="cfg-row">
    <label>Idle color<select aria-label="Idle signal color" value={cfg.signal.fallback} onChange={e=>setSig({fallback:e.target.value})}>{COLORS.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
    <label className="cfg-check"><input type="checkbox" checked={cfg.signal.cycle.enabled} onChange={e=>setSig({cycle:{...cfg.signal.cycle,enabled:e.target.checked}})}/>Timed cycle</label>
    <label className="cfg-mini">green s<input type="number" min={1} max={600} value={cfg.signal.cycle.green_s} onChange={e=>setSig({cycle:{...cfg.signal.cycle,green_s:Number(e.target.value)}})}/></label>
    <label className="cfg-mini">yellow s<input type="number" min={1} max={30} value={cfg.signal.cycle.yellow_s} onChange={e=>setSig({cycle:{...cfg.signal.cycle,yellow_s:Number(e.target.value)}})}/></label>
    <label className="cfg-mini">red s<input type="number" min={1} max={600} value={cfg.signal.cycle.red_s} onChange={e=>setSig({cycle:{...cfg.signal.cycle,red_s:Number(e.target.value)}})}/></label>
    <label className="cfg-mini">max extend s<input type="number" min={0} max={60} value={cfg.signal.cycle.extend_max_s} onChange={e=>setSig({cycle:{...cfg.signal.cycle,extend_max_s:Number(e.target.value)}})}/></label>
    <label className="cfg-check"><input type="checkbox" checked={cfg.signal.strip} onChange={e=>setSig({strip:e.target.checked})}/>Strip as signal (thirds red/yellow/green)</label>
    <label className="cfg-check"><input type="checkbox" checked={cfg.signal.cycle.shorten_red} onChange={e=>setSig({cycle:{...cfg.signal.cycle,shorten_red:e.target.checked}})}/>Shorten red when clear</label>
   </div>
   <span className="eyebrow">SIGNAL RULES · OVERRIDE THE CYCLE AND THE IDLE COLOR</span>
   {cfg.signal.rules.map((r,i)=>{const m=METRICS.find(x=>x.id===(r.raw?'':r.metric));return <div className="cfg-row cfg-rule" key={i}>
    {r.raw?<code className="cfg-raw">{r.raw}</code>:<>
     <select aria-label="Condition" value={r.metric} onChange={e=>{const nm=METRICS.find(x=>x.id===e.target.value)!;setSigRule(i,{metric:nm.id,op:nm.kind==='num'?'':'',value:nm.value});}}>{METRICS.filter(x=>x.kind!=='always').map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select>
     {m?.kind==='num'&&<select aria-label="Comparison" value={r.op} onChange={e=>setSigRule(i,{op:e.target.value})}>{OPS.map(o=><option key={o} value={o}>{o}</option>)}</select>}
     {m?.kind==='num'&&<input className="cfg-val" type="number" aria-label="Value" value={r.value} onChange={e=>setSigRule(i,{value:Number(e.target.value)})}/>}
     {m?.kind==='bool'&&<select aria-label="State" value={r.value} onChange={e=>setSigRule(i,{value:Number(e.target.value)})}><option value={1}>yes</option><option value={0}>no</option></select>}
     <span className="cfg-arrow">→</span>
     <select aria-label="Signal color" value={r.led} onChange={e=>setSigRule(i,{led:e.target.value})}>{COLORS.map(c=><option key={c} value={c}>{c}</option>)}</select></>}
    <label className="cfg-mini">arm s<input type="number" min={0} max={300} value={r.on_s} onChange={e=>setSigRule(i,{on_s:Number(e.target.value)})}/></label>
    <label className="cfg-mini">release s<input type="number" min={0} max={300} value={r.off_s} onChange={e=>setSigRule(i,{off_s:Number(e.target.value)})}/></label>
    <label className="cfg-mini">prio<input type="number" min={-10} max={20} value={r.priority} onChange={e=>setSigRule(i,{priority:Number(e.target.value)})}/></label>
    <button className="cfg-del" aria-label="Remove signal rule" onClick={()=>setSig({rules:cfg.signal.rules.filter((_,j)=>j!==i)})}><X size={14}/></button>
   </div>;})}
   <div className="cfg-add"><button className="quiet" disabled={cfg.signal.rules.length>=12} onClick={()=>setSig({rules:[...cfg.signal.rules,{name:'new signal rule',metric:'crossing_active',op:'==',value:1,led:'green',on_s:0,off_s:3,priority:9,raw:null}]})}><Plus size={14}/>Add signal rule</button></div>
   <p className="cfg-help">Signal rules check every second and beat the timed cycle; the idle color shows when no rule fires. The timed cycle stretches green while someone is in the crossing (up to the extend cap) and shortens red when the street is clear. The strip system above is fully independent.</p>
   <button className="primary full" disabled={busy} onClick={save}><Check size={16}/>{busy?'Sending…':'Send settings to camera'}</button>
   <button className="quiet full" disabled={busy} onClick={()=>setCfg(starterCfg())}>Reset to sensible defaults</button>
   {node.id!=='esp32cam-1'&&<p className="cfg-help">This node applies stream settings on its next boot. Lighting rules run on the camera's side for it.</p>}
  </div>}
  {open&&loaded&&!cfg&&<p className="cfg-help">Settings will appear after the camera checks in.</p>}
 </div>;}
