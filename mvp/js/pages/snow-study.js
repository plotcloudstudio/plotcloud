import * as S from '../store.js';
import {setParameter} from '../parameters.js';
import {esc,currentProject,currentVersion,setCurrent,setCurrentVersion} from '../app.js';
import {studioSolarScene} from '../studio-bridge.js?v=import-feedback-20261027-1';
import {sourceMeshes,environmentViewport} from '../environment/scene.js?v=vertical-snow-20261031-1';
import {fingerprint} from '../environment/analysis.js';
import {mountStudyShell} from '../study-ui/shell.js?v=unified-modes-20261030-1';
import {SNOW_RELEASE,SNOW_SCOPE,SNOW_SOURCE,SNOW_KEYS,snowDefaults,validateSnow} from '../snow-analysis.js';

const n=(v,d=2)=>Number(v).toLocaleString('en-CA',{maximumFractionDigits:d});
const download=(name,body,type)=>{const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
const labels={snowCm:'New snowfall depth (cm)',density:'New-snow density (kg/m³)',spacing:'Maximum grid spacing (m)',groundZ:'Fallback ground elevation Z (m)',x0:'Region minimum X (m)',x1:'Region maximum X (m)',y0:'Region minimum Y (m)',y1:'Region maximum Y (m)'};
const units={snowCm:'cm',density:'kg/m³',spacing:'m',groundZ:'m',x0:'m',x1:'m',y0:'m',y1:'m'};
const inputFields=(keys,input)=>keys.map(key=>'<label class="f">'+labels[key]+'<input data-snow-field="'+key+'" type="number" step="any" value="'+esc(input[key])+'"></label>').join('');

export async function render(app,sim,params=new URLSearchParams(),context={}){
 const p=S.project(params.get('project'))||currentProject(),v=p&&(S.version(p,params.get('version'))||currentVersion(p));
 if(!p||!v){app.innerHTML='<div class="wrap"><h1>Save a model version first.</h1><p>Snow deposition needs the actual source surfaces.</p><a class="btn" href="#/workspace">Open Workspace</a></div>';return;}
 setCurrent(p);setCurrentVersion(p,v.id);app.innerHTML='<div class="wrap"><h1>Preparing Snow accumulation…</h1><p role="status">Reading original source surfaces.</p></div>';
 let source,meshes;
 try{source=JSON.parse((await studioSolarScene(v,S.conditionsOf(p).site,p.name,p.id)).scene);meshes=sourceMeshes(source);if(!meshes.length)throw Error('The saved model has no source surfaces.');}
 catch(e){if(context.isCurrent&&!context.isCurrent())return;app.innerHTML='<div class="wrap"><h1>The model could not load.</h1><p role="alert">'+esc(e.message)+'</p><a href="#/workspace">Review the model in Workspace</a></div>';return;}
 if(context.isCurrent&&!context.isCurrent())return;
 const geometryHash=fingerprint(meshes),modelSnapshot=JSON.stringify(v.model),siteSnapshot=JSON.stringify(S.conditionsOf(p).site);
 let input={...snowDefaults(source.geometryBounds),...p.snowStudies?.[v.id]},alive=true,worker=null,result=null,busy=false,saved=false,generation=0,runSignature=null,runInput=null;
 const changedFields=new Set(),q=s=>app.querySelector(s);
 app.innerHTML='<div class="env-study"><header class="env-head"><div><a href="#/simulations">← Studies</a><strong>Snow accumulation</strong></div><div class="acts"><select id="env-project" aria-label="Project">'+S.projects().map(x=>'<option value="'+esc(x.id)+'" '+(x.id===p.id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select><select id="env-version" aria-label="Saved version">'+p.versions.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===v.id?'selected':'')+'>v'+x.n+' · '+esc(x.note)+'</option>').join('')+'</select><button id="env-run" class="btn accent">Run study</button><button id="env-stop" class="btn" hidden>Stop</button><button id="env-save" class="btn" disabled>Save result</button><button id="env-report" class="btn" disabled>Export report</button></div><p id="env-status" role="status">Review the snowfall scenario and region, then run.</p><progress id="env-progress" hidden></progress></header><div class="env-body"><aside class="env-setup"><fieldset id="snow-fields"><details open><summary>Analysis mode</summary><label class="f">Method<select id="snow-mode" aria-label="Snow analysis mode"><option value="vertical">Given snowfall · vertical deposition</option><option value="drift">Winter-wind drift screening</option></select></label></details><details><summary>Source and method</summary><p class="note">'+esc(p.name)+' · saved v'+v.n+' · '+meshes.length+' source surface objects. Original geometry, including linked context and terrain where available.</p><p class="note">One vertical snowfall event. The topmost surface receives each cell once. Glazing and all model surfaces are opaque. A receiving surface is not automatically classified as a weather-tight roof.</p><p class="note">No wind drift, melting, compaction, sliding or existing snow. This is a quantity screening, not roof structural capacity or a snowfall forecast.</p><a href="'+SNOW_SOURCE+'" target="_blank" rel="noopener">Snow depth, density and water equivalent · USDA NRCS ↗</a></details><details open><summary>Snowfall scenario</summary>'+inputFields(['snowCm','density'],input)+'<p class="note">15 cm and 100 kg/m³ are editable example assumptions, not local weather data. Enter new snow depth, not liquid rainfall or water-equivalent depth.</p></details><details open><summary>Evaluation region and ground</summary>'+inputFields(['spacing','groundZ','x0','x1','y0','y1'],input)+'<p class="note">Coordinates are world metres. Where no source surface is hit, use the stated flat ground elevation. Real terrain elevations are retained. Up to 4,096 cell centres; areas are horizontal projected areas and small features may be missed. Refine the grid to check convergence.</p></details></fieldset><details><summary>Export</summary><button id="env-csv" class="btn sm" disabled>Export cells CSV</button> <button id="env-json" class="btn sm" disabled>Export analysis JSON</button> <button id="snow-png" class="btn sm" disabled>Export view PNG</button><p class="note">Exports record the source version, scenario, region, method, time and geometry hash. JSON includes original surface coordinates. Report is a standalone HTML file that can be printed to PDF.</p></details></aside><section class="env-main"><div class="env-view"><div id="env-canvas"></div><div class="env-view-tools"><button class="btn sm" id="env-fit">Fit model + study</button><span>Original model and sampled snow</span></div><div class="env-legend" id="env-legend">White: source model · blue: calculated snow cells after running.</div></div><section class="env-results" id="env-results"><h2>Ready to calculate</h2><p>No result yet. Enter an event and run it on this saved version.</p></section></section></div></div>';
 const shell=mountStudyShell(q('.env-study'),{spatial:true});
 q('#snow-mode').onchange=e=>{if(e.target.value==='drift')location.hash='#/simulations/snow?mode=drift';};
 const status=(text,error=false)=>{q('#env-status').textContent=text;q('#env-status').setAttribute('role',error?'alert':'status');};
 const view=environmentViewport(q('#env-canvas'),message=>status(message,true),{key:'snow-'+p.id});
 const viewInput=()=>({...input,kind:'snow',z:input.groundZ});
 view.setResult(meshes,null,viewInput());q('#env-fit').onclick=()=>view.fit();
 const signature=()=>JSON.stringify({input,geometryHash,model:modelSnapshot,site:siteSnapshot});
 const current=()=>JSON.stringify(S.version(p,v.id)?.model)===modelSnapshot&&JSON.stringify(S.conditionsOf(p).site)===siteSnapshot;
 const exportIds=['env-save','env-report','env-csv','env-json','snow-png'];
 const enableExports=enabled=>{for(const id of exportIds)q('#'+id).disabled=!enabled;q('#env-save').disabled=!enabled||saved;};
 const persist=()=>{p.snowStudies||={};p.snowStudies[v.id]={...input};S.save();};
 const stop=message=>{generation++;worker?.terminate();worker=null;busy=false;q('#snow-fields').inert=false;q('#env-run').disabled=false;q('#env-stop').hidden=true;q('#env-progress').hidden=true;q('#env-project').disabled=q('#env-version').disabled=false;if(message)status(message);};
 const invalidate=()=>{if(busy)stop();result=null;saved=false;runSignature=null;enableExports(false);view.setResult(meshes,null,viewInput());q('#env-results').innerHTML='<h2>Inputs changed</h2><p>Calculate again. Earlier saved results remain in the project history.</p>';status('Inputs changed · review and rerun.');};
 for(const field of app.querySelectorAll('[data-snow-field]'))field.oninput=()=>{const key=field.dataset.snowField;input[key]=field.value.trim()===''?NaN:Number(field.value);changedFields.add(key);invalidate();};
 const renderResult=()=>{
  const t=result.totals;
  q('#env-results').innerHTML='<h2>Single-event deposition</h2><p class="note">'+esc(p.name)+' · v'+v.n+' · '+esc(result.computedAt)+' · '+esc(SNOW_RELEASE)+'</p><table><tbody>'+[
   ['New snow depth',n(runInput.snowCm)+' cm (uniform event)'],['Total deposited snow',n(t.volumeM3)+' m³'],['Ground snow volume',n(t.groundVolumeM3)+' m³'],['Roof / model-surface snow volume',n(t.surfaceVolumeM3)+' m³'],['Total snow mass',n(t.massKg,1)+' kg'],['Snow water equivalent',n(t.waterEquivalentMm,1)+' mm'],['Horizontal study area',n(t.areaM2)+' m²'],['Ground receiving area',n(t.groundAreaM2)+' m²'],['Roof / model-surface receiving area',n(t.surfaceAreaM2)+' m²'],['Assumed flat-ground area',n(t.fallbackAreaM2)+' m²'],['Grid cells',result.samples.length+' · '+n(result.grid.dx)+' × '+n(result.grid.dy)+' m']
  ].map(([a,b])=>'<tr><th scope="row">'+a+'</th><td>'+b+'</td></tr>').join('')+'</tbody></table><p class="note">Volume = horizontal receiving area × vertical snow depth. Mass = snow volume × entered density. Water equivalent = snow depth × density / water density (1,000 kg/m³).</p><p class="note">'+(t.fallbackAreaM2?'Some ground elevations were assumed where source geometry was absent. Review the region and fallback elevation before using quantities.':'All sample points hit supplied source geometry.')+'</p><p class="note">'+esc(SNOW_SCOPE)+'</p><p class="note">Uniform depth is expected for this model. The calculation allocates snow between exposed ground and roof/model surfaces; it does not manufacture drift-depth variations.</p>';
 };
 const run=()=>{
  if(busy)return;
  invalidate();
  try{validateSnow(input);if(!current())throw Error('The saved model or site changed. Reopen this study before calculating.');persist();}
  catch(e){status(e.message,true);return;}
  runInput={...input};runSignature=signature();busy=true;q('#snow-fields').inert=true;q('#env-run').disabled=true;q('#env-stop').hidden=false;q('#env-project').disabled=q('#env-version').disabled=true;q('#env-progress').hidden=false;q('#env-progress').removeAttribute('value');status('Sampling the highest source surfaces…');
  const token=++generation;
  try{worker=new Worker(new URL('../snow-worker.js?v='+SNOW_RELEASE,import.meta.url),{type:'module'});}
  catch(e){stop();status('The calculation worker could not start: '+e.message,true);return;}
  worker.onmessage=({data})=>{
   if(!alive||token!==generation)return;
   if(data.type==='progress'){q('#env-progress').max=data.total;q('#env-progress').value=data.completed;status('Sampling snow receivers · '+data.completed+' / '+data.total+' grid rows');return;}
   if(data.type==='error'){stop();status(data.message,true);return;}
   if(!current()||signature()!==runSignature){stop();invalidate();status('Inputs changed during calculation. Reopen and rerun.',true);return;}
   result=data.result;result.source={project:p.id,projectName:p.name,version:v.id,versionNumber:v.n,geometryHash,site:structuredClone(S.conditionsOf(p).site),method:SNOW_RELEASE,units:{coordinates:'m',depth:'cm',density:'kg/m³',volume:'m³',mass:'kg',waterEquivalent:'mm'}};
   for(const key of SNOW_KEYS)setParameter(p,{path:'snow.'+key,value:runInput[key],scope:'study-global',study:'snow-event',valueOrigin:changedFields.has(key)?'user-override':'platform-default',acquisition:changedFields.has(key)?'manual-entry':'template',ruleVersion:SNOW_RELEASE,meta:{acceptedScenario:true}});
   S.save();stop();saved=false;view.setResult(meshes,result,{...runInput,kind:'snow',z:runInput.groundZ});view.fit();renderResult();enableExports(true);status('Calculation complete · review ground assumptions, then save or export.');
  };
  worker.onerror=e=>{if(!alive||token!==generation)return;stop();status('Snow calculation failed: '+(e.message||'try again'),true);};
  worker.postMessage({meshes,input:runInput});
 };
 q('#env-run').onclick=run;q('#env-stop').onclick=()=>{stop('Calculation stopped. No new result was saved.');enableExports(false);};
 const ensureResult=()=>{if(!result||busy||runSignature!==signature()||!current()){invalidate();status('Results are no longer applicable. Reopen or rerun before saving or exporting.',true);return false;}return true;};
 q('#env-save').onclick=()=>{if(saved||!ensureResult())return;try{S.addRun(p,v.id,'snow',{...runInput,snowMode:'vertical',engine:'vertical-first-hit-snow',engineVersion:SNOW_RELEASE,geometryHash,source:result.source,scope:SNOW_SCOPE},{...result.totals,computedAt:result.computedAt,source:result.source,input:runInput,grid:result.grid},'snow');saved=true;enableExports(true);status('Saved to v'+v.n+' · earlier results are retained.');}catch(e){status('Could not save: '+e.message,true);}};
 const cell=v=>{const text=typeof v==='string'&&/^[=+@\-]/.test(v)?"'"+v:String(v??'');return '"'+text.replace(/"/g,'""')+'"';};
 q('#env-csv').onclick=()=>{if(!ensureResult())return;const rows=[['Project',p.name,'Version',v.n,'Computed at',result.computedAt],['Method',SNOW_RELEASE,'Geometry hash',geometryHash],['Snowfall (cm)',runInput.snowCm,'Density (kg/m³)',runInput.density],['Scope',SNOW_SCOPE],['x_m','y_m','receiver_z_m','snow_top_z_m','snow_depth_cm','projected_area_m2','snow_volume_m3','snow_mass_kg','receiver','surface_key','surface_name','assumed_ground'],...result.samples.map(s=>[s.x,s.y,s.z,s.snowTopM,s.value,s.areaM2,s.volumeM3,s.massKg,s.receiver,s.key,s.name,s.fallback])];download('PlotCloud-snow-v'+v.n+'.csv',rows.map(r=>r.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8');};
 q('#env-json').onclick=()=>{if(ensureResult())download('PlotCloud-snow-v'+v.n+'.json',JSON.stringify({...result,sourceMeshes:meshes},null,2),'application/json');};
 q('#snow-png').onclick=()=>{if(!ensureResult())return;const png=view.png();if(!png){status('A model image could not be exported. CSV and JSON remain available.',true);return;}const bytes=Uint8Array.from(atob(png.split(',')[1]),c=>c.charCodeAt(0));download('PlotCloud-snow-v'+v.n+'.png',bytes,'image/png');};
 q('#env-report').onclick=()=>{if(!ensureResult())return;const png=view.png(),html='<!doctype html><html lang="en"><meta charset="utf-8"><title>PlotCloud · Snow accumulation</title><style>body{max-width:1000px;margin:32px auto;padding:20px;font:15px/1.5 system-ui;color:#172739}img{max-width:100%}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #dce2e8;padding:7px}.note{font-size:13px;color:#435466}@media print{body{margin:0}}</style><h1>Snow accumulation · single event</h1>'+q('#env-results').innerHTML+(png?'<img alt="Calculated snow receivers on the original model" src="'+png+'">':'')+'<h2>Recorded scenario</h2><table>'+SNOW_KEYS.map(k=>'<tr><th>'+labels[k]+'</th><td>'+esc(runInput[k])+' '+units[k]+'</td></tr>').join('')+'</table><p>Geometry hash: '+esc(geometryHash)+' · source version '+esc(v.id)+'</p><p><a href="'+SNOW_SOURCE+'">USDA NRCS: snow depth, density and water equivalent</a>. Export the cell CSV and source JSON for the complete data.</p></html>';download('PlotCloud-snow-v'+v.n+'-report.html',html,'text/html');};
 q('#env-project').onchange=e=>{location.hash='#/simulations/snow?project='+encodeURIComponent(e.target.value);};
 q('#env-version').onchange=e=>{location.hash='#/simulations/snow?project='+encodeURIComponent(p.id)+'&version='+encodeURIComponent(e.target.value);};
 return()=>{alive=false;generation++;worker?.terminate();view.dispose();shell.dispose();};
}
