// Editable layer groups for details traced approximately from HABS plans and sections (2026-11-06: rounded ochre parapets, the
// rear trellis, the hearth boulder and kettle, built-ins, the guest house, its pool and the covered walkway up the hill).
// Positions and sizes are approximate: a diagrammatic reconstruction for study, not as-built survey data.
import * as H from './fallingwater-habs.js?v=habs-20261107-1';
export function details(xy, ground = () => 0){
 const groups={};
 const tri=(name,layer,a,b,c)=>{const g=groups[name]??={layer,p:[]};g.p.push(...a,...b,...c);};
 const quad=(name,layer,a,b,c,d)=>{tri(name,layer,a,b,c);tri(name,layer,a,c,d);};
 const box=(name,layer,cx,cy,z,w,d,h)=>{
  const a=cx-w/2,b=cx+w/2,c=cy-d/2,e=cy+d/2,f=z+h;
  const v=[[a,c,z],[b,c,z],[b,e,z],[a,e,z],[a,c,f],[b,c,f],[b,e,f],[a,e,f]];
  for(const face of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])quad(name,layer,...face.map(i=>v[i]));
 };
 // a wall or beam between two plan points: width w, from z up h; with a half-round top when round (Wright's parapets)
 const run=(name,layer,a,b,z,w,h,round=false)=>{const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<.01)return;const u=[(b[0]-a[0])/L,(b[1]-a[1])/L],n=[-u[1]*w/2,u[0]*w/2];
  const P=(p,s,zz)=>[p[0]+n[0]*s,p[1]+n[1]*s,zz],h0=round?h-w/2:h,A=[P(a,-1,z),P(b,-1,z),P(b,1,z),P(a,1,z),P(a,-1,z+h0),P(b,-1,z+h0),P(b,1,z+h0),P(a,1,z+h0)];
  for(const f of round?[[0,3,2,1],[0,1,5,4],[2,3,7,6],[3,0,4,7],[1,2,6,5]]:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])quad(name,layer,...f.map(i=>A[i]));
  if(round){const k=8,arc=j=>{const t=Math.PI*j/k,s=-Math.cos(t),c=Math.sin(t)*w/2;return [s,c];};
   for(let j=0;j<k;j++){const [s0,c0]=arc(j),[s1,c1]=arc(j+1),q=(p,s,c)=>[p[0]+n[0]*s,p[1]+n[1]*s,z+h0+c];
    quad(name,layer,q(a,s0,c0),q(b,s0,c0),q(b,s1,c1),q(a,s1,c1));tri(name,layer,q(a,s0,c0),q(a,s1,c1),[a[0],a[1],z+h0]);tri(name,layer,q(b,s1,c1),q(b,s0,c0),[b[0],b[1],z+h0]);}}};
 // a low lumpy rock: a squashed polyhedron
 const rock=(name,layer,cx,cy,z,rx,ry,h,seed=1)=>{const n=10,ring=(f,zz)=>Array.from({length:n},(_,i)=>{const t=2*Math.PI*i/n,k=.82+.18*Math.sin(i*2.7+seed*1.3);return [cx+Math.cos(t)*rx*f*k,cy+Math.sin(t)*ry*f*k,zz];});
  const r0=ring(1,z),r1=ring(.86,z+h*.62),top=[cx+.05*rx,cy-.04*ry,z+h];for(let i=0;i<n;i++){const j=(i+1)%n;quad(name,layer,r0[i],r0[j],r1[j],r1[i]);tri(name,layer,r1[i],r1[j],top);}};
 // a sphere (the red kettle in the living-room hearth)
 const ball=(name,layer,cx,cy,z,r)=>{const m=10,k=7,P=(i,j)=>{const t=2*Math.PI*i/m,f=Math.PI*j/k;return [cx+r*Math.sin(f)*Math.cos(t),cy+r*Math.sin(f)*Math.sin(t),z+r-r*Math.cos(f)];};
  for(let i=0;i<m;i++)for(let j=0;j<k;j++)quad(name,layer,P(i,j),P(i+1,j),P(i+1,j+1),P(i,j+1));};
 const at=(name,layer,x,y,z,w,d,h)=>box(name,layer,...xy(x,y),z,w,d,h);
 const runH=(name,layer,x,y,x2,y2,z,w,h,round)=>run(name,layer,xy(x,y),xy(x2,y2),z,w,h,round);

 // ---- the main house's trays, from the traced terraces (fallingwater-habs.js): a deep upturned edge under each slab and a parapet with
 // a half-round top round its open sides; from the south elevation, the parapets stand about 0.96 m above the floor and the tray's
 // edge runs about 0.57 m below it
 const P=(q)=>xy(q[0],q[1]);
 for(const [lv,list] of Object.entries(H.TERRACES)){const z=H.LEVELS.find(l=>l.id===lv).z;
  for(const t of list){for(let k=1;k<t.parapet.length;k++){const a=P(t.parapet[k-1]),b=P(t.parapet[k]);run(t.roof?'Roof edge':'Terrace parapets','Terrace rails',a,b,z-.57,.3,t.roof?.75:1.53,!t.roof);}}}
 // the chimney tower above the roof, to 32'-9 1/2" (sheet 10)
 { const [a,b]=xy(1328,1668),[c,d]=xy(1436,1392);box('Chimney tower','Stonework',(a+c)/2,(b+d)/2,7.5,c-a,d-b,9.99-7.5); }
 // the hatch stair: from the living room down through the floor to the platform just above Bear Run (top of platform -9'-3 1/8")
 { const Hh=H.HATCH,[a,b]=xy(Hh.x0,Hh.y1),[c,d]=xy(Hh.x1,Hh.y0),n=15,w=d-b;for(let k=0;k<n;k++){const z1=-(k+1)*(-Hh.bottom)/n;box('Hatch stair','Stairs',a+(c-a)*(k+.5)/n,(b+d)/2,z1,(c-a)/n+.01,w*.8,.06);}
   const [p,q]=xy(Hh.platform[0],Hh.platform[3]),[r,t]=xy(Hh.platform[2],Hh.platform[1]);box('Hatch stair platform','Stairs',(p+r)/2,(q+t)/2,Hh.bottom-.2,r-p,t-q,.2); }
 // the boulder of the site, left rising through the living-room floor in front of the hearth, and Wright's red kettle in the fireplace
 { const [x,y]=xy(1510,1510);rock('Hearth boulder','Stonework',x,y,-.2,1.1,.8,.42,2); }
 { const [x,y]=xy(1405,1520);ball('Kettle in the hearth','Kettle',x,y,.05,.28); }
 // built-in seats along the glazing (walnut), as the plans show them
 { const [a,b]=xy(1415,2290),[c,d]=xy(1930,2245);box('Living room window seat','Built-in joinery',(a+c)/2,(b+d)/2,0,c-a,d-b,.42); }
 { const [a,b]=xy(1305,1940),[c,d]=xy(1410,1640);box('Living room window seat','Built-in joinery',(a+c)/2,(b+d)/2,0,c-a,d-b,.42); }
 // the concrete trellis over the drive behind the house (one beam bends round a tree in the real house; straight here)
 for(let i=0;i<9;i++){const x=2060+i*70;run('Rear trellis','Terrace rails',xy(x,1060),xy(x,800),4.95,.2,.32);}
 run('Rear trellis','Terrace rails',xy(2040,800),xy(2640,800),4.95,.3,.32);
 // ---- the guest house (1939), up the hill to the north-west, its plunge pool, and the covered walkway that climbs to it.
 // Plan metres; the floor is set just above the highest ground under it, on a stone plinth.
 const G0=[-31,26],G1=[-17,33.5],T0=[-31,19.5],T1=[-20,26],PO=[[-25.6,20.4],[-20.8,20.4],[-20.8,23.8],[-25.6,23.8]];
 // the floor at the ground of the house's middle and a little over: the uphill side is cut into the hill, the downhill side stands on its plinth
 const gf=+(ground(-24,29.75)+.6).toFixed(2);
 let gmin=Infinity;for(const x of [-31,-24,-17])for(const y of [19.5,26,33.5])gmin=Math.min(gmin,ground(x,y));
 box('Guest house plinth','Stonework',(G0[0]+G1[0])/2,(G0[1]+G1[1])/2,gmin-.3,G1[0]-G0[0],G1[1]-G0[1],gf-gmin+.3-.27);
 for(const x of [-30.4,-26])box('Guest house terrace piers','Stonework',x,21,gmin-.3,.6,.6,gf-gmin-.15);
 box('Guest house floor','Structure',(G0[0]+G1[0])/2,(G0[1]+G1[1])/2,gf-.25,G1[0]-G0[0],G1[1]-G0[1],.25);
 // stone walls on the hill side and the ends; the south side opens to the terrace in glass (as Glazing, without the sash)
 run('Guest house stone walls','Stonework',[G0[0],G1[1]],[G1[0],G1[1]],gf,.45,2.7);run('Guest house stone walls','Stonework',[G0[0],G0[1]],[G0[0],G1[1]],gf,.45,2.7);run('Guest house stone walls','Stonework',[G1[0],G0[1]],[G1[0],G1[1]],gf,.45,2.7);
 run('Guest house stone walls','Stonework',[-24,G0[1]],[-24,G1[1]],gf,.3,2.7);box('Guest house chimney','Stonework',-24,31.8,gf,1.1,1.1,4.1);
 run('Guest house glazing','Guest glazing',[G0[0],G0[1]],[G1[0],G0[1]],gf+.05,.06,2.45);
 box('Guest house roof','Terrace rails',(G0[0]+G1[0])/2,(G0[1]+G1[1])/2-.6,gf+2.7,G1[0]-G0[0]+2.4,G1[1]-G0[1]+2.6,.32);
 // the terrace slab, open where the pool is
 const slab=(x0,y0,x1,y1)=>{if(x1-x0>.05&&y1-y0>.05)box('Guest house terrace','Structure',(x0+x1)/2,(y0+y1)/2,gf-.42,x1-x0,y1-y0,.42);};
 slab(T0[0],T0[1],PO[0][0],T1[1]);slab(PO[1][0],T0[1],T1[0],T1[1]);slab(PO[0][0],T0[1],PO[1][0],PO[0][1]);slab(PO[0][0],PO[2][1],PO[1][0],T1[1]);
 run('Guest house terrace parapet','Terrace rails',[T0[0],T0[1]],[T1[0],T0[1]],gf,.3,.95,true);run('Guest house terrace parapet','Terrace rails',[T1[0],T0[1]],[T1[0],T1[1]],gf,.3,.95,true);run('Guest house terrace parapet','Terrace rails',[T0[0],T0[1]],[T0[0],T1[1]],gf,.3,.95,true);
 // the plunge pool, sunk into the terrace: its basin here, its water a site water body (see the case's areas)
 const pool={pts:PO,level:+(gf-.25).toFixed(2),bottom:+(gf-1.6).toFixed(2)};
 for(let i=0;i<4;i++)run('Guest house pool basin','Terrace rails',PO[i],PO[(i+1)%4],pool.bottom,.22,gf-pool.bottom+.02);
 box('Guest house pool basin','Terrace rails',(PO[0][0]+PO[1][0])/2,(PO[0][1]+PO[2][1])/2,pool.bottom-.25,PO[1][0]-PO[0][0]+.22,PO[2][1]-PO[0][1]+.22,.25);
 // the covered walkway: from the bedroom-level bridge behind the main house up to the guest house, its canopy stepping down the
 // slope in short flat runs on thin steel posts
 const W=[xy(1950,560),[6.4,18.5],[2.5,23.2],[-4,25.6],[-10.5,26.2],[-16,25.4]],z0=H.LEVELS[1].z;let L=0;const seg=[];for(let i=1;i<W.length;i++){const l=Math.hypot(W[i][0]-W[i-1][0],W[i][1]-W[i-1][1]);seg.push([L,l]);L+=l;}
 const at2=(s)=>{let i=0;while(i<seg.length-1&&seg[i][0]+seg[i][1]<s)i++;const u=(s-seg[i][0])/seg[i][1],a=W[i],b=W[i+1];return [a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];};
 const zAt=(s)=>{const t=s/L,f=t*t*(3-2*t);return z0+(gf-z0)*f;};
 const N=Math.ceil(L/2.4);for(let k=0;k<N;k++){const s0=k*L/N,s1=(k+1)*L/N,a=at2(s0),b=at2(s1),zs=zAt(s0),ze=zAt(s1),zm=Math.max(zs,ze);
  run('Covered walkway path','Structure',a,b,Math.min(zs,ze)-.2,1.6,.2+Math.abs(ze-zs)*.5);
  run('Covered walkway canopy','Terrace rails',a,b,zm+2.35,2.3,.16,false);
  const gm=ground((a[0]+b[0])/2,(a[1]+b[1])/2);if(Math.min(zs,ze)-.25>gm+.3)box('Covered walkway piers','Stonework',(a[0]+b[0])/2,(a[1]+b[1])/2,gm-.2,.5,.5,Math.min(zs,ze)-.2-gm);
  const u=[b[0]-a[0],b[1]-a[1]],ul=Math.hypot(...u)||1,n=[-u[1]/ul*1.05,u[0]/ul*1.05];box('Covered walkway posts','Walkway steel',a[0]+n[0],a[1]+n[1],Math.min(zs,ze)-.05,.08,.08,zm-Math.min(zs,ze)+2.4);}

 const imports=[],meshes={};
 for(const [name,{layer,p}] of Object.entries(groups)){
  const id='habs-detail-'+imports.length,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<p.length;i++){const k=i%3;min[k]=Math.min(min[k],p[i]);max[k]=Math.max(max[k],p[i]);}
  meshes[id]=p.map((v,i)=>+(v-min[i%3]).toFixed(4));
  imports.push({id,name,layer,...(layer==='Roof'?{lv:'L3'}:{}),type:'imported',mat:layer==='Stonework'?'Stone':'Concrete',tris:p.length/9,g:{x:min[0],y:min[1],z:min[2],w:max[0]-min[0],d:max[1]-min[1],h:max[2]-min[2]}});
 }
 return {imports,meshes,pool};
}
