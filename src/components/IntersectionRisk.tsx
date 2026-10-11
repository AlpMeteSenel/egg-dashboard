'use client';
import {useRef} from 'react';import type {NodeRecord} from '@/lib/types';
import {activityRisk,riskSample,type RiskSample} from '@/lib/risk';
export default function IntersectionRisk({node,now,manualScore=null}:{node?:NodeRecord;now:number;manualScore?:number|null}){
 const buffer=useRef<{id:string;samples:RiskSample[]}>({id:'',samples:[]});if(buffer.current.id!==node?.id)buffer.current={id:node?.id||'',samples:[]};
 const sample=node?riskSample(node,now):null;buffer.current.samples=buffer.current.samples.filter(s=>now-s.at<=2500);if(sample&&!buffer.current.samples.some(s=>s.at===sample.at))buffer.current.samples.push(sample);
 const risk=node?.fresh?activityRisk(buffer.current.samples,now):null;
 const manual=manualScore!==null&&Number.isInteger(manualScore)&&manualScore>=0&&manualScore<=100,score=manual?manualScore:risk?.score,level=score===undefined?'Unknown':score>=55?'Elevated':score>=25?'Moderate':'Low';
 return <section className={'intersection-risk '+level.toLowerCase()} aria-label="Intersection activity risk"><div className="risk-heading"><div><span className="eyebrow">INTERSECTION ACTIVITY RISK</span><small>Via Vela × Via Bricherasio · UNO Q</small></div><strong>{score??'—'}<small>/100</small></strong></div><div className="risk-meter"><i style={{width:(score||0)+'%'}}/></div><div className="risk-details"><b>{score===undefined?'Waiting for fresh observations':level}{manual&&<span className="manual-risk-badge">Manual</span>}</b><span>{risk?risk.people+' people · '+risk.vehicles+' vehicles':'Camera data unavailable'}</span></div><p>{manual?'Manual scenario score · camera observations shown separately':'Prototype activity score · brief detection gaps held for 2 seconds'}</p>{risk&&<details><summary>{manual?'Automatic estimate: '+risk.score+'/100':'What affects this score?'}</summary>{risk.factors.map(f=><div className="risk-factor" key={f.label}><span>{f.label}</span><b>+{Math.round(f.value)}</b></div>)}</details>}</section>;
}
