'use client';
import {useRef} from 'react';import type {NodeRecord} from '@/lib/types';
import {activityRisk,riskSample,type RiskSample} from '@/lib/risk';
export default function IntersectionRisk({node,now}:{node?:NodeRecord;now:number}){
 const buffer=useRef<{id:string;samples:RiskSample[]}>({id:'',samples:[]});if(buffer.current.id!==node?.id)buffer.current={id:node?.id||'',samples:[]};
 const sample=node?riskSample(node,now):null;buffer.current.samples=buffer.current.samples.filter(s=>now-s.at<=2500);if(sample&&!buffer.current.samples.some(s=>s.at===sample.at))buffer.current.samples.push(sample);
 const risk=node?.fresh?activityRisk(buffer.current.samples,now):null;
 return <section className={'intersection-risk '+(risk?.level.toLowerCase()||'unknown')} aria-label="Intersection activity risk"><div className="risk-heading"><div><span className="eyebrow">INTERSECTION ACTIVITY RISK</span><small>Via Vela × Via Bricherasio · UNO Q</small></div><strong>{risk?risk.score:'—'}<small>/100</small></strong></div><div className="risk-meter"><i style={{width:(risk?.score||0)+'%'}}/></div><div className="risk-details"><b>{risk?.level||'Waiting for fresh observations'}</b><span>{risk?risk.people+' people · '+risk.vehicles+' vehicles':'Camera data unavailable'}</span></div><p>Prototype activity score · brief detection gaps held for 2 seconds</p>{risk&&<details><summary>What affects this score?</summary>{risk.factors.map(f=><div className="risk-factor" key={f.label}><span>{f.label}</span><b>+{Math.round(f.value)}</b></div>)}</details>}</section>;
}
