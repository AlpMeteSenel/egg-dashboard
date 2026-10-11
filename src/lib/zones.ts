import type {Point,Track} from './types';
export type DetectionZone={id:string;polygon:Point[];classes:string[]};
const allowed=['person','car','bus','truck','motorcycle','bicycle','van','train'];
export function cleanZones(value:unknown):DetectionZone[]{
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>8)throw Error('Use at most eight detection zones.');
 const ids=new Set<string>();
 return value.map((raw:unknown)=>{
  if(!raw||typeof raw!=='object')throw Error('Invalid detection zone.');
  const z=raw as DetectionZone;
  if(typeof z.id!=='string'||!/^[a-z0-9_-]{1,32}$/.test(z.id))throw Error('Zone names need lowercase letters, digits, dashes or underscores.');
  let id=z.id,n=2;while(ids.has(id))id=z.id.slice(0,28)+'-'+n++;ids.add(id);
  if(!Array.isArray(z.polygon)||z.polygon.length!==4||!z.polygon.every(p=>Array.isArray(p)&&p.length===2&&p.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)))throw Error('Choose four corners inside the camera image.');
  const p=z.polygon;
  const turns=p.map((a,i)=>{const b=p[(i+1)%4],c=p[(i+2)%4];return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);});
  const area=Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%4];return sum+a[0]*b[1]-b[0]*a[1];},0))/2;
  if(area<.0001||!turns.every(v=>v>=.001)&&!turns.every(v=>v<= -.001))throw Error('Click corners around the perimeter; the area cannot cross itself or collapse.');
  const classes=z.classes??[];
  if(!Array.isArray(classes)||classes.some(c=>!allowed.includes(c)))throw Error('Unknown detection class.');
  return {id,polygon:p.map(a=>[...a] as Point),classes:[...new Set(classes)]};
 });
}
export function inZone(point:Point,polygon:Point[]){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function zoneCount(zone:DetectionZone,tracks:Track[]){return tracks.filter(t=>t.confirmed&&!t.retained&&(!zone.classes.length||zone.classes.includes(t.cls))&&inZone([(t.box[0]+t.box[2])/2,t.box[3]],zone.polygon)).length;}
export function zoneRule(zone:DetectionZone,threshold:number){
 if(!Number.isInteger(threshold)||threshold<1||threshold>100)throw Error('Threshold must be 1–100.');
 return {name:'Area '+zone.id,when:`zone('${zone.id}').${zone.classes.includes('person')?'ped':'veh'} >= ${threshold}`,led:zone.id==='crossing'?'warning':'hazard',on_s:zone.id==='crossing'?0:3,off_s:5,priority:zone.id==='crossing'?9:7};
}

export function zoneLimits(cfg:unknown):Record<string,number>{
 const rules=(cfg as {led?:{rules?:{name:string;when:string}[]}})?.led?.rules||[];const out:Record<string,number>={};
 for(const r of [...rules.filter(r=>r.name.startsWith('Area ')),...rules.filter(r=>!r.name.startsWith('Area '))]){
  const match=/^zone\('([a-z0-9_-]+)'\)\.(?:ped|veh|occupancy) (>=|>) (\d+)$/.exec(r.when);
  if(match&&out[match[1]]===undefined)out[match[1]]=Number(match[3])+(match[2]==='>'?1:0);
 }
 return out;
}
