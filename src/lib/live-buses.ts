export type LiveBus={id:string;line:string;vehicle_id:string|null;headsign:string;lng:number;lat:number;heading:number|null;updated_at:number;stale:boolean};
export type BusFeed={vehicles:LiveBus[];source:string;fetched_at:number|null;error:string|null};
const obj=(x:unknown):Record<string,unknown>=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{};
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
function point(x:unknown):[number,number]|null{return Array.isArray(x)&&x.length>=2&&finite(x[0])&&finite(x[1])&&x[0]>=44.7&&x[0]<=45.5&&x[1]>=7.3&&x[1]<=8.1?[x[0],x[1]]:null;}
export function normalizeBuses(input:unknown,now=Date.now()/1000):LiveBus[]{
 const paths=obj(obj(input).paths),unique=new Map<string,LiveBus>();
 for(const [key,raw] of Object.entries(paths).slice(0,1000)){const p=obj(raw),position=point(p.last_location),at=p.last_ts;if(!position||!finite(at)||now-at>180||at-now>30||typeof p.line!=='string'||!p.line.trim())continue;
  const physical=typeof p.physical_vehicle_id==='string'||typeof p.physical_vehicle_id==='number'?String(p.physical_vehicle_id).slice(0,40):null,id=physical?'bus:'+physical:'run:'+key.slice(0,80);let heading:number|null=null;
  const chunks=Array.isArray(p.paths)?p.paths:[];const tail=Array.isArray(chunks.at(-1))?chunks.at(-1) as unknown[]:[];
  for(let i=tail.length-2;i>=Math.max(0,tail.length-20);i--){const before=point(tail[i]);if(!before)continue;const dy=(position[0]-before[0])*111320,dx=(position[1]-before[1])*111320*Math.cos(position[0]*Math.PI/180);if(Math.hypot(dx,dy)>=3){heading=(Math.atan2(dx,dy)*180/Math.PI+360)%360;break;}}
  const bus={id,line:p.line.slice(0,24),vehicle_id:physical,headsign:typeof p.headsign==='string'?p.headsign.slice(0,100):'',lng:position[1],lat:position[0],heading,updated_at:at,stale:now-at>90};const previous=unique.get(id);if(!previous||previous.updated_at<at)unique.set(id,bus);
 }
 return [...unique.values()];
}
export function ageBuses(buses:LiveBus[],now=Date.now()/1000){return buses.filter(b=>now-b.updated_at<=180&&b.updated_at-now<=30).map(b=>({...b,stale:now-b.updated_at>90}));}
