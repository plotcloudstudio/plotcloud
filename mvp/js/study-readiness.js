// Conservative input checks. Engine geometry validation remains authoritative.
const PLAN=new Set(['daylight','vent','acoustics','spacesyntax','movementdepth','views','cameras','privacy','wayfinding','isovist','evac']);
const LOCATION=new Set(['sunhours','daylight','radiation','utci','shadebenefit','solarenvelope']);
const EPW=new Set(['radiation','utci','climate','passive','shadebenefit']);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function inspectStudy(project,version,id,{site=project?.sharedConditions?.site||project?.site,defaults=project?.sharedConditions?.defaults||{},draftChanged}={}){
 // an address and weather alone are enough only for climate studies; say so plainly when that is all the project has
 const weatherNote=site?.climate?.hash&&!['climate','passive'].includes(id)?` Weather is ready (${site.climate.name||site.climate.station||'project EPW'}); this study also calculates on your model, so it needs ${PLAN.has(id)?'rooms with walls and windows':'building massing or an imported model'}. Climate Analysis and Passive Design run on the weather alone.`:'';
 const checks=[],add=(key,state,title,detail,href)=>checks.push({key,state,title,detail,href}),workspace='#/workspace/'+encodeURIComponent(project?.id||''),conditions='#/project-settings/'+encodeURIComponent(project?.id||'');
 if(!project)add('project','error','Choose a project','Start with an example or open your own project.','#/start-study');
 if(!version?.model)add('version','error','Save a model version','Studies use a saved snapshot. Your working draft has not been saved yet.'+weatherNote,workspace);
 else{
  const model=version.model,st=model.studio,components=model.components||[],walls=st?.walls||components.filter(c=>c.type==='wall');
  const hidden=new Set(st?.hiddenIds||[]),off=new Set((model.layers||[]).filter(l=>l.visible===false).map(l=>l.name)),imports=(st?.imports||[]).filter(o=>!hidden.has(o.id)&&!off.has(o.layer||'Imported'));
  if(imports.length&&(project?.runs||[]).some(r=>r.versionId===version.id&&!r.settings?.geometry))add('legacy-import-runs','warning','Rerun older imported-model results','Earlier runs may have used simplified or incomplete imported geometry. A result without a geometry audit has not been verified against the original imported surfaces.');
  if(PLAN.has(id)&&imports.some(o=>!['mass','terrain'].includes(o.type)))add('mesh-semantics','error','Prepare imported geometry for this indoor study','The imported surfaces are retained, but this engine needs native analysis walls, closed rooms and relevant openings. A visible 3D mesh is not yet a room or window definition. No sample model or bounding-box substitute will be analyzed.',workspace);
  if(id==='structure')add('structural-semantics','warning','Review the structural analytical model','Open this study to assign structural roles/materials, review axes, and confirm supports and loads on this exact model version. Visual meshes are not automatically verified structure.','#/simulations/structure');
  add('version','ok',`Saved version v${version.n}`,'This snapshot is kept separately from later model edits.');
  if(draftChanged??(project?.draft&&JSON.stringify(project.draft)!==JSON.stringify(model)))add('draft','warning','Unsaved design changes','This study uses the selected saved version. Save a new version to analyse your latest edits.',workspace);
  const units=st?.units||model.units;
  if(units&&units!=='m')add('units','error','Check model units',`Saved model units are ${units}; simulation geometry must be converted to metres.`,workspace);
  else add('units','ok','Simulation geometry uses metres','Review imported model dimensions in Workspace if the scale looks wrong.',workspace);
  const invalid=(st?.walls||[]).filter(w=>![w.a,w.b].every(p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(finite)));
  if(invalid.length)add('geometry','error','Repair invalid wall coordinates',invalid.slice(0,5).map(w=>w.id||'Unnamed wall').join(', '),workspace);
  if(PLAN.has(id)){
   if(walls.length<3)add('plan','error','Add a room layout','This study needs a plan with enclosing walls. A massing-only model is insufficient.',workspace);
   else add('plan','ok','Wall layout found','The engine checks closed rooms and the selected level when the model is prepared.');
   if(['daylight','vent','privacy'].includes(id)&&!(st?.ops||components.filter(c=>c.type==='window')).length)add('openings','warning','No openings recorded','Review windows and operable openings. An enclosed room can correctly return little daylight or ventilation.',workspace);
  }else if(id!=='structure'){
   if(!walls.length&&!st?.masses?.length&&!st?.imports?.length&&!st?.site&&!components.length)add('geometry','error','Add analysis geometry','Draw or import the building or site you want to study.'+weatherNote,workspace);
   else add('model','ok','Model geometry found','Review the analysis extent and context in the study.');
  }
 }
 if(LOCATION.has(id)){
  if(!finite(site?.lat)||!finite(site?.lon)||Math.abs(site.lat)>90||Math.abs(site.lon)>180)add('location','error','Set a valid project location','Latitude must be −90 to 90° and longitude −180 to 180°.',conditions);
  else add('location',site.sample?'warning':'ok',site.sample?'Using the example location':site.label||'Project location recorded',`${site.lat.toFixed(4)}°, ${site.lon.toFixed(4)}°${site.sample?' · Replace the example site for your own design.':''}`,conditions);
  if(site?.north!=null&&!finite(site.north))add('north','error','Set a valid north angle','True north must be a finite number in degrees.',conditions);
  else add('north','ok',`North ${site?.north??0}°`,'Confirm the building orientation before interpreting results.',conditions);
 }
 if(EPW.has(id)&&!site?.climate?.hash)add('weather','error','Upload a project EPW','This study needs a complete hourly weather file in project conditions.',conditions);
 else if(id==='daylight'&&!site?.climate?.hash)add('weather','warning','Daylight will use a generic year','Upload an EPW for a weather-file-based study. Review the method and limitations with the result.',conditions);
 else if(site?.climate?.quality?.blocked?.[id])add('weather','error','Weather file lacks fields this study needs',`${site.climate.name||'Project EPW'} is missing ${site.climate.quality.blocked[id].join(', ')} for more than 10 % of hours. Missing values are not filled; choose another station or upload a complete file.`,conditions);
 else if(site?.climate?.hash)add('weather','ok',`Weather: ${site.climate.name||site.climate.station||'project EPW'}`,'The file must also be available in this browser.',conditions);
 if(id==='daylight'&&((finite(defaults.plane)&&(defaults.plane<0||defaults.plane>1.5))||(finite(defaults.occStart)&&finite(defaults.occEnd)&&defaults.occStart>=defaults.occEnd)))add('settings','error','Review the daylight work plane and occupied hours','Use a work plane from 0 to 1.5 m and occupied end time later than start.',conditions);
 if(['isovist','evac','cameras'].includes(id))add('interaction','warning','Place study-specific inputs','Choose the observer, destinations or cameras inside the study before running.');
 return{checks,errors:checks.filter(c=>c.state==='error'),warnings:checks.filter(c=>c.state==='warning'),ready:!checks.some(c=>c.state==='error')};
}
