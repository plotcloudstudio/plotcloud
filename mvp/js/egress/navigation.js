import {EV} from '../circulation-engine.js';
import {inside,distance} from './scene.js';
const pointSegment=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
export class Heap{constructor(){this.a=[];}push(x){let i=this.a.length;this.a.push(x);while(i){const j=(i-1)>>1;if(this.a[j].t<=x.t)break;this.a[i]=this.a[j];i=j;}this.a[i]=x;}pop(){const first=this.a[0],last=this.a.pop();if(this.a.length){let i=0;while(2*i+1<this.a.length){let j=2*i+1;if(j+1<this.a.length&&this.a[j+1].t<this.a[j].t)j++;if(this.a[j].t>=last.t)break;this.a[i]=this.a[j];i=j;}this.a[i]=last;}return first;}get size(){return this.a.length;}}
export function navigation(scene,scenario,profile){
 const radius=profile.width/2,cell=scenario.grid,doors=scene.doors.map(d=>({...d,...scenario.doors[d.id]})),pieces=[];
 for(const w of scene.walls){const L=distance(w.a,w.b),d=w.a.map((v,i)=>(w.b[i]-v)/L),at=t=>w.a.map((v,i)=>v+d[i]*t),gaps=doors.filter(o=>o.wall===w.id).map(o=>{const mid=distance(w.a,o.p);return[mid-o.width/2,mid+o.width/2];}).sort((a,b)=>a[0]-b[0]);let pos=0;for(const [a,b]of gaps){if(a>pos)pieces.push({...w,a:at(pos),b:at(a)});pos=Math.max(pos,b);}if(pos<L)pieces.push({...w,a:at(pos),b:w.b});}
 const wallDistance=(p,w)=>{const L=distance(w.a,w.b),dx=(w.b[0]-w.a[0])/L,dy=(w.b[1]-w.a[1])/L,x=p[0]-w.a[0],y=p[1]-w.a[1],u=x*dx+y*dy,v=-x*dy+y*dx;return Math.hypot(Math.max(0,-u,u-L),Math.max(0,Math.abs(v)-w.t/2));};
 const clear=(p,lv)=>!pieces.some(w=>w.lv===lv&&wallDistance(p,w)<radius-1e-6)&&!scene.furniture.some(f=>f.lv===lv&&Math.hypot(Math.max(f.rect[0]-p[0],0,p[0]-f.rect[0]-f.rect[2]),Math.max(f.rect[1]-p[1],0,p[1]-f.rect[1]-f.rect[3]))<radius);
 const nodes=new Map(),edges=new Map(),warnings=[];
 const add=(id,room,p,kind)=>{nodes.set(id,{id,room,p,kind});edges.set(id,[]);return id;};
 const connect=(a,b,props,bidir=true)=>{if(!nodes.has(a)||!nodes.has(b))return;edges.get(a).push({to:b,...props});if(bidir)edges.get(b).push({to:a,...props,path:[...props.path].reverse()});};
 for(const room of scene.rooms)add('room:'+room.id,room.id,room.p,'room');
 const exits=new Set(),refuges=new Map();
 for(const r of scene.rooms)if(scenario.refuges?.[r.id]>0){refuges.set('room:'+r.id,{id:r.id,capacity:scenario.refuges[r.id]});}
 for(const door of doors){if(door.blocked||door.width<profile.width)continue;const sideIds=[];
  for(const side of door.sides){const r=scene.rooms.find(r=>r.id===side.room),v=side.p.map((x,i)=>x-door.p[i]),len=Math.hypot(v[0],v[1]);let p;for(let off=radius+.2;off<=1.6;off+=.1){const q=door.p.map((x,i)=>x+(v[i]/len)*off);if(inside(q,r.rects)&&clear(q,r.lv)){p=q;break;}}if(!p)continue;
   const id='door:'+door.id+':'+side.room;add(id,side.room,p,'door');sideIds.push(id);
  }
  if(sideIds.length===2){const path=[nodes.get(sideIds[0]).p,door.p,nodes.get(sideIds[1]).p];connect(...sideIds,{id:door.id,kind:'door',length:distance(path[0],path[1])+distance(path[1],path[2]),width:door.width,flow:scenario.specificFlow,path});}
  if(door.exit&&door.external&&sideIds.length===1){const a=nodes.get(sideIds[0]),to=add('exit:'+door.id,null,door.p,'exit');connect(a.id,to,{id:door.id,kind:'door',length:distance(a.p,door.p),width:door.width,flow:scenario.specificFlow,path:[a.p,door.p]},false);exits.add(to);}
 }
 for(const link of scenario.links||[]){if(scenario.mode==='horizontal'||link.blocked||link.width<profile.width||profile.stepFree&&!link.stepFree)continue;const a=nodes.get('room:'+link.from),b=nodes.get('room:'+link.to);if(!a||!b)continue;connect(a.id,b.id,{id:link.id,kind:'transfer',length:link.length,width:link.width,flow:scenario.specificFlow,speedFactor:link.speedFactor,path:[a.p,b.p]},true);}
 // Each room is a separate free-space graph: a path cannot bypass a closed door or walk outside.
 for(const room of scene.rooms){const ns=[...nodes.values()].filter(n=>n.room===room.id),xs=room.rects.flatMap(r=>[r[0],r[0]+r[2]]),ys=room.rects.flatMap(r=>[r[1],r[1]+r[3]]),x0=Math.min(...xs)-cell,y0=Math.min(...ys)-cell,W=Math.ceil((Math.max(...xs)-x0)/cell)+1,H=Math.ceil((Math.max(...ys)-y0)/cell)+1;
  if(W*H>150000)throw Error('Room navigation grid is too large. Increase the grid spacing.');const G={W,H,cell,blocked:new Uint8Array(W*H)};
  const point=i=>[x0+(i%W+.5)*cell,y0+(Math.floor(i/W)+.5)*cell,room.p[2]];
  for(let i=0;i<W*H;i++){const p=point(i);G.blocked[i]=!(inside(p,room.rects)&&clear(p,room.lv));}
  const snap=p=>{let best=-1,d=Infinity;for(let i=0;i<W*H;i++)if(!G.blocked[i]){const len=distance(point(i),p);if(len<d){d=len;best=i;}}return d<=1.5?best:-1;};
  for(const n of ns){n.cell=snap(n.p);if(n.cell>=0){const q=point(n.cell);if(n.kind==='room'&&distance(q,n.p)>cell*1.5)warnings.push(`${room.name}: representative start moved ${distance(q,n.p).toFixed(2)} m to clear floor.`);if(n.kind==='room')n.p=q;} }
  for(let i=0;i<ns.length;i++)for(let j=i+1;j<ns.length;j++){const a=ns[i],b=ns[j];if(a.cell<0||b.cell<0)continue;const route=EV.astar(G,[a.cell%W,Math.floor(a.cell/W)],[b.cell%W,Math.floor(b.cell/W)]);if(!route)continue;
   const path=[a.p,...route.cells.map(([x,y])=>point(y*W+x)),b.p];let valid=true;for(let k=1;k<path.length&&valid;k++){const n=Math.ceil(distance(path[k-1],path[k])/.04);for(let t=1;t<n;t++){const q=path[k-1].map((v,d)=>v+(path[k][d]-v)*t/n);if(!inside(q,room.rects)||!clear(q,room.lv)){valid=false;break;}}}if(valid)connect(a.id,b.id,{id:`room:${room.id}:${i}:${j}`,kind:'walk',length:path.slice(1).reduce((sum,p,k)=>sum+distance(p,path[k]),0),path});
  }
 }
 // Snap changes endpoints; recompute crossing geometry and recheck every door segment.
 for(const [id,list]of edges)edges.set(id,list.filter(e=>{if(e.kind==='walk')return true;const a=nodes.get(id),b=nodes.get(e.to);if(a.cell<0||b.cell<0)return false;e.path=[a.p,b.p];if(e.kind==='transfer')return e.length+1e-6>=distance(a.p,b.p);e.length=distance(a.p,b.p);const n=Math.ceil(e.length/.04);for(let i=0;i<=n;i++){const p=a.p.map((v,k)=>v+(b.p[k]-v)*i/n);if(!clear(p,scene.rooms.find(r=>r.id===a.room||r.id===b.room)?.lv))return false;}return true;}));
 return {nodes,edges,exits,refuges,warnings};
}
export function shortest(net,from,targets,speed,available=()=>true,party=1){
 if(!net.nodes.has(from)||net.nodes.get(from).cell<0)return null;
 const heap=new Heap(),cost=new Map([[from,0]]),prev=new Map();heap.push({t:0,id:from});let goal;
 while(heap.size){const cur=heap.pop();if(cur.t!==cost.get(cur.id))continue;if(targets.has(cur.id)&&available(cur.id)){goal=cur.id;break;}for(const edge of net.edges.get(cur.id)||[]){const c=cur.t+edge.length/(speed*(edge.speedFactor||1))+(edge.kind==='walk'?0:party/(edge.flow*edge.width));if(c<(cost.get(edge.to)??Infinity)){cost.set(edge.to,c);prev.set(edge.to,{from:cur.id,...edge});heap.push({t:c,id:edge.to});}}}
 if(!goal)return null;const edges=[];for(let id=goal;id!==from;){const e=prev.get(id);edges.unshift(e);id=e.from;}return {goal,edges};
}
