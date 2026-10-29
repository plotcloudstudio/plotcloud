/* Shared light interface and viewport adapters. No theme preference is stored. */
(()=>{
 'use strict';
 const script=document.currentScript,base=new URL('./',script.src),root=document.documentElement,surface=script.dataset.surface||'tool',roots=new Set([root]),framesBound=new WeakSet(),views=new Set();
 try{localStorage.removeItem('pc-ui-theme');localStorage.removeItem('pc-mvp-theme');}catch{}
 function apply(target){target.dataset.pcUi='1';target.dataset.pcSurface=target===root?surface:'tool';target.dataset.theme=surface==='site'&&target===root?'day':'light';target.removeAttribute('data-pc-theme');target.style.colorScheme='light';}
 const viewportColor=()=>getComputedStyle(root).getPropertyValue('--pc-ui-view').trim()||'#e9ecef';
 function redraw(view){const color=viewportColor();if(view.color===color)return;view.color=color;if(view.scene?.background?.set)view.scene.background.set(color);else view.renderer?.setClearColor(color,1);if(view.redraw)requestAnimationFrame(view.redraw);}
 function styles(doc){for(const file of ['tokens.css','components.css'])if(![...doc.querySelectorAll('link[rel="stylesheet"]')].some(l=>{try{return new URL(l.href).pathname.endsWith('/ui/'+file);}catch{return false;}})){const link=doc.createElement('link');link.rel='stylesheet';link.href=new URL(file+'?v=light-only-20261028-1',base).href;link.dataset.pcUiAssets='';link.onload=()=>views.forEach(redraw);doc.head.append(link);}}
 function adopt(frame){try{const doc=frame.contentDocument;if(doc?.documentElement&&frame.hasAttribute('srcdoc')){styles(doc);roots.add(doc.documentElement);apply(doc.documentElement);}}catch{}}
 function frames(){for(const frame of document.querySelectorAll('iframe')){if(!framesBound.has(frame)){framesBound.add(frame);frame.addEventListener('load',()=>adopt(frame));}adopt(frame);}}
 function layout(){if(surface!=='site')return;const header=document.querySelector('header.top'),context=document.querySelector('.pc-ui-context');root.style.setProperty('--pc-ui-shell-height',Math.round((header?.getBoundingClientRect().height||0)+(context?.getBoundingClientRect().height||0))+'px');root.dataset.pcContext=String(!!context);}
 function boot(){styles(document);frames();layout();if(surface==='tool'&&/Sun Hours|Wind Flow|Daylight|Natural Ventilation|Spatial|Space Syntax|Movement|Isovist|Camera Coverage|Indoor Acoustics|Evacuation|Circulation|View Analysis|Structural Analysis|Stormwater/i.test(document.title))import(new URL('simulation-fit.js?v=light-only-20261028-1',base)).then(m=>m.installSimulationFit(document)).catch(e=>console.warn('Simulation layout unavailable',e));addEventListener('resize',layout);new MutationObserver(records=>{if(records.some(r=>r.addedNodes.length||r.removedNodes.length)){frames();layout();}}).observe(document.body,{childList:true,subtree:true});}
 if(surface==='tool')root.dataset.pcTool=location.pathname.split('/').pop().replace(/\.html$/,'');apply(root);
 window.PlotCloudUI={version:1,viewportColor,canvasBackground:()=> '#ffffff',trackViewport(scene,renderer,redrawView){const view={scene,renderer,redraw:redrawView};views.add(view);redraw(view);return()=>views.delete(view);}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
