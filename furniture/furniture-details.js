// All detail geometry is regenerated from the current part dimensions (millimetres).
export const DETAIL_FAMILIES=new Set(['bed','nightstand','wardrobe','dresser','sofa','sectional','armchair','coffee','sidetable','tvstand','bookshelf','dining','chair','desk','office','kitchen','island','fridge','range','washer','toilet','vanity','bathtub','shower','shoecab']);
export const STORAGE_FAMILIES=new Set(['nightstand','wardrobe','dresser','tvstand','desk','kitchen','island','vanity','shoecab']);
const ellipse=(rx,ry,x=0,y=0)=>Array.from({length:64},(_,i)=>[x+rx*Math.cos(i*Math.PI/32),y+ry*Math.sin(i*Math.PI/32)]);
const base=q=>q.cz-q.h/2;
function bowl(B,name,mat,x,y,z,rx,ry,h,t=12){
 const profile=[[0,0],[rx*.54,0],[rx*.7,h*.12],[rx*.9,h*.5],[rx,h-6],[rx-2,h],[rx-t,h],[rx*.9-t,h*.51],[rx*.68-t,h*.17],[rx*.5,t],[0,t],[0,0]];
 B.lathe(name,'Fixtures',mat,x,y,z,profile,ry/rx);
 B.cyl('Drain fitting','Fixtures','steel',x,y,z+t+.5,Math.min(22,rx*.14),3,{seg:32});
 B.cyl('Drain inset','Fixtures','black',x,y,z+t+3.6,Math.min(12,rx*.08),.6,{seg:24});
}
function seam(B,q){
 const z=q.cz+q.h/2-4,hw=q.w/2-10,hd=q.d/2-10;if(hw<12||hd<12)return;
 const c=Math.cos(q.rotZ||0),s=Math.sin(q.rotZ||0),r=Math.min(22,hw*.2,hd*.2),pts=[];
 for(const [x,y,a]of [[hw-r,hd-r,0],[-hw+r,hd-r,Math.PI/2],[-hw+r,-hd+r,Math.PI],[hw-r,-hd+r,Math.PI*1.5]])for(let i=0;i<5;i++){const angle=a+i*Math.PI/8,px=x+r*Math.cos(angle),py=y+r*Math.sin(angle);pts.push([q.cx+px*c-py*s,q.cy+px*s+py*c,z]);}
 pts.push(pts[0]);B.tube(q.name+' piping','Stitching','fabric',pts,1.8);
}
function hollow(B,q,openTop){
 const t=Math.min(20,q.w*.06,q.d*.06,q.h*.08),z=base(q);
 for(const sx of [-1,1])B.box('Cabinet side','Interior',q.mat,q.cx+sx*(q.w/2-t/2),q.cy,z,t,q.d,q.h,{r:1});
 B.box('Cabinet back','Interior',q.mat,q.cx,q.cy+q.d/2-t/2,z,q.w-2*t,t,q.h);
 B.box('Cabinet bottom','Interior',q.mat,q.cx,q.cy,z,q.w-2*t,q.d-t,t);
 if(!openTop)B.box('Cabinet top','Interior',q.mat,q.cx,q.cy,z+q.h-t,q.w-2*t,q.d-t,t);
 return t;
}
export function refineFurniture(id,p,input,makeBuilder){
 if(!DETAIL_FAMILIES.has(id))return input;
 const B=makeBuilder(),parts=input.slice(),remove=new Set(),sink=parts.find(q=>q.name==='Sink rim');
 const carcasses=parts.filter(q=>q.kind==='box'&&['Carcass','Base carcass','Island carcass','Drawer unit','Wall carcass'].includes(q.name));
 for(const q of carcasses){remove.add(q);const t=hollow(B,q,!!sink);
  if(p.openStorage){for(let i=1;i<=2;i++)B.box('Interior shelf','Interior',q.mat,q.cx,q.cy-4,base(q)+(q.h-t)*i/3,q.w-2*t,q.d-t-12,t);}
 }
 if(p.openStorage)for(const q of parts)if(/^(Door|Base door|Wall door|Drawer front|Handle)$/.test(q.name))remove.add(q);
 if(id==='vanity'){
  for(const q of parts)if(['Basin','Faucet','Spout'].includes(q.name))remove.add(q);
  const count=p.basins,slot=p.W/count,rx=Math.min(210,slot/2-30),ry=Math.min(160,p.D*.3),cy=-Math.min(30,p.D*.06),h=p.bowlDepth||130;
  for(let i=0;i<count;i++){const x=(i-(count-1)/2)*slot;bowl(B,'Basin shell','ceramic',x,cy,p.H,rx,ry,h,12);const fy=Math.min(p.D/2-30,cy+ry+30);
   B.cyl('Faucet','Fixtures','steel',x,fy,p.H,14,h+120);B.box('Spout','Fixtures','steel',x,fy-65,p.H+h+90,26,150,20,{r:6});
   B.box('Mixer lever','Fixtures','steel',x,fy-10,p.H+h+122,12,70,9,{r:3});
  }
 }
 if(sink){
  const body=carcasses.find(q=>q.name==='Base carcass'||q.name==='Island carcass'),direction=id==='island'?1:-1;
  const x=sink.cx,y=body?body.cy+direction*30:sink.cy,rx=sink.w/2-5,ry=Math.min(sink.d/2-5,body?(body.d-130)/2:225),top=base(sink),h=p.bowlDepth||170;
  for(const q of parts)if(['Sink rim','Sink basin','Faucet','Spout'].includes(q.name))remove.add(q);
  const counter=parts.find(q=>q.name==='Countertop');if(counter){remove.add(counter);const z=base(counter);B.prism('Countertop with sink cutout',counter.layer,counter.mat,'xy',[[counter.cx-counter.w/2,counter.cy-counter.d/2],[counter.cx+counter.w/2,counter.cy-counter.d/2],[counter.cx+counter.w/2,counter.cy+counter.d/2],[counter.cx-counter.w/2,counter.cy+counter.d/2]],z,counter.h,[ellipse(rx-8,ry-8,x,y)]);}
  bowl(B,'Sink shell','steel',x,y,top-h+4,rx,ry,h,8);
  const fy=body?body.cy-direction*(body.d/2-32):y+ry+40;
  B.cyl('Faucet','Fixtures','steel',x,fy,top,16,260);
  B.box('Spout','Fixtures','steel',x,(fy+y)/2,top+240,28,Math.abs(fy-y)+30,22,{r:6});
  B.box('Mixer lever','Fixtures','steel',x+28,fy,top+120,12,55,10,{r:3});
 }
 if(id==='toilet'){
  const q=parts.find(q=>q.name==='Bowl'),seat=parts.find(q=>q.name==='Seat');remove.add(q);remove.add(seat);
  bowl(B,'Toilet bowl shell','ceramic',q.cx,q.cy,base(q),q.r,q.ry,q.h,16);
  B.lathe('Seat ring','Seat','white',seat.cx,seat.cy,base(seat),[[150,0],[182,0],[182,25],[150,25],[150,0]],seat.ry/182);
  for(const sx of [-1,1])B.cyl('Seat hinge','Hardware','steel',sx*65,q.cy+q.ry*.72,p.sh-25,12,20);
 }
 if(id==='shower'){
  const q=parts.find(q=>q.name==='Shower tray');if(q){remove.add(q);const floor=Math.min(12,q.h);B.box('Tray floor','Tray',q.mat,q.cx,q.cy,base(q),q.w,q.d,floor,{r:3});if(q.h>floor){for(const sx of [-1,1])B.box('Tray side','Tray',q.mat,q.cx+sx*(q.w/2-12),q.cy,base(q)+floor,24,q.d,q.h-floor);for(const sy of [-1,1])B.box('Tray end','Tray',q.mat,q.cx,q.cy+sy*(q.d/2-12),base(q)+floor,q.w-48,24,q.h-floor);}const drain=parts.find(r=>r.name==='Drain');if(drain)drain.cz=base(q)+floor+1;}
 }
 if(p.details!==false){
  for(const q of parts){if(remove.has(q))continue;
   if(q.kind==='box'&&/Pillow|cushion|^Seat$|Duvet/.test(q.name)&&q.mat!=='wood')seam(B,q);
   if(q.kind==='box'&&['Top','Desktop'].includes(q.name)){
    const z=base(q);for(const sy of [-1,1])B.box('Under-top rail','Joinery','wood',q.cx,q.cy+sy*(q.d/2-55),z-38,Math.max(20,q.w-120),18,36);
   }
   if(q.kind==='box'&&q.name==='Handle'){for(const sx of [-1,1])B.box('Handle mount','Hardware','steel',q.cx+sx*q.w*.3,q.cy+q.d*.45,base(q)+q.h*.3,Math.min(12,q.w*.15),Math.max(8,q.d*.65),Math.max(6,q.h*.4));}
   if(q.kind==='box'&&/screen/.test(q.name))B.box('Screen bezel','Devices','black',q.cx,q.cy+q.d/2+1,base(q)-3,q.w+6,4,q.h+6,{r:2});
   if(q.kind==='box'&&q.name==='Spout')B.cyl('Aerator','Fixtures','steel',q.cx,q.cy-q.d*.36,base(q)-4,Math.min(9,q.w*.3),4);
   if(q.kind==='cyl'&&q.name==='Leg'&&q.axis==='z')B.cyl('Foot glide','Hardware','black',q.cx,q.cy,base(q),q.r*.92,Math.min(5,q.h*.15));
  }
  if(id==='bed'){
   const q=parts.find(q=>q.name==='Mattress');for(const sy of [-1,1])B.box('Mattress side panel','Bedding','mattress',q.cx,q.cy+sy*(q.d/2-5),q.cz-18,q.w-60,4,36,{r:2});
   if(p.head)for(const sx of [-1,1])B.box('Headboard panel seam','Stitching','fabric',sx*p.W/6,p.L/2+28,Math.min(p.headH,p.frameH+p.mat+150)*.25,3,2,Math.max(100,p.headH*.6));
  }
  if(id==='bookshelf')for(const q of parts.filter(q=>q.name==='Shelf'))for(const sx of [-1,1])for(const sy of [-1,1])B.cyl('Shelf support','Hardware','steel',sx*(p.W/2-p.t-4),sy*(p.D/2-40),base(q)-6,4,6,{seg:12});
  if(['fridge','range'].includes(id))for(let i=0;i<7;i++)B.box('Vent slot','Hardware','black',(i-3)*p.W*.09,-p.D/2-1,32,p.W*.055,3,5);
  if(id==='range')for(const q of parts.filter(q=>q.name==='Burner'))for(const rot of [0,Math.PI/2])B.box('Pan support','Cooktop','black',q.cx,q.cy,q.cz+q.h/2+1,q.r*1.65,8,8,{rot});
  if(id==='washer')for(const q of parts.filter(q=>q.name.endsWith(' door')))B.cylY('Door gasket','Hardware','black',q.cx,q.cy+2,q.cz,q.r+12,4,{seg:48});
  if(id==='bathtub'){B.cylY('Overflow trim','Fixtures','steel',p.L/2-72,0,p.H-100,18,4);for(let i=-2;i<=2;i++)B.box('Drain grille','Fixtures','black',p.L/2-190+i*6,0,112,2,30,1);}
  if(id==='shower')for(const q of parts.filter(q=>q.name==='Fixed glass'||q.name==='Door glass'))for(const z of [base(q)+80,base(q)+q.h-80])B.box('Glass bracket','Hardware','steel',q.cx-q.w/2+25,q.cy,z,26,16,20,{r:2});
  if(id==='office'){B.box('Lumbar pad','Seat','fabric',0,480/2-2,p.sh+160,p.sw*.65,22,85,{r:14});B.cylY('Height adjustment lever','Hardware','black',p.sw*.32,-25,p.sh-85,9,120);}
  if(id==='toilet'){const q=parts.find(q=>q.name==='Pedestal');for(const sx of [-1,1])B.cyl('Floor fixing cap','Hardware','ceramic',sx*90,q.cy,8,14,10,{seg:24});}
 }
 return parts.filter(q=>!remove.has(q)).concat(B.parts);
}
