import {navigation,shortest,Heap} from './navigation.js';
import {digest,distance} from './scene.js';
export const METHOD='hospital-network-1.0';
export const LIMITATIONS=[
 'Uncalibrated network screening model; not a fire safety certification or a validated prediction of patient behaviour.',
 'Time starts at alarm. Detection, smoke, heat, toxicity and tenability are not calculated; no ASET/RSET safety margin is available.',
 'Rooms use representative starts and grid paths. Door queues have unlimited storage. Local collision, crowd pressure, spillback and overtaking are not modelled.',
 'Transfers are user-confirmed schematic connections with measured route lengths, not automatically inferred stair geometry. Beds use a circular clearance envelope; turning and equipment transfer require separate review.',
 'Escorts are a pooled resource, held through travel and a specified turnaround delay. Staff return paths, shift allocation, clinical treatment and patient deterioration are not simulated.',
 'Disruption events delay one occupant only; a fall does not physically obstruct other occupants. Probabilities and distributions are study assumptions unless independently evidenced.',
 'Horizontal relocation ends at a user-designated receiving room on the same level. Fire compartment ratings, clinical suitability and subsequent evacuation stages are not verified.'
];
export function rng(seed){let a=parseInt(digest(String(seed)),16);return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export function validate(scene,s){
 const errors=[],num=(v,min,max,label,int=false)=>{if(!Number.isFinite(v)||v<min||v>max||int&&!Number.isInteger(v))errors.push(`${label}: expected ${int?'integer ':''}${min}–${max}.`);};
 if(!['final','horizontal'].includes(s.mode))errors.push('Choose final evacuation or horizontal relocation.');
 num(s.grid,.1,1,'Grid');num(s.specificFlow,.05,5,'Specific flow');num(s.staff,0,200,'Available escorts',true);num(s.turnaround,0,7200,'Escort turnaround');num(s.horizon,1,86400,'Observation horizon');num(s.repeats,1,100,'Replicates',true);num(s.seed,0,2147483647,'Seed',true);
 if(!s.basis?.trim())errors.push('Record the parameter source or explicitly state that this is a synthetic assumption study.');
 const ids=new Set();let population=0;
 for(const g of s.groups||[]){if(ids.has(g.id))errors.push('Group IDs must be unique.');ids.add(g.id);if(!scene.rooms.some(r=>r.id===g.room))errors.push(`${g.id}: missing room.`);num(g.count,0,500,'Group count',true);population+=g.count;num(g.width,.2,2,'Clearance diameter');num(g.speedMin,.01,3,'Minimum speed');num(g.speedMax,g.speedMin,3,'Maximum speed');num(g.responseMin,0,7200,'Minimum response');num(g.responseMax,g.responseMin,7200,'Maximum response');num(g.escorts,0,8,'Escorts per patient',true);num(g.preparation,0,7200,'Preparation');num(g.fallProbability,0,1,'Disruption probability');num(g.fallMin,0,7200,'Minimum disruption');num(g.fallMax,g.fallMin,7200,'Maximum disruption');if(g.fallProbability>0&&!g.fallBasis?.trim())errors.push(`${g.id}: disruption probability needs a source or an explicit hypothetical rationale.`);}
 if(population>1000)errors.push('Maximum 1,000 occupants per study.');
 if(population*s.repeats>10000)errors.push('This browser study supports at most 10,000 occupant-replicates. Reduce the population or replicates, and use separate recorded seed ranges for larger experiments.');
 for(const [id,o]of Object.entries(s.doors||{})){const d=scene.doors.find(d=>d.id===id);if(!d){errors.push('Unknown door '+id);continue;}num(o.width,.1,d.width,'Door clear width');if(o.exit&&!d.external)errors.push('Only external doors can be designated final exits.');}
 const linkIds=new Set();for(const l of s.links||[]){if(!l.id||linkIds.has(l.id)||scene.doors.some(d=>d.id===l.id))errors.push('Transfer IDs must be unique.');linkIds.add(l.id);const a=scene.rooms.find(r=>r.id===l.from),b=scene.rooms.find(r=>r.id===l.to);if(!a||!b||a.lv===b.lv)errors.push(`${l.id}: select two rooms on different levels.`);num(l.width,.2,10,'Transfer width');num(l.length,a&&b?distance(a.p,b.p):.1,1000,'Transfer path length');num(l.speedFactor,.05,1,'Transfer speed factor');if(!l.confirmed)errors.push(`${l.id}: confirm the connection and measured length.`);}
 for(const [id,n]of Object.entries(s.refuges||{})){if(!scene.rooms.some(r=>r.id===id))errors.push('Unknown receiving room.');num(n,0,1000,'Receiving capacity',true);}
 if(errors.length)throw Error([...new Set(errors)].join('\n'));return population;
}
export function prepare(scene,s){validate(scene,s);const cache=new Map(),nets=new Map();for(const g of s.groups){const key=`${g.width}:${!!g.stepFree}`;if(!cache.has(key))cache.set(key,navigation(scene,s,g));nets.set(g.id,cache.get(key));}return nets;}
export function simulate(scene,s,seed,nets=prepare(scene,s)){
 const heap=new Heap(),people=[],events=[],gates=new Map(),reserved=new Map(),waiting=[];let free=s.staff,serial=0;
 const push=(t,type,p,extra={})=>heap.push({t:t+0,type,p,order:serial++,...extra});
 for(const g of s.groups)for(let i=0;i<g.count;i++){const id=`${g.id}:${i+1}`,rand=rng(`${seed}/${id}`),speed=g.speedMin+rand()*(g.speedMax-g.speedMin),response=g.responseMin+rand()*(g.responseMax-g.responseMin),fall=rand()<g.fallProbability,fallDuration=g.fallMin+rand()*(g.fallMax-g.fallMin),fallFraction=rand();const p={id,group:g.id,room:g.room,speed,response,status:'not-started',arrival:null,queue:0,staffWait:0,segments:[],g,fall,fallDuration,fallFraction};people.push(p);push(response,'ready',p);}
 const begin=(p,t)=>{const net=nets.get(p.group),room=scene.rooms.find(r=>r.id===p.room),targets=s.mode==='final'?net.exits:new Set([...net.refuges.keys()].filter(id=>scene.rooms.find(r=>r.id===net.nodes.get(id).room)?.lv===room.lv));const route=shortest(net,'room:'+p.room,targets,p.speed,id=>s.mode==='final'||(reserved.get(id)||0)<net.refuges.get(id).capacity,p.g.escorts+1);
  if(!route){p.status='no-accessible-route';events.push({time:t,person:p.id,type:p.status});return false;}p.route=route;p.target=route.goal;if(s.mode==='horizontal')reserved.set(route.goal,(reserved.get(route.goal)||0)+1);p.startPoint=net.nodes.get('room:'+p.room).p;p.status='moving';p.staffWait=t-p.response;free-=p.g.escorts;p.edge=0;p.fallEdge=route.edges.length?Math.min(route.edges.length-1,Math.floor(p.fallFraction*route.edges.length)):-1;push(t+p.g.preparation,'step',p);return true;};
 const assign=t=>{for(let i=0;i<waiting.length;){const p=waiting[i];if(p.g.escorts<=free){waiting.splice(i,1);begin(p,t);}else i++;}};
 while(heap.size){const e=heap.pop();if(e.t>s.horizon)break;const {p,t}=e;
  if(e.type==='ready'){p.status='awaiting-escorts';if(p.g.escorts>s.staff){p.status='insufficient-escorts';continue;}waiting.push(p);assign(t);}
  else if(e.type==='release'){free+=e.n;assign(t);}
  else if(e.type==='step'){
   const edge=p.route.edges[p.edge];if(!edge){p.arrival=t;p.status=s.mode==='final'?'evacuated':'relocated';events.push({time:t,person:p.id,type:p.status,target:p.target});push(t+s.turnaround,'release',null,{n:p.g.escorts});continue;}
   let start=t;if(p.fall&&p.edge===p.fallEdge){events.push({time:t,person:p.id,type:'individual-disruption',duration:p.fallDuration});start+=p.fallDuration;}
   if(edge.kind!=='walk'){const before=start;start=Math.max(start,gates.get(edge.id)||0);p.queue+=Math.max(0,Math.min(start,s.horizon)-before);const service=(p.g.escorts+1)/(edge.flow*edge.width);gates.set(edge.id,start+service);start+=service;}
   const end=start+edge.length/(p.speed*(edge.speedFactor||1));p.segments.push({start,end,path:edge.path,kind:edge.kind,edge:edge.id});p.edge++;push(end,'step',p);
  }
 }
 for(const p of people){if(p.status==='awaiting-escorts')p.staffWait=Math.max(0,s.horizon-p.response);if(p.arrival===null&&['moving','awaiting-escorts','not-started'].includes(p.status))p.status='time-limit';delete p.route;delete p.g;}
 const completed=people.filter(p=>p.arrival!==null).length,total=people.length;
 return {seed,total,completed,incomplete:total-completed,clearance:total>0&&completed===total?Math.max(...people.map(p=>p.arrival)):null,people,events};
}
export const quantile=(xs,q)=>{if(!xs.length)return null;const a=[...xs].sort((a,b)=>a-b),k=(a.length-1)*q,i=Math.floor(k);return a[i]+(a[Math.min(i+1,a.length-1)]-a[i])*(k-i);};
export function summarize(runs){const complete=runs.filter(r=>r.total>0&&r.incomplete===0),all=complete.length===runs.length;return {runs:runs.length,allCompletedRuns:complete.length,completionFraction:complete.length/runs.length,clearanceP50:all?quantile(complete.map(r=>r.clearance),.5):null,clearanceP95:all?quantile(complete.map(r=>r.clearance),.95):null,minCompleted:Math.min(...runs.map(r=>r.completed)),maxIncomplete:Math.max(...runs.map(r=>r.incomplete))};}
export function experiment(scene,s,progress=()=>{}){const nets=prepare(scene,s),runs=[];for(let i=0;i<s.repeats;i++){runs.push(simulate(scene,s,s.seed+i,nets));progress(i+1,s.repeats);}return {method:METHOD,generatedAt:new Date().toISOString(),inputHash:digest({scene,scenario:s}),scene,scenario:s,summary:summarize(runs),warnings:[...new Set([...scene.warnings,...[...nets.values()].flatMap(n=>n.warnings)])],limitations:LIMITATIONS,runs};}
