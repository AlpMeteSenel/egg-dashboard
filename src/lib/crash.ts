import type {Track,Telemetry} from './types';
export type CrashSettings={enabled:boolean;location:string;overlap:number;frames:number;minCarSpeed:number};
export type CrashEvidence={person_id:number;car_id:number;person_conf:number;car_conf:number;overlap:number;person_speed:number|null;car_speed:number|null;relative_min:number|null;relative_max:number|null;frames:number;duration_ms:number};
export const crashDefaults:CrashSettings={enabled:false,location:'Via Vincenzo Vela / Via Giovanni Battista Bricherasio, Torino',overlap:.25,frames:3,minCarSpeed:0};
export function calibratedSpeed(t:Track){const v=t.speed_kmh;if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>200||/pixel|uncalibrat|unavailable|invalid|warming|pending/i.test(t.speed_status||''))return null;return Math.round(v*10)/10;}
export function overlapOfPerson(person:Track,car:Track){const p=person.box,c=car.box;const intersection=Math.max(0,Math.min(p[2],c[2])-Math.max(p[0],c[0]))*Math.max(0,Math.min(p[3],c[3])-Math.max(p[1],c[1]));return intersection/((p[2]-p[0])*(p[3]-p[1]));}
export function relativeBounds(a:number|null,b:number|null){return a===null||b===null?{min:null,max:null}:{min:Math.round(Math.abs(a-b)*10)/10,max:Math.round((a+b)*10)/10};}
// Distinct camera captures, not dashboard polls, provide temporal evidence.
export class CrashDetector{
 private lastCapture=0;private pairs=new Map<string,{first:number;last:number;frames:number}>();
 reset(){this.pairs.clear();}
 observe(t:Telemetry,settings:CrashSettings,now=Date.now()):CrashEvidence[]{
  const at=t.capture_ts*1000;
  if(at<=this.lastCapture)return [];
  this.lastCapture=at;
  if(!settings.enabled||t.source_kind!=='live'||now-at>2500||at-now>250){this.reset();return [];}
  const tracks=t.vision.tracks.filter(x=>x.confirmed&&!x.retained&&x.conf>=.5&&(x.last_seen_s??0)<=.7);
  const people=tracks.filter(x=>x.cls==='person'),cars=tracks.filter(x=>x.cls==='car'),active=new Set<string>(),result:CrashEvidence[]=[];
  for(const p of people)for(const c of cars){const overlap=overlapOfPerson(p,c),cs=calibratedSpeed(c);if(overlap<settings.overlap||settings.minCarSpeed>0&&(cs===null||cs<settings.minCarSpeed))continue;
   const key=p.id+':'+c.id;active.add(key);const previous=this.pairs.get(key);const evidence=previous&&at-previous.last<=2500?{...previous,last:at,frames:previous.frames+1}:{first:at,last:at,frames:1};this.pairs.set(key,evidence);
   if(evidence.frames>=settings.frames&&at-evidence.first>=500){const ps=calibratedSpeed(p),bounds=relativeBounds(cs,ps);result.push({person_id:p.id,car_id:c.id,person_conf:p.conf,car_conf:c.conf,overlap:Math.round(overlap*100),person_speed:ps,car_speed:cs,relative_min:bounds.min,relative_max:bounds.max,frames:evidence.frames,duration_ms:at-evidence.first});}
  }
  for(const key of this.pairs.keys())if(!active.has(key))this.pairs.delete(key);
  return result;
 }
}
export function crashMessage(location:string,e:CrashEvidence,test=false){const speed=(n:number|null)=>n===null?'non disponibile':`${n} chilometri orari`;return `${test?'Questo è un test del prototipo Swarmflow. Nessun incidente reale è confermato. ':''}Possibile collisione tra un'auto e un pedone a ${location}. Velocità stimata dell'auto: ${speed(e.car_speed)}. Velocità stimata del pedone: ${speed(e.person_speed)}. ${e.relative_min!==null?`Velocità relativa possibile tra ${e.relative_min} e ${e.relative_max} chilometri orari; direzioni non misurate. `:''}La segnalazione deriva da riquadri sovrapposti nelle immagini e richiede verifica umana.`;}
