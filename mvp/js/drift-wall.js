// DriftWall: DOM adaptation of the React Bits source supplied by the user.
// 2026-11-09: it moves as soon as the page opens (half speed when the system prefers reduced motion); Pause wall stops it.
// Copyright (c) 2026 David Haz. MIT + Commons Clause; see THIRD_PARTY_NOTICES.md.
// Keeps the original alternating-column drift, velocity damping and pointer tilt.
const factor=(index,variance)=>1+variance*(((index*.6180339887+.35)%1)*2-1);
export function mountDriftWall(root,items,{onActive=()=>{},pauseButton,columns=5,speed=26,variance=.45,tilt=16,turn=-14,depth=120,parallax=.6}={}){
  const mq=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};let reduced=false,motionEnabled=true,paused=false,visible=true,dead=false,raf=0,last=null,cols=[],offsets=[],velocities=[],active=null,hovered=-1,pointer={x:0,y:0},damped={x:0,y:0},plane,layout='';
  root.classList.add('drift-wall');root.setAttribute('role','group');root.setAttribute('aria-label','Explore all simulation types');
  const setActive=tile=>{if(active===tile)return;active?.classList.remove('is-active');active=tile;tile?.classList.add('is-active');hovered=tile?Number(tile.dataset.col):-1;const item=tile?items.find(i=>i.id===tile.dataset.sim):null;root.dataset.activeSim=item?.id||'';onActive(item);};
  const updateControl=()=>{root.dataset.motion=reduced?'reduced':paused?'paused':'running';if(!pauseButton)return;pauseButton.disabled=false;pauseButton.textContent=reduced?'Play wall':paused?'Resume wall':'Pause wall';pauseButton.setAttribute('aria-pressed',String(paused||reduced));pauseButton.title=reduced?'Your system prefers reduced motion. Play the wall if you want to enable it.':'';};
  const staticMode=()=>reduced||root.classList.contains('is-keyboard');
  const applyPlane=()=>{if(!plane||staticMode())return;plane.style.transform=`translate(-50%,-50%) scale(1.18) rotateX(${tilt+damped.y}deg) rotateY(${turn+damped.x}deg) translateZ(${-depth}px)`;};
  const build=()=>{const width=root.clientWidth,height=root.clientHeight||540,count=Math.min(columns,width<480?2:width<720?3:width<1000?4:5),tw=width<480?154:width<720?174:200,th=148,gap=18;
    const signature=[count,tw,Math.round(height)].join(':');if(signature===layout)return;layout=signature;setActive(null);root.replaceChildren();root.style.setProperty('--dw-tile-w',tw+'px');root.style.setProperty('--dw-tile-h',th+'px');root.style.setProperty('--dw-gap',gap+'px');
    plane=document.createElement('div');plane.className='drift-wall__plane';root.append(plane);cols=[];offsets=[];velocities=[];
    Array.from({length:count},(_,c)=>items.filter((_,i)=>i%count===c)).forEach((col,c)=>{const copyHeight=Math.max(th+gap,col.length*(th+gap)),copies=Math.max(2,Math.ceil(height*1.6/copyHeight)+1),column=document.createElement('div'),track=document.createElement('div');column.className='drift-wall__col';track.className='drift-wall__track';column.append(track);plane.append(column);
      for(let copy=0;copy<copies;copy++)for(const item of col){const tile=document.createElement('a');tile.href=item.href;tile.className='drift-wall__tile';tile.dataset.sim=item.id;tile.dataset.col=String(c);tile.dataset.copy=String(copy);tile.setAttribute('aria-label',`${item.title}. ${item.question} Open study.`);if(copy>0){tile.tabIndex=-1;tile.setAttribute('aria-hidden','true');}
        const inner=document.createElement('span');inner.className='drift-wall__inner';const img=document.createElement('img');img.src=item.image;img.alt='';img.loading='eager';img.decoding='async';img.draggable=false;const caption=document.createElement('span');caption.className='drift-wall__caption';const title=document.createElement('b');title.textContent=item.title;const question=document.createElement('span');question.textContent=item.question;caption.append(title,question);inner.append(img,caption);if(item.status==='planned'){const badge=document.createElement('span');badge.className='study-soon drift-wall__soon';badge.textContent='Coming soon';inner.append(badge);tile.setAttribute('aria-label',`${item.title}. Coming soon. ${item.question} Open preview.`);}tile.append(inner);track.append(tile);}
      cols.push({track,copyHeight,velocity:(mq.matches?speed*.5:speed)*factor(c,variance)*(c%2===0?1:-1)});offsets.push(copyHeight*((c*.37)%1));velocities.push(0);
    });applyPlane();cols.forEach((col,c)=>col.track.style.transform=`translate3d(0,${-offsets[c]}px,0)`);
  };
  const tick=ts=>{raf=0;if(dead||!visible||document.hidden)return;const dt=last===null?0:Math.min(.05,Math.max(0,ts-last)/1000);last=ts;
    const stopped=paused||staticMode();const damp=1-Math.exp(-dt/.12),maxTilt=parallax*8;damped.x+=((stopped?0:pointer.x*maxTilt)-damped.x)*damp;damped.y+=((stopped?0:-pointer.y*maxTilt)-damped.y)*damp;applyPlane();
    if(!stopped)cols.forEach((col,c)=>{const target=col.velocity*(hovered===c?0:1),ease=1-Math.exp(-dt/(target===0?.16:.28));velocities[c]+=(target-velocities[c])*ease;offsets[c]=((offsets[c]+velocities[c]*dt)%col.copyHeight+col.copyHeight)%col.copyHeight;col.track.style.transform=`translate3d(0,${-offsets[c]}px,0)`;});
    if(!stopped)raf=requestAnimationFrame(tick);
  };
  const start=()=>{if(!raf&&visible&&!document.hidden&&!dead){last=null;raf=requestAnimationFrame(tick);}};
  const motion=()=>{reduced=mq.matches&&!motionEnabled;root.classList.toggle('drift-wall--reduced',reduced);updateControl();if(reduced){cancelAnimationFrame(raf);raf=0;}else{applyPlane();start();}};
  const over=e=>{const tile=e.target.closest('.drift-wall__tile');if(tile&&root.contains(tile))setActive(tile);};
  const move=e=>{if(reduced||paused)return;const r=root.getBoundingClientRect();pointer={x:(e.clientX-r.left)/r.width-.5,y:(e.clientY-r.top)/r.height-.5};};
  const leave=()=>{pointer={x:0,y:0};if(!root.contains(document.activeElement))setActive(null);};
  const focus=e=>{const tile=e.target.closest('.drift-wall__tile');if(!tile)return;if(tile.matches(':focus-visible'))root.classList.add('is-keyboard');setActive(tile);if(staticMode())tile.scrollIntoView({block:'nearest',inline:'nearest'});};
  const blur=e=>{if(!root.contains(e.relatedTarget)){root.classList.remove('is-keyboard');setActive(null);start();}};
  const down=e=>{if(!e.target.closest('.drift-wall__tile')){root.classList.remove('is-keyboard');start();}};
  const pause=()=>{if(reduced){motionEnabled=true;paused=false;motion();}else{paused=!paused;updateControl();start();}};
  root.addEventListener('pointerover',over);root.addEventListener('pointermove',move);root.addEventListener('pointerleave',leave);root.addEventListener('focusin',focus);root.addEventListener('focusout',blur);root.addEventListener('pointerdown',down);pauseButton?.addEventListener('click',pause);
  const visibility=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=null;}else start();};document.addEventListener('visibilitychange',visibility);
  if(typeof mq.addEventListener==='function')mq.addEventListener('change',motion);else if(typeof mq.addListener==='function')mq.addListener(motion);
  let resize=null,observer=null;
  if(typeof ResizeObserver==='function'){resize=new ResizeObserver(build);resize.observe(root);}else addEventListener('resize',build);
  if(typeof IntersectionObserver==='function'){observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)start();else{cancelAnimationFrame(raf);raf=0;last=null;}});observer.observe(root);}
  build();motion();
  return()=>{dead=true;cancelAnimationFrame(raf);resize?.disconnect();observer?.disconnect();if(!resize)removeEventListener('resize',build);if(typeof mq.removeEventListener==='function')mq.removeEventListener('change',motion);else if(typeof mq.removeListener==='function')mq.removeListener(motion);document.removeEventListener('visibilitychange',visibility);root.removeEventListener('pointerover',over);root.removeEventListener('pointermove',move);root.removeEventListener('pointerleave',leave);root.removeEventListener('focusin',focus);root.removeEventListener('focusout',blur);root.removeEventListener('pointerdown',down);pauseButton?.removeEventListener('click',pause);root.replaceChildren();};
}
