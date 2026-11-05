// Immutable geometry adapter. Room keys are valid only for this model snapshot.
export const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
export const inside=(p,rects)=>rects.some(([x,y,w,h])=>p[0]>=x-1e-6&&p[0]<=x+w+1e-6&&p[1]>=y-1e-6&&p[1]<=y+h+1e-6);
export function digest(value){let h=2166136261;for(const c of JSON.stringify(value))h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0).toString(16);}
export function adaptScene(raw){
 const rooms=[],doors=[],walls=[],furniture=[],levels=raw.studio.levels.map(l=>({id:l.id,name:l.name,z:l.z||0,h:l.h||3}));
 for(const sc of raw.scenes){const lv=levels.find(l=>l.id===sc.source.level),o=sc.origin||[0,0],P=p=>[p[0]+o[0],p[1]+o[1],lv.z];
  for(const r of sc.rooms||[])rooms.push({id:`${lv.id}:${r.id}`,lv:lv.id,name:r.name,p:P(r.label),rects:r.rects.map(([x,y,w,h])=>[x+o[0],y+o[1],w,h])});
  for(const [i,w] of sc.walls.entries()){const a=P(w.a),b=P(w.b),source=raw.studio.walls.find(x=>x.lv===lv.id&&distance([...x.a,lv.z],a)<.01&&distance([...x.b,lv.z],b)<.01);walls.push({id:source?.id||`${lv.id}:analysis-wall:${i}`,lv:lv.id,a,b,t:w.t||.2,h:w.h||lv.h});}
  for(const f of sc.furn||[])furniture.push({lv:lv.id,rect:[f.x+o[0],f.y+o[1],f.w,f.d],h:f.h||.8});
  for(const d of sc.open||[]){if(d.kind!=='door')continue;const original=raw.studio.ops.find(x=>x.id===d.id),wall=walls.find(w=>w.id===original?.wall),a=P(d.a),b=P(d.b),len=distance(a,b),mid=a.map((v,i)=>(v+b[i])/2),normal=[-(b[1]-a[1])/len,(b[0]-a[0])/len,0],sides=[];
   for(const sign of [-1,1]){let side;for(let off=(wall?.t||.2)/2+.15;off<=1.3;off+=.1){const p=mid.map((v,i)=>v+normal[i]*off*sign),r=rooms.find(r=>r.lv===lv.id&&inside(p,r.rects));if(r){side={room:r.id,p};break;}}if(side&&!sides.some(s=>s.room===side.room))sides.push(side);}
   doors.push({id:d.id,lv:lv.id,a,b,p:mid,width:len,wall:wall?.id,external:!!d.ext,sides,name:`${lv.name} · door ${d.id}`});
  }
 }
 const scene={levels,rooms,doors,walls,furniture,warnings:[]};
 if(raw.studio.imports?.length)scene.warnings.push('Imported meshes are not navigation obstacles. Review the plan and add their blocking geometry as walls or furniture before relying on routes.');
 for(const l of levels)if(!rooms.some(r=>r.lv===l.id))scene.warnings.push(`${l.name}: no enclosed rooms were detected. This level has no navigable area.`);
 for(const d of doors)if(!d.sides.length)scene.warnings.push(`${d.name}: no connected room detected.`);
 scene.hash=digest(scene);return scene;
}

// A synthetic editable teaching model, never presented as a real hospital or validated design.
export function hospitalModel(){
 const levels=[0,1,2].map(i=>({id:'H'+i,name:i?'Ward floor '+(i+1):'Ground floor',z:i*3.6,h:3.6})),walls=[],ops=[],names=[],floors=[];
 for(const l of levels){const wall=(id,a,b)=>{const w={id:l.id+'-'+id,lv:l.id,a,b,t:.2};walls.push(w);return w.id;},door=(id,wall,pos,w)=>ops.push({id:l.id+'-'+id,wall,pos,w,kind:'door',object_type:'door',sill:0,head:2.2,open:1});
  const west=wall('west',[0,0],[0,12]);wall('east',[18,0],[18,12]);wall('south',[0,0],[18,0]);wall('north',[0,12],[18,12]);
  const south=wall('ward-s',[0,5],[14,5]),north=wall('ward-n',[0,7],[14,7]),stair=wall('stair',[14,0],[14,12]);wall('split-s',[7,0],[7,5]);wall('split-n',[7,7],[7,12]);
  for(const [suffix,w] of [['s',south],['n',north]]){door('door-'+suffix+'1',w,3.5,1.4);door('door-'+suffix+'2',w,10.5,1.4);}door('stair-door',stair,6,1.4);if(l.id==='H0')door('exit',west,6,1.6);
  for(const [name,x,y] of [['Ward A',3.5,2.5],['Ward B',10.5,2.5],['Receiving compartment',3.5,9.5],['Ward C',10.5,9.5],['Corridor',7,6],['Stair landing',16,6]])names.push({lv:l.id,name,x,y});
  floors.push({id:l.id+'-floor',lv:l.id,x:0,y:0,w:18,d:12,thickness:.2});
 }
 return {units:'m',north:0,layers:[{name:'Walls',visible:true},{name:'Rooms',visible:true},{name:'Furniture',visible:true}],components:[],meshes:{},studio:{v:2,id:'hospital-teaching',name:'Hospital evacuation · synthetic study',units:'m',north:0,levels,walls,ops,names,floors,furn:[],imports:[],masses:[],voids:[],fences:[],ceil:[],notes:[],lights:[],hiddenIds:[],climate:{},targets:{}}};
}
