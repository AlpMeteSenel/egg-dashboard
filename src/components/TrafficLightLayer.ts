import * as THREE from 'three';
import mapboxgl from 'mapbox-gl';
import {TURIN} from '@/lib/geo';
import type {MapSignal} from '@/lib/signals';
export function createTrafficLightLayer(map:mapboxgl.Map){
 const scene=new THREE.Scene(),camera=new THREE.Camera(),origin=mapboxgl.MercatorCoordinate.fromLngLat(TURIN),scale=origin.meterInMercatorCoordinateUnits();
 scene.add(new THREE.AmbientLight(0xffffff,2));const sun=new THREE.DirectionalLight(0xffffff,2.5);sun.position.set(-40,-60,100);scene.add(sun);
 const pole=new THREE.CylinderGeometry(.065,.09,3.45,12);pole.rotateX(Math.PI/2);
 const base=new THREE.CylinderGeometry(.18,.23,.15,12);base.rotateX(Math.PI/2);
 const caseGeo=new THREE.BoxGeometry(.55,.34,1.42),bracket=new THREE.BoxGeometry(.43,.08,.07),lens=new THREE.CylinderGeometry(.15,.15,.045,24),hood=new THREE.CylinderGeometry(.19,.19,.29,20,1,true,-Math.PI/2,Math.PI);
 const metal=new THREE.MeshStandardMaterial({color:0x7b8589,metalness:.75,roughness:.5}),black=new THREE.MeshStandardMaterial({color:0x20272b,roughness:.65,side:THREE.DoubleSide});
 const colors=[0xff372d,0xffc23f,0x29db70],dark=[0x401714,0x493615,0x123a23];
 const off=dark.map(color=>new THREE.MeshStandardMaterial({color,roughness:.25})),on=colors.map(color=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.4,roughness:.2}));
 const actors=new Map<string,{group:THREE.Group;lenses:THREE.Mesh[]}>();let renderer:THREE.WebGLRenderer|null=null;
 function sync(signals:MapSignal[],enabled:boolean){
  const ids=new Set(signals.map(s=>s.id));for(const [id,a] of actors)if(!ids.has(id)){scene.remove(a.group);actors.delete(id);}
  for(const s of signals){let a=actors.get(s.id);if(!a){const group=new THREE.Group(),foot=new THREE.Mesh(base,metal),stem=new THREE.Mesh(pole,metal),housing=new THREE.Mesh(caseGeo,black);foot.position.z=.075;stem.position.z=1.8;housing.position.set(.24,0,3.08);group.add(foot,stem,housing);
    for(const z of [2.65,3.55]){const arm=new THREE.Mesh(bracket,metal);arm.position.set(.15,.06,z);group.add(arm);}
    const lenses:THREE.Mesh[]=[];for(let i=0;i<3;i++){const z=3.52-i*.44,lamp=new THREE.Mesh(lens,off[i]),visor=new THREE.Mesh(hood,black);lamp.position.set(.24,-.20,z);visor.position.set(.24,-.32,z);group.add(lamp,visor);lenses.push(lamp);}a={group,lenses};actors.set(s.id,a);scene.add(group);
   }
   const p=mapboxgl.MercatorCoordinate.fromLngLat(s.point);a.group.position.set((p.x-origin.x)/scale,(p.y-origin.y)/scale,0);a.group.rotation.z=s.heading*Math.PI/180;a.group.visible=enabled;
   a.lenses.forEach((l,i)=>l.material=['red','amber','green'][i]===s.phase?on[i]:off[i]);
  }map.triggerRepaint();
 }
 const layer:mapboxgl.CustomLayerInterface={id:'intersection-traffic-lights-3d',type:'custom',renderingMode:'3d',onAdd(_map,gl){renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});renderer.autoClear=false;},render(_gl,matrix){if(!renderer||!actors.size)return;camera.projectionMatrix=new THREE.Matrix4().fromArray(matrix).multiply(new THREE.Matrix4().makeTranslation(origin.x,origin.y,origin.z).scale(new THREE.Vector3(scale,scale,scale)));renderer.resetState();renderer.render(scene,camera);},onRemove(){for(const g of [pole,base,caseGeo,bracket,lens,hood])g.dispose();for(const m of [metal,black,...off,...on])m.dispose();renderer?.dispose();actors.clear();}};
 return {layer,sync};
}
