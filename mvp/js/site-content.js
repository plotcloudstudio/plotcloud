import * as Cloud from './cloud.js';
import {hospitalResearchPost} from '../research/hospital-evacuation-article.js';
import {evacuationAccuracyPost} from '../research/fire-evacuation-article.js';
export const researchPosts=[evacuationAccuracyPost,hospitalResearchPost];

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
export function bodyHTML(text,{refs=null}={}){
  const cites=t=>refs?t.replace(/\[(\d+(?:\s*[–,-]\s*\d+)*)\]/g,(m,n)=>{const first=refs[(+String(n).match(/\d+/)[0])-1];return `<span class="cite" title="${first?escapeText(first.replace(/\[([^\]]+)\]\([^)]+\)/g,'$1')):''}">[${n}]</span>`;}):t;
  const esc2=t=>cites(escapeText(t));
  const inline=value=>{let out='',at=0;for(const m of String(value).matchAll(/\[([^\]\n]+)\]\(([^\s)]+)\)/g)){out+=esc2(String(value).slice(at,m.index));let url='';try{const u=new URL(m[2],location.href);if(!u.username&&!u.password&&(u.protocol==='https:'||u.origin===location.origin&&u.protocol==='http:'))url=u.href;}catch{}out+=url?`<a href="${escapeText(url)}">${escapeText(m[1])}</a>`:escapeText(m[0]);at=m.index+m[0].length;}return out+esc2(String(value).slice(at));};
  return String(text||'').split(/\n\s*\n/).filter(Boolean).map(block=>{
    if(block.startsWith('## ')){const [head,...rest]=block.split('\n');return `<h2>${inline(head.slice(3))}</h2>${rest.length?'<p>'+inline(rest.join('\n')).replace(/\n/g,'<br>')+'</p>':''}`;}
    if(block.startsWith('### ')){const [head,...rest]=block.split('\n');return `<h3>${inline(head.slice(4))}</h3>${rest.length?'<p>'+inline(rest.join('\n')).replace(/\n/g,'<br>')+'</p>':''}`;}
    {const rows=block.split('\n');if(rows.length>1&&rows.every(l=>l.trim().startsWith('|'))){const cells=l=>l.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim()),body=rows.filter((l,i)=>i&&!/^\|?[\s:|-]+\|?$/.test(l.trim()));return '<div class="article-table"><table><thead><tr>'+cells(rows[0]).map(c=>'<th>'+inline(c)+'</th>').join('')+'</tr></thead><tbody>'+body.map(l=>'<tr>'+cells(l).map(c=>'<td>'+inline(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}}
    {const fm=block.match(/^!\[([^\]]*)\]\(([^\s)]+)\)$/);if(fm){const src=safeImage(fm[2]),cap=fm[1].match(/^(Fig\. \d+\.)\s*(.*)$/);return src?`<figure class="article-fig"><img src="${escapeText(src)}" alt="${escapeText(fm[1])}" loading="lazy"><figcaption>${cap?`<b>${escapeText(cap[1])}</b> ${inline(cap[2])}`:inline(fm[1])}</figcaption></figure>`:'';}}
    if(/^Table \d+\. /.test(block)){const m=block.match(/^(Table \d+\.)\s*([\s\S]*)$/);return `<p class="article-tcap"><b>${escapeText(m[1])}</b> ${inline(m[2])}</p>`;}
    {const lines=block.split('\n');if(lines.every(l=>/^\d+\. /.test(l)))return '<ol>'+lines.map(l=>'<li>'+inline(l.replace(/^\d+\. /,''))+'</li>').join('')+'</ol>';}
    const lines=block.split('\n');if(lines.every(l=>l.startsWith('- ')))return '<ul>'+lines.map(l=>'<li>'+inline(l.slice(2))+'</li>').join('')+'</ul>';
    return '<p>'+inline(block).replace(/\n/g,'<br>')+'</p>';
  }).join('');
}
// a research article laid out like a journal article on ScienceDirect (2026-11-10): the journal line, title, authors and
// affiliations, article information and keywords, highlights, abstract, numbered sections with captioned tables and figures,
// the declarations and a numbered reference list; citations [n] show the reference on hover
export function articleHTML(post){
  const c=post.content||{},refs=c.references||[],b=t=>bodyHTML(t,{refs}),img=safeImage(c.image);
  const authors=(c.authors||[]).map(a=>`<span>${escapeText(a.name)}${a.aff?`<sup>${escapeText(a.aff)}</sup>`:''}</span>`).join(', ');
  return `<article class="sd-article" id="${escapeText(post.id)}"><header class="sd-head"><div class="sd-journal"><b>${escapeText(c.journal||'PlotCloud Research Notes')}</b>${c.journalNote?`<span>${escapeText(c.journalNote)}</span>`:''}</div>
  <p class="sd-type">${escapeText(c.articleType||'Research article')}</p><h1 class="sd-title">${escapeText(c.title)}</h1><p class="sd-authors">${authors}</p>
  <div class="sd-affs">${(c.affiliations||[]).map(a=>`<p><sup>${escapeText(a.key)}</sup> ${escapeText(a.text)}</p>`).join('')}</div></header>
  <div class="sd-front"><aside class="sd-info"><h2>Article info</h2><h3>Article history</h3>${(c.history||[]).map(h=>`<p>${escapeText(h)}</p>`).join('')}<h3>Keywords</h3>${(c.keywords||[]).map(k=>`<p>${escapeText(k)}</p>`).join('')}</aside>
  <div class="sd-abs"><section class="sd-highlights"><h2>Highlights</h2><ul>${(c.highlights||[]).map(h=>`<li>${escapeText(h)}</li>`).join('')}</ul></section>${img?`<section class="sd-ga"><h2>Graphical abstract</h2><img src="${escapeText(img)}" alt="${escapeText(c.imageAlt||'')}" loading="lazy"></section>`:''}<section><h2>Abstract</h2>${b(c.abstract||'')}</section></div></div>
  <div class="sd-body">${b(c.body||'')}</div>
  <div class="sd-back">${(c.backmatter||[]).map(x=>`<section><h2>${escapeText(x.title)}</h2>${b(x.text)}</section>`).join('')}
  <section class="sd-refs"><h2>References</h2><ol>${refs.map((r,i)=>`<li id="${escapeText(post.id)}-ref-${i+1}">${bodyHTML(r).replace(/^<p>|<\/p>$/g,'')}</li>`).join('')}</ol></section></div></article>`;
}
export function postHTML(post,{detail=false}={}){
  const c=post.content||{};if(detail&&c.format==='article')return articleHTML(post);
  const image=safeImage(c.image),meta=[categories[c.category]||categories.studio,c.university,c.location,c.eventDate,c.version&&'Version '+c.version].filter(Boolean);
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
