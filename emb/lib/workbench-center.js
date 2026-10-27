// Only imported building geometry is eligible; authored elements and furniture are untouched.
export const isImportedBuildingObject=o=>!!o?.g&&!o.ref&&!['furniture','terrain','mass'].includes(o.type);
export function centerModel(model,selection,meshes,canMove=()=>true){
 const records=(model.imports||[]).filter(isImportedBuildingObject).map(o=>({k:'imp',id:o.id,o}));
 const key=s=>s.k+':'+s.id,by=new Map(records.map(r=>[key(r),r]));
 const chosen=new Set(selection.filter(s=>s.k==='imp'&&by.has(key(s))).map(key));
 if(!chosen.size)throw Error('Select an imported building model. Furniture and authored elements cannot use this command.');
 for(const k of chosen)if(!canMove(by.get(k)))throw Error('Unlock and show the imported building before centering.');
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let count=0;
 for(const m of meshes){if(!chosen.has(key(m)))continue;for(let i=0;i<m.pos.length;i+=3){if(i+2>=m.pos.length)throw Error('Incomplete model geometry.');for(let a=0;a<3;a++){const v=m.pos[i+a];if(!Number.isFinite(v))throw Error('Invalid model geometry.');min[a]=Math.min(min[a],v);max[a]=Math.max(max[a],v);}count++;}}
 if(!count)throw Error('No visible imported building geometry to center.');
 // wsMeshes exports Float32 coordinates; ignore its rounding noise on repeat clicks.
 const tolerance=Math.max(1e-6,...max.map((v,a)=>(v-min[a])*2e-7));
 const delta=[-(min[0]+max[0])/2,-(min[1]+max[1])/2,-min[2]].map(v=>Math.abs(v)<tolerance?0:v);
 const next=structuredClone(model),[dx,dy,dz]=delta;
 for(const o of next.imports||[])if(chosen.has('imp:'+o.id))o.g={...o.g,x:o.g.x+dx,y:o.g.y+dy,z:o.g.z+dz};
 return {model:next,delta,bounds:{min,max},count:chosen.size,moved:delta.some(Boolean)};
}
