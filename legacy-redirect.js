// Compatibility addresses only. The retired site has no page renderer or project state.
(function(root){
 function destination(hash){
  const text=String(hash||'').replace(/^#\/?/,''),[path,query='']=text.split('?'),[page,id]=path.split('/'),q=new URLSearchParams(query);
  const studies=new Set(['sunhours','wind','stormwater','daylight','vent','spacesyntax','movementdepth','isovist','cameras','views','acoustics','evac','structure','span','wayfinding','privacy','noise']);
  const retired=new Set(['render','atlas','composer','studio','architectural-render','image-toolkit']);
  if(['studio','workspace','workspace-v2'].includes(page))return '#/workspace';
  if(['library','resources'].includes(page)){const category=q.get('category')||q.get('cat');return '#/resources'+(page==='library'?'/files':'')+(category?'?category='+encodeURIComponent(category):'');}
  if(page==='res')return '#/resources/item/'+encodeURIComponent(id||'');
  if(page==='showroom')return '#/resources/showroom'+(id?'/'+encodeURIComponent(id):'');
  if(page==='tool'){
   if(['modeler','tracer','sitectx','__plan'].includes(id))return '#/workspace';
   if(studies.has(id))return '#/simulations/'+id;
   if(retired.has(id))return '#/resources';
   return '#/resources/tool/'+encodeURIComponent(['sheets','units'].includes(id)?'scale':id||'');
  }
  if(['terms','privacy','license','refunds'].includes(page))return '#/legal/'+page;
  if(page==='project')return '#/results';
  if(page==='join')return '#/login?signup=1';
  if(['account','login','pricing','simulations','results'].includes(page))return '#/'+page;
  if(['tools','learn','support','requests','donate'].includes(page))return '#/resources';
  return '#/';
 }
 if(typeof module==='object'&&module.exports)module.exports={destination};
 if(root?.location){const go=()=>{const target=new URL('mvp/',root.location.href);target.hash=destination(root.location.hash);root.location.replace(target.href);};root.addEventListener('hashchange',go);go();}
})(typeof window==='object'?window:null);
