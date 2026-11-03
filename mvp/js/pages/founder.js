import * as C from '../cloud.js';
import {esc} from '../app.js';
import {aboutDefault,categories,editContent,postHTML,teamHTML,bodyHTML} from '../site-content.js';

const field=(label,name,value='',type='text',limit=300)=>`<label class="f">${label}<input name="${name}" type="${type}" value="${esc(value)}" maxlength="${limit}"></label>`;
const area=(label,name,value='',rows=4,limit=50000)=>`<label class="f">${label}<textarea name="${name}" rows="${rows}" maxlength="${limit}">${esc(value)}</textarea></label>`;
const clone=v=>JSON.parse(JSON.stringify(v));
export async function render(app,_,params,{isCurrent=()=>true}={}){
  app.innerHTML='<div class="wrap"><span class="eyebrow">Founder workspace</span><h1 class="display md">Manage PlotCloud.</h1><p role="status">Checking founder access…</p></div>';
  if(!C.user()){
    app.innerHTML='<div class="wrap"><span class="eyebrow">Founder workspace</span><h1 class="display md">Founder sign-in.</h1><p class="lede">Use your registered founder account to publish Blog and About updates, or manage user access.</p><p>Owner account: <b>plotcloud@gmail.com</b></p><a class="btn accent" href="#/login?next=founder">Log in to manage PlotCloud</a><p class="note">A paid membership does not grant administrator access.</p></div>';return;
  }
  let documents;
  try{documents=await editContent('list');}catch(e){
    if(!isCurrent())return;
    const missing=e.status===404;
    app.innerHTML=`<div class="wrap"><span class="eyebrow">Founder workspace</span><h1 class="display md">${missing?'Connect content publishing.':'Founder access required.'}</h1><p role="alert">${esc(missing?'The content database has not been initialized for this site.':e.message)}</p>${missing?'<p>Run the complete database setup as Supabase project owner, then assign the confirmed plotcloud@gmail.com website account as administrator.</p><p><a class="btn" href="../supabase/setup-plotcloud.sql" download>Download complete setup SQL</a> <a class="btn" href="../supabase/appoint-admin.sql" download>Download owner appointment SQL</a></p>':''}<p><a class="btn" href="#/admin">Account access and setup</a> <a href="#/account">Your account</a></p><p class="note">Website passwords and database secrets are never entered in this editor. Browser profile labels cannot unlock it.</p></div>`;return;
  }
  if(!isCurrent())return;
  let current=null,dirty=false,busy=false,mode=params.get('tab')==='about'?'about':'blog';
  app.innerHTML=`<div class="wrap founder-workspace"><header class="founder-heading"><div><span class="eyebrow">Founder · ${esc(C.user().email)}</span><h1 class="display md">Manage PlotCloud.</h1><p class="lede">Publish stories, introduce the team, and manage account access.</p></div><a class="btn" href="#/admin">Manage user access ↗</a></header><nav class="cms-tabs" aria-label="Founder tools"><button type="button" data-section="blog">Blog</button><button type="button" data-section="about">About & team</button><a href="#/admin">User access · Month / Year / Permanent</a></nav><div class="cms-layout"><aside class="cms-library"><div class="cms-library-head"><h2 id="cmsLibraryTitle">Blog posts</h2><button class="btn sm" type="button" id="newPost">New post +</button></div><label class="f">Find a post<input type="search" id="cmsSearch" placeholder="Title, university or version"></label><div id="cmsDocuments"></div></aside><section class="cms-editor" aria-label="Content editor"><p>Select a story or create a post.</p></section></div><dialog class="cms-preview"><button type="button" class="btn" id="closePreview">Close preview</button><div id="cmsPreviewBody"></div></dialog></div>`;
  const $=s=>app.querySelector(s),editor=$('.cms-editor'),list=$('#cmsDocuments'),search=$('#cmsSearch'),preview=$('.cms-preview');
  const say=(message,error=false)=>{const out=$('#cmsStatus');if(out){out.textContent=message;out.classList.toggle('is-error',error);}};
  const allowLeave=()=>!dirty||confirm('Leave this editor without saving the current changes?');
  const protect=event=>{if(dirty&&event.target.closest('a[href^="#/"]')&&!allowLeave()){event.preventDefault();event.stopImmediatePropagation();}};
  app.closest('#app')?.addEventListener('click',protect,true);
  const unload=event=>{if(dirty){event.preventDefault();event.returnValue='';}};addEventListener('beforeunload',unload);
  function library(){
    const q=search.value.toLowerCase();
    list.innerHTML=documents.filter(d=>d.kind===mode&&JSON.stringify(d.draft).toLowerCase().includes(q)).map(d=>`<button type="button" data-doc="${esc(d.id)}"${current?.id===d.id?' aria-current="true"':''}><b>${esc(d.kind==='about'?'About PlotCloud':d.draft.title||'Untitled post')}</b><small>${d.published?'Published':'Draft'} · revision ${d.revision}</small></button>`).join('')||'<p class="note">No saved content yet.</p>';
    list.querySelectorAll('[data-doc]').forEach(b=>b.onclick=()=>{if(!busy&&allowLeave())open(documents.find(d=>d.id===b.dataset.doc));});
  }
  const person=(p={},index=0)=>`<fieldset class="cms-person" data-person><legend>Team member ${index+1}</legend>${field('Name','personName',p.name)}${field('Role','personRole',p.role)}${area('Biography','personBio',p.bio,3,4000)}${field('Photo URL · HTTPS','personPhoto',p.photo)}<button type="button" class="btn sm" data-remove-person>Remove from this draft</button></fieldset>`;
  function read(){
    const fd=new FormData($('#cmsForm'));if(mode==='about')return{headline:fd.get('headline'),intro:fd.get('intro'),storyTitle:fd.get('storyTitle'),story:fd.get('story'),teamIntro:fd.get('teamIntro'),team:[...editor.querySelectorAll('[data-person]')].map(p=>Object.fromEntries([['name','personName'],['role','personRole'],['bio','personBio'],['photo','personPhoto']].map(([k,n])=>[k,p.querySelector(`[name="${n}"]`).value])))};
    return Object.fromEntries(['title','category','summary','body','university','location','eventDate','version','image','imageAlt'].map(k=>[k,fd.get(k)||'']));
  }
  function changed(){dirty=true;say('Unsaved changes. Save a draft or publish when ready.');}
  function bindPeople(){editor.querySelectorAll('[data-remove-person]').forEach(b=>b.onclick=()=>{b.closest('[data-person]').remove();changed();});}
  function category(){const c=editor.querySelector('[name=category]')?.value;editor.querySelectorAll('[data-category]').forEach(e=>e.hidden=e.dataset.category!==c);}
  function open(doc){
    current=doc||{id:mode==='about'?'about':'post-'+crypto.randomUUID(),kind:mode,draft:mode==='about'?clone(aboutDefault):{title:'',category:'campus',summary:'',body:'',university:'',location:'',eventDate:'',version:'',image:'',imageAlt:''},revision:0,published:null};dirty=false;
    const c=current.draft;
    editor.innerHTML=`<form id="cmsForm"><header class="cms-editor-head"><h2>${mode==='about'?'About & team':current.revision?'Edit blog post':'New blog post'}</h2><p class="note" id="cmsRevision">${current.published?'Public version is live. Draft edits stay private until published.':'Draft · visible only to founders.'} Revision ${current.revision}</p></header>${mode==='about'?area('Headline','headline',c.headline,2,250)+area('Introduction','intro',c.intro,4,3000)+field('Story heading','storyTitle',c.storyTitle)+area('Our story','story',c.story,6,20000)+area('Team introduction','teamIntro',c.teamIntro,3,3000)+`<div id="cmsPeople">${(c.team||[]).map(person).join('')}</div><button class="btn" type="button" id="addPerson">Add team member +</button>`:field('Title','title',c.title,'text',180)+`<label class="f">Category<select name="category">${Object.entries(categories).map(([k,n])=>`<option value="${k}"${c.category===k?' selected':''}>${n}</option>`).join('')}</select></label><div class="cms-field-pair" data-category="campus">${field('University','university',c.university)}${field('Visit date','eventDate',c.eventDate,'date')}${field('City / location','location',c.location)}</div><div data-category="release">${field('Version label','version',c.version,'text',80)}</div>`+area('Summary','summary',c.summary,3,600)+area('Story / release notes','body',c.body,12)+`<p class="note">Use blank lines for paragraphs, ## for a heading, and - for a list. HTML is displayed as plain text.</p>`+field('Cover image URL · HTTPS or site image path','image',c.image)+field('Describe the cover image','imageAlt',c.imageAlt)}<div class="cms-actions"><button type="submit" class="btn" id="saveDraft">Save draft</button><button type="button" class="btn" id="previewContent">Preview</button><button type="button" class="btn accent" id="publishContent">Publish</button>${mode==='blog'&&current.published?'<button type="button" class="btn" id="unpublishContent">Unpublish</button>':''}${current.revision?'<button type="button" class="btn" id="contentHistory">History</button>':''}</div><p id="cmsStatus" class="note" role="status" aria-live="polite">${current.revision?'Saved in the founder database.':'Not saved yet.'}</p><div id="cmsHistory"></div></form>`;
    $('#cmsForm').oninput=changed;$('#cmsForm').onchange=changed;$('#cmsForm').onsubmit=async e=>{e.preventDefault();await operation('save');};
    editor.querySelector('[name=category]')?.addEventListener('change',category);category();
    $('#addPerson')?.addEventListener('click',()=>{if(editor.querySelectorAll('[data-person]').length>=30){say('Maximum 30 team members.',true);return;}$('#cmsPeople').insertAdjacentHTML('beforeend',person({},editor.querySelectorAll('[data-person]').length));bindPeople();changed();});bindPeople();
    $('#previewContent').onclick=()=>{const payload=read();$('#cmsPreviewBody').innerHTML=mode==='about'?`<h1>${esc(payload.headline).replace(/\n/g,'<br>')}</h1><p class="lede">${esc(payload.intro)}</p><h2>${esc(payload.storyTitle)}</h2>${bodyHTML(payload.story)}${teamHTML(payload)}`:postHTML({id:current.id,content:payload},{detail:true});if(preview.showModal)preview.showModal();else preview.setAttribute('open','');};
    $('#publishContent').onclick=()=>operation('publish');$('#unpublishContent')?.addEventListener('click',()=>{if(confirm('Remove this story from the public Blog? Its draft and history will be kept.'))operation('unpublish');});
    $('#contentHistory')?.addEventListener('click',async()=>{try{const history=await editContent('history',{p_id:current.id});$('#cmsHistory').innerHTML='<h3>Revision history</h3>'+history.map((h,i)=>`<div class="cms-history-row"><span>Revision ${h.revision} · ${esc(h.action)} · ${esc(new Date(h.created_at).toLocaleString())}</span><button class="btn sm" type="button" data-restore="${i}">Restore as draft</button></div>`).join('');$('#cmsHistory').querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{if(allowLeave()){const restored=history[+b.dataset.restore].snapshot.draft;open({...current,draft:clone(restored)});changed();say('Restored in the editor. Save a draft to keep it; publish separately.');}});}catch(e){say(e.message,true);}});
    library();
  }
  async function operation(action){
    if(busy)return;const payload=read();busy=true;const uid=C.user()?.id;
    const controls=[...editor.querySelectorAll('button,input,textarea,select'),...list.querySelectorAll('button'),$('#newPost')];controls.forEach(e=>e.disabled=true);say(action==='publish'?'Publishing…':'Saving…');
    try{
      if(action==='save'||action==='publish'&&(dirty||!current.revision))current=await editContent('save',{p_id:current.id,p_kind:mode,p_payload:payload,p_expected:current.revision});
      if(action!=='save')current=await editContent(action,{p_id:current.id,p_expected:current.revision});
      if(!isCurrent()||uid!==C.user()?.id)return;
      documents=documents.filter(d=>d.id!==current.id);documents.unshift(current);dirty=false;open(current);say(action==='publish'?'Published. Visitors can now see this version.':action==='unpublish'?'Unpublished. Draft and history are kept.':'Draft saved. The public page has not changed.');
    }catch(e){if(isCurrent())say(e.message,true);}finally{busy=false;controls.forEach(e=>e.disabled=false);}
  }
  function section(value){if(busy||!allowLeave())return;mode=value;dirty=false;search.value='';$('.cms-library label').hidden=value==='about';$('#newPost').hidden=value==='about';$('#cmsLibraryTitle').textContent=value==='about'?'About page':'Blog posts';app.querySelectorAll('[data-section]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.section===value)));open(documents.find(d=>d.kind===value));}
  search.oninput=library;$('#newPost').onclick=()=>{if(!busy&&allowLeave())open(null);};app.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>section(b.dataset.section));
  $('#closePreview').onclick=()=>preview.close?preview.close():preview.removeAttribute('open');section(mode);
  return()=>{app.closest('#app')?.removeEventListener('click',protect,true);removeEventListener('beforeunload',unload);preview.close?.();};
}
