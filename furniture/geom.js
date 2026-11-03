// Part → three.js BufferGeometry, already placed in model space (Z up, mm).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function partGeometry(p) {
  let g;
  if(p.kind==='loft'){
    const n=p.seg||12,pos=[],idx=[];
    for(const [x,y,z,rx,ry] of p.rings)for(let j=0;j<n;j++){const a=j/n*Math.PI*2;pos.push(x+Math.cos(a)*rx,y+Math.sin(a)*ry,z);}
    for(let i=0;i<p.rings.length-1;i++)for(let j=0;j<n;j++){const a=i*n+j,b=i*n+(j+1)%n,c=b+n,d=a+n;idx.push(a,b,d,b,c,d);}
    for(let j=1;j<n-1;j++){idx.push(0,j+1,j);const b=(p.rings.length-1)*n;idx.push(b,b+j,b+j+1);}
    g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();g.translate(p.cx,p.cy,p.cz);return g;
  }
  if(p.kind==='lathe'){
    g=new THREE.LatheGeometry(p.profile.map(q=>new THREE.Vector2(q[0],q[1])),64);
    g.rotateX(Math.PI/2);g.scale(1,p.depthScale,1);g.translate(p.cx,p.cy,p.cz);return g;
  }
  if (p.kind === 'prism') {
    const sh = new THREE.Shape(p.pts.map((q) => new THREE.Vector2(q[0], q[1])));
    for(const hole of p.holes||[])sh.holes.push(new THREE.Path(hole.map(q=>new THREE.Vector2(q[0],q[1]))));
    g = new THREE.ExtrudeGeometry(sh, { depth: p.t, bevelEnabled: false, curveSegments: 1 });
    if (p.plane === 'xy') g.translate(0, 0, p.a0);
    else if (p.plane === 'xz') { g.rotateX(Math.PI / 2); g.translate(0, p.a0 + p.t, 0); }
    else { g.rotateX(Math.PI / 2); g.rotateZ(Math.PI / 2); g.translate(p.a0, 0, 0); }
    g.translate(p.cx, p.cy, p.cz);
    return g;
  }
  if (p.kind === 'tube') {
    const path = new THREE.CurvePath();
    const v = p.pts.map((q) => new THREE.Vector3(q[0] + p.cx, q[1] + p.cy, q[2] + p.cz));
    for (let i = 0; i < v.length - 1; i++) path.add(new THREE.LineCurve3(v[i], v[i + 1]));
    return new THREE.TubeGeometry(path, Math.max(4, (v.length - 1) * 6), p.r, 10, false);
  }
  if (p.kind === 'box') {
    const rMax = Math.min(p.w, p.d, p.h) / 2 - 0.5;
    const r = Math.min(p.round || 0, rMax);
    g = r > 1 ? new RoundedBoxGeometry(p.w, p.d, p.h, 3, r) : new THREE.BoxGeometry(p.w, p.d, p.h);
    if (p.rotZ) g.rotateZ(p.rotZ);
  } else {
    g = new THREE.CylinderGeometry(p.r, p.r * p.taper, p.h, p.seg || 32);
    if (p.axis === 'z') {
      if (p.ry !== p.r) g.scale(1, 1, p.ry / p.r);
      g.rotateX(Math.PI / 2);
    }
    // axis 'y': CylinderGeometry already runs along Y
  }
  g.translate(p.cx, p.cy, p.cz);
  return g;
}

// Flat triangle list helper: returns { pos: Float32Array, idx: Uint32Array }
export function triangles(g) {
  const pos = g.getAttribute('position').array;
  let idx;
  if (g.index) idx = Uint32Array.from(g.index.array);
  else { idx = new Uint32Array(pos.length / 3); for (let i = 0; i < idx.length; i++) idx[i] = i; }
  return { pos, idx };
}

// Can this part be written to Rhino as a true NURBS solid?
export function isNurbsable(p) {
  if (p.kind === 'tube'||p.kind==='lathe'||p.kind==='loft'||p.holes?.length) return false;
  if (p.kind === 'prism') return true;
  if (p.kind === 'box') return !(p.round > 1 && Math.min(p.round, Math.min(p.w, p.d, p.h) / 2 - 0.5) > 1);
  return p.ry === p.r && p.taper === 1;
}
