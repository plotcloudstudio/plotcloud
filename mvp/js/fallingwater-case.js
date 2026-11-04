import {landscape,ground} from './fallingwater-landscape.js';
import {details} from './fallingwater-details.js';
// Diagram-level reconstruction traced from HABS PA-5346 sheets 2, 4–6, 9–10.
// Source rasters are not shipped. Approximate geometry and study inputs are not as-built data.
export const title='Fallingwater · main house';
export const source='https://www.loc.gov/resource/hhh.pa1690.sheet?st=gallery';
export const site={label:'Fallingwater, Mill Run, Pennsylvania',lat:39.90631,lon:-79.46804,north:45,tz:'America/New_York',wind:2.5,windDir:'SW'};
const m=.0465,xy=(x,y)=>[+(m*(x-320)).toFixed(3),+(m*(410-y)).toFixed(3)];
const round=n=>+n.toFixed(3);
export function caseModel(open=.05){
 const levels=[{id:'L1',name:'Living level',z:0,h:2.55},{id:'L2',name:'Bedroom level',z:2.55,h:2.17},{id:'L3',name:'Study level',z:4.72,h:1.98}];
 const walls=[],ops=[],floors=[],names=[],furn=[];
 const wall=(lv,a,b,t=.25)=>{const id=`w${walls.length+1}`;walls.push({id,lv,a:xy(...a),b:xy(...b),t,object_type:'wall',layer:'Wall'});return id;};
 const loop=(lv,pts)=>pts.map((a,i)=>wall(lv,a,pts[(i+1)%pts.length]));
 const opening=(id,f,w,kind='win')=>{const a=walls.find(x=>x.id===id);ops.push({id:`o${ops.length+1}`,wall:id,pos:round(Math.hypot(a.a[0]-a.b[0],a.a[1]-a.b[1])*f),w,kind,sill:kind==='door'?0:.55,head:kind==='door'?1.95:1.85,open:kind==='door'? .6:open,flip:1});};
 const floor=(lv,x,y,x2,y2)=>{const [a,b]=xy(x,y2);floors.push({id:`f${floors.length+1}`,lv,x:a,y:b,w:round((x2-x)*m),d:round((y2-y)*m),thickness:.24,object_type:'floor',layer:'Floor'});};
 const name=(lv,label,x,y)=>{const[a,b]=xy(x,y);names.push({lv,name:label,x:a,y:b});};
 const item=(lv,label,x,y,w,d,h,id)=>{const[a,b]=xy(x,y);furn.push({id:`u${furn.length+1}`,lv,type:id||'box',name:label,label,x:a,y:b,w,d,h,rot:0,object_type:'furniture',layer:'Furniture',...(id?{gen:{id,vals:{}}}:{})});};
 // Exterior centre lines and room divisions simplified from the HABS floor sheets.
 const a=loop('L1',[[181,228],[325,228],[325,271],[523,271],[523,407],[455,407],[455,535],[311,535],[311,321],[250,321],[250,274],[181,274]]);
 opening(a[2],.53,1.6);opening(a[3],.45,2.1);opening(a[6],.48,4.3);opening(a[7],.58,2.7);opening(a[0],.25,1.6);opening(a[8],.44,1.5);opening(a[4],.43,.9,'door');ops.at(-1).open=0;
 opening(wall('L1',[325,271],[311,321],.16),.52,.9,'door');opening(wall('L1',[250,228],[250,274],.16),.55,.8,'door');
 name('L1','Living room',410,380);name('L1','Kitchen',285,273);name('L1','Service sitting room',210,252);
 floor('L1',181,228,325,274);floor('L1',250,274,325,321);floor('L1',311,271,523,407);floor('L1',235,452,598,543);floor('L1',311,407,598,452);floor('L1',806,411,894,611);
 item('L1','Built-in seating',344,497,2.8,.8,.76,'sofa');item('L1','Living room table',395,443,1.1,.65,.45,'coffee');item('L1','Dining table',454,315,1.7,.85,.75,'dining');item('L1','Kitchen counter',277,300,1.8,.62,.9);
 const b=loop('L2',[[247,229],[392,229],[392,251],[433,251],[433,122],[474,122],[474,251],[538,251],[538,301],[550,301],[550,409],[320,409],[320,320],[247,320]]);
 opening(b[0],.34,2.2);opening(b[4],.5,1.0,'door');ops.at(-1).open=0;opening(b[9],.61,1.8);opening(b[10],.18,2.2);opening(b[10],.77,2.8);opening(b[12],.45,1.7);
 opening(wall('L2',[320,320],[320,229],.16),.52,.85,'door');opening(wall('L2',[320,303],[550,303],.16),.16,.9,'door');opening(wall('L2',[466,303],[466,409],.16),.18,.83,'door');opening(wall('L2',[416,303],[416,409],.16),.55,.75,'door');
 name('L2','Dressing room',280,275);name('L2','Hall and stair landing',403,281);name('L2','Main bedroom',371,361);name('L2','Bath',438,362);name('L2','Guest bedroom',505,367);
 floor('L2',74,201,247,301);floor('L2',247,229,550,409);floor('L2',433,122,474,229);floor('L2',317,409,463,580);floor('L2',550,346,700,415);
 item('L2','Main bed',365,366,1.55,2.05,.55,'bed');item('L2','Guest bed',510,371,1.3,2,.55,'bed');item('L2','Bath fittings',440,375,.8,1.35,.55,'bathtub');
 const c=loop('L3',[[246,228],[325,228],[325,253],[475,253],[475,283],[486,283],[486,307],[325,307],[325,332],[246,332]]);
 opening(c[0],.5,1.8);opening(c[2],.72,1.9);opening(c[6],.45,2.2);opening(c[9],.5,2.0);opening(wall('L3',[325,253],[325,307],.16),.5,.85,'door');
 name('L3','Study',286,275);name('L3','Gallery and sleeping alcove',399,283);
 floor('L3',246,228,325,332);floor('L3',325,253,486,307);floor('L3',325,307,530,384);
 item('L3','Study desk',278,261,1.25,.6,.73,'desk');item('L3','Gallery bench',389,292,1.5,.53,.45,'banquette');
 // Site diagram: Bear Run and the sloping bank are approximated from the survey.
 // Rotate plan-space coordinates back into the site's east/north frame.
 const r=Math.SQRT1_2, world=([x,y])=>[(x+y)*r,(y-x)*r];
 const {water,features}=landscape(),detail=details(xy),n=201,step=2.5,z=[];
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const e=-250+step*i,k=-250+step*j;z.push(round(ground((e-k)*r,(e+k)*r)));}
 const paths=[{id:'approach',name:'Approach to main house',cls:'path',width:2.1,pts:[[30,10],[25,8],[22,5],[23,2],[24,0]].map(p=>world(p))},{id:'woodland-path',name:'Woodland path',cls:'path',width:1.6,pts:[[-22,10],[-16,9],[-10,8],[-5,9],[-2,11],[4,13],[8,13]].map(p=>world(p))}];
 const origin={lat:site.lat,lon:site.lon,label:site.label};
 const context={v:1,id:'habs-pa5346-site',version:3,crs:'local-tm',origin,north:0,boundary:{kind:'radius',r:250},tz:-5,dst:1,buildings:[],roads:paths,trees:[],features3d:features,areas:[{id:'bear-run',kind:'water',name:'Bear Run',pts:water}],sources:[{provider:'HABS PA-5346',attribution:'Library of Congress · HABS PA-5346; diagrammatic trace',url:source},{provider:'USGS 3DEP',attribution:'USGS National Map · outer terrain',url:'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer'}],terrain:{provider:'USGS 3DEP outer terrain + HABS section-based creek reconstruction',res:step,relief:round(Math.max(...z)-Math.min(...z)),grid:{x0:-250,y0:-250,step,nx:n,ny:n,z}}};
 const studio={v:2,id:'fallingwater',name:title,units:'m',north:site.north,version:2,imports:detail.imports,masses:[],levels,walls,ops,floors,names,furn,voids:[],fences:[],ceil:[],notes:[],hiddenIds:[],lights:[],climate:{from:225,U10:2.5,terrain:'suburban',Tout:18,Tin:24},targets:{ach:5,df:2},site:context};
 return {units:'m',north:site.north,layers:['Site','Masses','Context','Structure','Walls','Glazing','Roof','Rooms','Furniture','Stonework','Terrace rails','Stairs'].map(name=>({name,color:({Stonework:'#a2957b','Terrace rails':'#d8d3c7',Stairs:'#bdb6a7'})[name],visible:true,locked:name==='Site'})),components:[],meshes:detail.meshes,studio};
}


