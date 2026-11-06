import {landscape,ground} from './fallingwater-landscape.js';
import {details} from './fallingwater-details.js';
import * as H from './fallingwater-habs.js?v=habs-20261107-1';
// The main house traced from the HABS PA-5346 measured drawings (fallingwater-habs.js: plans, sections, south elevation), at their
// true scale and levels; the site and terrain round it approximate. Not as-built survey data; source rasters are not shipped.
export const title='Fallingwater · main house';
export const source='https://www.loc.gov/resource/hhh.pa1690.sheet?st=gallery';
export const site={label:'Fallingwater, Mill Run, Pennsylvania',lat:39.90631,lon:-79.46804,north:45,tz:'America/New_York',wind:2.5,windDir:'SW'};
const round=n=>+n.toFixed(3);
// a drawing pixel (25 px to the foot) to plan metres; the sheets' y runs down, the plan's up
const xy=(x,y)=>[round((x-H.ORIGIN[0])*H.PX),round((H.ORIGIN[1]-y)*H.PX)];
// layer materials: Wright's light ochre concrete, the coursed Pottsville sandstone, waxed flagstone floors, walnut built-ins,
// Cherokee-red steel and the red kettle; colours approximate, for the 3D view and rendering
const LOOKS={Structure:['concrete','#e0c994'],'Terrace rails':['concrete','#e2cc98'],Roof:['concrete','#e0c994'],Walls:['plaster','#e6d4a6'],Stonework:['stone','#8f8371'],'Flagstone floors':['stone','#77705f'],Stairs:['concrete','#d9c59a'],'Built-in joinery':['timber-cladding','#6e4b30'],Glazing:['glass-double','#a9c6d6'],'Guest glazing':['glass-double','#a9c6d6'],'Walkway steel':['steel','#9b3a26'],Kettle:['steel','#b8321f']};
export function caseModel(open=.05){
 const levels=H.LEVELS.map(l=>({...l})),walls=[],ops=[],floors=[],names=[],furn=[],LV=Object.fromEntries(levels.map(l=>[l.id,l]));
 const wall=(lv,a,b,t,layer)=>{const id=`w${walls.length+1}`;walls.push({id,lv,a,b,t:round(Math.max(.06,t)),h:LV[lv].h,object_type:'wall',layer});return id;};
 const op=(id,from,to,kind)=>{const w=walls.find(x=>x.id===id),L=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]),a=Math.max(0,Math.min(from,to)),b=Math.min(L,Math.max(from,to));if(b-a<.3)return;const door=kind==='door',H0=LV[w.lv].h;
  ops.push({id:`o${ops.length+1}`,wall:id,pos:round((a+b)/2),w:round(b-a),kind:door?'door':'win',object_type:door?'door':'window',sill:door?0:.05,head:round(door?Math.min(2.1,H0-.1):H0-.12),open:door?.6:open,flip:1,...(door?{}:{frame:'#9b3a26'})});};
 // the hatched masonry of the plans: each run a stone wall along its longer side, as thick as the drawing shows it
 for(const [lv,R] of Object.entries(H.STONE))for(const [x0,y0,x1,y1] of R){const w=x1-x0,h=y1-y0;
  if(w>=h)wall(lv,xy(x0,(y0+y1)/2),xy(x1,(y0+y1)/2),h*H.PX,'Stonework');else wall(lv,xy((x0+x1)/2,y0),xy((x0+x1)/2,y1),w*H.PX,'Stonework');}
 // glass, partitions and doors read from the drawings
 for(const [lv,list] of Object.entries(H.WALLS))for(const [x0,y0,x1,y1,t,kind,extra] of list){
  if(kind==='pier'){const w=x1-x0,h=y1-y0;if(w>=h)wall(lv,xy(x0,(y0+y1)/2),xy(x1,(y0+y1)/2),h*H.PX,'Stonework');else wall(lv,xy((x0+x1)/2,y0),xy((x0+x1)/2,y1),w*H.PX,'Stonework');continue;}
  const a=xy(x0,y0),b=xy(x1,y1),L=Math.hypot(b[0]-a[0],b[1]-a[1]),id=wall(lv,a,b,t*H.PX,kind==='glass'?'Walls':kind==='stone'?'Stonework':'Walls');
  const along=(q)=>Math.abs(x1-x0)>=Math.abs(y1-y0)?Math.abs(q-x0)*H.PX:Math.abs(q-y0)*H.PX;
  if(kind==='glass'){const D=(extra||[]).map(([f,g])=>[along(f),along(g)]).sort((p,q)=>p[0]-q[0]);let s0=.05;for(const [f,g] of D){op(id,s0,f-.02,'win');op(id,f,g,'door');s0=g+.02;}op(id,s0,L-.05,'win');}
  else if(kind==='door')op(id,.05,L-.05,'door');}
 for(const [lv,list] of Object.entries(H.ROOMS))for(const [name,x,y] of list){const [a,b]=xy(x,y);names.push({lv,name,x:a,y:b});}
 const rect=(lv,x0,y0,x1,y1,layer,th,holes)=>{const [a,b]=xy(x0,y1),[c,d]=xy(x1,y0);floors.push({id:`f${floors.length+1}`,lv,x:a,y:b,w:round(c-a),d:round(d-b),thickness:th,object_type:'floor',layer,...(holes?{holes:holes.map(([p,q,r,s])=>[xy(p,q),xy(r,q),xy(r,s),xy(p,s)])}:{})});};
 for(const [lv,list] of Object.entries(H.FLOORS))for(const [x0,y0,x1,y1,holes] of list)rect(lv,x0,y0,x1,y1,'Flagstone floors',.3,holes);
 for(const [lv,list] of Object.entries(H.TERRACES))for(const t of list)for(const [x0,y0,x1,y1] of t.slabs)rect(lv,x0,y0,x1,y1,t.roof?'Roof':'Structure',t.roof?.35:.45);
 // the stairs between levels, as Plan Studio's own straight stairs (the openings above follow)
 for(const [lv,x0,y0,x1,y1,dir] of H.STAIRS){const [cx,cy]=xy((x0+x1)/2,(y0+y1)/2),ew=dir==='E'||dir==='W',run=(ew?x1-x0:y1-y0)*H.PX,wid=(ew?y1-y0:x1-x0)*H.PX,rot={N:0,S:Math.PI,E:-Math.PI/2,W:Math.PI/2}[dir];
  furn.push({id:`st${furn.length+1}`,lv,type:'straight',gen:{id:'straight',vals:{use:'private',kind:'stringer',H:Math.round(LV[lv].h*1000),W:Math.round(wid*1000),T:Math.round(run/Math.max(1,Math.round(LV[lv].h/.18)-1)*1000),topLanding:false,rails:'both',glass:false,color_wood:'#d9c4a0',n:Math.round(LV[lv].h/.18)},auto:true},name:'Stair',x:cx,y:cy,w:round(wid),d:round(run),h:LV[lv].h,rot,object_type:'furniture',layer:'Stairs'});}
 // furniture where the drawings show it (sizes from the plans)
 const item=(lv,label,x0,y0,x1,y1,h,type)=>{const [a,b]=xy((x0+x1)/2,(y0+y1)/2);furn.push({id:`u${furn.length+1}`,lv,type:type||'box',name:label,label,x:a,y:b,w:round((x1-x0)*H.PX),d:round((y1-y0)*H.PX),h,rot:0,object_type:'furniture',layer:'Furniture'});};
 item('L1','Dining table',1667,1220,1750,1385,.74,'dining');item('L1','Living room table',1840,1780,1935,1930,.45,'coffee');item('L1','Kitchen counter',1100,1010,1150,1340,.9);item('L1','Kitchen range',1325,1310,1390,1385,.9);
 item('L2','Master bed',1638,1409,1809,1567,.55,'bed');item('L2','Guest bed',2144,1508,2304,1580,.55,'bed1');item('L2','Dressing room table',1180,1110,1300,1200,.74,'desk');
 item('L3','Study desk',1110,1040,1300,1090,.74,'desk');item('L3','Alcove bed',1880,1130,2030,1200,.5,'bed1');
 // Site diagram: Bear Run and the sloping bank are approximated from the survey.
 // Rotate plan-space coordinates back into the site's east/north frame.
 const r=Math.SQRT1_2, world=([x,y])=>[(x+y)*r,(y-x)*r];
 const {water,features,centre}=landscape(),detail=details(xy,ground),n=201,step=2.5,z=[];
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const e=-250+step*i,k=-250+step*j;z.push(round(ground((e-k)*r,(e+k)*r)));}
 const paths=[{id:'approach',name:'Approach to main house',cls:'path',width:2.1,pts:[[30,10],[25,8],[22,5],[23,2],[24,0]].map(p=>world(p))},{id:'woodland-path',name:'Woodland path',cls:'path',width:1.6,pts:[[-22,10],[-16,9],[-10,8],[-5,9],[-2,11],[4,13],[8,13]].map(p=>world(p))}];
 const origin={lat:site.lat,lon:site.lon,label:site.label};
 const context={v:1,id:'habs-pa5346-site',version:3,crs:'local-tm',origin,north:0,boundary:{kind:'radius',r:250},tz:-5,dst:1,buildings:[],roads:paths,trees:[],features3d:features,areas:[{id:'bear-run',kind:'water',name:'Bear Run',pts:water,water:{type:'stream',centre,depth:.6,speed:.8,discharge:.5}},{id:'guest-pool',kind:'water',name:'Guest house plunge pool',pts:detail.pool.pts.map(p=>world(p).map(v=>+v.toFixed(2))),water:{type:'pond',level:detail.pool.level,depth:+(detail.pool.level-detail.pool.bottom).toFixed(2)}}],sources:[{provider:'HABS PA-5346',attribution:'Library of Congress · HABS PA-5346 measured drawings; plans traced at true scale, levels from the sections',url:source},{provider:'USGS 3DEP',attribution:'USGS National Map · outer terrain',url:'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer'}],terrain:{provider:'USGS 3DEP outer terrain + HABS section-based creek reconstruction',res:step,relief:round(Math.max(...z)-Math.min(...z)),grid:{x0:-250,y0:-250,step,nx:n,ny:n,z}}};
 const studio={v:2,id:'fallingwater',name:title,units:'m',north:site.north,version:2,imports:detail.imports,masses:[],levels,walls,ops,floors,names,furn,voids:[],fences:[],ceil:[],notes:[],hiddenIds:[],lights:[],climate:{from:225,U10:2.5,terrain:'suburban',Tout:18,Tin:24},targets:{ach:5,df:2},site:context};
 return {units:'m',north:site.north,layers:['Site','Masses','Context','Structure','Flagstone floors','Walls','Glazing','Guest glazing','Roof','Rooms','Furniture','Built-in joinery','Stonework','Terrace rails','Stairs','Walkway steel','Kettle'].map(name=>({name,color:({Stonework:'#8f8371','Terrace rails':'#e2cc98',Stairs:'#bdb6a7'})[name],visible:true,locked:name==='Site',...(LOOKS[name]?{material:LOOKS[name][0],props:{color:LOOKS[name][1]}}:{})})),components:[],meshes:detail.meshes,studio};
}


