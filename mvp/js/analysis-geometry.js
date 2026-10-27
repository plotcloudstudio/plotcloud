// All positions in this contract are world-space metres, Z up, unindexed triangles.
export const SOLAR_MESH_STUDIES=new Set(['sunhours','radiation','utci']);
export function visibleImports(model){const hidden=new Set(model.studio?.hiddenIds||[]),off=new Set((model.layers||[]).filter(l=>l.visible===false).map(l=>l.name));return(model.studio?.imports||[]).filter(o=>!hidden.has(o.id)&&!off.has(o.layer||'Imported'));}
const layerOf={wall:'Walls',op:'Glazing',floor:'Structure',void:'Structure',furn:'Furniture',room:'Rooms',mass:'Masses',light:'Lighting',ceil:'Lighting',fence:'Walls'};
export function solarMeshScene(raw,model,{name,site,versionId,projectId,context=[],terrain=null}){
 const off=new Set((model.layers||[]).filter(l=>l.visible===false).map(l=>l.name)),imports=new Map(visibleImports(model).map(o=>[String(o.id),o])),allImports=new Set((model.studio?.imports||[]).map(o=>String(o.id))),meshes=[];
 let triangles=0;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 const extend=(x,y,z)=>{for(const [i,n]of[x,y,z].entries()){min[i]=Math.min(min[i],n);max[i]=Math.max(max[i],n);}};
 for(const m of raw){if(m.k==='imp'&&allImports.has(String(m.id))&&!imports.has(String(m.id)))continue;if(m.k!=='imp'&&off.has(layerOf[m.k]||'Structure'))continue;
  const positions=Array.from(m.pos||[]);if(!positions.length)continue;if(positions.length%9||positions.some(n=>!Number.isFinite(n)))throw Error('Invalid triangles in '+m.id+'. Repair the object before simulation.');
  triangles+=positions.length/9;if(triangles>350000)throw Error('The visible model exceeds 350,000 triangles. Reduce mesh density before simulation; objects have not been removed automatically.');
  const im=imports.get(String(m.id)),role=im?.type==='terrain'?'terrain':im&&(im.type==='mass'||['Site','Context'].includes(im.layer))?'context':'proposed';
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<positions.length;i+=3){extend(positions[i],positions[i+1],positions[i+2]);for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],positions[i+k]);hi[k]=Math.max(hi[k],positions[i+k]);}}
  meshes.push({id:m.id,kind:m.k,role,name:im?.name||m.id,positions,glass:!!m.glass,outer:[[lo[0],lo[1]],[hi[0],lo[1]],[hi[0],hi[1]],[lo[0],hi[1]]],base:lo[2],h:hi[2],boundsForLabelsOnly:true});
 }
 const missing=[...imports.values()].filter(o=>!meshes.some(m=>m.kind==='imp'&&String(m.id)===String(o.id)));if(missing.length)throw Error('Missing mesh geometry: '+missing.map(o=>o.name||o.id).join(', ')+'. Reimport these objects before simulation.');
 if(!meshes.length)throw Error('No visible surface geometry to analyze. Show the required layers or import the model again.');
 const masses=off.has('Site')?[]:context;for(const m of masses)for(const p of m.outer||[]){extend(p[0],p[1],m.base);extend(p[0],p[1],m.h);}
 if(terrain&&!off.has('Site'))for(const p of terrain.pts||[])extend(...p);
 return{format:'plotcloud-scene',v:1,kind:'masses',name,app:'plotcloud-workspace',north:-(site?.north||0),loc:site&&Number.isFinite(site.lat)?{lat:site.lat,lon:site.lon,label:site.label,tz:site.utcOffset??Math.round(site.lon/15),dst:0}:null,
  masses,meshes,terrain:off.has('Site')?null:terrain,geometryBounds:{min,max},source:{app:'plotcloud-workspace',project:projectId,version:versionId,level:'all',geometry:'world-triangle-mesh-v1'},
  geometryAudit:{objects:meshes.length,imported:imports.size,triangles,units:'m',axis:'z-up',representation:'Workspace surface meshes'},notes:['Workspace surface meshes are used without bounding-box replacement. Glazing is currently treated as opaque by this solar screening solver.']};
}
