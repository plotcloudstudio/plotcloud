import {experiment} from './solver.js';
self.onmessage=({data})=>{try{self.postMessage({result:experiment(data.scene,data.scenario,(done,total)=>self.postMessage({done,total}))});}catch(e){self.postMessage({error:e.message});}};
