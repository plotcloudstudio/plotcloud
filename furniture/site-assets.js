// Original lightweight architectural entourage. Z-up millimetres; faces -Y.
// Deterministic geometry keeps saved project dimensions and exports reproducible.
const TAU=Math.PI*2;
function loft(B,name,mat,rings,seg=12,layer='Body'){
 if(rings.at(-1)[2]<rings[0][2])rings=[...rings].reverse();
 B.parts.push({kind:'loft',name,layer,mat,rings,seg,cx:0,cy:0,cz:0});
}
function oval(B,name,mat,x,y,z,rx,ry,rz,layer='Body',seg=12){
 const rings=Array.from({length:9},(_,i)=>{const a=-Math.PI/2+i*Math.PI/8,r=Math.max(.001,Math.cos(a));return[x,y,z+Math.sin(a)*rz,rx*r,ry*r];});
 loft(B,name,mat,rings,seg,layer);
}
function limb(B,name,mat,points,radii){
 loft(B,name,mat,points.map((p,i)=>[...p,radii[i],radii[i]*.85]),10);
}
function upperBody(B,H,{hip=.51,shoulder=.81,head=.91,y=0,lean=0,child=false,seated=false}={}){
 const z=hip*H,t=shoulder*H,skin='personSkin',cloth='person';
 loft(B,'Tailored shirt',cloth,[[0,y,z,.094*H,.055*H],[0,y,z+.035*H,.1*H,.062*H],[0,y+lean*.4,z+(t-z)*.45,.085*H,.053*H],[0,y+lean*.9,t-.035*H,.128*H,.063*H],[0,y+lean,t,.115*H,.052*H],[0,y+lean,t+.012*H,.035*H,.031*H]],16);
 B.cyl('Neck','Body',skin,0,y+lean,t,.026*H,(seated?.06:.04)*H,{seg:12});
 const hy=y+lean-.006*H,hz=head*H;
 oval(B,'Head',skin,0,hy,hz,.045*H,.051*H,(1-head)*H);
 oval(B,'Jaw',skin,0,hy-.016*H,hz-.035*H,.034*H,.036*H,.025*H);
 oval(B,'Hair','personHair',0,hy+.005*H,hz+(1-head)*H*.45,.046*H,.05*H,(1-head)*H*.55);
 oval(B,'Nose',skin,0,hy-.053*H,hz-.005*H,.01*H,.016*H,.012*H);
 for(const s of [-1,1])oval(B,'Ear',skin,s*.045*H,hy,hz-.002*H,.008*H,.012*H,.017*H);
 for(const s of [-1,1]){
  const shoulderP=[s*.123*H,y+lean,t-.018*H];
  const elbow=[s*.152*H,y-(s>0?.025:-.015)*H, seated?z+.03*H:.635*H];
  const wrist=[s*.14*H,y-(seated?.14:.035)*H,seated?z+.012*H:.53*H];
  limb(B,'Shirt sleeve',cloth,[[s*.112*H,y+lean,t-.015*H],[s*.145*H,y+lean*.4,t-.075*H],elbow],[.037*H,.038*H,.029*H]);
  limb(B,'Forearm',skin,[elbow,[(elbow[0]+wrist[0])/2,(elbow[1]+wrist[1])/2,(elbow[2]+wrist[2])/2],wrist],[.027*H,.024*H,.018*H]);
  oval(B,'Hand',skin,wrist[0],wrist[1],wrist[2]-.02*H,.02*H,.018*H,.036*H);
  // Separate collar halves, button placket and hem make the body read as clothing.
  B.prism('Shirt collar','Clothing','personTrim','xy',[[s*.008*H,y-.034*H],[s*.042*H,y-.053*H],[s*.025*H,y-.067*H]],t-.012*H,.009*H);
 }
 B.tube('Shirt placket','Clothing','personTrim',[[0,y-.063*H,z+.045*H],[0,y+lean-.058*H,t-.025*H]],.0025*H);
 for(let i=0;i<4;i++)oval(B,'Shirt button','personTrim',0,y-.065*H+lean*i/4,z+.075*H+i*(t-z-.1*H)/4,.003*H,.002*H,.003*H,'Clothing',8);
 if(!child)B.box('Belt','Clothing','personTrim',0,y,z-.009*H,.184*H,.112*H,.012*H,{r:.005*H});
}
export function standingFigure(B,H,o={}){
 const child=!!o.headR,elderly=!!o.stoop,hip=child?.48:.51,shoulder=child?.79:.83,head=child?.905:.935,lean=elderly?-.03*H:0;
 upperBody(B,H,{hip,shoulder,head,lean,child});
 for(const s of [-1,1]){
  const step=s*.025*H,x=s*.052*H;
  limb(B,'Trouser leg','personDk',[[x,0,hip*H],[x,step*.6,.43*H],[x,step,.29*H],[x,step*.8,.17*H],[x,step,.045*H]],[.056*H,.05*H,.037*H,.033*H,.029*H]);
  B.box('Shoe sole','Clothing','personTrim',x,step-.025*H,0,.07*H,.145*H,.013*H,{r:.006*H});
  oval(B,'Shoe upper','personShoe',x,step-.025*H,.028*H,.037*H,.075*H,.025*H,'Clothing');
 }
 if(elderly){
  // A restrained lean, silver hair and glasses, without exaggerated frailty.
  const hz=head*H,hy=lean-.006*H;
  for(const p of B.parts)if(p.name==='Hair')p.mat='personSilver';
  for(const s of [-1,1])B.tube('Glasses','Clothing','personTrim',Array.from({length:13},(_,i)=>{const a=i*TAU/12;return[s*.022*H+Math.cos(a)*.017*H,hy-.052*H,hz+.006*H+Math.sin(a)*.012*H];}),.0015*H);
  B.tube('Glasses bridge','Clothing','personTrim',[[-.006*H,hy-.053*H,hz+.006*H],[.006*H,hy-.053*H,hz+.006*H]],.0015*H);
 }
 return B.parts;
}
export function wheelchairFigure(B,H){
 const wr=300;
 B.box('Seat cushion','Chair','personTrim',0,0,480,450,430,50,{r:20});
 B.box('Upholstered back','Chair','personTrim',0,220,520,440,50,380,{r:18});
 for(const s of [-1,1]){
  const x=s*350;
  const ring=(name,r,mat,t)=>B.prism(name,'Wheels',mat,'yz',Array.from({length:40},(_,i)=>[85+r*Math.cos(i*TAU/40),wr+r*Math.sin(i*TAU/40)]),x-t/2,t,[Array.from({length:40},(_,i)=>[85+(r-14)*Math.cos(-i*TAU/40),wr+(r-14)*Math.sin(-i*TAU/40)])]);
  ring('Pneumatic tyre',wr,'tyre',35);ring('Wheel rim',wr-20,'steel',16);ring('Push rim',wr-45,'steel',12);
  for(let i=0;i<12;i++){const a=i*TAU/12;B.tube('Wheel spoke','Wheels','steel',[[x,85,wr],[x,85+(wr-23)*Math.cos(a),wr+(wr-23)*Math.sin(a)]],3);}
  oval(B,'Axle hub','steel',x,85,wr,22,22,22,'Wheels');
  B.tube('Frame rail','Chair','steel',[[s*225,-400,170],[s*225,-170,450],[s*225,200,480],[s*225,225,880],[s*225,330,880]],14);
  B.tube('Armrest support','Chair','steel',[[s*245,-120,480],[s*245,-120,700],[s*245,210,700]],12);
  B.box('Arm pad','Chair','personTrim',s*245,30,700,65,310,28,{r:12});
  B.prism('Front caster','Wheels','tyre','yz',Array.from({length:20},(_,i)=>[-420+65*Math.cos(i*TAU/20),65+65*Math.sin(i*TAU/20)]),s*220-15,30);
  B.tube('Caster fork','Chair','steel',[[s*220,-420,65],[s*220,-420,160],[s*220,-340,240]],9);
  B.box('Footplate','Chair','steel',s*95,-470,155,170,190,18,{r:8});
 }
 B.tube('Cross brace','Chair','steel',[[-225,-140,220],[225,180,470]],12);B.tube('Cross brace','Chair','steel',[[225,-140,220],[-225,180,470]],12);
 // Rider dimensions scale above the fixed seat so the feet remain on footplates.
 const torsoScale=H;
 upperBody(B,torsoScale,{hip:650/torsoScale,shoulder:(H-230)/torsoScale,head:.935,y:45,seated:true});
 for(const s of [-1,1]){
  limb(B,'Seated trouser leg','personDk',[[s*95,80,585],[s*95,-120,590],[s*95,-340,560],[s*95,-355,380],[s*95,-390,215]],[80,75,65,49,43]);
  B.box('Shoe sole','Clothing','personTrim',s*95,-450,175,100,200,18,{r:8});oval(B,'Shoe','personShoe',s*95,-450,210,52,100,35,'Clothing');
 }
 return B.parts;
}
export function landscapeTree(B,H,C,getBounds){
 let state=137;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const R=C/2,tr=Math.max(60,C*.027);
 loft(B,'Tapered trunk','trunk',[[0,0,0,tr*1.35,tr*1.2],[tr*.2,0,H*.2,tr,tr*.9],[-tr*.15,tr*.2,H*.42,tr*.65,tr*.6],[0,0,H*.66,tr*.25,tr*.23]],12,'Tree');
 for(let i=0;i<22;i++){
  const a=i*2.399963,z=H*(.46+.43*rand()),spread=Math.sin((z/H-.35)/.65*Math.PI)*R*.72;
  const x=Math.cos(a)*spread,y=Math.sin(a)*spread,base=[0,0,H*(.29+.18*rand())];
  B.tube('Primary branch','Tree','trunk',[base,[x*.45,y*.45,z*.8],[x,y,z]],tr*(.18+.12*rand()));
  const clusterR=R*(.19+.09*rand());
  for(let j=0;j<48;j++){
   const az=rand()*TAU,u=rand()*2-1,r=clusterR*Math.cbrt(rand()),q=Math.sqrt(1-u*u);
   const lx=x+Math.cos(az)*q*r,ly=y+Math.sin(az)*q*r,lz=Math.min(H-12,z+u*r*.8),sz=Math.min(C*.035,140)*( .65+rand()*.7),ang=rand()*TAU;
   const along=[Math.cos(ang)*sz,Math.sin(ang)*sz],side=[-along[1]*.4,along[0]*.4];
   // Folded leaf blades, green tonal variation and air gaps, rather than solid balls.
   const points=[[lx-along[0],ly-along[1]],[lx+side[0],ly+side[1]],[lx+along[0],ly+along[1]],[lx-side[0],ly-side[1]]];
   B.prism('Leaf blade','Foliage',['leaf','leafDk','leafLight','leafMid'][Math.floor(rand()*4)],'xy',points,Math.max(H*.32,lz),Math.max(2,sz*.05));
  }
 }
 const b=getBounds(B.parts),sx=C/(b[3]-b[0]),sy=C/(b[4]-b[1]),sz=H/(b[5]-b[2]);
 for(const p of B.parts){
  if(p.kind==='loft')p.rings=p.rings.map(([x,y,z,rx,ry])=>[x*sx,y*sy,z*sz,rx*sx,ry*sy]);
  else if(p.kind==='tube'){p.pts=p.pts.map(([x,y,z])=>[x*sx,y*sy,z*sz]);p.r*=Math.min(sx,sy,sz);}
  else if(p.kind==='prism'){p.pts=p.pts.map(([x,y])=>[x*sx,y*sy]);p.a0*=sz;p.t*=sz;}
 }
 return B.parts;
}
