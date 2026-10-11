import type { GroundPair, Point, Placement, Track, MappedTrack } from './types';
const R=6378137;
export const TURIN:Point=[7.6869,45.0703];
export function mercator(p:Point):Point {return [R*p[0]*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))];}
export function lnglat(p:Point):Point{return [p[0]/R*180/Math.PI,(2*Math.atan(Math.exp(p[1]/R))-Math.PI/2)*180/Math.PI];}
export function solve(a:number[][],b:number[]):number[]{
 const m=a.map((r,i)=>[...r,b[i]]);for(let c=0;c<b.length;c++){let pivot=c;for(let i=c+1;i<b.length;i++)if(Math.abs(m[i][c])>Math.abs(m[pivot][c]))pivot=i;
 if(Math.abs(m[pivot][c])<1e-10)throw Error('These landmarks are too close together or in a line. Choose four corners around a ground area.');
 [m[c],m[pivot]]=[m[pivot],m[c]];const k=m[c][c];m[c]=m[c].map(x=>x/k);for(let i=0;i<b.length;i++)if(i!==c){const f=m[i][c];m[i]=m[i].map((v,j)=>v-f*m[c][j]);}}
 return m.map(r=>r[b.length]);
}
function area(q:Point[]):number {return Math.abs(q.reduce((s,a,i)=>{const b=q[(i+1)%q.length];return s+a[0]*b[1]-a[1]*b[0];},0))/2;}
function convex(q:Point[]):boolean {const turns=q.map((a,i)=>{const b=q[(i+1)%4],c=q[(i+2)%4];return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);});return turns.every(x=>x>1e-10)||turns.every(x=>x< -1e-10);}
export function inside(p:Point,q:Point[]):boolean {let result=false;for(let i=0,j=q.length-1;i<q.length;j=i++){const a=q[i],b=q[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;}
export function align(pairs:GroundPair[]){
 if(pairs.length!==4)throw Error('Match four ground landmarks to place people on the map.');
 const origin=mercator(pairs[0].map),scale=Math.cos(pairs[0].map[1]*Math.PI/180);
 const image=pairs.map(p=>p.image),ground=pairs.map(p=>{const a=mercator(p.map);return [(a[0]-origin[0])*scale,(a[1]-origin[1])*scale] as Point;});
 if(!convex(image)||!convex(ground)||area(image)<.00005||area(ground)<1)throw Error('Choose four distinct corners around the same flat ground area, in the same perimeter order.');
 const a:number[][]=[],b:number[]=[];pairs.forEach((p,i)=>{const [x,y]=p.image,[u,v]=ground[i];a.push([x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]);b.push(u,v);});const h=solve(a,b);
 const ds=image.map(([x,y])=>h[6]*x+h[7]*y+1);if(!ds.every(d=>d*ds[0]>0))throw Error('Ground alignment crosses the camera horizon.');
 return {project:(p:Point):Point|null=>{const d=h[6]*p[0]+h[7]*p[1]+1;if(d*ds[0]<=0||Math.abs(d)<Math.min(...ds.map(Math.abs))*.12)return null;const x=(h[0]*p[0]+h[1]*p[1]+h[2])/d,y=(h[3]*p[0]+h[4]*p[1]+h[5])/d;if(!Number.isFinite(x+y)||Math.hypot(x,y)>500)return null;return lnglat([origin[0]+x/scale,origin[1]+y/scale]);},image};
}
const placeable=new Set(['person','bicycle','car','bus','truck','motorcycle']);
export function mapTracks(tracks:Track[],placement:Placement|null):MappedTrack[]{
 if(!placement||placement.pairs.length!==4)return [];const ground=align(placement.pairs);
 return tracks.flatMap(t=>{if(!t.confirmed||t.retained||!placeable.has(t.cls)||(t.last_seen_s??0)>1)return [];const p:Point=[(t.box[0]+t.box[2])/2,t.box[3]],ll=ground.project(p);return ll?[{...t,lng:ll[0],lat:ll[1],extrapolated:!inside(p,ground.image)}]:[];});
}
export function coverage(placement:Placement):Point[]{const center:Point=[placement.lng,placement.lat],m=mercator(center),scale=Math.cos(placement.lat*Math.PI/180);const p=[center];for(let d=-36;d<=36;d+=9){const a=(placement.heading+d)*Math.PI/180;p.push(lnglat([m[0]+Math.sin(a)*25/scale,m[1]+Math.cos(a)*25/scale]));}p.push(center);return p;}
