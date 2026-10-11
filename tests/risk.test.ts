import test from 'node:test';import assert from 'node:assert/strict';import {activityRisk,riskSample} from '../src/lib/risk';import type {NodeRecord} from '../src/lib/types';
test('brief disappearances and new track IDs do not double counts; old observations expire',()=>{
 const samples=[{at:10000,people:1,vehicles:2,crossing:true,speed:null},{at:11000,people:0,vehicles:0,crossing:false,speed:null}];
 assert.equal(activityRisk(samples,11000)!.score,51);assert.equal(activityRisk(samples,13000)!.score,0);assert.equal(activityRisk(samples,14000),null);
});
test('unconfirmed, retained and stale detections never increase the risk estimate',()=>{
 const node={fresh:true,telemetry:{capture_ts:10,vision:{occupied:false,tracks:[{cls:'person',confirmed:false,conf:.9},{cls:'car',confirmed:true,retained:true,conf:.9}]}}} as unknown as NodeRecord;
 assert.equal(riskSample(node,10000)!.people,0);assert.equal(riskSample(node,10000)!.vehicles,0);assert.equal(riskSample(node,15000),null);
});
