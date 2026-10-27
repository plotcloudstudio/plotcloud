// Rigid translation in model coordinates (metres, Z up). Never modify mesh data or Site.
const kinds={wall:'walls',op:'ops',floor:'floors',void:'voids',fence:'fences',furn:'furn',light:'lights',ceil:'ceil',note:'notes',imp:'imports',mass:'masses'};
export function centerModel(model,selection,meshes,canMove=()=>true){
 const records=Object.entries(kinds).flatMap(([k,list])=>(model[list]||[]).map(o=>({k,id:o.id,o})));
 const key=s=>s.k+':'+s.id,by=new Map(records.map(r=>[key(r),r]));
 const chosen=new Set(selection.map(key));
 for(const k of chosen)if(!by.has(k)||!canMove(by.get(k)))throw Error('Unlock and show all selected objects before centering.');
 // Openings and generated slabs follow their hosts; they must never be left behind.
 const walls=new Set(records.filter(r=>r.k==='wall'&&chosen.has(key(r))).map(r=>r.id));
 const fullWalls=lv=>{const w=records.filter(r=>r.k==='wall'&&r.o.lv===lv);return w.length>0&&w.every(r=>walls.has(r.id));};
 for(const r of records)if(r.k==='op'&&walls.has(r.o.wall)||r.k==='floor'&&r.o.auto&&fullWalls(r.o.lv)||r.k==='void'&&r.o.fromStair&&chosen.has('furn:'+r.o.fromStair)){
  if(!canMove(r))throw Error('Unlock and show the hosted openings and floors before centering.');chosen.add(key(r));
 }
 for(const k of chosen){const r=by.get(k);if(r.k==='op'&&!walls.has(r.o.wall))throw Error('Select the host wall together with its door or window before centering.');if(r.k==='floor'&&r.o.auto&&!fullWalls(r.o.lv))throw Error('Select the walls that generate this floor before centering.');if(r.k==='void'&&r.o.fromStair&&!chosen.has('furn:'+r.o.fromStair))throw Error('Select the stair that generates this floor opening before centering.');}
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let count=0;
 for(const m of meshes){if(!chosen.has(key(m)))continue;for(let i=0;i<m.pos.length;i+=3){if(i+2>=m.pos.length)throw Error('Incomplete model geometry.');for(let a=0;a<3;a++){const v=m.pos[i+a];if(!Number.isFinite(v))throw Error('Invalid model geometry.');min[a]=Math.min(min[a],v);max[a]=Math.max(max[a],v);}count++;}}
 if(!count)throw Error('No visible model geometry to center.');
 // wsMeshes exports Float32 coordinates; ignore its rounding noise on repeat clicks.
 const tolerance=Math.max(1e-6,...max.map((v,a)=>(v-min[a])*2e-7));
 const delta=[-(min[0]+max[0])/2,-(min[1]+max[1])/2,-min[2]].map(v=>Math.abs(v)<tolerance?0:v);
 const shiftedLevels=new Set();
 if(delta[2])for(const k of chosen){const r=by.get(k);if(['imp','mass'].includes(r.k))continue;const lv=r.o.lv||(r.k==='op'?by.get('wall:'+r.o.wall)?.o.lv:null);if(!lv)throw Error('This object has no editable level elevation.');shiftedLevels.add(lv);}
 for(const lv of shiftedLevels){if(!(model.levels||[]).some(l=>l.id===lv))throw Error('The selected level is unavailable.');if(records.some(r=>(r.o.lv===lv||r.k==='op'&&by.get('wall:'+r.o.wall)?.o.lv===lv)&&!['imp','mass'].includes(r.k)&&!chosen.has(key(r))))throw Error('To place the base at Z=0, select the entire level, including hidden or locked elements.');}
 const next=structuredClone(model),[dx,dy,dz]=delta,p=q=>[q[0]+dx,q[1]+dy];
 for(const [k,list]of Object.entries(kinds))for(const o of next[list]||[]){if(!chosen.has(key({k,id:o.id})))continue;if(k==='op')continue;if(k==='imp'){o.g={...o.g,x:o.g.x+dx,y:o.g.y+dy,z:o.g.z+dz};continue;}if(o.a&&o.b){o.a=p(o.a);o.b=p(o.b);}if(o.points)o.points=o.points.map(p);if(o.holes)o.holes=o.holes.map(h=>h.map(p));if(Number.isFinite(o.x))o.x+=dx;if(Number.isFinite(o.y))o.y+=dy;if(k==='mass')o.z=(o.z||0)+dz;}
 for(const l of next.levels||[])if(shiftedLevels.has(l.id))l.z+=dz;
 for(const n of next.names||[])if(fullWalls(n.lv)){if(Number.isFinite(n.x))n.x+=dx;if(Number.isFinite(n.y))n.y+=dy;}
 return {model:next,delta,bounds:{min,max},count:chosen.size,moved:delta.some(Boolean)};
}
