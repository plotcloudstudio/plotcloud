import {snowAnalysis} from './snow-analysis.js';
self.onmessage=({data})=>{
 try{let last=0;const result=snowAnalysis(data.meshes,data.input,p=>{if(performance.now()-last>80||p.completed===p.total){last=performance.now();self.postMessage({type:'progress',...p});}});self.postMessage({type:'done',result});}
 catch(e){self.postMessage({type:'error',message:e.message||'Snow deposition could not complete.'});}
};
