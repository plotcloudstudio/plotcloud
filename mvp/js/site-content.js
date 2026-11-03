import * as Cloud from './cloud.js';

export const categories={campus:'Campus visits',release:'Product updates',studio:'Studio notes'};
export const aboutDefault={headline:'Understand the building.\nImprove the next decision.',intro:'PlotCloud is a browser workspace for architects and architecture students exploring building performance in early design.',storyTitle:'Keep your existing workflow',story:'Use supported imports and exports alongside your CAD and modelling tools. PlotCloud supports design exploration; study methods and limitations remain part of the result.',teamIntro:'',team:[]};
export const initialPosts=[
  {id:'compare',kind:'blog',content:{title:'Compare a change against the same baseline',category:'studio',summary:'Keep the model version, site and study settings together when you compare design decisions.',body:'A useful comparison starts with one question: what did this design change do? Save the baseline, change one design variable and keep the site, orientation and study period consistent.\n\nIn PlotCloud, review the model version and study settings with each result. A change in weather, date or calculation settings can change the outcome too; record those differences before drawing a design conclusion.',image:'img/home/sunhours.webp',imageAlt:'Illustrative solar exposure study'}},
  {id:'illustration',kind:'blog',content:{title:'Make an interior legible with one ink',category:'studio',summary:'Use a cutaway axonometric to explain rooms, openings and furniture.',body:'A cutaway axonometric can explain rooms, openings and furniture in one view. Strong cut edges establish the plan; fine lines describe the objects inside it.\n\nOpen Workspace in Perspective, choose Illustration in Display mode and select an ink colour. Frame the model and use Export model to save the Perspective view as a PNG. The drawing communicates spatial organisation; analysis overlays provide separate performance evidence.',image:'img/home/illustration-interior.webp',imageAlt:'Blue line interior cutaway illustration'}}
];
export const escapeText=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeImage(value){
  if(!value)return '';
  try{const u=new URL(String(value),location.href);return !u.username&&!u.password&&(u.protocol==='https:'||u.origin===location.origin&&u.protocol==='http:')?u.href:'';}catch{return '';}
}
export function bodyHTML(text){
  return String(text||'').split(/\n\s*\n/).filter(Boolean).map(block=>{
    if(block.startsWith('## ')){const [head,...rest]=block.split('\n');return `<h2>${escapeText(head.slice(3))}</h2>${rest.length?'<p>'+escapeText(rest.join('\n')).replace(/\n/g,'<br>')+'</p>':''}`;}
    const lines=block.split('\n');if(lines.every(l=>l.startsWith('- ')))return '<ul>'+lines.map(l=>'<li>'+escapeText(l.slice(2))+'</li>').join('')+'</ul>';
    return '<p>'+escapeText(block).replace(/\n/g,'<br>')+'</p>';
  }).join('');
}
export function postHTML(post,{detail=false}={}){
  const c=post.content||{},image=safeImage(c.image),meta=[categories[c.category]||categories.studio,c.university,c.location,c.eventDate,c.version&&'Version '+c.version].filter(Boolean);
  return `<article class="card public-article${detail?' cms-post-detail':''}${image?'':' cms-post-no-image'}" id="${escapeText(post.id)}">${image?`<img src="${escapeText(image)}" alt="${escapeText(c.imageAlt||c.title)}" loading="lazy">`:''}<div><span class="eyebrow">${meta.map(escapeText).join(' · ')}</span><h2>${escapeText(c.title)}</h2>${post.publishedAt?`<p class="note">Published ${escapeText(new Date(post.publishedAt).toLocaleDateString('en-CA',{dateStyle:'medium'}))}</p>`:''}${detail?bodyHTML(c.body):`<p>${escapeText(c.summary||String(c.body||'').slice(0,220))}</p><a href="#/blog/${encodeURIComponent(post.id)}">Read story →</a>`}</div></article>`;
}
export function teamHTML(about){
  const team=Array.isArray(about.team)?about.team:[];if(!team.length)return '';
  return `<section class="cms-team"><span class="eyebrow">The people behind PlotCloud</span><h2>Meet the team.</h2>${about.teamIntro?'<p>'+escapeText(about.teamIntro)+'</p>':''}<div class="cms-team-grid">${team.map(p=>`<article class="card">${safeImage(p.photo)?`<img src="${escapeText(safeImage(p.photo))}" alt="${escapeText(p.name)}" loading="lazy">`:''}<h3>${escapeText(p.name)}</h3><span class="eyebrow">${escapeText(p.role)}</span>${bodyHTML(p.bio)}</article>`).join('')}</div></section>`;
}
export async function publishedContent(){
  if(!Cloud.configured())return null;
  try{const result=await Cloud.publicRpc('pc_public_site_content');if(!Array.isArray(result))throw Error('Invalid content response.');return result;}catch{return null;}
}
export async function editContent(action,args={}){
  return Cloud.rpc('pc_site_edit',{p_action:action,...args});
}
