import * as THREE from 'three';
import mapboxgl from 'mapbox-gl';
import type {LiveBus} from '@/lib/live-buses';
import {TURIN} from '@/lib/geo';
export function createBusLayer(map:mapboxgl.Map){
 const scene=new THREE.Scene(),camera=new THREE.Camera(),origin=mapboxgl.MercatorCoordinate.fromLngLat(TURIN,0),scale=origin.meterInMercatorCoordinateUnits();
 const hull=new THREE.BoxGeometry(2.55,10.8,2.5),glass=new THREE.BoxGeometry(2.61,8.5,.85),roof=new THREE.BoxGeometry(2.2,9.2,.12),wheel=new THREE.CylinderGeometry(.42,.42,.24,10);wheel.rotateZ(Math.PI/2);
 const blue=new THREE.MeshStandardMaterial({color:0x397bd7,roughness:.6}),gray=new THREE.MeshStandardMaterial({color:0x929b9e,roughness:.8}),windowMat=new THREE.MeshStandardMaterial({color:0x183850,roughness:.3}),white=new THREE.MeshStandardMaterial({color:0xdceaf4,roughness:.7}),rubber=new THREE.MeshStandardMaterial({color:0x24303b});
 scene.add(new THREE.AmbientLight(0xffffff,2.5));const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(-30,-50,100);scene.add(sun);
 type Actor={mesh:THREE.Group;hull:THREE.Mesh;start:THREE.Vector3;target:THREE.Vector3;started:number;at:number};const actors=new Map<string,Actor>();let renderer:THREE.WebGLRenderer|null=null;
 function sync(buses:LiveBus[],enabled:boolean){const ids=new Set(enabled?buses.map(b=>b.id):[]);for(const [id,a] of actors)if(!ids.has(id)){scene.remove(a.mesh);actors.delete(id);}
  if(!enabled){map.triggerRepaint();return;}const now=performance.now();for(const b of buses){const p=mapboxgl.MercatorCoordinate.fromLngLat([b.lng,b.lat],0),target=new THREE.Vector3((p.x-origin.x)/scale,(p.y-origin.y)/scale,0);let a=actors.get(b.id);
   if(!a){const mesh=new THREE.Group(),body=new THREE.Mesh(hull,blue);body.position.z=1.8;mesh.add(body);const windows=new THREE.Mesh(glass,windowMat);windows.position.z=2.3;mesh.add(windows);const top=new THREE.Mesh(roof,white);top.position.z=3.1;mesh.add(top);for(const x of [-1.3,1.3])for(const y of [-3.7,3.7]){const w=new THREE.Mesh(wheel,rubber);w.position.set(x,y,.5);mesh.add(w);}mesh.position.copy(target);scene.add(mesh);a={mesh,hull:body,start:target.clone(),target,started:now,at:b.updated_at};actors.set(b.id,a);}
   else if(a.at!==b.updated_at){a.start.copy(a.mesh.position);a.target.copy(target);a.started=now;a.at=b.updated_at;}
   a.hull.material=b.stale?gray:blue;if(b.heading!==null)a.mesh.rotation.z=Math.PI+b.heading*Math.PI/180;
  }map.triggerRepaint();
 }
 const layer:mapboxgl.CustomLayerInterface={id:'busto-buses-3d',type:'custom',renderingMode:'3d',onAdd(_map,gl){renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});renderer.autoClear=false;},render(_gl,matrix){if(!renderer||!actors.size)return;let moving=false;const now=performance.now(),bounds=map.getBounds();for(const a of actors.values()){const t=Math.min(1,(now-a.started)/1200);a.mesh.position.lerpVectors(a.start,a.target,t);if(t<1)moving=true;const ll=mapboxgl.MercatorCoordinate.fromLngLat(TURIN);ll.x+=a.target.x*scale;ll.y+=a.target.y*scale;const age=Date.now()/1000-a.at;a.hull.material=age>90?gray:blue;a.mesh.visible=age<=180&&!!bounds?.contains(ll.toLngLat());}
 camera.projectionMatrix=new THREE.Matrix4().fromArray(matrix).multiply(new THREE.Matrix4().makeTranslation(origin.x,origin.y,origin.z).scale(new THREE.Vector3(scale,scale,scale)));renderer.resetState();renderer.render(scene,camera);if(moving)map.triggerRepaint();},onRemove(){for(const g of [hull,glass,roof,wheel])g.dispose();for(const m of [blue,gray,windowMat,white,rubber])m.dispose();renderer?.dispose();actors.clear();}};
 return {layer,sync};
}
