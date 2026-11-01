import {geometry} from './environment/analysis.js';

export const SNOW_RELEASE='vertical-snow-20261031-1';
export const SNOW_SCOPE='One uniform snowfall event, vertical deposition on the topmost opaque model surface per horizontal cell. No wind redistribution, melting, settling, sliding, existing snowpack or structural capacity calculation.';
export const SNOW_SOURCE='https://www.nrcs.usda.gov/resources/education-and-teaching-materials/climate-glossary';
export const SNOW_KEYS=['snowCm','density','spacing','groundZ','x0','x1','y0','y1'];
export function snowDefaults(bounds){
 const b=bounds||{min:[0,0,0],max:[16,12,3]},w=b.max[0]-b.min[0],d=b.max[1]-b.min[1],pad=Math.max(2,Math.max(w,d)*.15);
 return{snowCm:15,density:100,spacing:Math.max(.5,Math.ceil(Math.max(w,d)/25*10)/10),groundZ:b.min[2],x0:b.min[0]-pad,x1:b.max[0]+pad,y0:b.min[1]-pad,y1:b.max[1]+pad};
}
export function validateSnow(i){
 for(const key of SNOW_KEYS)if(!Number.isFinite(i[key]))throw Error('Enter a finite number for '+key+'.');
 if(i.snowCm<0||i.snowCm>1000)throw Error('Snowfall depth must be between 0 and 1,000 cm.');
 if(i.density<10||i.density>600)throw Error('New-snow density must be between 10 and 600 kg/m³ for this screening model.');
 if(i.spacing<.1)throw Error('Grid spacing must be at least 0.1 m.');
 if(!(i.x1>i.x0&&i.y1>i.y0))throw Error('The evaluation region needs positive width and depth.');
 const area=(i.x1-i.x0)*(i.y1-i.y0);
 if(!Number.isFinite(area)||!Number.isFinite(area*i.snowCm/100*i.density))throw Error('The region or snow quantity is too large to represent safely.');
 const nx=Math.max(1,Math.ceil((i.x1-i.x0)/i.spacing)),ny=Math.max(1,Math.ceil((i.y1-i.y0)/i.spacing));
 if(!Number.isSafeInteger(nx*ny)||nx*ny>4096)throw Error('The region exceeds 4,096 cells. Increase spacing or reduce the region. It was not changed automatically.');
 return{nx,ny,dx:(i.x1-i.x0)/nx,dy:(i.y1-i.y0)/ny};
}
// Vertical first-hit sampling on original triangles. A BVH rejects unrelated XY
// regions; barycentric interpolation retains sloped roofs and terrain elevations.
export function topReceiver(tree,x,y){
 let hit=null;
 const walk=n=>{
  if(!n||x<n.lo[0]-1e-8||x>n.hi[0]+1e-8||y<n.lo[1]-1e-8||y>n.hi[1]+1e-8||(hit&&n.hi[2]<hit.z))return;
  if(!n.items){const first=(n.a?.hi[2]||0)>(n.b?.hi[2]||0)?n.a:n.b;walk(first);walk(first===n.a?n.b:n.a);return;}
  for(const t of n.items){
   const p=t.p,ax=p[3]-p[0],ay=p[4]-p[1],bx=p[6]-p[0],by=p[7]-p[1],det=ax*by-ay*bx;
   if(Math.abs(det)<1e-12)continue;
   const px=x-p[0],py=y-p[1],u=(px*by-py*bx)/det,v=(ax*py-ay*px)/det;
   if(u< -1e-9||v< -1e-9||u+v>1+1e-9)continue;
   const z=p[2]+u*(p[5]-p[2])+v*(p[8]-p[2]);
   if(!hit||z>hit.z)hit={z,key:t.key};
  }
 };
 walk(tree.root);return hit;
}
export function snowAnalysis(meshes,input,onProgress=()=>{}){
 const grid=validateSnow(input);if(!meshes.length)throw Error('A saved model with source surfaces is required.');
 const tree=geometry(meshes);if(!tree.triangles)throw Error('The model has no triangles.');
 const names=new Map(meshes.map(m=>[m.key,m.name||m.key])),area=grid.dx*grid.dy,depth=input.snowCm/100;
 const totals={areaM2:0,groundAreaM2:0,surfaceAreaM2:0,groundVolumeM3:0,surfaceVolumeM3:0,volumeM3:0,massKg:0,waterM3:0,waterEquivalentMm:depth*input.density,fallbackAreaM2:0};
 const samples=[];
 for(let j=0;j<grid.ny;j++){
  for(let i=0;i<grid.nx;i++){
   const x=input.x0+(i+.5)*grid.dx,y=input.y0+(j+.5)*grid.dy,hit=topReceiver(tree,x,y),fallback=!hit;
   const ground=fallback||/(^|:)(terrain|ground|site)(:|$)/i.test(hit.key),receiver=ground?'ground':'roof/model surface';
   const z=hit?.z??input.groundZ,volume=area*depth,mass=volume*input.density;
   samples.push({x,y,z,snowTopM:z+depth,value:input.snowCm,areaM2:area,volumeM3:volume,massKg:mass,receiver,key:hit?.key||'assumed-ground',name:hit?names.get(hit.key):'Assumed flat ground',fallback});
   totals.areaM2+=area;totals.volumeM3+=volume;totals.massKg+=mass;totals.waterM3+=mass/1000;
   if(ground){totals.groundAreaM2+=area;totals.groundVolumeM3+=volume;}else{totals.surfaceAreaM2+=area;totals.surfaceVolumeM3+=volume;}
   if(fallback)totals.fallbackAreaM2+=area;
  }
  onProgress({completed:j+1,total:grid.ny});
 }
 return{kind:'snow',release:SNOW_RELEASE,scope:SNOW_SCOPE,unit:'cm',input:{...input},grid,samples,totals,triangles:tree.triangles,computedAt:new Date().toISOString(),methodSource:SNOW_SOURCE};
}
