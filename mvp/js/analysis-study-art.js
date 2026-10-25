// Catalogue-only presentation of real engine fields on the existing standard models.
// No alternative simulation algorithm: these samples run the production engines.
export const SITE_BOXES=[[5.5,4,4,3.5,5.2],[1,1,2.3,2.8,2.3],[11.8,1.3,2.5,3.4,3.5],[1.2,8.5,3,2,3],[11.2,8.7,3.6,2,2]];
function plan(model){
 const walls=model.components.filter(c=>c.type==='wall').map(c=>{const g=c.g,h=g.w>=g.d;return {id:c.id,a:h?[g.x,g.y+g.d/2]:[g.x+g.w/2,g.y],b:h?[g.x+g.w,g.y+g.d/2]:[g.x+g.w/2,g.y+g.d],h:g.h,t:Math.min(g.w,g.d)};});
 const open=model.components.filter(c=>c.type==='window'||c.type==='door').map(c=>{const g=c.g,h=g.w>=g.d,x=g.x+g.w/2,y=g.y+g.d/2;
  const host=walls.filter(w=>(w.a[1]===w.b[1])===h).sort((a,b)=>Math.abs((h?a.a[1]:a.a[0])-(h?y:x))-Math.abs((h?b.a[1]:b.a[0])-(h?y:x)))[0];
  const line=h?host.a[1]:host.a[0],door=g.z===0;
  return {id:c.id,a:h?[g.x,line]:[line,g.y],b:h?[g.x+g.w,line]:[line,g.y+g.d],kind:door?'door':'win',ext:line<.3||line>11.7,sill:door?0:g.z,head:g.z+g.h};
 });
 const rooms=model.components.filter(c=>c.type==='room').map(c=>({id:c.id,name:c.name,label:[c.g.x+c.g.w/2,c.g.y+c.g.d/2],rects:[[c.g.x,c.g.y,c.g.w,c.g.d]]}));
 const furn=model.components.filter(c=>c.type==='furniture').map(c=>({...c.g,id:c.id,name:c.name}));
 return {walls,open,rooms,furn,bounds:{w:16,h:12},origin:[0,0],settings:{floorZ:0,ceil:3.2,north:0}};
}
export async function studyField(id,model){
 const source={app:'plotcloud-catalog',project:'catalog-'+id,version:'standard-model-v1'},scene=id==='noise'?{kind:'masses',masses:SITE_BOXES.map(([x,y,w,d,h],i)=>({id:'catalog-mass-'+i,role:'proposed',base:0,h,outer:[[x,y],[x+w,y],[x+w,y+d],[x,y+d]],holes:[]}))}:plan(model);
 Object.assign(scene,{source,name:'Catalogue standard '+(id==='noise'?'site':'interior')});
 const frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.style.cssText='position:fixed;left:-5000px;top:0;width:1366px;height:768px;pointer-events:none';
 const loaded=new Promise((resolve,reject)=>{frame.onload=resolve;frame.onerror=reject;});frame.src='../emb/'+id+'.html';document.body.appendChild(frame);
 try{
  await loaded;const w=frame.contentWindow;if(!w.__psim)throw Error(id+' engine did not initialize');
  w.postMessage({pc:1,t:'project',scene:JSON.stringify(scene),name:scene.name,source},location.origin);
  for(let n=0;w.__psim.SC.source?.project!==source.project;n++){if(n>200)throw Error(id+' model handoff timed out');await new Promise(r=>setTimeout(r,20));}
  await w.__psim.run();if(!w.__pcAnalysisState().ready)throw Error(id+' did not produce a current result');
  const field=w.__psim.field(),extra=id==='noise'?{facades:w.__psim.RES.fac.map(f=>({a:f.a,b:f.b,h:f.m.h,values:[...f.vals]}))}:{};
  return {field,...extra,engine:'emb/'+id+'.html',conditions:w.__pcAnalysisState().conditions,source};
 }finally{frame.remove();}
}
