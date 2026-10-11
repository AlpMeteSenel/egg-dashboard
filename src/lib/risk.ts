import type {NodeRecord} from './types';
export type RiskSample={at:number;people:number;vehicles:number;crossing:boolean;speed:number|null};
export function riskSample(node:NodeRecord,now:number):RiskSample|null{
 const t=node.telemetry;if(!node.fresh||!t||now-t.capture_ts*1000>2500)return null;
 const tracks=t.vision.tracks.filter(t=>t.confirmed&&!t.retained&&t.conf>=.3),vehicles=tracks.filter(t=>['car','bus','truck','motorcycle'].includes(t.cls));
 const speeds=vehicles.map(t=>t.speed_kmh).filter((n):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<200);
 return {at:t.capture_ts*1000,people:tracks.filter(t=>t.cls==='person').length,vehicles:vehicles.length,crossing:t.vision.occupied,speed:speeds.length?Math.max(...speeds):null};
}
export function activityRisk(samples:RiskSample[],now:number){
 const recent=samples.filter(s=>now-s.at>=-250&&now-s.at<=2500);if(!recent.length)return null;
 const people=Math.max(...recent.map(s=>s.people)),vehicles=Math.max(...recent.map(s=>s.vehicles)),crossing=recent.some(s=>s.crossing),speeds=recent.flatMap(s=>s.speed===null?[]:[s.speed]),speed=speeds.length?Math.max(...speeds):null;
 const factors=[{label:'Pedestrian activity',value:Math.min(18,people*3)},{label:'Vehicle activity',value:Math.min(24,vehicles*4)},{label:'People and vehicles together',value:people>0&&vehicles>0?25:0},{label:'Vehicles near an occupied crossing',value:crossing&&vehicles>0?15:0},{label:'Estimated speed above 30 km/h',value:speed===null?0:Math.min(18,Math.max(0,(speed-30)*.5))}];
 const score=Math.round(Math.min(100,factors.reduce((s,f)=>s+f.value,0)));
 return {score,level:score>=55?'Elevated':score>=25?'Moderate':'Low',people,vehicles,speed,factors};
}
