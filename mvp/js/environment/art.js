// Catalogue diagrams on the existing standard model/camera. Never a user's result.
export function environmentalArt({T,id,mesh,path,group,night,high,low}){
 const ink=night?'#d9dce2':'#394450',cold='#548fbb',hot='#d97b65';
 if(id==='skyview'){
  const c=[7,1.8,.2],R=3;for(const elevation of[25,50,75]){const a=elevation*Math.PI/180,points=[];for(let i=0;i<=72;i++){const az=i/72*Math.PI*2;points.push([c[0]+R*Math.cos(a)*Math.sin(az),c[1]+R*Math.cos(a)*Math.cos(az),c[2]+R*Math.sin(a)]);}path(points,cold,1,.75);}for(let i=0;i<12;i++){const az=i/12*Math.PI*2;path([c,[c[0]+R*Math.sin(az),c[1]+R*Math.cos(az),c[2]+1.7]],i%3===0?hot:cold,1,.7);}mesh(c[0]-.1,c[1]-.1,c[2],.2,.2,.2,hot);
 }else if(id==='shadebenefit'){
  mesh(1.6,2.2,3.1,4.2,3.2,.16,'#b292d2',.8);for(const x of[1.75,5.5])mesh(x,2.3,0,.13,.13,3.1,'#aab4bd');for(let x=2;x<5.5;x+=.35)path([[x,4.8,.04],[x,3.2,.04]],cold,1,.9);for(let j=0;j<5;j++)path([[3+j*.5,-.2,6],[1.5+j*.5,2.4,3.3]],'#dcba6b',1,.8);
 }else if(id==='solarenvelope'){
  const points=[],nx=16,ny=12;for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){const x=i+.2,y=j+.2,z=.7+Math.min(4,(y+1)*.33+(15-x)*.06);for(const p of[[x,y,z],[x+1,y,z],[x,y+1,z+.33],[x+1,y,z],[x+1,y+1,z+.33],[x,y+1,z+.33]])points.push(...p);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.computeVertexNormals();const m=new T.Mesh(g,new T.MeshBasicMaterial({color:cold,side:T.DoubleSide,transparent:true,opacity:.37}));group.add(m);for(let x=0;x<=16;x+=2)path([[x,0,.7+(15-x)*.06],[x,12,4.7+(15-x)*.06]],cold,1,.8);path([[.4,-.1,.08],[15.5,-.1,.08]],hot);
 }else{
  const card=document.createElement('div');card.style.cssText='position:absolute;top:95px;right:48px;width:300px;color:'+ink+';font:11px Arial;background:'+(night?'rgba(22,28,37,.9)':'rgba(241,242,244,.9)')+';padding:12px;border:1px solid '+(night?'#44505e':'#c5ccd3');
  if(id==='climate')card.innerHTML='<div style="margin-bottom:6px;letter-spacing:.8px">WEATHER PROFILE · DIAGRAM</div><svg viewBox="0 0 300 110"><path d="M10 10V92H290" fill="none" stroke="'+ink+'" opacity=".4"/><path d="M12 78L36 73L60 62L84 48L108 32L132 20L156 19L180 28L204 42L228 61L252 74L284 80" fill="none" stroke="'+hot+'" stroke-width="3"/><path d="M12 48L36 52L60 58L84 68L108 73L132 78L156 76L180 68L204 61L228 53L252 48L284 45" fill="none" stroke="'+cold+'" stroke-width="2"/><text x="10" y="108" fill="'+ink+'" font-size="10">JAN</text><text x="262" y="108" fill="'+ink+'" font-size="10">DEC</text></svg>';
  else card.innerHTML='<div style="margin-bottom:6px;letter-spacing:.8px">PSYCHROMETRIC SCREEN · DIAGRAM</div><svg viewBox="0 0 300 110"><path d="M15 8V92H285" fill="none" stroke="'+ink+'" opacity=".4"/>'+[0,1,2,3].map(i=>'<path d="M18 '+(83+i*2)+'Q150 '+(80-i*15)+' 280 '+(8+i*19)+'" fill="none" stroke="'+cold+'" opacity=".75"/>').join('')+'<rect x="135" y="35" width="60" height="42" fill="'+cold+'" opacity=".16"/>'+Array.from({length:80},(_,i)=>'<circle cx="'+(50+(i*37%210))+'" cy="'+(38+(i*17%46))+'" r="1.5" fill="'+hot+'" opacity=".6"/>').join('')+'<text x="110" y="108" fill="'+ink+'" font-size="10">DRY-BULB TEMPERATURE</text></svg>';
  document.body.append(card);
 }
 document.querySelector('#legend').textContent={climate:'TEMPERATURE / WEATHER',passive:'WEATHER OPPORTUNITIES',skyview:'SKY / OBSTRUCTION',shadebenefit:'BASELINE / CANDIDATE',solarenvelope:'GEOMETRIC HEIGHT BOUNDARY'}[id];
 document.querySelector('.foot>span').textContent='ILLUSTRATIVE PREVIEW · '+(id==='climate'||id==='passive'?'WEATHER STUDY':'EXTERIOR STUDY');
}
