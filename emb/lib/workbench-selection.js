// CSS-pixel geometry for Rhino window/crossing selection; no bounding-box hit substitutes.
export function polygonTouchesRect(points,r){
 if(!points.length)return false;
 const inside=p=>p[0]>=r[0]&&p[0]<=r[2]&&p[1]>=r[1]&&p[1]<=r[3];
 if(points.some(inside))return true;
 const corners=[[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]];
 const inPoly=p=>{let on=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])on=!on;}return on;};
 if(corners.some(inPoly))return true;
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const segment=(a,b,c,d)=>{if(Math.max(a[0],b[0])<Math.min(c[0],d[0])||Math.min(a[0],b[0])>Math.max(c[0],d[0])||Math.max(a[1],b[1])<Math.min(c[1],d[1])||Math.min(a[1],b[1])>Math.max(c[1],d[1]))return false;return cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0;};
 return points.some((a,i)=>corners.some((c,j)=>segment(a,points[(i+1)%points.length],c,corners[(j+1)%4])));
}
export function selectedByRect(polygons,rect,crossing){return polygons.length>0&&(crossing?polygons.some(p=>polygonTouchesRect(p,rect)):polygons.every(p=>p.every(q=>q[0]>=rect[0]&&q[0]<=rect[2]&&q[1]>=rect[1]&&q[1]<=rect[3])));}
export function moveObject(o,original,kind,dx,dy,{host,fixOpening=()=>{}}={}){
 const p=q=>[q[0]+dx,q[1]+dy];
 if(kind==='op'){if(!host)return;const d=[host.b[0]-host.a[0],host.b[1]-host.a[1]],n=Math.hypot(...d)||1;o.pos=original.pos+(dx*d[0]+dy*d[1])/n;fixOpening(o);return;}
 if(original.g){o.g={...original.g,x:original.g.x+dx,y:original.g.y+dy};return;}
 if(original.a&&original.b){o.a=p(original.a);o.b=p(original.b);}
 if(original.points)o.points=original.points.map(p);
 if(original.holes)o.holes=original.holes.map(h=>h.map(p));
 if(Number.isFinite(original.x))o.x=original.x+dx;
 if(Number.isFinite(original.y))o.y=original.y+dy;
}
