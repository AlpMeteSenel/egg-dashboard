import test from 'node:test';import assert from 'node:assert/strict';
import {mapSignals,hasSignalController} from '../src/lib/signals';import type {NodeRecord} from '../src/lib/types';
const node=(id:string,signals:number[][]|undefined)=>({id,name:id,fresh:true,placement:{lng:7.66,lat:45.06,heading:0,pairs:[],signals},telemetry:{vision:{traffic:[1,0,0],traffic_lights:[[1,0,0],[0,0,1],[1,0,0],[0,0,1]],countdown:20}}}) as unknown as NodeRecord;
test('only explicitly placed signals on a real controller appear; no camera fallback',()=>{
 assert.deepEqual(mapSignals([node('egg',undefined)]),[]);
 const esp=node('esp32cam-1',[[7.66,45.06]]);// Even a stray signal field must never attach lights to this capture-only camera.

 assert.equal(hasSignalController(esp),false);assert.deepEqual(mapSignals([esp]),[]);
});
test('four placed lights use their own reported phase, opposite pairs match and stale lights turn dark',()=>{
 const n=node('egg',[[7.66,45.0601],[7.6601,45.06],[7.66,45.0599],[7.6599,45.06]]);
 assert.deepEqual(mapSignals([n]).map(s=>s.phase),['red','green','red','green']);assert.ok(Math.abs(mapSignals([n])[0].heading)<.1);
 n.fresh=false;assert.ok(mapSignals([n]).every(s=>s.phase==='unknown'&&s.countdown===null));
});
