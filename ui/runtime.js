/* Shared theme bridge. Presentation only: never reads or rewrites project/model data. */
(()=>{
 'use strict';
 const script=document.currentScript,base=new URL('./',script.src),root=document.documentElement;
 const surface=script.dataset.surface||'tool';
 if(surface==='tool')root.dataset.pcTool=location.pathname.split('/').pop().replace(/\.html$/,'');
 const normalize=value=>value==='night'||value==='dark'?'night':value==='day'||value==='light'?'day':null;
 const read=()=>{try{return normalize(localStorage.getItem('pc-ui-theme'))||normalize(localStorage.getItem('pc-mvp-theme'))}catch{return null}};
 let mode=read()||normalize(root.dataset.theme)||'day';
 const roots=new Set([root]),boundFrames=new WeakSet();
 function apply(target){
  const native=target===root&&surface==='site'?mode:mode==='night'?'dark':'light';
  for(const [key,value] of Object.entries({pcUi:'1',pcTheme:mode,pcSurface:target===root?surface:'tool',theme:native}))if(target.dataset[key]!==value)target.dataset[key]=value;
  target.style.colorScheme=mode==='night'?'dark':'light';
 }
 function publish(){
  roots.forEach(target=>{if(target.isConnected)apply(target);else roots.delete(target)});
  document.querySelectorAll('iframe').forEach(frame=>{try{if(new URL(frame.src||location.href,location.href).origin===location.origin)frame.contentWindow?.postMessage({pc:1,t:'ui-theme',theme:mode},location.origin)}catch{}});
  const button=document.querySelector('.pc-ui-theme');
  if(button){button.setAttribute('aria-pressed',String(mode==='night'));button.setAttribute('aria-label',mode==='night'?'Switch to day theme':'Switch to night theme');button.title=button.getAttribute('aria-label');button.querySelector('span').textContent=mode==='night'?'Day':'Night'}
 }
 function set(value,{persist=false}={}){
  const next=normalize(value);if(!next)return;const changed=next!==mode;mode=next;
  if(persist)try{localStorage.setItem('pc-ui-theme',mode);localStorage.setItem('pc-mvp-theme',mode)}catch{}
  publish();if(changed)window.dispatchEvent(new CustomEvent('pc-ui-theme',{detail:mode}));
 }
 function adopt(frame){
  try{
   const child=frame.contentDocument;if(!child||!frame.hasAttribute('srcdoc')||!child.documentElement)return;
   if(!child.querySelector('link[data-pc-ui-assets]'))for(const file of ['tokens.css','components.css']){const link=child.createElement('link');link.rel='stylesheet';link.href=new URL(file,base).href;link.dataset.pcUiAssets='';link.addEventListener('load',()=>{child.documentElement.setAttribute('data-theme',child.documentElement.dataset.theme)});child.head.append(link)}
   roots.add(child.documentElement);apply(child.documentElement);
  }catch{}
 }
 function frames(){for(const frame of document.querySelectorAll('iframe')){
  if(!boundFrames.has(frame)){boundFrames.add(frame);frame.addEventListener('load',()=>{adopt(frame);publish()})}adopt(frame);
 }}
 function controls(){
  const toolbar=surface==='classic'?document.querySelector('header.site .hicons'):surface==='tool'?document.querySelector('.kj-top, .topbar, body>.top, .app>.top, header.top, .app>header'):null;
  if(toolbar&&!document.querySelector('.pc-ui-theme')){
   const button=document.createElement('button');button.type='button';button.className='pc-ui-theme';
   button.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2a8 8 0 1 0 8 8 6 6 0 0 1-8-8Z"/></svg><span></span>';
   button.addEventListener('click',()=>{set(mode==='night'?'day':'night',{persist:true})});
   // Embedded tools use the host's theme control instead of adding duplicate chrome.
   if(window.parent===window){toolbar.append(button);return true}
  }
  return false;
 }
 function layout(){
  if(surface!=='site')return;
  const header=document.querySelector('header.top'),context=document.querySelector('.pc-ui-context');
  const value=Math.round((header?.getBoundingClientRect().height||0)+(context?.getBoundingClientRect().height||0))+'px';
  if(root.style.getPropertyValue('--pc-ui-shell-height')!==value)root.style.setProperty('--pc-ui-shell-height',value);
  const state=context?'true':'false';if(root.dataset.pcContext!==state)root.dataset.pcContext=state;
 }
 function boot(){
  frames();controls();layout();publish();
  if(surface==='tool'&&/Sun Hours|Wind Flow|Daylight|Natural Ventilation|Spatial|Space Syntax|Movement|Isovist|Camera Coverage|Indoor Acoustics|Evacuation|Circulation|View Analysis|Structural Analysis|Stormwater/i.test(document.title))import(new URL('simulation-fit.js?v=unified-20261025-4',base)).then(m=>m.installSimulationFit(document)).catch(e=>console.warn('Simulation layout unavailable',e));
  addEventListener('resize',layout);
  new MutationObserver(records=>{if(records.some(r=>r.addedNodes.length||r.removedNodes.length)){frames();if(controls())publish();layout()}}).observe(document.body,{childList:true,subtree:true});
 }
 apply(root);
 new MutationObserver(()=>{const next=normalize(root.dataset.theme);if(next&&next!==mode)set(next,{persist:true})}).observe(root,{attributes:true,attributeFilter:['data-theme']});
 addEventListener('pc-theme',event=>set(event.detail,{persist:true}));
 addEventListener('storage',event=>{if(event.key==='pc-ui-theme'||event.key==='pc-mvp-theme')set(event.newValue)});
 addEventListener('message',event=>{if(event.origin===location.origin&&event.source===parent&&event.data?.pc===1&&event.data.t==='ui-theme')set(event.data.theme)});
 window.PlotCloudUI={version:1,get theme(){return mode},setTheme:value=>set(value,{persist:true})};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
