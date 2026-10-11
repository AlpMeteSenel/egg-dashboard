import test from 'node:test';import assert from 'node:assert/strict';
import {cleanZones,zoneCount,zoneRule,type DetectionZone} from '../src/lib/zones';
import type {Track} from '../src/lib/types';
const z:DetectionZone={id:'cars',polygon:[[.1,.1],[.9,.1],[.9,.9],[.1,.9]],classes:['car']};
test('zone geometry rejects self-crossing, collapsed, oversized and non-finite input',()=>{
 assert.deepEqual(cleanZones([z])[0],z);
 for(const polygon of [[[.1,.1],[.9,.9],[.9,.1],[.1,.9]],[[.1,.1],[.1,.1],[.1,.1],[.1,.1]],[[NaN,.1],[.9,.1],[.9,.9],[.1,.9]],[[2,.1],[.9,.1],[.9,.9],[.1,.9]]])assert.throws(()=>cleanZones([{...z,polygon}]));
 assert.throws(()=>cleanZones(Array(9).fill(z)));assert.throws(()=>cleanZones([{...z,id:'bad\'id'}]));
 assert.deepEqual(cleanZones([z,z,{...z,id:'cars-2'}]).map(z=>z.id),['cars','cars-2','cars-2-2']);
});
test('area counts use confirmed current footpoints, never box overlap or retained tracks',()=>{
 const t:Track={id:1,cls:'car',conf:.8,box:[.2,.2,.4,.8],speed_kmh:null,confirmed:true,inside:false};
 assert.equal(zoneCount(z,[t,{...t,id:2,confirmed:false},{...t,id:3,retained:true},{...t,id:4,cls:'person'},{...t,id:5,box:[.2,.2,.4,.95]}]),1);
});
test('crosswalk and congestion thresholds produce explicit zone-aware rules',()=>{
 assert.equal(zoneRule(z,5).when,"zone('cars').veh >= 5");assert.equal(zoneRule({...z,id:'crossing',classes:['person']},1).on_s,0);
 assert.throws(()=>zoneRule(z,0));assert.throws(()=>zoneRule(z,1.5));
});
