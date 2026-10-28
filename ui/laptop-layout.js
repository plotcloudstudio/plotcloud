// Presentation bridge for the site's existing same-origin nested workspaces.
// Keep native scrolling, model coordinates, camera state and handlers unchanged.
const stylesheet=new URL('./laptop-layout.css?v=laptop-layout-20261028-1',import.meta.url).href;
const documents=new WeakSet(),frames=new WeakSet();
function mount(doc){
 try{
  if(!doc?.head||documents.has(doc))return;
  documents.add(doc);
  if(!doc.querySelector('link[data-pc-laptop-layout]')){
   const link=doc.createElement('link');link.rel='stylesheet';link.href=stylesheet;link.dataset.pcLaptopLayout='';link.onload=measureShell;doc.head.append(link);
  }
  const scan=()=>{for(const frame of doc.querySelectorAll('iframe')){
   if(!frames.has(frame)){frames.add(frame);frame.addEventListener('load',()=>{try{mount(frame.contentDocument);}catch{}});}
   try{mount(frame.contentDocument);}catch{}
  }};
  new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('iframe')||n.querySelector?.('iframe')))))scan();}).observe(doc.documentElement,{childList:true,subtree:true});
  scan();
 }catch{/* Cross-origin external tools keep their own presentation. */}
}
let context=null;
const sizes=new ResizeObserver(measureShell);
function measureShell(){
 const header=document.querySelector('header.top'),current=document.querySelector('.pc-ui-context');
 if(context!==current){if(context)sizes.unobserve(context);context=current;if(context)sizes.observe(context);}
 if(header)sizes.observe(header);
 document.documentElement.style.setProperty('--pc-ui-shell-height',Math.round((header?.getBoundingClientRect().height||0)+(current?.getBoundingClientRect().height||0))+'px');
}
mount(document);measureShell();
new MutationObserver(measureShell).observe(document.body,{childList:true});
