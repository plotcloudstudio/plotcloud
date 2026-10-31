// Read-only explanations for choosing a study. Previewing never runs an analysis.
import {simulationPresentation} from './simulation-presentation.js';
export function mountSimulationPreview(menu,trigger,sims){
  const card=document.createElement('aside');card.className='sim-intent-card';card.id='w2-sim-intent';card.hidden=true;card.setAttribute('role','tooltip');
  card.innerHTML='<div class="sim-intent-front"><div class="sim-intent-top"><span data-scope></span><span data-index></span></div><div class="sim-intent-image"><img alt="" width="1672" height="941"></div><p class="sim-intent-name"></p><h3></h3><p class="sim-intent-description"></p><div class="sim-intent-inputs"></div><div class="sim-intent-foot">Click to open study <span>↗</span></div></div>';
  document.body.append(card);
  const buttons=[...menu.querySelectorAll('[data-addsim]')];let active=null,animation=null;
  buttons.forEach((b,i)=>{b.tabIndex=i===0?0:-1;});
  const place=()=>{if(!active||menu.hidden)return;const r=active.getBoundingClientRect(),m=menu.getBoundingClientRect(),w=card.offsetWidth,h=card.offsetHeight,pad=28;
    let left=m.right+18,top=r.top-36;
    if(left+w>innerWidth-pad)left=m.left-w-18;
    if(left<pad){left=Math.max(pad,Math.min(innerWidth-w-pad,m.left));top=r.bottom+12;if(top+h>innerHeight-pad)top=r.top-h-12;}
    card.style.left=Math.max(pad,Math.min(left,innerWidth-w-pad))+'px';card.style.top=Math.max(pad,Math.min(top,innerHeight-h-pad))+'px';
  };
  const clear=()=>{active?.classList.remove('is-previewed');active?.removeAttribute('aria-describedby');active=null;card.hidden=true;animation?.cancel();};
  const show=b=>{if(!b||menu.hidden||b===active)return;const sim=sims.find(s=>s.id===b.dataset.addsim);if(!sim)return;
    active?.classList.remove('is-previewed');active?.removeAttribute('aria-describedby');active=b;b.classList.add('is-previewed');b.setAttribute('aria-describedby',card.id);buttons.forEach(x=>x.tabIndex=x===b?0:-1);
    const {question,description,image}=simulationPresentation(sim);
    card.dataset.sim=sim.id;card.querySelector('[data-scope]').textContent=sim.scope==='Interior'?'Interior study':'Building study';card.querySelector('[data-index]').textContent=String(buttons.indexOf(b)+1).padStart(2,'0')+' / '+String(buttons.length).padStart(2,'0');card.querySelector('.sim-intent-name').textContent=sim.name;card.querySelector('h3').textContent=question;card.querySelector('.sim-intent-description').textContent=description;
    card.querySelector('.sim-intent-image img').src=image;
    const inputs=card.querySelector('.sim-intent-inputs');inputs.replaceChildren();const label=document.createElement('span');label.textContent='Start with';inputs.append(label);(sim.inputs||[]).slice(0,2).forEach(text=>{const chip=document.createElement('b');chip.textContent=text;inputs.append(chip);});
    card.hidden=false;place();animation?.cancel();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)animation=card.animate([{opacity:0,transform:'translate(-14px, 8px) rotate(-2deg) scale(.95)'},{opacity:1,transform:'translate(0, 0) rotate(0) scale(1)'}],{duration:230,easing:'cubic-bezier(.2,.75,.25,1)'});
  };
  const over=e=>show(e.target.closest('[data-addsim]'));const focus=e=>show(e.target.closest('[data-addsim]'));
  const keys=e=>{const b=e.target.closest('[data-addsim]');if(!b)return;let n=buttons.indexOf(b);if(e.key==='ArrowDown')n=(n+1)%buttons.length;else if(e.key==='ArrowUp')n=(n-1+buttons.length)%buttons.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=buttons.length-1;else if(e.key==='Tab'){menu.hidden=true;trigger.setAttribute('aria-expanded','false');clear();return;}else return;e.preventDefault();e.stopPropagation();buttons[n].focus();};
  const leave=()=>{if(!menu.contains(document.activeElement))clear();};
  menu.addEventListener('pointerover',over);menu.addEventListener('focusin',focus);menu.addEventListener('pointerleave',leave);menu.addEventListener('keydown',keys);menu.addEventListener('scroll',place,{passive:true});addEventListener('resize',place);
  const observer=new MutationObserver(()=>{if(menu.hidden)clear();});observer.observe(menu,{attributes:true,attributeFilter:['hidden']});
  return()=>{observer.disconnect();animation?.cancel();removeEventListener('resize',place);menu.removeEventListener('pointerover',over);menu.removeEventListener('focusin',focus);menu.removeEventListener('pointerleave',leave);menu.removeEventListener('keydown',keys);menu.removeEventListener('scroll',place);card.remove();};
}
