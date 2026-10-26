import {mountHomeHero} from '../home-hero.js?v=20261024-click2';
import {img,theme} from '../app.js';
import {mountSunExample} from '../home-example.js';

// The approved preview is the single layout source for the public homepage.
export async function render(app,rest,params,context={}){
  const hash=location.hash,active=()=>context.isCurrent?context.isCurrent():location.hash===hash;
  const response=await fetch(new URL('../../home-preview.html?v=workflow-20261026-1',import.meta.url));
  if(!response.ok)throw new Error('Homepage could not load');
  const doc=new DOMParser().parseFromString(await response.text(),'text/html');
  if(!active())return;
  const style=document.createElement('style');style.textContent=doc.querySelector('style').textContent;document.head.append(style);
  app.innerHTML=doc.querySelector('main').innerHTML;
  const footer=app.querySelector('.preview-foot p');footer.textContent='Building simulation for design decisions. Screening studies, not code compliance.';
  await mountSunExample(app,active);
  if(!active()){style.remove();return;}
  const update=()=>app.querySelectorAll('[data-image]').forEach(image=>{image.src=img(image.dataset.image.replace(/^sim-/,'analysis-'));});
  update();addEventListener('pc-theme',update);
  app.querySelector('.scene').classList.add('home-hero-study');
  const dispose=mountHomeHero(app.querySelector('.scene'));
  return()=>{dispose();style.remove();removeEventListener('pc-theme',update);};
}
