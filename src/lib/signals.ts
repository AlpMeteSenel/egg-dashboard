import type {NodeRecord,Point} from './types';
export type MapSignal={id:string;node:string;name:string;index:number;point:Point;heading:number;phase:'red'|'amber'|'green'|'unknown';countdown:number|null};
export function hasSignalController(node:Pick<NodeRecord,'id'|'telemetry'>){return node.id!=='esp32cam-1'&&(node.id==='egg'||Array.isArray(node.telemetry?.vision.traffic)&&node.telemetry.vision.traffic.length===3);}
export function mapSignals(nodes:NodeRecord[]):MapSignal[]{return nodes.flatMap(node=>{
 if(!hasSignalController(node)||!node.placement?.signals?.length)return [];
 const spots=node.placement.signals,center:Point=[spots.reduce((s,p)=>s+p[0],0)/spots.length,spots.reduce((s,p)=>s+p[1],0)/spots.length];
 return spots.map((point,index)=>{
  const f=node.fresh?(node.telemetry?.vision.traffic_lights?.[index]||(index===0?node.telemetry?.vision.traffic:undefined)):undefined;
  const phase:MapSignal['phase']=f?.[0]?'red':f?.[1]?'amber':f?.[2]?'green':'unknown';
  const heading=(Math.atan2((point[0]-center[0])*Math.cos(center[1]*Math.PI/180),point[1]-center[1])*180/Math.PI+360)%360;
  return {id:node.id+'-'+index,node:node.id,name:node.name,index,point,heading,phase,countdown:node.fresh&&typeof node.telemetry?.vision.countdown==='number'?Math.max(0,Math.ceil(node.telemetry.vision.countdown)):null};
 });
});}
