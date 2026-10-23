/* Schematic architectural illustration. All environmental paths are art-directed. */
const root = document.querySelector('.study');
const viewport = document.querySelector('.viewport');
const canvas = document.querySelector('canvas');
const status = document.querySelector('.state-label');
const pauseButton = document.querySelector('[data-action=pause]');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const options = new URLSearchParams(location.search);
const embedded = options.get('embed') === '1';
const initialMode = ['sun','wind','rain','sound'].includes(options.get('mode')) ? options.get('mode') : 'sun';
let visualTheme = options.get('theme') === 'night' ? 'night' : 'day';
if (embedded) document.documentElement.dataset.embedded = 'true';
document.documentElement.dataset.theme = visualTheme;
let mode = 'sun', paused = reduced.matches, visible = true, failed = false;
let renderer, scene, camera, frame, observer, resizeObserver;
const names = {sun:'Sun / light & shadow',wind:'Wind / airflow paths',rain:'Rain / surface water',sound:'Sound / wave propagation'};
function showFallback(error) {
  failed = true;
  cancelAnimationFrame(frame);
  root.dataset.ready = 'false';
  root.dataset.fallback = 'true';
  document.querySelector('.fallback-message').textContent = 'Architectural study · 3D preview unavailable';
  document.querySelector('.view-hint').textContent = 'Schematic Toronto maquette';
  document.querySelectorAll('button').forEach(button => {button.disabled = true;});
  if (error) console.warn('PlotCloud hero: 3D preview unavailable.', error.message);
}
function syncPause() {
  pauseButton.setAttribute('aria-pressed', String(paused));
  pauseButton.setAttribute('aria-label', paused ? 'Play animation' : 'Pause animation');
  pauseButton.title = paused ? 'Play animation' : 'Pause animation';
  pauseButton.innerHTML = paused
    ? '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="m5 3 8 5-8 5Z" fill="currentColor"/></svg>'
    : '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 3h3v10H4zm5 0h3v10H9z" fill="currentColor"/></svg>';
}
syncPause();
if(embedded){
  canvas.tabIndex=0;canvas.removeAttribute('aria-hidden');canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','Illustrative Toronto architectural model. Drag to rotate. Press Space to pause or resume motion.');
  canvas.addEventListener('keydown',event=>{if(event.code==='Space'){event.preventDefault();paused=!paused;syncPause();}});
}
try {
  const T = await import('../furniture/three.module.min.js');
  const white = new T.MeshStandardMaterial({color:0xf1f0e8,roughness:.93,metalness:0});
  const chalk = new T.MeshStandardMaterial({color:0xe3e3db,roughness:1});
  const roof = new T.MeshStandardMaterial({color:0xf8f7f1,roughness:.9});
  const dark = new T.MeshStandardMaterial({color:0x6e7876,roughness:.85});
  const baseMaterial = new T.MeshStandardMaterial({color:0xe2e1d7,roughness:1});
  const roadMaterial = new T.MeshStandardMaterial({color:0xc9cdc4,roughness:1});
  renderer = new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'});
  const backgroundColor=()=>embedded?(visualTheme==='night'?0x111317:0xeef0f3):0xf7f7f2;
  renderer.setClearColor(backgroundColor());
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  scene = new T.Scene();
  scene.fog = new T.Fog(backgroundColor(),32,64);
  camera = new T.OrthographicCamera(-10,10,10,-10,.1,90);
  const world = new T.Group();
  scene.add(world);
  scene.add(new T.HemisphereLight(0xffffff,0xb5b7ac,1.7));
  const key = new T.DirectionalLight(0xffdfa7,4.2);
  key.position.set(-9,14,6); key.castShadow = true;
  key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-11,right:11,top:14,bottom:-9,near:.5,far:45});
  key.shadow.normalBias = .04; key.shadow.bias = -.0003;
  key.shadow.radius = 4;
  scene.add(key);
  const fill = new T.DirectionalLight(0xdbe5ed,1.0);fill.position.set(8,8,-10);scene.add(fill);
  const boxGeo = new T.BoxGeometry(1,1,1);
  function box(parent,x,y,z,w,h,d,mat=white) {
    const mesh = new T.Mesh(boxGeo,mat);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);
    mesh.castShadow = true;mesh.receiveShadow = true;parent.add(mesh);return mesh;
  }
  function line(parent,points,color=0xb8bcb0,opacity=.5) {
    const geometry = new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p)));
    const material = new T.LineBasicMaterial({color,transparent:true,opacity});
    const mesh = new T.Line(geometry,material);parent.add(mesh);return mesh;
  }
  function cylinder(parent,x,y,z,rTop,rBottom,height,mat=white,segments=48) {
    const mesh = new T.Mesh(new T.CylinderGeometry(rTop,rBottom,height,segments),mat);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  // Studio ground and two fine strata beneath separated, self-contained model tiles.
  const ground = new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({color:0x455041,opacity:.17}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.95;ground.receiveShadow=true;scene.add(ground);
  box(world,0,-.67,0,10.55,.15,8.4,baseMaterial);
  box(world,0,-.48,0,10.8,.18,8.65,chalk);
  const tiles=[];
  let seed=2026;
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let ix=0;ix<5;ix++)for(let iz=0;iz<4;iz++){
    const tile=new T.Group(); const floating=(ix===0&&iz===3)||(ix===4&&iz===0)||(ix===4&&iz===3);
    tile.position.set((ix-2)*2.2, floating?.14:0,(iz-1.5)*2.2);
    if(floating) {tile.position.x+=(ix-2)*.045;tile.position.z+=(iz-1.5)*.045;}
    tile.userData={base:tile.position.y,floating,phase:ix+iz};
    world.add(tile);tiles.push(tile);
    box(tile,0,-.12,0,2.1,.32,2.1,white);
    // Orthogonal roads and kerbs leave fine construction seams between modules.
    box(tile,0,.046,-.83,2.1,.012,.19,roadMaterial);
    line(tile,[[-1.05,.057,-.73],[1.05,.057,-.73]],0xe9eae1,.85);
    box(tile,-.84,.046,0,.16,.012,2.1,roadMaterial);
    // Leave the landmark district open; skyline occupies the eastern/back tiles.
    if((ix>=3)||(iz===0&&ix>0)||(ix===0&&iz<2)){
      for(let n=0;n<3;n++){
        const x=-.35+(n%2)*.85+(rand()-.5)*.12,z=-.30+Math.floor(n/2)*.85;
        const h=.45+rand()*1.45+(ix===3&&iz===1?1:0),w=.42+rand()*.26,d=.38+rand()*.28;
        box(tile,x,h/2+.065,z,w,h,d,white);
        box(tile,x,h+.085,z,w+.035,.05,d+.035,roof);
        if(h>1.1){box(tile,x+.03,h+.2,z,w*.65,.2,d*.65,chalk);}
        // Quiet horizontal facade joints give massing a crafted scale.
        for(let floor=.28;floor<h-.08;floor+=.24){
          line(tile,[[x-w/2-.002,floor+.065,z+d/2+.002],[x+w/2+.002,floor+.065,z+d/2+.002]],0xb2b7ae,.25);
        }
      }
    } else if(ix===0&&iz===3||ix===1&&iz===3||ix===4&&iz===3){
      for(let level=0;level<7;level++){
        const points=[];
        for(let s=0;s<=38;s++){
          const a=s/38*Math.PI*1.4;
          const px=-.8+Math.cos(a)*(.3+level*.16),pz=.7-Math.sin(a)*(.3+level*.16)*.65;
          if(Math.abs(px)<1.04&&Math.abs(pz)<1.04)points.push([px,.052,pz]);
        }
        line(tile,points,0xb9beb1,.6);
      }
    }
    // Small architectural landscape elements, kept monochrome.
    if(iz===3&&ix>1)for(let n=0;n<5;n++){
      const x=-.52+n*.3;
      cylinder(tile,x,.12,.65,.025,.025,.13,chalk,8);
      const tree=new T.Mesh(new T.IcosahedronGeometry(.115,1),chalk);tree.position.set(x,.27,.65);tree.scale.y=1.35;tree.castShadow=true;tile.add(tree);
    }
  }
  // CN Tower: tapered triangular shaft, radiating buttresses, revolving pod and mast.
  const landmark = new T.Group();landmark.position.set(-.30,.055,-.1);world.add(landmark);
  cylinder(landmark,0,.11,0,.65,.77,.18,chalk);
  const shaft=cylinder(landmark,0,2.9,0,.105,.39,5.65,white,3);shaft.rotation.y=Math.PI/6;
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3;
    const rib=box(landmark,Math.cos(a)*.15,2.0,Math.sin(a)*.15,.09,3.9,.17,roof);rib.rotation.y=-a;
  }
  cylinder(landmark,0,5.38,0,.43,.14,.24,white);
  cylinder(landmark,0,5.57,0,.71,.44,.18,white);
  cylinder(landmark,0,5.72,0,.69,.71,.13,dark);
  cylinder(landmark,0,5.81,0,.61,.70,.08,roof);
  cylinder(landmark,0,5.93,0,.38,.61,.17,white);
  cylinder(landmark,0,6.41,0,.095,.13,.85,white);
  cylinder(landmark,0,6.87,0,.23,.12,.13,white);
  cylinder(landmark,0,6.95,0,.17,.23,.05,dark);
  cylinder(landmark,0,7.44,0,.048,.10,.95,roof);
  cylinder(landmark,0,8.15,0,.021,.043,.5,white);
  cylinder(landmark,0,8.52,0,.009,.02,.25,dark);
  // Rogers Centre: low elliptical dome with restrained radial roof seams.
  const stadium=new T.Group();stadium.position.set(-2.65,.07,.8);stadium.rotation.y=-.14;world.add(stadium);
  const drum=cylinder(stadium,0,.18,0,1.21,1.23,.3,chalk);drum.scale.z=.86;
  const dome=new T.Mesh(new T.SphereGeometry(1,48,20,0,Math.PI*2,0,Math.PI/2),roof);
  dome.scale.set(1.22,.53,1.04);dome.position.y=.33;dome.castShadow=true;dome.receiveShadow=true;stadium.add(dome);
  for(let i=0;i<11;i++){
    const a=i*Math.PI/11,points=[];
    for(let j=0;j<=30;j++){const v=j/30*Math.PI;points.push([Math.cos(v)*Math.cos(a)*1.225,.33+Math.sin(v)*.535,Math.cos(v)*Math.sin(a)*1.045]);}
    line(stadium,points,0xc2c5ba,.55);
  }
  // Rail corridor and a quiet water edge orient the schematic site.
  for(let n=0;n<4;n++)line(world,[[-5.4,.07,2.1+n*.09],[5.4,.07,2.1+n*.09]],0x9ba498,.5);
  box(world,3.85,.055,3.0,2.35,.025,1.25,new T.MeshStandardMaterial({color:0xc8d4cf,roughness:.72}));
  for(let j=0;j<8;j++)line(world,[[2.8,.073,2.5+j*.13],[4.9,.073,2.5+j*.13]],0xecf0e9,.5);
  // All environmental effects are schematic, with one visible layer at a time.
  const effects={sun:new T.Group(),wind:new T.Group(),rain:new T.Group(),sound:new T.Group()};
  Object.values(effects).forEach(group=>world.add(group));
  // A softly tinted sun/shadow field lives on the tiles, preserving the modular seams.
  const solarSurfaces=[];
  for(const tile of tiles){
    const geo=new T.PlaneGeometry(2.07,2.07,16,16);geo.rotateX(-Math.PI/2);
    const pos=geo.attributes.position,colors=new Float32Array(pos.count*3);
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i)+tile.position.x,z=pos.getZ(i)+tile.position.z;
      const shadow=Math.exp(-Math.pow((x-1.0)/1.0,2)-Math.pow((z+.9)/1.8,2));
      const warm=new T.Color(0xe7b874),cool=new T.Color(0x8abfc2);
      warm.lerp(cool,shadow);colors.set([warm.r,warm.g,warm.b],i*3);
    }
    geo.setAttribute('color',new T.BufferAttribute(colors,3));
    const surface=new T.Mesh(geo,new T.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.38,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
    surface.position.y=.048;tile.add(surface);solarSurfaces.push(surface);
  }
  // Fine solar orbit and horizontal orientation ring echo architectural analysis drawings.
  const solarArc=[];
  for(let i=0;i<=100;i++){const a=i/100*Math.PI;solarArc.push([Math.cos(a)*6.25,Math.sin(a)*7.2+.08,-1.5]);}
  line(effects.sun,solarArc,0xbd9250,.55);
  const compass=[];for(let i=0;i<=140;i++){const a=i/140*Math.PI*2;compass.push([Math.cos(a)*6.1,.09,Math.sin(a)*5.0]);}
  line(effects.sun,compass,0x9da594,.35);
  const sunOrb=new T.Mesh(new T.SphereGeometry(.14,20,12),new T.MeshBasicMaterial({color:0xd99c42}));effects.sun.add(sunOrb);
  // A monochrome directional field makes airflow legible even with animation paused.
  const arrowVertices=[];
  for(let ix=0;ix<29;ix++)for(let iz=0;iz<22;iz++){
    const x=-5.2+ix*.37,z=-4.0+iz*.37;
    const bend=Math.exp(-((x+.3)**2+(z+.1)**2)/3);
    const dx=.14,dz=(z<0?-1:1)*bend*.10,y=.10;
    arrowVertices.push(x,y,z,x+dx,y,z+dz,x+dx,y,z+dz,x+dx-.045,y,z+dz+.025,x+dx,y,z+dz,x+dx-.04,y,z+dz-.035);
  }
  const arrowsGeo=new T.BufferGeometry();arrowsGeo.setAttribute('position',new T.Float32BufferAttribute(arrowVertices,3));
  effects.wind.add(new T.LineSegments(arrowsGeo,new T.LineBasicMaterial({color:0x428b90,transparent:true,opacity:.38})));
  const airflow=[];
  const flowPoint=(u,i)=>{const x=-6+u*12,y=.5+(i%5)*.58,z=-3.6+Math.floor(i/5)*1.7;const bend=Math.exp(-Math.pow((x+.3)/1.8,2));return [x,y+bend*.4,z+(z<0?-1:1)*bend*.65];};
  for(let i=0;i<25;i++){
    const points=Array.from({length:65},(_,n)=>flowPoint(n/64,i));
    line(effects.wind,points,0x559ea2,.22);
    const dash=line(effects.wind,points.slice(0,9),0x287d87,.85);
    airflow.push({i,dash});
  }
  const rainCount=280,rainPositions=new Float32Array(rainCount*6),rainSeeds=[];
  for(let i=0;i<rainCount;i++)rainSeeds.push([rand()*12-6,rand()*9,rand()*9-4.5]);
  const rainGeo=new T.BufferGeometry();rainGeo.setAttribute('position',new T.BufferAttribute(rainPositions,3));
  const rainMesh=new T.LineSegments(rainGeo,new T.LineBasicMaterial({color:0x658fb3,transparent:true,opacity:.5}));effects.rain.add(rainMesh);
  const runoff=[];
  for(let j=0;j<7;j++){
    const points=[];for(let i=0;i<45;i++){const u=i/44;points.push([-4.9+u*9.8,.085,2.3+j*.11+Math.sin(u*6+j)*.07]);}
    runoff.push(line(effects.rain,points,0x4d87ad,.65));
  }
  // Dotted wavefront: points form a continuous undulating sound surface.
  const pointCanvas=document.createElement('canvas');pointCanvas.width=32;pointCanvas.height=32;
  const ctx=pointCanvas.getContext('2d');ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(16,16,12,0,Math.PI*2);ctx.fill();
  const pointTexture=new T.CanvasTexture(pointCanvas);
  const soundBase=[],soundPositions=[];
  for(let ix=0;ix<66;ix++)for(let iz=0;iz<52;iz++){
    const x=-5.35+ix*.165,z=-4.25+iz*.165;const r=Math.hypot(x+.3,z+.1);
    soundBase.push([x,z,r]);soundPositions.push(x,.13,z);
  }
  const soundGeo=new T.BufferGeometry();soundGeo.setAttribute('position',new T.Float32BufferAttribute(soundPositions,3));
  const soundPoints=new T.Points(soundGeo,new T.PointsMaterial({color:0x725091,size:2.0,map:pointTexture,transparent:true,opacity:.9,alphaTest:.2,depthWrite:false,toneMapped:false}));
  effects.sound.add(soundPoints);
  const rainGround=new T.BufferGeometry();const runoffPoints=new Float32Array(450*3);rainGround.setAttribute('position',new T.BufferAttribute(runoffPoints,3));
  effects.rain.add(new T.Points(rainGround,new T.PointsMaterial({color:0x4d83ad,size:1.9,map:pointTexture,transparent:true,opacity:.8,alphaTest:.2})));
  const rings=[];
  for(let j=0;j<4;j++){
    const ring=line(effects.sound,Array.from({length:97},(_,i)=>{const a=i/96*Math.PI*2;return [Math.cos(a),0,Math.sin(a)];}),0x9980ae,.5);
    ring.position.set(-.3,.105,-.1);rings.push(ring);
  }
  const dustGeo=new T.BufferGeometry();const dust=new Float32Array(90);
  for(let i=0;i<30;i++)dust.set([rand()*12-6,rand()*6+.5,rand()*9-4.5],i*3);
  dustGeo.setAttribute('position',new T.BufferAttribute(dust,3));
  const particles=new T.Points(dustGeo,new T.PointsMaterial({color:0xbcb8a1,size:1.2,transparent:true,opacity:.28}));effects.sun.add(particles);
  let azimuth=.63,elevation=.46,dragging=false,lastX=0,lastY=0,orbit=0,clock=0,frames=0,lastTime=0,lastRender=0;
  let pointerX=0,pointerY=0,leanX=0,leanY=0;
  function setMode(value){
    if(!names[value])return;mode=value;root.dataset.mode=value;status.textContent=names[value];
    solarSurfaces.forEach(surface=>surface.visible=mode==='sun');
    for(const [name,group] of Object.entries(effects))group.visible=name===mode;
    document.querySelectorAll('button[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===value)));
    render(0);
    if(embedded)parent.postMessage({type:'plotcloud-hero-state',mode},location.origin);
  }
  document.querySelectorAll('button[data-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.mode)));
  pauseButton.addEventListener('click',()=>{paused=!paused;syncPause();});
  reduced.addEventListener('change',e=>{paused=e.matches;syncPause();});
  document.querySelector('[data-action=reset]').addEventListener('click',()=>{azimuth=.63;elevation=.46;orbit=0;pointerX=pointerY=leanX=leanY=0;render(0);});
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!dragging){if(!paused&&e.pointerType!=='touch'){const rect=canvas.getBoundingClientRect();pointerX=(e.clientX-rect.left)/rect.width-.5;pointerY=(e.clientY-rect.top)/rect.height-.5;}return;}azimuth-=(e.clientX-lastX)*.004;elevation=T.MathUtils.clamp(elevation+(e.clientY-lastY)*.003,.2,.85);lastX=e.clientX;lastY=e.clientY;render(0);});
  canvas.addEventListener('pointerleave',()=>{pointerX=pointerY=0;});
  const endDrag=()=>{dragging=false;};canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
  function render(dt){
    const animate=!paused&&!dragging;
    if(animate){clock+=dt;orbit=Math.sin(clock*.055)*.16;}
    if(animate){const follow=1-Math.exp(-dt*5);leanX+=(pointerX*.13-leanX)*follow;leanY+=(pointerY*.05-leanY)*follow;}
    camera.position.set(Math.sin(azimuth+orbit+leanX)*23,Math.sin(elevation+leanY)*23+3,Math.cos(azimuth+orbit+leanX)*23);
    camera.lookAt(0,2.75,0);
    const tint=new T.Color(mode==='sun'?0xffdfa7:mode==='rain'?0xdbe8f8:0xf4f3ea);
    key.color.lerp(tint,dt?Math.min(1,dt*3):1);
    key.intensity=T.MathUtils.lerp(key.intensity,mode==='sun'?4.2:3,dt?Math.min(1,dt*3):1);
    key.position.x=-9+(mode==='sun'?Math.sin(clock*.09)*4:0);
    const solarPhase=.85+Math.sin(clock*.09)*.35;
    sunOrb.position.set(Math.cos(solarPhase)*6.25,Math.sin(solarPhase)*7.2+.08,-1.5);
    tiles.forEach(tile=>{if(tile.userData.floating)tile.position.y=tile.userData.base+Math.sin(clock*.6+tile.userData.phase)*.035;});
    if(mode==='wind')airflow.forEach(({i,dash})=>{const a=dash.geometry.attributes.position;for(let p=0;p<a.count;p++){const u=((clock*.1+i*.071)%.94)+p*.006;const point=flowPoint(u,i);a.setXYZ(p,...point);}a.needsUpdate=true;});
    if(mode==='rain'){
      rainSeeds.forEach(([x,y,z],i)=>{const h=((y-clock*2.7)%9+9)%9;rainPositions.set([x,h,z,x-.035,h+.21,z+.015],i*6);});rainGeo.attributes.position.needsUpdate=true;
      runoff.forEach((mesh,i)=>mesh.material.opacity=.4+Math.sin(clock*2+i)*.2);
      for(let i=0;i<450;i++){
        const row=Math.floor(i/75),u=(i%75/75+clock*.065)%1;
        const x=-5.3+u*10.6,z=-3.9+row*1.45+Math.sin(u*7+row)*.16;
        runoffPoints.set([x,.12,z],i*3);
      }
      rainGround.attributes.position.needsUpdate=true;
    }
    if(mode==='sound'){
      rings.forEach((ring,i)=>{const phase=(clock*.15+i*.25)%1;const scale=.5+phase*5.4;ring.scale.set(scale,1,scale);ring.material.opacity=(1-phase)*.25;});
      const a=soundGeo.attributes.position;
      soundBase.forEach(([x,z,r],i)=>{const wave=Math.sin(r*3.8-clock*3.0);a.setY(i,.16+(.5+.5*wave)*.95*Math.exp(-r*.07));});
      a.needsUpdate=true;
    }
    particles.rotation.y=clock*.015;
    renderer.render(scene,camera);frames++;
  }
  function resize(){
    const {width,height}=viewport.getBoundingClientRect();if(!width||!height)return;
    renderer.setSize(width,height,false);
    const aspect=width/height,halfHeight=embedded?Math.max(6.15,6.8/aspect):Math.max(7.1,7.6/aspect);
    camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;
    camera.updateProjectionMatrix();render(0);
  }
  resizeObserver=new ResizeObserver(resize);resizeObserver.observe(viewport);
  observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;},{rootMargin:'60px'});observer.observe(viewport);
  document.addEventListener('visibilitychange',()=>{lastTime=0;});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();showFallback();});
  function loop(time){
    if(failed)return;
    frame=requestAnimationFrame(loop);
    if(!visible||document.hidden){lastTime=0;return;}
    if(time-lastRender<33)return;
    const dt=lastTime?Math.min((time-lastTime)/1000,.1):0;lastTime=time;lastRender=time;
    if(!paused)render(dt);
  }
  function applyTheme(value){
    visualTheme=value==='night'?'night':'day';document.documentElement.dataset.theme=visualTheme;
    renderer.setClearColor(backgroundColor());scene.fog.color.setHex(backgroundColor());render(0);
  }
  if(embedded)addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='plotcloud-hero-config')return;
    if(['day','night'].includes(event.data.theme))applyTheme(event.data.theme);
    if(names[event.data.mode]&&event.data.mode!==mode)setMode(event.data.mode);
  });
  setMode(initialMode);resize();root.dataset.ready='true';
  if(embedded)parent.postMessage({type:'plotcloud-hero-ready'},location.origin);
  window.PlotCloudHero={get state(){return {mode,paused,frames,ready:!failed,azimuth,elevation,clock,leanX,leanY,theme:visualTheme};}};
  frame=requestAnimationFrame(loop);
  addEventListener('pagehide',()=>{cancelAnimationFrame(frame);observer.disconnect();resizeObserver.disconnect();scene.traverse(object=>{object.geometry?.dispose();if(object.material){const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.dispose());}});renderer.dispose();},{once:true});
} catch(error) { showFallback(error); }
