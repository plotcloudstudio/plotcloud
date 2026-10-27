// Render library thumbnails from the same parameterized geometry used by Plan/Perspective.
const fs=require('node:fs'),{chromium}=require('playwright');
(async()=>{const base=process.env.TEST_BASE||'http://127.0.0.1:8790',browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage();await page.goto(base+'/furniture/');await page.setContent(`<script type="importmap">{"imports":{"three":"${base}/furniture/three.module.min.js","three/addons/":"${base}/furniture/addons/"}}</script>`);
 const results=await page.evaluate(async base=>{const T=await import('three'),{MODELS,defaults,buildModel,materialColor}=await import(base+'/furniture/models.js?v=furniture-detail-20261027-1'),{partGeometry}=await import(base+'/furniture/geom.js?v=furniture-detail-20261027-1');
  const W=260,H=200,R=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});R.setSize(W,H);R.setClearColor(0xffffff,0);R.outputColorSpace=T.SRGBColorSpace;const sc=new T.Scene();sc.add(new T.HemisphereLight(0xffffff,0xb9b3a8,2.1));const light=new T.DirectionalLight(0xffffff,1.5);light.position.set(-3,6,4);sc.add(light);const cam=new T.PerspectiveCamera(28,W/H,.05,100),out=[];
  for(const m of MODELS){const v=defaults(m),{parts}=buildModel(m,v),group=new T.Group();group.rotation.x=-Math.PI/2;group.scale.setScalar(.001);
   for(const p of parts){const glass=['glass','clearglass','mirror'].includes(p.mat);group.add(new T.Mesh(partGeometry(p),new T.MeshLambertMaterial({color:materialColor(p.mat,v),transparent:glass,opacity:glass?.5:1})));}sc.add(group);
   const b=new T.Box3().setFromObject(group),ctr=b.getCenter(new T.Vector3()),sz=b.getSize(new T.Vector3()),dist=Math.max(sz.x,sz.z*1.1,sz.y*1.5)/(2*Math.tan(14*Math.PI/180))*1.25;cam.position.copy(ctr).add(new T.Vector3(.75,.62,1).normalize().multiplyScalar(dist));cam.lookAt(ctr);R.render(sc,cam);out.push({id:m.id,image:R.domElement.toDataURL('image/png').split(',')[1]});sc.remove(group);group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});await new Promise(r=>setTimeout(r,0));
  }R.dispose();return out;
 },base);
 for(const r of results)fs.writeFileSync('mvp/img/furniture/'+r.id+'.png',Buffer.from(r.image,'base64'));console.log('Rendered',results.length,'parameterized family thumbnails (260 × 200).');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
