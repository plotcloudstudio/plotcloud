// Private, revocable testing grants. These do not create a paid membership or unlock resources.
const KEY='pc-simulation-test-code-v1';
let grant=null,checked=0,inflight=null,epoch=0;
const clean=v=>String(v||'').replace(/\s+/g,'').toUpperCase();
const saved=()=>{try{return localStorage.getItem(KEY)||'';}catch{return '';}};
export const testingStatus=()=>({active:!!grant&&Date.parse(grant.startsAt)<=Date.now()&&Date.now()<Date.parse(grant.expiresAt),expiresAt:grant?.expiresAt||null});
export const allowsTestingStudy=id=>testingStatus().active&&!id.startsWith('resource:')&&grant.features.includes(id);
export function matchingTestingGrant(ledger,digest,now=Date.now()){
 if(ledger?.schema!==1||!Array.isArray(ledger.grants))return null;
 return ledger.grants.find(g=>g.codeHash===digest&&g.scope==='simulations'&&!g.revokedAt&&Date.parse(g.startsAt)<=now&&now<Date.parse(g.expiresAt)&&Array.isArray(g.features)&&g.features.length>0&&g.features.every(id=>/^[a-z][a-z0-9]*$/.test(id)))||null;
}
export async function checkTestingAccess({force=false,code=saved()}={}){
 code=clean(code);if(!/^PCSIM-[A-F0-9]{48}$/.test(code)){epoch++;grant=null;return testingStatus();}
 if(!force&&inflight)return inflight;if(!force&&Date.now()-checked<15000)return testingStatus();const revision=++epoch;
 const task=(async()=>{try{const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code)),digest=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');const url=new URL('../simulation-test-ledger.json',import.meta.url);url.searchParams.set('v',String(Date.now()));const response=await fetch(url,{cache:'no-store',credentials:'same-origin'});if(!response.ok)throw Error('Testing access unavailable');const found=matchingTestingGrant(await response.json(),digest);if(revision===epoch)grant=found;}catch{if(revision===epoch)grant=null;}if(revision===epoch)checked=Date.now();return testingStatus();})();inflight=task;try{return await task;}finally{if(inflight===task)inflight=null;}
}
export async function activateTestingCode(value){const code=clean(value),result=await checkTestingAccess({force:true,code});if(!result.active)throw Error('This testing code is invalid, expired, revoked or could not be verified.');try{localStorage.setItem(KEY,code);}catch{grant=null;throw Error('Browser storage is required to keep testing access.');}dispatchEvent(new CustomEvent('pc-simulation-test'));return result;}
export function clearTestingCode(){epoch++;grant=null;checked=0;try{localStorage.removeItem(KEY);}catch{}dispatchEvent(new CustomEvent('pc-simulation-test'));}
const date=v=>new Date(v).toLocaleString('en-CA',{dateStyle:'medium',timeStyle:'short'});
export function mountTestingAccess(host,{onSuccess=()=>location.reload()}={}){
 if(testingStatus().active){host.innerHTML='<p role="status"><b>Private simulation testing active.</b> Ends '+date(grant.expiresAt)+'. This is not a paid membership.</p><button type="button" class="btn sm">End testing on this browser</button>';host.querySelector('button').onclick=()=>{clearTestingCode();onSuccess();};return;}
 host.innerHTML='<details><summary>Have a private simulation testing code?</summary><p class="note">Testing codes unlock the listed studies for a limited period. They do not grant administrator access or a paid membership.</p><form style="display:grid;gap:12px;margin-top:12px"><label class="f">Simulation testing code<input name="testingCode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="PCSIM-…" required></label><button type="submit" class="btn">Activate testing access</button><p role="status" aria-live="polite"></p></form></details>';
 const form=host.querySelector('form');form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button'),message=form.querySelector('[role=status]');button.disabled=true;try{await activateTestingCode(new FormData(form).get('testingCode'));onSuccess();}catch(error){message.textContent=error.message;}finally{button.disabled=false;}};
}
if(typeof window!=='undefined')addEventListener('storage',e=>{if(e.key===KEY||e.key===null){grant=null;checked=0;checkTestingAccess({force:true});}});
