// Persist contents instead of a File reference that can expire after navigation.
import * as S from './store.js';
function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open('pc-project-climate',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function climateFile(hash){if(!hash)return null;const db=await database();try{return await new Promise((resolve,reject)=>{const r=db.transaction('files').objectStore('files').get(hash);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}finally{db.close();}}
export async function saveClimate(file){
 if(file.size>8*1024*1024)throw Error('EPW must be smaller than 8 MB.');
 const text=await file.text(),lines=text.trim().split(/\r?\n/),head=lines[0].split(',');
 if(head[0]!=='LOCATION'||lines.length<8768)throw Error('Choose a complete hourly EPW file (8 header lines and at least 8760 hours).');
 if(lines.slice(8,8768).some(line=>{const a=line.split(',');return a.length<22||![6,20,21].every(i=>a[i].trim()!==''&&Number.isFinite(+a[i]))||+a[6]>=99||+a[20]>=999||+a[21]>=999||+a[21]<0;}))throw Error('EPW has missing or invalid hourly temperature/wind data.');
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');
 const record={name:file.name,text,hash,station:head[1],hours:8760},db=await database();
 try{await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(record,hash);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
 return {name:record.name,hash,station:record.station,hours:8760};
}
export function mountProjectClimate(app,p){
 const site=S.conditionsOf(p).site,section=document.createElement('section');section.className='card';section.style.cssText='padding:24px;margin-top:18px';
 section.innerHTML='<h2>Shared climate & exposure</h2><p class="note">For Natural Ventilation and Daylight. Stored in this browser, not synced to other devices. Upload once per project; existing results are never overwritten.</p><div class="grid g2" style="margin-top:16px"><label class="f">Terrain roughness<select id="projectTerrain"><option value="open">Open country</option><option value="suburban">Suburbs</option><option value="city">City center</option></select></label><label class="f">Neighbour shelter<select id="projectShelter"><option value="exposed">Exposed</option><option value="semi">Half as tall nearby</option><option value="sheltered">As tall nearby</option></select></label></div><p id="projectClimateStatus" class="note" role="status" style="margin:16px 0"></p><label class="btn">Upload EPW<input type="file" id="projectEpw" accept=".epw" hidden></label><p class="note">Uploading does not change project location or north. Review the weather station before running.</p>';
 app.querySelector('#sharedForm').before(section);
 const terrain=section.querySelector('#projectTerrain'),shelter=section.querySelector('#projectShelter'),status=section.querySelector('#projectClimateStatus');terrain.value=site.terrain||'suburban';shelter.value=site.shelter||'semi';
 const describe=()=>{const c=S.conditionsOf(p).site.climate;status.textContent=c?`${c.name} · ${c.station} · ${c.hours} hours`:'No shared EPW. Ventilation uses the explicit wind/temperature scenario; Daylight uses its generic year.';};describe();
 const update=extra=>{const c=S.conditionsOf(p);S.updateConditions(p,{...c.site,...extra},c.defaults);};
 for(const field of [terrain,shelter])field.onchange=()=>{update({terrain:terrain.value,shelter:shelter.value});status.textContent='Exposure saved for this project. Reopen the study to apply.';};
 section.querySelector('#projectEpw').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;status.textContent='Validating and storing EPW…';try{const climate=await saveClimate(file);update({climate});describe();}catch(error){status.textContent=error.message||'Could not store the EPW. Previous file is unchanged.';}};
}

export async function applyProjectClimate(frame,site,sim,edit){
 const doc=frame.contentDocument;if(!doc||!['vent','daylight'].includes(sim))return;
 const note=doc.createElement('p');note.className='note';note.id='projectClimateSummary';
 const anchor=doc.getElementById(sim==='vent'?'wxMore':'epwInfo');if(!anchor)return;
 anchor.before(note);const link=doc.createElement('a');link.href='#';link.textContent='Edit project conditions ↗';link.onclick=e=>{e.preventDefault();edit();};
 const status=doc.createElement('span');note.append(status,doc.createElement('br'),link);
 if(sim==='daylight')doc.getElementById('epwF').addEventListener('change',()=>{if(!doc.body.dataset.pcSharedWeatherLoading)status.textContent='Study-only climate selected; check the engine weather status below. Project file is unchanged.';});
 if(sim==='vent'){
  for(const [id,value]of Object.entries({north:site.north??0,terrain:site.terrain||'suburban',shelter:site.shelter||'semi'})){const el=doc.getElementById(id);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));el.disabled=true;el.closest('.lab').hidden=true;}
  // Floor height and operable-temperature limits are study-specific, not site defaults.
  for(const id of ['floorZ','epwOpen']){const el=doc.getElementById(id);if(el)anchor.before(id==='floorZ'?el.closest('.lab'):el);}
  anchor.hidden=true;
 }
 if(!site.climate){status.textContent=`Project north ${site.north??0}° · No shared EPW; ${sim==='vent'?'explicit wind/temperature scenario':'generic year'}.`;return;}
 status.textContent='Loading project EPW…';
 const run=doc.getElementById('run'),wasDisabled=run?.disabled;if(run)run.disabled=true;
 doc.body.dataset.pcSharedWeatherLoading='true';
 let applied=false;
 try{
  const file=await climateFile(site.climate.hash);if(!file)throw Error('Shared EPW is missing from this browser. Upload it again in project conditions.');
  const input=doc.getElementById('epwF'),dt=new DataTransfer();dt.items.add(new File([file.text],file.name,{type:'text/plain'}));input.files=dt.files;
  const info=doc.getElementById('epwInfo');info.textContent='Loading project EPW…';input.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise((resolve,reject)=>{const start=Date.now(),poll=()=>{const text=info.textContent;if(/could not/i.test(text))reject(Error(text));else if(text!=='Loading project EPW…')resolve();else if(Date.now()-start>30000)reject(Error('Timed out reading project EPW.'));else setTimeout(poll,50);};poll();});
  status.textContent=`Project north ${site.north??0}° · EPW: ${file.name} · ${file.station}`;
  applied=true;
 }catch(error){status.textContent=error.message;throw error;}
 finally{delete doc.body.dataset.pcSharedWeatherLoading;if(run)run.disabled=applied?wasDisabled:true;}
}
