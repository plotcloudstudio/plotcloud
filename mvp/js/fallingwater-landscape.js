// Display geometry for Bear Run. Plan layout follows HABS PA-5346 sheet 2;
// vertical profile is schematic, based on sections, not survey elevations or hydraulics.
import dem from './fallingwater-dem.js';
import siteDem from './fallingwater-site-dem.js';
import {STREAM,ORIGIN,PX} from './fallingwater-habs.js?v=habs-20261107-1';
const r=Math.SQRT1_2;
const world=([x,y,z])=>[(x+y)*r,(y-x)*r,z];
// [x along the stream, its middle, width, water surface] in plan metres, the living level at 0: Bear Run as the HABS first-floor plan
// draws its banks and the south elevation its levels (upper stream about 3.1 m below the living room, the main falls about 5.1 m)
const profile=STREAM.map(([x,y,z,w])=>[+((x-ORIGIN[0])*PX).toFixed(3),+((ORIGIN[1]-y)*PX).toFixed(3),+(w*PX).toFixed(2),z]).sort((a,b)=>a[0]-b[0]);
function station(x){let i=profile.findIndex(p=>p[0]>=x);if(i<0)return profile.at(-1);if(i===0)return profile[0];const a=profile[i-1],b=profile[i],t=(x-a[0])/(b[0]-a[0]);return a.map((v,k)=>v+(b[k]-v)*t);}
function localGround(x,y){const [,mid,w,water]=station(x),d=y-mid,bank=Math.max(0,Math.abs(d)-w/2),channel=water-.55;
 const rock=.24*Math.sin(x*.53+y*.66)+.13*Math.sin(x*1.1-y*.39);
 if(bank<1.6)return channel+bank*1.12+rock*.12;
 // the north bank climbs steeply from the water to the house's back, about at the living level, then up the hill
 if(d>0)return Math.min(channel+1.8+bank*1.1,-.35)+Math.max(0,y-11)*.34+rock*Math.min(1,bank/5);
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
 // The segmented stream edges and exposed ledges read as rock rather than a rectangular trench.
 for(let i=1;i<profile.length;i++)for(const s of [-1,1]){
  const a=profile[i-1],b=profile[i];if(Math.abs(b[3]-a[3])>.5)continue;const pa=edge(a,s*.52,-.15),pb=edge(b,s*.52,-.15),qa=edge(a,s*.68,.36),qb=edge(b,s*.68,.36);
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
 // Bear Run as a site water body: its outline, and its centreline (upstream first) with the surface level and width
 const centre=[...profile].reverse().map(p=>{const [e,n]=world([p[0],p[1],0]);return [+e.toFixed(2),+n.toFixed(2),p[3],p[2]];});
 return {features:Object.values(groups),water:profile.map(p=>edge(p,-.5)).concat([...profile].reverse().map(p=>edge(p,.5))).map(p=>world(p).slice(0,2).map(v=>+v.toFixed(2))),centre};
}
