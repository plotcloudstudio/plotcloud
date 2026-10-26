// Compare recorded evidence without attributing cause to model edits or trusting timestamps as inputs.
export function stableValue(value){
 if(value===undefined)return null;if(Array.isArray(value))return value.map(stableValue);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stableValue(value[k])]));return value;
}
export const evidenceText=v=>v===undefined?'Not recorded':typeof v==='object'?JSON.stringify(stableValue(v)):String(v);
function inputs(settings={}){
 const out={...settings};delete out.provenance;delete out.inheritedFrom;
 if(settings.provenance)out['Engine and host context']={engine:settings.provenance.engine,release:settings.provenance.engineRelease,site:settings.provenance.site};
 if(settings.sharedConditions){const c=settings.sharedConditions;let signature=c.signature;try{signature=JSON.parse(signature);}catch{}out.sharedConditions={signature,effective:c.effective,studyOnlyOverrides:c.studyOnlyOverrides};}
 return out;
}
export function compareEvidence(a,b){
 if(!a||!b)return{status:'missing',label:'A matching run is missing',differences:[]};
 if(!['full-tool','batch'].includes(a.source)||!['full-tool','batch'].includes(b.source))return{status:'unverified',label:'Stored previews are not engine evidence',differences:[]};
 const left=inputs(a.settings),right=inputs(b.settings),differences=[...new Set([...Object.keys(left),...Object.keys(right)])].filter(k=>JSON.stringify(stableValue(left[k]))!==JSON.stringify(stableValue(right[k]))).map(key=>({key,a:left[key],b:right[key]}));
 if(differences.length)return{status:'different',label:'Recorded inputs differ — review before comparing',differences};
 if(!Object.keys(left).length)return{status:'unknown',label:'Input conditions were not recorded',differences:[]};
 return{status:'match',label:'Recorded inputs match',differences:[],note:'Matching recorded inputs do not establish causation or validate the analysis. Review scope, method and any unrecorded assumptions.'};
}
