// Display geometry for Bear Run. Plan layout follows HABS PA-5346 sheet 2;
// vertical profile is schematic, based on sections, not survey elevations or hydraulics.
import dem from './fallingwater-dem.js';
import siteDem from './fallingwater-site-dem.js';
const r=Math.SQRT1_2;
const world=([x,y,z])=>[(x+y)*r,(y-x)*r,z];
const profile=[[-23,-8.3,4.5,-3.75],[-16,-7.9,4.0,-3.65],[-10,-6.8,3.5,-3.55],[-5,-6.0,3.4,-3.5],[-3.4,-5.6,3.6,-3.48],[-2.9,-5.5,3.6,-2.32],[-.2,-5.1,3.1,-2.26],[.25,-5.05,3.1,-1.37],[3,-5.1,3.4,-1.33],[9,-5.3,4.0,-1.30],[16,-4.8,4.2,-1.22],[24,-3.9,4.0,-1.16],[31,-4,4.2,-1.1]];
function station(x){let i=profile.findIndex(p=>p[0]>=x);if(i<0)return profile.at(-1);if(i===0)return profile[0];const a=profile[i-1],b=profile[i],t=(x-a[0])/(b[0]-a[0]);return a.map((v,k)=>v+(b[k]-v)*t);}
function localGround(x,y){const [,mid,w,water]=station(x),d=y-mid,bank=Math.max(0,Math.abs(d)-w/2),channel=water-.55;
 const rock=.24*Math.sin(x*.53+y*.66)+.13*Math.sin(x*1.1-y*.39);
 if(bank<1.6)return channel+bank*1.12+rock*.12;
 if(d>0)return Math.max(-.2,channel+1.7)+Math.max(0,y-7)*.34+rock*Math.min(1,bank/5);
 return channel+Math.min(5,bank*.37)+rock;
}
export function ground(x,y){
 const [e,n]=world([x,y,0]);
 const grid=siteDem.grid,fu=Math.max(0,Math.min(grid.nx-1,(e-grid.x0)/grid.step)),fv=Math.max(0,Math.min(grid.ny-1,(n-grid.y0)/grid.step));
 const fi=Math.min(grid.nx-2,Math.floor(fu)),fj=Math.min(grid.ny-2,Math.floor(fv)),fa=fu-fi,fb=fv-fj,fk=fj*grid.nx+fi;
 const outer=(1-fb)*((1-fa)*grid.z[fk]+fa*grid.z[fk+1])+fb*((1-fa)*grid.z[fk+grid.nx]+fa*grid.z[fk+grid.nx+1]);
 const extent=Math.max(Math.abs(e),Math.abs(n)),fade=Math.max(0,Math.min(1,(extent-25)/9)),mix=fade*fade*(3-2*fade);
 if(mix===1)return outer;
 const u=Math.max(0,Math.min(dem.n-1,e+dem.radius)),v=Math.max(0,Math.min(dem.n-1,n+dem.radius));
 const i=Math.min(dem.n-2,Math.floor(u)),j=Math.min(dem.n-2,Math.floor(v)),a=u-i,b=v-j,k=j*dem.n+i;
 const surveyed=(1-b)*((1-a)*dem.z[k]+a*dem.z[k+1])+b*((1-a)*dem.z[k+dem.n]+a*dem.z[k+dem.n+1]);
 const dist=Math.min(Math.abs(y-station(x)[1]),Math.hypot(x-2,y-1)),t=Math.max(0,Math.min(1,(dist-8)/15)),blend=t*t*(3-2*t);
 return (localGround(x,y)*(1-blend)+surveyed*blend)*(1-mix)+outer*mix;
}
export function landscape(){
 const groups={};const tri=(key,color,a,b,c)=>{const g=groups[key]??={id:key,color,vertices:[]};g.vertices.push(...[a,b,c].flatMap(p=>world(p).map(v=>+v.toFixed(3))));};
 const quad=(key,color,a,b,c,d)=>{tri(key,color,a,b,c);tri(key,color,a,c,d);};
 const edge=(p,t,z=0)=>[p[0],p[1]+p[2]*t,p[3]+z];
 for(let i=1;i<profile.length;i++){
  const a=profile[i-1],b=profile[i],drop=b[3]-a[3]>.5;
  for(let j=0;j<6;j++){const l=-.5+j/6,h=l+1/6,key=drop?'cascade':`pool-${j%3}`,color=drop?'#82c5d0':['#3e8794','#4b9ca7','#367682'][j%3];quad(key,color,edge(a,l),edge(b,l),edge(b,h),edge(a,h));}
  if(drop)for(let j=0;j<9;j++){
   const f=-.42+j*.1,l=f-.013,h=f+.013;
   quad('whitewater','#e7f6f3',edge(a,l,.025),edge(b,l,.025),edge(b,h,.025),edge(a,h,.025));
   const z=a[3]+.033,y=a[1]+a[2]*f,x=a[0]-.12;
   quad('whitewater','#e7f6f3',[x-.7,y,z],[x,y-.08,z],[x+.08,y+.08,z],[x-.35,y+.13,z]);
  }
 }
 // The segmented stream edges and exposed ledges read as rock rather than a rectangular trench.
 for(let i=1;i<profile.length;i++)for(const s of [-1,1]){
  const a=profile[i-1],b=profile[i],pa=edge(a,s*.52,-.15),pb=edge(b,s*.52,-.15),qa=edge(a,s*.68,.36),qb=edge(b,s*.68,.36);
  quad(i%2?'ledge-light':'ledge-dark',i%2?'#a6a398':'#7e8178',pa,pb,qb,qa);
 }
 // Woodland context sampled from the clusters shown on the site sheet, with assumed heights.
 for(const [i,[x,y]] of [[-20,11],[-15,8],[-17,16],[-11,13],[-7,17],[-2,18],[4,17],[8,19],[13,15],[18,16],[23,12],[28,8],[-19,-14],[-13,-17],[-7,-15],[2,-16],[10,-15],[17,-14],[26,-12]].entries()){
  const z=ground(x,y),h=3.9+(i*7%9)*.36,n=7;
  for(let j=0;j<n;j++){const a=j*2*Math.PI/n,b=(j+1)*2*Math.PI/n,pt=(t,s,k)=>[x+Math.cos(t)*s,y+Math.sin(t)*s,z+k];
   quad('trunks','#756653',pt(a,.14,0),pt(b,.14,0),pt(b,.08,h*.63),pt(a,.08,h*.63));
   for(let k=0;k<3;k++){const radius=(1.1+(i%4)*.14)*(1-k*.24),low=h*(.35+k*.14),hi=low+h*.3;
    const p=pt(a+k*.34,radius,low),q=pt(b+k*.34,radius,low),tip=[x+.15*k,y-.12*k,z+hi];
    tri(k%2?'canopy-light':'canopy-dark',k%2?'#77966a':'#537751',p,q,tip);
    tri('canopy-dark','#537751',q,p,[x,y,z+low-.38]);
   }
  }
 }
 return {features:Object.values(groups),water:profile.map(p=>edge(p,-.5)).concat([...profile].reverse().map(p=>edge(p,.5))).map(p=>world(p).slice(0,2))};
}
