import test from 'node:test';
import assert from 'node:assert/strict';
import {snowAnalysis,validateSnow} from '../mvp/js/snow-analysis.js';
import {setParameter,studySnapshot,applicability} from '../mvp/js/parameters.js';
const plane=(key,x0,y0,x1,y1,z)=>({key,name:key,positions:[x0,y0,z,x1,y0,z,x1,y1,z,x0,y0,z,x1,y1,z,x0,y1,z]});
const input={snowCm:20,density:100,spacing:1,groundZ:0,x0:0,x1:4,y0:0,y1:4};
test('shelter allocates snowfall to the highest surface once, with mass and SWE conservation',()=>{
 const r=snowAnalysis([plane('terrain:site',0,0,4,4,0),plane('roof:lower',0,0,2,2,3),plane('roof:upper',0,0,1,1,6)],input);
 assert.equal(r.totals.areaM2,16);assert.equal(r.totals.groundAreaM2,12);assert.equal(r.totals.surfaceAreaM2,4);
 assert.ok(Math.abs(r.totals.volumeM3-3.2)<1e-10);assert.equal(r.totals.massKg,320);assert.equal(r.totals.waterEquivalentMm,20);
 assert.equal(r.samples.find(p=>p.x===.5&&p.y===.5).z,6);assert.equal(r.samples.length,16);assert.equal(r.totals.fallbackAreaM2,0);
});
test('actual sloping surfaces and below-zero terrain are retained; vertical walls collect no projected snow',()=>{
 const slope={key:'roof:slope',positions:[0,0,2,2,0,4,2,2,4,0,0,2,2,2,4,0,2,2]};
 const wall={key:'wall:vertical',positions:[3,0,0,3,2,0,3,0,6]};
 const r=snowAnalysis([plane('linked:terrain',0,0,4,4,-2),slope,wall],input);
 assert.equal(r.samples[0].z,2.5);assert.equal(r.samples.find(p=>p.x===3.5&&p.y===.5).z,-2);
 assert.equal(r.totals.surfaceAreaM2,4);
});
test('missing terrain is explicitly counted as assumed ground; density scales mass, not snow depth',()=>{
 const meshes=[plane('roof:one',0,0,2,2,3)],a=snowAnalysis(meshes,input),b=snowAnalysis(meshes,{...input,density:200});
 assert.equal(a.totals.fallbackAreaM2,12);assert.equal(b.totals.massKg,a.totals.massKg*2);
 assert.deepEqual(b.samples.map(p=>p.value),a.samples.map(p=>p.value));assert.equal(b.totals.waterEquivalentMm,40);
});
test('zero event deposits no snow and invalid/oversized inputs never get substituted',()=>{
 assert.equal(snowAnalysis([plane('roof:r',0,0,2,2,3)],{...input,snowCm:0}).totals.massKg,0);
 for(const patch of [{snowCm:-1},{density:0},{spacing:.01},{x1:0},{snowCm:NaN},{x1:1000,y1:1000}])assert.throws(()=>validateSnow({...input,...patch}));
});
test('uniform-event parameters invalidate that mode while leaving existing winter-wind dependencies intact',()=>{
 const project={parameters:{schema:1,records:[]}};
 for(const [key,value] of Object.entries(input))setParameter(project,{path:'snow.'+key,value,scope:'study-global',study:'snow-event'});
 const used=studySnapshot(project,'snow-event'),wind=studySnapshot(project,'snow').hash,run={simId:'snow',inputs:used};
 assert.equal(applicability(project,run).status,'current');
 setParameter(project,{path:'snow.density',value:200,scope:'study-global',study:'snow-event'});
 assert.equal(applicability(project,run).status,'stale');
 assert.equal(studySnapshot(project,'snow').hash,wind);
});
