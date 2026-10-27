import * as S from './store.js';
import {importModel} from './viewport.js';
import {reviewImport} from './import-review.js?v=import-feedback-20261027-1';
import {toStudio} from './studio-convert.js';
import {setCurrent,setCurrentVersion} from './app.js';
export function mountStudyImport(host,study){
 const bar=document.createElement('div');bar.className='study-import';bar.style.cssText='display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0';
 bar.innerHTML='<button type="button" class="btn sm" data-study-import>Import model as a new project</button><input type="file" data-study-file accept=".obj,.stl,.glb,.gltf,.3dm" hidden><button type="button" class="btn sm" data-study-retry hidden>Retry last import</button><span class="note" role="status" aria-live="polite">No model? Import here, or open Workspace to edit your model. Imports create a separate project and do not merge into the sample.</span><details><summary>Supported files and example</summary><p class="note">OBJ, STL, GLB, glTF and Rhino 3DM. Maximum file size: 25 MiB; maximum geometry: 80,000 triangles. Use a self-contained GLB when glTF has external resources.</p><a href="examples/building-metres.obj" download="PlotCloud-example-10x8x6m.obj">Download example building · 10 × 8 × 6 m · Z up</a></details>';
 host.append(bar);const input=bar.querySelector('input'),button=bar.querySelector('[data-study-import]'),retry=bar.querySelector('[data-study-retry]'),status=bar.querySelector('[role=status]');let busy=false,lastFile=null,alive=true;
 const report=(text,error=false)=>{status.textContent=text;status.title=text;status.setAttribute('role',error?'alert':'status');retry.hidden=!error||!lastFile;};
 button.onclick=()=>{report('Choose a model for a separate project. Cancel keeps your current project.');input.click();};
 input.addEventListener('cancel',()=>report('No file selected. Your current project is unchanged.'));
 const run=async(file)=>{if(busy||!alive)return;lastFile=file;busy=true;button.disabled=retry.disabled=true;button.textContent='Importing…';bar.setAttribute('aria-busy','true');report('Reading '+file.name+'…');
  try{const parsed=await importModel(file);if(!alive)return;report('Review the units, dimensions and new-project destination.');const name=file.name.replace(/\.[^.]+$/,''),r=await reviewImport(parsed,{name:file.name,destination:{label:'New project: '+name,sample:false}});if(!alive)return;if(!r){report('Import cancelled. Your existing projects are unchanged.');return;}
   report('Preparing the model and saving its first version…');await new Promise(requestAnimationFrame);if(!alive)return;
   const layers=[...new Set(r.components.map(c=>c.srcLayer||c.layer||'Imported'))].map(name=>({name,color:'#cfcac0',visible:true,locked:false})),studio=toStudio({units:'m',layers:[],components:[]},S.account().site,{name}),meshes={};
   studio.imports=r.components.map(c=>{const id=S.uid('c');meshes[id]=c.mesh;return{id,name:c.name,layer:c.srcLayer||c.layer||'Imported',type:'imported',mat:c.mat,g:c.g,tris:c.mesh.length/9};});
   const p=S.createProject(name,{units:'m',layers,components:[],studio,meshes,importAudit:r.audit}),v=S.saveVersion(p,'Imported model · scale reviewed');setCurrent(p);setCurrentVersion(p,v.id);
   const next='#/simulations/'+study+'?imported=1';if(location.hash===next)dispatchEvent(new HashChangeEvent('hashchange'));else location.hash=next;
  }catch(error){if(alive)report('Import did not finish: '+(error.message||'Unknown reader error')+' Retry the import or choose the file again.',true);}
  finally{busy=false;if(alive){button.disabled=retry.disabled=false;button.textContent='Import model as a new project';bar.removeAttribute('aria-busy');}}
 };
 input.onchange=()=>{const file=input.files[0];input.value='';if(file)run(file);else report('No file selected. Your current project is unchanged.');};retry.onclick=()=>{if(lastFile)run(lastFile);};
 return()=>{alive=false;bar.remove();};
}
