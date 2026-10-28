// File-based handoff intentionally avoids HTTPS-to-localhost mixed-content/private-network restrictions.
export const RELEASE='local-compute-20261028-2';
export const SCHEMA='plotcloud-local-job-v1';
export const MAX_FILE=48*1024*1024;
export async function sha256(value){const bytes=new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function sensorsFor(input){
 for(const key of ['x0','x1','y0','y1','z','spacing'])if(!Number.isFinite(input[key]))throw Error('All sensor-region inputs must be finite metres.');
 if(input.x1<=input.x0||input.y1<=input.y0||input.spacing<=0)throw Error('Choose a nonzero region and positive maximum spacing.');
 const nx=Math.ceil((input.x1-input.x0)/input.spacing),ny=Math.ceil((input.y1-input.y0)/input.spacing);
 if(!Number.isSafeInteger(nx*ny)||nx*ny>4096)throw Error('This grid exceeds 4,096 sensors. Reduce the region or explicitly increase spacing; it is never changed automatically.');
 const dx=(input.x1-input.x0)/nx,dy=(input.y1-input.y0)/ny,sensors=[];
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)sensors.push({id:`sensor-${j*nx+i+1}`,position:[input.x0+(i+.5)*dx,input.y0+(j+.5)*dy,input.z],normal:[0,0,1]});
 return{nx,ny,dx,dy,requestedMaxSpacing:input.spacing,sensors};
}
export function validateLocalResult(result,pending,currentHash){
 if(!result||result.schema!=='plotcloud-local-result-v1'||result.state!=='completed')throw Error('Only a completed local-engine result can be imported.');
 if(!pending||result.id!==pending.id||result.kind!==pending.kind||JSON.stringify(result.source)!==JSON.stringify(pending.source))throw Error('This result does not match the exported job for this model version. Select the original project/version and task.');
 if(result.source.modelHash!==currentHash)throw Error('The saved source model has changed. Export and calculate a new job. Historical results are retained.');
 if(!/^[a-f0-9]{64}$/.test(result.inputSha256||''))throw Error('The engine input checksum is missing.');
 const r=result.result;if(!r||!r.solver?.version||r.solver.name!==(pending.kind==='radiance-df'?'Radiance':'EnergyPlus'))throw Error('Missing or mismatched reference-engine provenance.');
 if(pending.kind==='radiance-df'){
  if(r.metric!=='daylight_factor'||r.unit!=='%'||!Number.isFinite(r.mean)||!Number.isFinite(r.exteriorReferenceLux)||r.exteriorReferenceLux<=0||r.sensors?.length!==pending.sensorCount)throw Error('Incomplete daylight-factor result.');
  for(let i=0;i<r.sensors.length;i++){const s=r.sensors[i];if(s.id!==pending.sensors[i].id||JSON.stringify(s.position)!==JSON.stringify(pending.sensors[i].position)||JSON.stringify(s.normal)!==JSON.stringify(pending.sensors[i].normal)||!Number.isFinite(s.daylightFactorPercent)||s.daylightFactorPercent<0||!Number.isFinite(s.illuminanceLux)||s.illuminanceLux<0)throw Error('Sensor IDs, coordinates or values do not match the submitted grid.');}
  const mean=r.sensors.reduce((a,s)=>a+s.daylightFactorPercent,0)/r.sensors.length;
  if(Math.abs(mean-r.mean)>1e-7*Math.max(1,mean))throw Error('The daylight-factor summary does not match its sensors.');
 }else if(r.metric!=='engine_output'||!r.completion?.includes('EnergyPlus Completed Successfully')||!Array.isArray(r.files))throw Error('EnergyPlus did not provide a successful completion record.');
 return result;
}
export function localCSV(result){if(result.kind!=='radiance-df')throw Error('EnergyPlus outputs are in the local engine ZIP archive.');return ['sensor_id,x_m,y_m,z_m,normal_x,normal_y,normal_z,illuminance_lux,daylight_factor_percent',...result.result.sensors.map(s=>[JSON.stringify(s.id),...s.position,...s.normal,s.illuminanceLux,s.daylightFactorPercent].join(','))].join('\n');}
