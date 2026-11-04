export const USGS_3DEP='https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer';
const M=6378137,D=Math.PI/180,project=([lat,lon])=>[M*lon*D,M*Math.log(Math.tan(Math.PI/4+lat*D/2))];
// 3DEP exportImage returns uncompressed single-band Float32 GeoTIFF. Reject other encodings.
export function decodeElevationTIFF(buffer){
 const v=new DataView(buffer),byte=v.getUint16(0),le=byte===0x4949;
 const u16=i=>v.getUint16(i,le),u32=i=>v.getUint32(i,le);
 if((!le&&byte!==0x4d4d)||u16(2)!==42)throw Error('USGS did not return a supported elevation TIFF.');
 const ifd=u32(4),entries=new Map(),len={3:2,4:4,12:8};
 for(let i=0;i<u16(ifd);i++){const p=ifd+2+i*12,type=u16(p+2),n=u32(p+4),sz=len[type];if(!sz||n>100000)continue;const a=sz*n<=4?p+8:u32(p+8);entries.set(u16(p),Array.from({length:n},(_,k)=>type===3?u16(a+k*sz):type===4?u32(a+k*sz):v.getFloat64(a+k*sz,le)));}
 const get=(k,d)=>entries.get(k)?.[0]??d,w=get(256,0),h=get(257,0),scale=entries.get(33550),tie=entries.get(33922);
 if(w<2||h<2||w*h>2000000||get(258)!==32||get(339)!==3||get(259,1)!==1||get(277,1)!==1||!scale||!tie||!scale.slice(0,2).every(n=>Number.isFinite(n)&&n>0))throw Error('USGS elevation raster has an unsupported format.');
 const tiled=entries.has(324),tw=tiled?get(322):w,th=tiled?get(323):get(278,h),offset=entries.get(tiled?324:273),tilesX=Math.ceil(w/tw);
 if(!offset||!(tw>0&&th>0)||offset.length!==tilesX*Math.ceil(h/th))throw Error('USGS elevation raster is incomplete.');
 const read=(i,j)=>{const k=Math.floor(j/th)*tilesX+Math.floor(i/tw),a=offset[k]+4*((j%th)*tw+i%tw);const z=v.getFloat32(a,le);if(!Number.isFinite(z)||z< -500||z>9000)throw Error('The requested area has missing elevation cells.');return z;};
 const sample=(e,n)=>{const x=(e-tie[3])/scale[0]+tie[0]-.5,y=(tie[4]-n)/scale[1]+tie[1]-.5;
  if(x<0||y<0||x>w-1||y>h-1)throw Error('The elevation raster does not cover this study area.');
  const i=Math.floor(x),j=Math.floor(y),k=Math.min(w-1,i+1),l=Math.min(h-1,j+1),a=x-i,b=y-j;
  return (1-b)*((1-a)*read(i,j)+a*read(k,j))+b*((1-a)*read(i,l)+a*read(k,l));};
 return {w,h,sample,scale,tie};
}

export async function fetchUSGSTerrain(frame,r,{fetcher=fetch}={}){
 const [lat,lon]=frame.inv(0,0);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<18||lat>72||lon> -60||lon< -180)throw Error('USGS 3DEP is intended for U.S. locations. Use the existing global terrain source elsewhere.');
 r=Math.max(20,Math.min(1000,+r||250));const half=Math.min(100,Math.ceil(r)),step=r/half,n=2*half+1;
 const corners=[[-r,-r],[-r,r],[r,-r],[r,r]].map(([x,y])=>project(frame.inv(x,y))),[cx,cy]=project([lat,lon]);
 const d=Math.max(...corners.flatMap(([x,y])=>[Math.abs(x-cx),Math.abs(y-cy)]))+6*step/Math.cos(lat*D);
 const query=new URLSearchParams({bbox:[cx-d,cy-d,cx+d,cy+d].join(','),bboxSR:'3857',imageSR:'3857',size:`${n+12},${n+12}`,format:'tiff',pixelType:'F32',interpolation:'RSP_BilinearInterpolation',f:'image'});
 const response=await fetcher(`${USGS_3DEP}/exportImage?${query}`,{signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw Error(`USGS elevation service returned HTTP ${response.status}.`);
 const raster=decodeElevationTIFF(await response.arrayBuffer()),elev0=raster.sample(cx,cy),z=[];
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const p=project(frame.inv(-r+i*step,-r+j*step));z.push(+(raster.sample(...p)-elev0).toFixed(2));}
 return {provider:'USGS 3DEP · bare-earth DEM',source:USGS_3DEP,res:step,elev0:+elev0.toFixed(2),relief:+(Math.max(...z)-Math.min(...z)).toFixed(2),grid:{x0:-r,y0:-r,step,nx:n,ny:n,z}};
}
