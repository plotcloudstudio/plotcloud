// Editable layer groups for details traced approximately from HABS plans and sections.
export function details(xy){
 const groups={};const box=(name,layer,cx,cy,z,w,d,h)=>{
  const g=groups[name]??={layer,p:[]};const a=cx-w/2,b=cx+w/2,c=cy-d/2,e=cy+d/2,f=z+h;
  const v=[[a,c,z],[b,c,z],[b,e,z],[a,e,z],[a,c,f],[b,c,f],[b,e,f],[a,e,f]];
  for(const face of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])for(const j of [0,1,2,0,2,3])g.p.push(...v[face[j]]);
 };
 const at=(name,layer,x,y,z,w,d,h)=>box(name,layer,...xy(x,y),z,w,d,h);
 at('Main stone chimney','Stonework',320,318,-.4,1.12,1.48,9.55);
 at('Upper masonry pier','Stonework',474,275,2.28,.75,1.02,4.8);
 at('West terrace support','Stonework',310,511,-3.22,.72,1.45,3.1);
 at('Bridge north abutment','Stonework',850,426,-1.35,4.1,.76,1.15);
 at('Bridge south abutment','Stonework',850,593,-3.35,4.1,.85,3.15);
 at('Bridge approach landing','Structure',850,622,-.22,4.2,1.7,.22);
 at('Entrance approach','Structure',752,400,-.24,6.9,1.22,.24);
 const rail=(name,x,y,x2,y2,z)=>{const [a,b]=xy(x,y),[c,d]=xy(x2,y2),w=Math.abs(c-a),h=Math.abs(d-b);box(name,'Terrace rails',(a+c)/2,(b+d)/2,z,Math.max(.13,w),Math.max(.13,h),.78);};
 rail('Living terrace parapet',235,452,235,543,0);rail('Living terrace parapet',235,543,598,543,0);rail('Living terrace parapet',598,447,598,543,0);
 rail('Bedroom terrace parapet',317,580,463,580,2.55);rail('Bedroom terrace parapet',317,413,317,580,2.55);rail('Bedroom terrace parapet',551,415,697,415,2.55);
 rail('Study terrace parapet',326,384,530,384,4.72);rail('Study terrace parapet',530,309,530,384,4.72);
 rail('Bridge edges',808,422,808,605,0);rail('Bridge edges',892,422,892,605,0);
 const steps=(name,x,y,z,rise,run,n,w)=>{const [cx,cy]=xy(x,y);for(let i=0;i<n;i++){const h=(i+1)*rise/n;box(name,'Stairs',cx,cy+i*run/n,z,w,run/n+.012,h);}};
 steps('Stair to bedroom level',485,311,0,2.55,3.1,15,.95);
 steps('Stair to study level',402,291,2.55,2.17,2.55,13,.92);
 steps('Stair down to Bear Run',495,539,-2.62,2.62,2.7,15,1.12);
 const imports=[],meshes={};
 for(const [name,{layer,p}] of Object.entries(groups)){
  const id='habs-detail-'+imports.length,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<p.length;i++){const k=i%3;min[k]=Math.min(min[k],p[i]);max[k]=Math.max(max[k],p[i]);}
  meshes[id]=p.map((v,i)=>+(v-min[i%3]).toFixed(4));
  imports.push({id,name,layer,type:'imported',mat:layer==='Stonework'?'Stone':'Concrete',tris:p.length/9,g:{x:min[0],y:min[1],z:min[2],w:max[0]-min[0],d:max[1]-min[1],h:max[2]-min[2]}});
 }
 return {imports,meshes};
}
