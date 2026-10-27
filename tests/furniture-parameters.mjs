import assert from 'node:assert/strict';
import {MODELS,defaults,buildModel,bounds,normaliseValues,paramVisible,CATS} from '../furniture/models.js';
const lookup=id=>MODELS.find(m=>m.id===id),build=(id,p={})=>buildModel(lookup(id),p),fingerprint=r=>JSON.stringify(r.parts);
let cases=0;const inactive=[];
for(const m of MODELS){
 const def=defaults(m),samples=[def,...['min','max'].map(end=>Object.fromEntries(m.params.map(q=>[q.k,q.type==='bool'?end==='max':q.type==='select'?q.options[end==='max'?q.options.length-1:0][0]:q[end]])))];
 for(const q of m.params){const vals=q.type==='bool'?[false,true]:q.type==='select'?q.options.map(o=>o[0]):[q.min,q.max];
  for(const v of vals)samples.push({...def,[q.k]:v});
  if(paramVisible(q,def)&&vals.length>1&&fingerprint(buildModel(m,{...def,[q.k]:vals[0]}))===fingerprint(buildModel(m,{...def,[q.k]:vals.at(-1)})))inactive.push(m.id+':'+q.k);
 }
 for(const p of samples){const r=buildModel(m,p);assert(r.parts.length,m.id);assert(Object.values(r.dims).every(v=>Number.isFinite(v)&&v>0),m.id+JSON.stringify(p));assert(bounds(r.parts).every(Number.isFinite),m.id);
  for(const part of r.parts){for(const [k,v]of Object.entries(part))if(typeof v==='number')assert(Number.isFinite(v),m.id+':'+k);if(part.kind==='box')assert(part.w>0&&part.d>0&&part.h>0);if(part.kind==='lathe')assert(part.profile.every(q=>q.every(Number.isFinite)&&q[0]>=0));}cases++;
 }
 assert(CATS.includes(m.cat));assert.deepEqual(buildModel(m,def),buildModel(m,JSON.parse(JSON.stringify(def))),'Serialized parameters reproduce geometry');
}
assert.deepEqual(inactive,[],'Every visible parameter must affect generated geometry');
for(const W of [800,990,1370,1520,1930,2200])for(const count of [0,1,2,3,4]){
 const raw=lookup('bed').build({...defaults(lookup('bed')),W,pillows:count}),pillows=raw.filter(q=>q.name==='Pillow');assert.equal(pillows.length,count);
 for(let i=0;i<count;i++){const q=pillows[i],op=pillows[count-i-1];assert(Math.abs(q.cx+op.cx)<1e-8);assert.equal(q.w,op.w);assert(q.cx-q.w/2>=-W/2&&q.cx+q.w/2<=W/2);if(i)assert(q.cx-q.w/2>pillows[i-1].cx+pillows[i-1].w/2);}
}
for(const W of [600,900,1100,1600])for(const basins of [1,2]){const r=build('vanity',{W,basins}),bowls=r.parts.filter(q=>q.name==='Basin shell');assert.equal(bowls.length,basins);if(basins===2)assert(Math.abs(bowls[0].cx+bowls[1].cx)<1e-7);for(const q of bowls){const rx=Math.max(...q.profile.map(p=>p[0]));assert(Math.abs(q.cx)+rx<=W/2);assert(q.profile.at(-3)[1]<Math.max(...q.profile.map(p=>p[1])));}}
assert.notEqual(fingerprint(build('vanity',{bowlDepth:80})),fingerprint(build('vanity',{bowlDepth:180})));
assert(build('kitchen').parts.some(q=>q.holes?.length));assert(build('island',{sink:true}).parts.some(q=>q.holes?.length));
assert.equal(build('locker',{cols:4,rows:3}).parts.filter(q=>q.name==='Locker door').length,12);assert.equal(build('locker',{cols:4,rows:3,open:true}).parts.filter(q=>q.name==='Locker door').length,0);assert.equal(build('locker',{H:1800}).dims.H,1800);
assert.equal(build('banquette',{seats:5}).parts.filter(q=>q.name==='Seat cushion').length,5);assert.equal(build('workstation',{modules:3,double:true}).parts.filter(q=>q.name==='Desktop').length,6);
assert.equal(normaliseValues(lookup('bed'),{W:Infinity,L:-999,pillows:99,head:'yes'}).W,1520);assert.equal(normaliseValues(lookup('bed'),{pillows:99}).pillows,4);
console.log('PASS',MODELS.length,'parametric families;',cases,'boundary/option combinations; pillow symmetry, basin cavities, cabinet interiors, linked counts, persistence and invalid inputs');
