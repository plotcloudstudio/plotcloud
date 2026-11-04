import * as S from './store.js';
import {caseModel,title,site,source} from './fallingwater-case.js';
import evidence from './fallingwater-results.js';

const level={L1:'01 · Living',L2:'02 · Bedrooms',L3:'03 · Study'};
const [a,b]=evidence.runs;
export const caseCard=()=>`<section class="pc-case" aria-labelledby="fallingwater-title"><div class="pc-case-copy"><span class="eyebrow">Featured case study · Pennsylvania, USA</span><h2 id="fallingwater-title">Fallingwater</h2><p>Explore Frank Lloyd Wright’s three-level main house, Bear Run and the furnished interiors. Compare two window-opening scenarios under the same assumed wind conditions.</p><button class="btn accent" type="button" data-fallingwater>Open case in Workspace →</button> <button class="btn" type="button" data-fallingwater="results">View saved results</button> <a href="${source}" target="_blank" rel="noopener">Measured drawings ↗</a><p class="note">Diagrammatic reconstruction from HABS PA-5346. USGS 3DEP supplies the outer terrain; the creek, cascades and building details are reconstructed from HABS. Results are screening estimates, not measured performance.</p></div><div class="pc-case-data"><span class="eyebrow">Calculated in PlotCloud · natural ventilation</span><div class="pc-case-metrics">${evidence.runs.map(r=>`<div><b>${r.ach.toFixed(1)} ACH</b><small>${Math.round(r.open*100)}% window opening</small></div>`).join('')}</div><p class="note">Whole-house outdoor air changes · SW 2.5 m/s at 10 m · 18 °C outside / 24 °C inside.</p><details><summary>See room results and study inputs</summary><p class="note">Daylight factor: CIE overcast sky, 0.8 m workplane, 0.5 m grid, glazing transmittance 0.70. The airflow model uses assumed openings and does not resolve local valley wind or inter-floor stairwell airflow.</p><div class="pc-case-table"><table class="t"><thead><tr><th>Room</th><th>5% ACH</th><th>15% ACH</th><th>Daylight factor</th></tr></thead><tbody>${a.rooms.map((r,i)=>`<tr><td>${level[r.level]} · ${r.name}</td><td>${r.ach.toFixed(1)}</td><td>${b.rooms[i].ach.toFixed(1)}</td><td>${r.daylightFactor.toFixed(1)}%</td></tr>`).join('')}</tbody></table></div></details></div></section>`;

export function openCase(){
 try{const key='pc-mvp-ws2',ui=JSON.parse(localStorage.getItem(key)||'{}');localStorage.setItem(key,JSON.stringify({...ui,view:'persp'}));}catch{} 
 let p=S.projects().find(p=>p.caseStudy?.id==='fallingwater-habs-detailed-v2'&&!p.deletedAt);
 if(p)return p;
 p=S.createProject(title + " (detailed)",caseModel());
 p.site=S.clone(site);p.siteLinked=false;p.caseStudy={id:'fallingwater-habs-detailed-v2',source,generated:evidence.generated,engine:evidence.engine,engineHash:evidence.engineHash,modelHash:evidence.modelHash};
 S.updateConditions(p,site,p.sharedConditions.defaults,{keepRevision:true});
 for(const r of evidence.runs){
  p.draft=caseModel(r.open);const v=S.saveVersion(p,`${Math.round(r.open*100)}% effective window opening · same weather scenario`);
  const settings={...evidence.conditions,windowOpening:r.open,configurationName:`${Math.round(r.open*100)}% open`,method:evidence.engine};
  S.addRun(p,v.id,'vent',settings,{ach:r.rooms[0].ach,wholeHouseACH:r.ach,outdoorLps:r.airflow,rooms:r.rooms,caseStudy:{...p.caseStudy,modelHash:r.modelHash},kpis:[['Whole-house outdoor ACH',r.ach.toFixed(1)],['Outdoor supply',`${r.airflow.toFixed(0)} L/s`]]},'plan-studio-case');
  S.addRun(p,v.id,'daylight',settings,{df:r.daylightFactor,rooms:r.rooms,caseStudy:{...p.caseStudy,modelHash:r.modelHash},kpis:[['Average daylight factor',`${r.daylightFactor.toFixed(2)}%`]]},'plan-studio-case');
 }
 return p;
}





