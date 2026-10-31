import * as S from './store.js';

// One navigation for Home, product information, resources and authentication.
const links=[['pricing','Pricing'],['about','About'],['blog','Blog'],['resources','Resources']];
export function publicNav(active='',{light=false}={}){
  const start=S.account().user?'#/new-project':'#/login?signup=1&next=new-project';
  return `<nav class="lp-nav${light?' lp-nav-light':''}" aria-label="Main"><a class="lp-logo" href="#/" aria-label="PlotCloud home">plot<b>cloud</b></a><button type="button" class="lp-menu" aria-expanded="false" aria-controls="lpNavLinks">Menu</button><div class="lp-links" id="lpNavLinks">${links.map(([id,name])=>`<a href="#/${id}"${active===id?' aria-current="page"':''}>${name}</a>`).join('')}</div><div class="lp-cta"><a class="lp-login" href="#/login"${active==='login'?' aria-current="page"':''}>Log in</a><a class="lp-btn" href="${start}"${active==='signup'?' aria-current="page"':''}>Get started</a></div></nav>`;
}
export function bindPublicNav(root){
  const nav=root.querySelector('.lp-nav'),menu=nav.querySelector('.lp-menu');
  menu.addEventListener('click',()=>{const open=nav.classList.toggle('is-open');menu.setAttribute('aria-expanded',String(open));});
  nav.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('is-open')){nav.classList.remove('is-open');menu.setAttribute('aria-expanded','false');menu.focus();}});
  return nav;
}
export function publicPage(app,key,params=new URLSearchParams()){
  document.body.classList.add('pc-public');
  app.innerHTML=`<div class="lp lp-public lp-public-${key}">${publicNav(key==='login'&&params.has('signup')?'signup':key,{light:true})}<div class="lp-public-content"></div><footer class="lp-public-footer"><a class="lp-logo" href="#/">plot<b>cloud</b></a><p>Building performance, made visible.</p><div>${links.map(([id,name])=>`<a href="#/${id}">${name}</a>`).join('')}<a href="#/legal">Legal</a></div></footer></div>`;
  bindPublicNav(app);return app.querySelector('.lp-public-content');
}
