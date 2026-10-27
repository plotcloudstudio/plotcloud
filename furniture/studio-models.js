// Studio and institutional furniture. Units: millimetres; generated with the shared part builder.
export function studioModels(makeBuilder){
 const dim=(k,label,min,max,def,step=10)=>({k,label,min,max,def,step});
 const num=(k,label,min,max,def)=>({k,label,type:'int',min,max,def});
 const bool=(k,label,def)=>({k,label,type:'bool',def});
 const model=(id,en,group,params,build,colors=['wood','fabric'])=>({id,en,name:en,cat:group,group,colors,params,build,kw:'studio school university classroom '+en.toLowerCase()});
 const feet=(B,w,d,h)=>{for(const sx of [-1,1])for(const sy of [-1,1])B.box('Leg','Frame','steel',sx*(w/2-45),sy*(d/2-45),0,35,35,h,{r:3});};
 return[
 model('drafting_table','Drafting table','Dining & Office',[dim('W','Width',900,1800,1200),dim('D','Depth',600,1000,800),dim('H','Front working height',700,1100,900),{...dim('tilt','Top tilt',0,45,15,1),unit:'°'},bool('shelf','Storage shelf',true)],p=>{
  const B=makeBuilder(),a=p.tilt*Math.PI/180,rise=p.D*Math.sin(a),depth=p.D*Math.cos(a),top=28;
  feet(B,p.W,p.D,p.H-top);B.prism('Tilting drawing top','Top','wood','yz',[[-depth/2,p.H-top],[depth/2,p.H+rise-top],[depth/2,p.H+rise],[-depth/2,p.H]],-p.W/2,p.W);
  B.box('Paper stop','Hardware','steel',0,-depth/2-5,p.H-5,p.W-100,16,24,{r:2});
  for(const sx of [-1,1])B.box('Tilt support','Hardware','steel',sx*(p.W/2-55),depth*.2,p.H-60,20,35,rise*.7+45);
  B.box('Frame stretcher','Frame','steel',0,p.D/2-45,250,p.W-90,25,50);
  if(p.shelf)B.box('Storage shelf','Storage','wood',0,0,190,p.W-130,p.D-140,20,{r:2});return B.parts;
 }),
 model('studio_stool','Studio stool','Dining & Office',[dim('H','Seat height',450,850,650),dim('W','Seat diameter',320,480,380),bool('back','Backrest',true),dim('footH','Footrest height',150,350,250)],p=>{
  const B=makeBuilder(),r=p.W/2;B.cyl('Seat','Seat','fabric',0,0,p.H-45,r,45,{seg:56});
  for(const sx of [-1,1])for(const sy of [-1,1])B.cyl('Leg','Frame','steel',sx*r*.65,sy*r*.65,0,15,p.H-45,{seg:20});
  const fh=Math.min(p.footH,p.H-140),rr=r*.92;B.lathe('Footrest ring','Frame','steel',0,0,fh,[[rr-7,0],[rr+7,0],[rr+7,14],[rr-7,14],[rr-7,0]]);
  if(p.back){for(const sx of [-1,1])B.box('Back upright','Frame','steel',sx*r*.65,r*.7,p.H-50,22,22,310);B.box('Backrest','Seat','fabric',0,r*.75,p.H+130,p.W-40,40,130,{r:16});}return B.parts;
 }),
 model('workstation','Modular workstation','Dining & Office',[num('modules','Modules per row',1,6,2),dim('W','Module width',800,1800,1200),dim('D','Module depth',550,850,700),dim('H','Desk height',680,800,740),bool('double','Back-to-back rows',false),bool('divider','Acoustic divider geometry',true),dim('dividerH','Divider above desk',250,600,400)],p=>{
  const B=makeBuilder(),rows=p.double?[-1,1]:[0];
  for(let i=0;i<p.modules;i++)for(const row of rows){const x=(i-(p.modules-1)/2)*(p.W+20),y=row*(p.D/2+20);B.box('Desktop','Top','wood',x,y,p.H-25,p.W,p.D,25,{r:3});
   for(const sx of [-1,1])for(const sy of [-1,1])B.box('Leg','Frame','steel',x+sx*(p.W/2-50),y+sy*(p.D/2-50),0,30,30,p.H-25,{r:2});
   B.box('Cable tray','Hardware','steel',x,y+(row===-1?1:-1)*p.D*.3,p.H-100,p.W-180,100,40);B.cyl('Cable grommet','Hardware','black',x+p.W*.32,y+(row===-1?1:-1)*p.D*.32,p.H,25,2,{seg:24});
  }
  if(p.divider)for(let i=0;i<p.modules;i++)B.box('Desk divider','Panels','fabric',(i-(p.modules-1)/2)*(p.W+20),p.double?0:p.D/2,p.H-80,p.W-20,35,p.dividerH+80,{r:8});return B.parts;
 }),
 model('pinup_panel','Pin-up panel','Studio & Education',[dim('W','Panel width',600,1600,1000),dim('H','Overall height',1400,2400,1900),num('panels','Panel count',1,4,1),bool('wheels','Casters',true)],p=>{
  const B=makeBuilder(),z=p.wheels?75:12;
  for(let i=0;i<p.panels;i++){const x=(i-(p.panels-1)/2)*(p.W+45);B.box('Pin-up surface','Panels','fabric',x,0,250,p.W,40,p.H-280,{r:6});
   for(const sx of [-1,1]){const px=x+sx*(p.W/2+12);B.box('Frame upright','Frame','steel',px,0,z,24,30,p.H-z);B.box('Support foot','Frame','steel',px,0,z,35,500,25,{r:5});
    if(p.wheels)for(const sy of [-1,1])B.cylY('Caster','Hardware','black',px,sy*210,35,35,30,{seg:24});}
   B.box('Frame top','Frame','steel',x,0,p.H-25,p.W+48,30,25);B.box('Marker tray','Hardware','steel',x,-38,245,p.W-50,60,12);
  }return B.parts;
 }),
 model('locker','Locker bank','Studio & Education',[num('cols','Columns',1,6,3),num('rows','Compartments per column',1,4,2),dim('W','Column width',250,500,350),dim('D','Depth',350,600,450),dim('H','Overall height',1400,2100,1800),bool('open','Open compartments',false)],p=>{
  const B=makeBuilder(),total=p.cols*p.W,h=(p.H-116)/p.rows,t=16;B.box('Plinth','Frame','black',0,12,0,total-30,p.D-30,100);B.box('Back panel','Frame','steel',0,p.D/2-4,100,total,8,p.H-100);
  for(let c=0;c<=p.cols;c++)B.box('Partition','Frame','steel',-total/2+c*p.W,0,100,t,p.D,p.H-100);
  for(let row=0;row<=p.rows;row++)B.box('Shelf','Frame','steel',0,0,100+row*h,total,p.D,t);
  if(!p.open)for(let c=0;c<p.cols;c++)for(let row=0;row<p.rows;row++){const x=(c-(p.cols-1)/2)*p.W,z=116+row*h+3;B.box('Locker door','Doors','panel',x,-p.D/2-5,z,p.W-22,15,h-22,{r:2});
   B.box('Recessed handle','Hardware','black',x+p.W*.28,-p.D/2-14,z+h*.45,24,4,65,{r:3});B.box('Label slot','Hardware','white',x,-p.D/2-14,z+h*.8,p.W*.26,3,22);for(let i=0;i<3;i++)B.box('Vent slot','Hardware','black',x,-p.D/2-14,z+35+i*12,p.W*.45,3,4);
  }return B.parts;
 },['wood']),
 model('banquette','Bench / banquette','Living',[dim('L','Length',800,3200,1800),dim('D','Seat depth',450,750,550),dim('H','Seat height',400,520,450),num('seats','Cushion modules',1,5,3),bool('back','Backrest',true),dim('backH','Backrest above seat',250,550,350)],p=>{
  const B=makeBuilder();feet(B,p.L,p.D,p.H-100);B.box('Seat frame','Frame','wood',0,0,p.H-100,p.L,p.D,35,{r:3});const w=p.L/p.seats;
  for(let i=0;i<p.seats;i++){const x=(i-(p.seats-1)/2)*w;B.box('Seat cushion','Seat','fabric',x,-10,p.H-65,w-8,p.D-20,65,{r:18});if(p.back)B.box('Back cushion','Seat','fabric',x,p.D/2-25,p.H+10,w-8,70,p.backH-10,{r:18});}
  if(p.back){for(const sx of [-1,1])B.box('Back upright','Frame','wood',sx*(p.L/2-35),p.D/2-20,p.H-90,35,35,p.backH+90);}return B.parts;
 })];
}
