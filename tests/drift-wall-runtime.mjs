import assert from 'node:assert/strict';
import {mountDriftWall} from '../mvp/js/drift-wall.js';

// Unit DOM: exercise scheduling and browser-API availability without a browser engine.
class Element {
  constructor(){this.children=[];this.dataset={};this.style={setProperty(){}};this.events=new Map();this.attrs={};const names=new Set();this.classList={add:(n)=>names.add(n),remove:n=>names.delete(n),contains:n=>names.has(n),toggle(n,on){on?names.add(n):names.delete(n);}};}
  setAttribute(k,v){this.attrs[k]=v;}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  addEventListener(n,fn){this.events.set(n,fn);}
  removeEventListener(n,fn){if(this.events.get(n)===fn)this.events.delete(n);}
  click(){this.events.get('click')?.({target:this});}
}
function environment({reduced=false,legacyMedia=false,observers=true,hidden=false}={}){
  const root=new Element(),button=new Element(),doc=new Element(),win=new Element(),mq={matches:reduced};
  root.clientWidth=1200;root.clientHeight=520;doc.hidden=hidden;doc.createElement=()=>new Element();
  let mediaCallback=null;mq[legacyMedia?'addListener':'addEventListener']=(...args)=>mediaCallback=args.at(-1);
  mq[legacyMedia?'removeListener':'removeEventListener']=()=>mediaCallback=null;
  const queue=new Map();let next=0,disconnected=0;
  const globals={document:doc,matchMedia:()=>mq,requestAnimationFrame:fn=>{queue.set(++next,fn);return next;},cancelAnimationFrame:id=>queue.delete(id),addEventListener:win.addEventListener.bind(win),removeEventListener:win.removeEventListener.bind(win),ResizeObserver:observers?class{observe(){}disconnect(){disconnected++;}}:undefined,IntersectionObserver:observers?class{observe(){}disconnect(){disconnected++;}}:undefined};
  const prior=Object.fromEntries(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
  const items=Array.from({length:23},(_,i)=>({id:String(i),title:'Study '+i,question:'Design question',image:'preview.webp',href:'#/study/'+i}));
  const stop=mountDriftWall(root,items,{pauseButton:button});
  return{root,button,doc,win,mq,queue,track:()=>root.children[0].children[0].children[0],frame(ts){const pending=[...queue.values()];queue.clear();pending.forEach(fn=>fn(ts));},changeMotion(value){mq.matches=value;mediaCallback?.();},close(){stop();assert.equal(queue.size,0);assert.equal(mediaCallback,null);if(observers)assert.equal(disconnected,2);else assert.equal(win.events.size,0);for(const[k,d]of Object.entries(prior))d?Object.defineProperty(globalThis,k,d):delete globalThis[k];}};
}

for(const observers of [true,false]){
  const e=environment({observers,legacyMedia:!observers});try{
    assert(e.queue.size>0,'Starts without waiting for an IntersectionObserver callback');
    const before=e.track().style.transform;e.frame(0);e.frame(50);assert.notEqual(e.track().style.transform,before);
    e.button.click();e.frame(100);const paused=e.track().style.transform;e.frame(150);assert.equal(e.track().style.transform,paused);assert.equal(e.queue.size,0);
    e.button.click();e.frame(200);e.frame(250);assert.notEqual(e.track().style.transform,paused);
    e.doc.hidden=true;e.doc.events.get('visibilitychange')();assert.equal(e.queue.size,0);
    e.doc.hidden=false;e.doc.events.get('visibilitychange')();assert(e.queue.size>0);
  }finally{e.close();}
}
console.log('PASS startup, drift, pause/resume, tab visibility, observer fallback and cleanup');
for(const legacyMedia of [true,false]){
  const e=environment({reduced:true,legacyMedia});try{
    assert.equal(e.root.dataset.motion,'reduced');assert.equal(e.queue.size,0);assert.equal(e.button.disabled,false);assert.equal(e.button.textContent,'Play wall');
    e.button.click();assert.equal(e.root.dataset.motion,'running');assert(!e.root.classList.contains('drift-wall--reduced'));
    const before=e.track().style.transform;e.frame(0);e.frame(50);assert.notEqual(e.track().style.transform,before);
  }finally{e.close();}
}
console.log('PASS reduced-motion default, explicit Play override and legacy MediaQueryList support');
const e=environment({hidden:true});try{assert.equal(e.queue.size,0);e.doc.hidden=false;e.doc.events.get('visibilitychange')();assert(e.queue.size>0);e.changeMotion(true);assert.equal(e.queue.size,0);assert.equal(e.button.textContent,'Play wall');}finally{e.close();}
console.log('PASS initially hidden tab and live system-preference changes');
