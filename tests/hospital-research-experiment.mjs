// Generates inspectable synthetic experiments; none are hospital observations.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fixture} from './egress-fixture.mjs';
import {settings,profiles} from '../mvp/js/egress/settings.js';
import {experiment,METHOD} from '../mvp/js/egress/solver.js';
const scene=fixture(),make=()=>({...settings(scene,true),repeats:100}),cases=[];
for(const grid of [.1,.25,.5]){const s=make();s.grid=grid;cases.push({id:'vertical-grid-'+grid,scenario:s});}
for(const staff of [2,4,8]){const s=make();s.mode='horizontal';s.staff=staff;s.groups=s.groups.map(g=>({...g,...profiles.bed,count:3}));cases.push({id:'horizontal-bed-staff-'+staff,scenario:s});}
{const s=make();s.doors['H0-exit'].blocked=true;cases.push({id:'blocked-exit',scenario:s});}
{const s=make();s.groups=s.groups.map(g=>({...g,fallProbability:.1,fallMin:10,fallMax:30,fallBasis:'Deliberately hypothetical 10% per run sensitivity case; no measured fall probability.'}));cases.push({id:'hypothetical-disruption',scenario:s});}
const files=['mvp/js/egress/scene.js','mvp/js/egress/navigation.js','mvp/js/egress/solver.js','mvp/js/egress/settings.js','tests/egress-fixture.mjs','tests/hospital-research-experiment.mjs','emb/modeler.html','mvp/js/circulation-engine.js'];
const results=cases.map(c=>{const r=experiment(scene,c.scenario);return {id:c.id,scenario:c.scenario,inputHash:r.inputHash,summary:r.summary,runs:r.runs.map(x=>({...x,people:x.people.map(({segments,...p})=>p)}))};});
const artifact={title:'Hospital evacuation: synthetic verification and sensitivity experiments',method:METHOD,createdAt:new Date().toISOString(),provenance:'Synthetic geometry and hypothetical inputs. Core Plan Studio STC fixture, before browser door-generator normalization. Not a measured hospital; not empirical model validation.',runtime:process.version,sourceNormalization:'UTF-8 with CRLF normalized to LF',sourceSHA256:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8').replaceAll('\r\n','\n')).digest('hex')])),scene,results};
const target=new URL('../mvp/research/hospital-evacuation-experiments.json',import.meta.url);
if(process.argv.includes('--check')){const prior=JSON.parse(fs.readFileSync(target,'utf8'));assert.deepEqual(artifact.sourceSHA256,prior.sourceSHA256);assert.deepEqual(artifact.results,prior.results);assert.equal(JSON.stringify(artifact.scene),JSON.stringify(prior.scene));console.log('Published synthetic evidence reproduces exactly.');}
else{fs.mkdirSync(new URL('../mvp/research/',import.meta.url),{recursive:true});fs.writeFileSync(target,JSON.stringify(artifact));}
console.table(results.map(r=>({case:r.id,completedRuns:r.summary.allCompletedRuns,p50:r.summary.clearanceP50,p95:r.summary.clearanceP95,maxIncomplete:r.summary.maxIncomplete})));
