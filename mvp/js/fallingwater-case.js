import {landscape,ground} from './fallingwater-landscape.js';
import {details} from './fallingwater-details.js';
import * as H from './fallingwater-habs.js?v=habs-20261116-1';
// The main house traced from the HABS PA-5346 measured drawings (fallingwater-habs.js: plans, sections, south elevation), at their
// true scale and levels; the site and terrain round it approximate. Not as-built survey data; source rasters are not shipped.
export const title='Fallingwater · main house';
export const source='https://www.loc.gov/resource/hhh.pa1690.sheet?st=gallery';
export const site={label:'Fallingwater, Mill Run, Pennsylvania',lat:39.90631,lon:-79.46804,north:315,tz:'America/New_York',wind:2.5,windDir:'SW'};
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
  const a=xy(x0,y0),b=xy(x1,y1),L=Math.hypot(b[0]-a[0],b[1]-a[1]),id=wall(lv,a,b,t*H.PX,kind==='glass'?'Glazing':kind==='stone'?'Stonework':'Walls');
  const along=(q)=>Math.abs(x1-x0)>=Math.abs(y1-y0)?Math.abs(q-x0)*H.PX:Math.abs(q-y0)*H.PX;
  if(kind==='glass'){const D=(extra||[]).map(([f,g])=>[along(f),along(g)]).sort((p,q)=>p[0]-q[0]);let s0=.05;for(const [f,g] of D){op(id,s0,f-.02,'win');op(id,f,g,'door');s0=g+.02;}op(id,s0,L-.05,'win');}
  else if(kind==='door')op(id,.05,L-.05,'door');}
 // arc walls: one wall each, bent by its bulge (tan of a quarter of the angle it turns through; above 0 it bends to the right of a → b)
 for(const [lv,list] of Object.entries(H.ARCS))for(const A of list){const P=(deg)=>{const a=deg*Math.PI/180;return xy(A.c[0]+A.r*Math.cos(a),A.c[1]+A.r*Math.sin(a));},a=P(A.a0),b=P(A.a1),m=P((A.a0+A.a1)/2),right=((b[0]-a[0])*(m[1]-a[1])-(b[1]-a[1])*(m[0]-a[0]))<0;
  const id=wall(lv,a,b,A.t*H.PX,A.kind==='glass'?'Glazing':'Stonework');walls.find(w=>w.id===id).bulge=round((right?1:-1)*Math.tan(Math.abs(A.a1-A.a0)*Math.PI/180/4)*1e3)/1e3;}
 for(const [lv,list] of Object.entries(H.ROOMS))for(const [name,x,y] of list){const [a,b]=xy(x,y);names.push({lv,name,x:a,y:b});}
 const rect=(lv,x0,y0,x1,y1,layer,th,holes)=>{const [a,b]=xy(x0,y1),[c,d]=xy(x1,y0);floors.push({id:`f${floors.length+1}`,lv,x:a,y:b,w:round(c-a),d:round(d-b),thickness:th,object_type:'floor',layer,...(holes?{holes:holes.map(([p,q,r,s])=>[xy(p,q),xy(r,q),xy(r,s),xy(p,s)])}:{})});};
 for(const [lv,list] of Object.entries(H.FLOORS))for(const [x0,y0,x1,y1,holes] of list)rect(lv,x0,y0,x1,y1,'Flagstone floors',.3,holes);
 for(const [lv,list] of Object.entries(H.TERRACES))for(const t of list)for(const [x0,y0,x1,y1] of t.slabs)rect(lv,x0,y0,x1,y1,t.roof?'Roof':'Structure',t.roof?.35:.45);
 // the roof over the third level, a level of its own at 24'-7 3/8" (sheet 10)
 levels.push({id:'RF',name:'Roof',z:H.ROOF.z,h:.35});LV.RF=levels.at(-1);for(const [x0,y0,x1,y1] of H.ROOF.slabs)rect('RF',x0,y0,x1,y1,'Roof',.35);
 // the stairs between levels, as Plan Studio's own straight stairs (the openings above follow)
 for(const [lv,x0,y0,x1,y1,dir] of H.STAIRS){const [cx,cy]=xy((x0+x1)/2,(y0+y1)/2),ew=dir==='E'||dir==='W',run=(ew?x1-x0:y1-y0)*H.PX,wid=(ew?y1-y0:x1-x0)*H.PX,rot={N:0,S:Math.PI,E:-Math.PI/2,W:Math.PI/2}[dir];
  furn.push({id:`st${furn.length+1}`,lv,type:'straight',gen:{id:'straight',vals:{use:'private',kind:'stringer',H:Math.round(LV[lv].h*1000),W:Math.round(wid*1000),T:Math.round(run/Math.max(1,Math.round(LV[lv].h/.18)-1)*1000),topLanding:false,rails:'both',glass:false,color_wood:'#d9c4a0',n:Math.round(LV[lv].h/.18)},auto:true},name:'Stair',x:cx,y:cy,w:round(wid),d:round(run),h:LV[lv].h,rot,object_type:'furniture',layer:'Stairs',semanticCategory:'Furniture',semanticSource:'Plan Studio object'});}
 // ---- furniture and fixtures: every piece a rectangle on the plan sheets (4, 5, 6), at its drawn position and plan size; fixtures
 // and loose pieces are the catalogue's generators sized to the drawing; built-ins are blocks on the joinery layer. The plans give no
 // heights: built-ins take the catalogue's standard height for their kind (desk .74, counter .9, wardrobe 2.1, bookcase 1.8).
 // A piece's back is its local +y; rot turns it: 0 back to the north (plan up), -PI/2 east, PI back to the south, PI/2 west.
 const item=(lv,label,x0,y0,x1,y1,h,type,layer)=>{const [a,b]=xy((x0+x1)/2,(y0+y1)/2);furn.push({id:`u${furn.length+1}`,lv,type:type||'box',name:label,label,x:a,y:b,w:round((x1-x0)*H.PX),d:round((y1-y0)*H.PX),h,rot:0,object_type:'furniture',layer:layer||'Furniture',semanticCategory:'Furniture',semanticSource:'Plan Studio object'});};
 const built=(lv,label,x0,y0,x1,y1,h)=>item(lv,label,x0,y0,x1,y1,h,'box','Built-in joinery');
 const mm=(px)=>Math.round(px*H.PX*1000);
 const piece=(lv,label,gen,x0,y0,x1,y1,rot,vals)=>{const [a,b]=xy((x0+x1)/2,(y0+y1)/2);furn.push({id:`u${furn.length+1}`,lv,type:gen,gen:{id:gen,vals:vals||{}},name:label,label,x:a,y:b,w:round((x1-x0)*H.PX),d:round((y1-y0)*H.PX),h:1,rot:rot||0,object_type:'furniture',layer:'Furniture',semanticCategory:'Furniture',semanticSource:'Plan Studio object'});};
 const bed=(lv,label,x0,y0,x1,y1,rot)=>{const along=rot===0||rot===Math.PI?y1-y0:x1-x0,across=rot===0||rot===Math.PI?x1-x0:y1-y0;piece(lv,label,'bed',x0,y0,x1,y1,rot,{W:Math.max(800,mm(across)-60),L:Math.max(1800,mm(along)-60),head:true});};
 const tub=(lv,x0,y0,x1,y1)=>{const L=Math.max(x1-x0,y1-y0),W=Math.min(x1-x0,y1-y0);piece(lv,'Bathtub','bathtub',x0,y0,x1,y1,y1-y0>x1-x0?Math.PI/2:0,{L:Math.max(1400,Math.min(1830,mm(L))),W:Math.max(700,Math.min(900,mm(W)))});};
 const E=-Math.PI/2,Wd=Math.PI/2,N=0,S=Math.PI;
 // sheet 4 · living level
 piece('L1','Dining table','dining',1662,1240,1750,1385,0,{L:mm(145),W:mm(88),shape:'rect'});
 for(const [cx,cy,r] of [[1640,1268,Wd],[1640,1333,Wd],[1778,1268,E],[1778,1333,E]])piece('L1','Dining chair','chair',cx-21,cy-21,cx+21,cy+21,r);
 built('L1','Built-in table at the hatch',1920,1810,2030,1950,.74);
 built('L1','Kitchen counter with sink',1105,1095,1130,1365,.9);
 built('L1','Kitchen cabinet',1208,1010,1258,1037,.9);
 piece('L1','Refrigerator','fridge',1262,996,1343,1050,N,{W:Math.min(910,mm(81)),D:Math.min(800,mm(54))});
 built('L1','Kitchen cabinet',1325,1100,1378,1166,.9);
 piece('L1','Range','range',1325,1305,1378,1380,E,{W:Math.max(600,mm(75)),D:Math.min(720,mm(53))});
 // sheet 5 · bedroom level
 bed('L2','Dressing room bed',1219,1116,1380,1200,Wd);
 built('L2','Dressing room closet',1109,1260,1193,1355,2.1);built('L2','Dressing room desk (sheet 11 detail)',1200,990,1380,1030,.74);
 tub('L2',1623,1008,1682,1135);built('L2','Bath cabinet',1557,983,1613,1025,.9);
 piece('L2','Sink','vanity',1517,1106,1567,1138,S,{W:Math.max(600,mm(50)),D:Math.max(420,mm(32)),mirror:false});
 piece('L2','Toilet','toilet',1436,1098,1471,1150,Wd);
 bed('L2','Master bed',1636,1410,1803,1588,E);
 built('L2','Master bedroom wardrobe',1755,1588,1803,1669,2.1);
 tub('L2',1818,1327,1894,1459);
 piece('L2','Sink','vanity',1965,1368,1991,1415,E,{W:Math.max(600,mm(47)),D:Math.max(420,mm(26)),mirror:false});
 piece('L2','Toilet','toilet',1938,1427,1988,1456,E);
 piece('L2','Toilet','toilet',1841,1512,1876,1574,N);
 piece('L2','Shower','shower',1909,1512,1991,1595,N,{W:Math.max(800,mm(82)),D:Math.max(800,mm(83)),type:'corner'});
 built('L2','Bath cabinet',1821,1600,1844,1686,.9);
 piece('L2','Sink','vanity',1926,1745,1982,1777,S,{W:Math.max(600,mm(56)),D:Math.max(420,mm(32)),mirror:false});
 bed('L2','Guest bed',2142,1510,2280,1580,E);
 built('L2','Guest bedroom wardrobe',2097,1397,2305,1447,2.1);
 built('L2','Guest bedroom desk',2007,1660,2072,1780,.74);
 // sheet 6 · study level
 built('L3','Study desk, north run',1125,1005,1390,1050,.74);built('L3','Study desk, west run',1085,1050,1125,1195,.74);
 built('L3','Study bookcase',1335,1050,1392,1225,1.8);
 piece('L3','Sink','vanity',1420,1059,1448,1112,Wd,{W:Math.max(600,mm(53)),D:Math.max(420,mm(28)),mirror:false});
 piece('L3','Toilet','toilet',1503,1126,1531,1179,S);
 built('L3','Bath cabinet',1450,1013,1575,1041,.9);
 bed('L3','Sleeping alcove bed',1909,1112,1987,1273,N);
 // ---- the guest house, a level of its own up the hill (site plan, sheet 2): stone walls on three sides, glass to the south with the
 // same red sash, a living room and a bedroom; its floor just above the ground at its middle
 const G=H.GUEST,gp=(x,y)=>xy(...H.sitePx(x,y)),[gx0,gy0,gx1,gy1]=G.walls,gc=gp((gx0+gx1)/2,(gy0+gy1)/2),gz=round(ground(...gc)+.6);
 levels.push({id:'G1',name:'Guest house',z:gz,h:2.75});LV.G1=levels.at(-1);
 const gw=(a,b,t,kind,doors)=>{const id=wall('G1',a,b,t,kind==='glass'?'Guest glazing':'Stonework');const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(kind==='glass'){let s0=.05;for(const [f,g] of doors||[]){op(id,s0,f-.02,'win');op(id,f,g,'door');s0=g+.02;}op(id,s0,L-.05,'win');}else for(const [f,g] of doors||[])op(id,f,g,'door');return id;};
 const toAlong=(a0,v)=>(v-a0)*2.5*H.PX;
 gw(gp(gx0,gy0),gp(gx1,gy0),.45,'stone');gw(gp(gx0,gy0),gp(gx0,gy1),.45,'stone');gw(gp(gx1,gy0),gp(gx1,gy1),.45,'stone',G.east.doors.map(([f,g])=>[toAlong(gy0,f),toAlong(gy0,g)]));
 gw(gp(gx0,gy1),gp(gx1,gy1),.12,'glass',G.south.doors.map(([f,g])=>[toAlong(gx0,f),toAlong(gx0,g)]));
 gw(gp(G.partition,gy0),gp(G.partition,gy1),.15,'part',[[toAlong(gy0,gy1)-1.6,toAlong(gy0,gy1)-.7]]);
 for(const [name,x,y] of G.rooms){const [a,b]=gp(x,y);names.push({lv:'G1',name,x:a,y:b});}
 { const [a,b]=gp(gx0,gy1),[c,d]=gp(gx1,gy0);floors.push({id:`f${floors.length+1}`,lv:'G1',x:a,y:b,w:round(c-a),d:round(d-b),thickness:.3,object_type:'floor',layer:'Flagstone floors'}); }
 { const [x0,y0,x1,y1]=G.terrace,[a,b]=gp(x0,y1),[c,d]=gp(x1,y0);floors.push({id:`f${floors.length+1}`,lv:'G1',x:a,y:b,w:round(c-a),d:round(d-b),thickness:.45,object_type:'floor',layer:'Structure'}); }
 // the guest house is drawn only as a footprint on the site plan (sheet 2): no furniture is shown, so none is modelled
 // Site diagram: Bear Run and the sloping bank are approximated from the survey.
 // Rotate plan-space coordinates back into the site's east/north frame.
 // true north is 45° clockwise from the drawings' up (the HABS north arrow), so the plan's up is north-west
 const r=Math.SQRT1_2, world=([x,y])=>[(x-y)*r,(x+y)*r];
 const {water,features,centre}=landscape(),detail=details(xy,ground,{gz}),n=201,step=2.5,z=[];
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const e=-250+step*i,k=-250+step*j;z.push(round(ground((e+k)*r,(k-e)*r)));}
 const paths=[{id:'approach',name:'Approach to main house',cls:'path',width:2.1,pts:[[30,10],[25,8],[22,5],[23,2],[24,0]].map(p=>world(p))},{id:'woodland-path',name:'Woodland path',cls:'path',width:1.6,pts:[[-22,10],[-16,9],[-10,8],[-5,9],[-2,11],[4,13],[8,13]].map(p=>world(p))}];
 const origin={lat:site.lat,lon:site.lon,label:site.label};
 const context={v:1,id:'habs-pa5346-site',version:3,crs:'local-tm',origin,north:0,boundary:{kind:'radius',r:250},tz:-5,dst:1,buildings:[],roads:paths,trees:[],features3d:features,areas:[{id:'bear-run',kind:'water',name:'Bear Run',pts:water,water:{type:'stream',centre,depth:.6,speed:.8,discharge:.5}},{id:'guest-pool',kind:'water',name:'Guest house plunge pool',pts:detail.pool.pts.map(p=>world(p).map(v=>+v.toFixed(2))),water:{type:'pond',level:detail.pool.level,depth:+(detail.pool.level-detail.pool.bottom).toFixed(2)}}],sources:[{provider:'HABS PA-5346',attribution:'Library of Congress · HABS PA-5346 measured drawings; plans traced at true scale, levels from the sections',url:source},{provider:'USGS 3DEP',attribution:'USGS National Map · outer terrain',url:'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer'}],terrain:{provider:'USGS 3DEP outer terrain + HABS section-based creek reconstruction',res:step,relief:round(Math.max(...z)-Math.min(...z)),grid:{x0:-250,y0:-250,step,nx:n,ny:n,z}}};
 const studio={v:2,id:'fallingwater',name:title,units:'m',north:site.north,version:2,imports:detail.imports,masses:[],levels,walls,ops,floors,names,furn,voids:[],fences:[],ceil:[],notes:[],hiddenIds:[],lights:[],climate:{from:225,U10:2.5,terrain:'suburban',Tout:18,Tin:24},targets:{ach:5,df:2},site:context};
 return {units:'m',north:site.north,layers:['Site','Masses','Context','Structure','Flagstone floors','Walls','Glazing','Guest glazing','Roof','Rooms','Furniture','Built-in joinery','Stonework','Terrace rails','Stairs','Walkway steel','Kettle'].map(name=>({name,color:({Stonework:'#8f8371','Terrace rails':'#e2cc98',Stairs:'#bdb6a7'})[name],visible:true,locked:name==='Site',...(LOOKS[name]?{material:LOOKS[name][0],props:{color:LOOKS[name][1]}}:{})})),components:[],meshes:detail.meshes,studio};
}


