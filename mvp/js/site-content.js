import * as Cloud from './cloud.js';
import {hospitalResearchPost} from '../research/hospital-evacuation-article.js';
import {fallingwaterModelPost} from '../research/fallingwater-model-article.js';
import {evacuationAccuracyPost} from '../research/fire-evacuation-article.js';
import {simulationReports} from '../research/simulation-reports.js';
// the Blog holds research notes only (2026-11-17): the hospital methods note is superseded by the accuracy article and no longer listed
// one method and data report per simulation (2026-11-21), built from mvp/research/reports/*.md by tools/build-simulation-reports.py
export const researchPosts=[fallingwaterModelPost,evacuationAccuracyPost,...simulationReports];
void hospitalResearchPost;

// Blog posts (2026-11-17): research notes and offline events. New posts are a research note, an event (talk, workshop, exhibition)
// or a campus visit; product updates and studio notes still read but are no longer offered in the editor
export const categories={research:'Research',event:'Event',campus:'Campus visit',release:'Product updates',studio:'Studio notes'};
export const blogKinds={research:'Research',events:'Events'};
export const isEventPost=(p)=>['event','campus'].includes(p?.content?.category);
export const isResearchPost=(p)=>p?.content?.format==='article'||p?.content?.category==='research';
export const upcoming=(p)=>isEventPost(p)&&/^\d{4}-\d{2}-\d{2}$/.test(p.content.eventDate||'')&&p.content.eventDate>=new Date().toISOString().slice(0,10);
// The About page's founders, testimonials and client logos (2026-11-17) start as labelled samples: every sample item carries
// sample:true and is shown with a "Sample" tag until the founder replaces it in the Founder workspace (#/founder › About & team).
// The first card is the founder's own, to be completed with their name, role and LinkedIn there. Nothing here is a real claim.
export const aboutDefault={headline:'Understand the building.\nImprove the next decision.',intro:'SimuSite is a browser workspace for architects and architecture students exploring building performance in early design.',storyTitle:'Keep your existing workflow',story:'Use supported imports and exports alongside your CAD and modelling tools. SimuSite supports design exploration; study methods and limitations remain part of the result.',teamIntro:'',
 team:[{name:'Founder · name to be added',role:'Founder',bio:'This card is for the founder: name, role, a short biography and a LinkedIn link are entered in the Founder workspace.',photo:'',linkedin:'',sample:true},{name:'Sample co-founder',role:'Sample role · e.g. Simulation lead',bio:'Sample text. A short biography of two or three sentences goes here.',photo:'',linkedin:'',sample:true},{name:'Sample co-founder',role:'Sample role · e.g. Product and design',bio:'Sample text. Replace with the real person, or remove the card.',photo:'',linkedin:'',sample:true}],
 testimonials:[{quote:'Sample quote. What a client or a studio said about working with SimuSite goes here.',name:'Sample name',role:'Sample role',org:'Sample studio',sample:true},{quote:'Sample quote. Keep each one to two or three sentences, with the person\'s permission.',name:'Sample name',role:'Sample role',org:'Sample university',sample:true},{quote:'Sample quote. A third voice, or remove this card.',name:'Sample name',role:'Sample role',org:'Sample practice',sample:true}],
 clients:[{name:'Sample client',logo:'',url:'',sample:true},{name:'Sample studio',logo:'',url:'',sample:true},{name:'Sample university',logo:'',url:'',sample:true},{name:'Sample practice',logo:'',url:'',sample:true},{name:'Sample developer',logo:'',url:'',sample:true},{name:'Sample partner',logo:'',url:'',sample:true}]};
export const initialPosts=[];   // the two studio notes were retired (2026-11-17): the Blog holds research only
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
  return `<article class="sd-article" id="${escapeText(post.id)}"><header class="sd-head"><div class="sd-journal"><b>${escapeText(c.journal||'SimuSite Research Notes')}</b>${c.journalNote?`<span>${escapeText(c.journalNote)}</span>`:''}</div>
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
  const image=safeImage(c.image),meta=[upcoming(post)?'Upcoming':'',c.format==='article'?(c.articleType||'Research article'):(categories[c.category]||categories.studio),c.university,c.location,c.eventDate,c.version&&'Version '+c.version].filter(Boolean);
  return `<article class="card public-article${detail?' cms-post-detail':''}${image?'':' cms-post-no-image'}" id="${escapeText(post.id)}">${image?`<img src="${escapeText(image)}" alt="${escapeText(c.imageAlt||c.title)}" loading="lazy">`:''}<div><span class="eyebrow">${meta.map(escapeText).join(' · ')}</span><h2>${escapeText(c.title)}</h2>${post.publishedAt?`<p class="note">Published ${escapeText(new Date(post.publishedAt).toLocaleDateString('en-CA',{dateStyle:'medium'}))}</p>`:''}${detail?bodyHTML(c.body):`<p>${escapeText(c.summary||String(c.body||'').slice(0,220))}</p><a href="#/blog/${encodeURIComponent(post.id)}">Read story →</a>`}</div></article>`;
}
const sampleTag=(o)=>o&&o.sample?'<span class="sample-tag" title="Sample content, not a real person, quote or client">Sample</span>':'';
const sampleNote=(list,what)=>list.some(o=>o&&o.sample)?`<p class="note sample-note">Sample content until real ${what} are entered; nothing here is a claim.</p>`:'';
const httpsOnly=(u)=>{try{const x=new URL(String(u||''));return x.protocol==='https:'?x.href:'';}catch{return '';}};
const initials=(name)=>String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('')||'·';
export function teamHTML(about){
  const team=Array.isArray(about.team)?about.team:[];if(!team.length)return '';
  return `<section class="cms-team about-team"><div class="about-sechead"><span class="eyebrow">The people behind SimuSite</span><h2>Founders.</h2></div>${about.teamIntro?'<p>'+escapeText(about.teamIntro)+'</p>':''}${sampleNote(team,'names')}<div class="cms-team-grid">${team.map(p=>{const li=httpsOnly(p.linkedin);return `<article class="card${p.sample?' is-sample':''}">${sampleTag(p)}${safeImage(p.photo)?`<img src="${escapeText(safeImage(p.photo))}" alt="${escapeText(p.name)}" loading="lazy">`:`<span class="about-initials" aria-hidden="true">${escapeText(initials(p.name))}</span>`}<h3>${escapeText(p.name)}</h3><span class="eyebrow">${escapeText(p.role)}</span>${bodyHTML(p.bio)}${li?`<a class="about-linkedin" href="${escapeText(li)}" target="_blank" rel="noopener">LinkedIn ↗</a>`:p.sample?'<span class="about-linkedin is-empty">LinkedIn: add in the editor</span>':''}</article>`;}).join('')}</div></section>`;
}
export function testimonialsHTML(about){
  const list=Array.isArray(about.testimonials)?about.testimonials:[];if(!list.length)return '';
  return `<section class="about-quotes"><div class="about-sechead"><span class="eyebrow">What people say</span><h2>In their words.</h2></div>${sampleNote(list,'quotes')}<div class="about-quotegrid">${list.map(t=>`<figure class="about-quote${t.sample?' is-sample':''}">${sampleTag(t)}<blockquote>${escapeText(t.quote)}</blockquote><figcaption><b>${escapeText(t.name)}</b>${t.role||t.org?`<span>${escapeText([t.role,t.org].filter(Boolean).join(' · '))}</span>`:''}</figcaption></figure>`).join('')}</div></section>`;
}
export function clientsHTML(about){
  const list=Array.isArray(about.clients)?about.clients:[];if(!list.length)return '';
  const box=(c)=>{const logo=safeImage(c.logo),inner=logo?`<img src="${escapeText(logo)}" alt="${escapeText(c.name)}" loading="lazy">`:`<span>${escapeText(c.name)}</span>`,url=httpsOnly(c.url);return `<li class="${c.sample?'is-sample':''}">${sampleTag(c)}${url?`<a href="${escapeText(url)}" target="_blank" rel="noopener">${inner}</a>`:inner}</li>`;};
  return `<section class="about-clients"><div class="about-sechead"><span class="eyebrow">Working with</span><h2>Studios, schools and partners.</h2></div>${sampleNote(list,'names and logos')}<ul class="about-logos">${list.map(box).join('')}</ul></section>`;
}
export const aboutExtrasHTML=(about)=>teamHTML(about)+testimonialsHTML(about)+clientsHTML(about);
// Resources published from the Founder workspace (2026-11-17): papers, tutorials and news; a card each, a page each
export const resourceTypes={paper:'Papers',tutorial:'Tutorials',news:'News',library:'Library files'};
// the resource library's categories (2026-11-17), the same as the early catalogue's
export const libraryCategories=[['portfolio','Portfolio & Job Application'],['cad','CAD Resources'],['rhino','Rhino Resources'],['revit','Revit Resources'],['gh','Grasshopper & Parametric'],['models','3D & Case Study Models'],['diagrams','Diagrams & Graphics'],['site','Site & Urban Design'],['pres','Presentation Templates']];
const libCat=(k)=>(libraryCategories.find((c)=>c[0]===k)||[k,'Library'])[1];
export const isLibrary=(d)=>d?.content?.type==='library';
const formatsOf=(c)=>String(c.formats||'').split(/[\s,;\/]+/).map((f)=>f.replace(/^\./,'').trim()).filter(Boolean).slice(0,8);
const accessTag=(c)=>c.access==='members'?'<span class="lib-tag lib-members">Members</span>':'<span class="lib-tag lib-free">Free</span>';
// a library file's card, in the early library's style; its page decides how the file is reached (free link, or members' signed link)
export function libraryCardHTML(item){const c=item.content||{},img=safeImage(c.image),f=formatsOf(c);
  return `<a class="resource-card lib-card" href="#/resources/pub/${escapeText(item.id)}" data-lib-category="${escapeText(c.category||'')}"><figure>${img?`<img src="${escapeText(img)}" alt="" loading="lazy">`:`<span class="lib-ph">${escapeText((f[0]||'file').toUpperCase())}</span>`}</figure><span class="eyebrow">${escapeText(libCat(c.category))}</span><h3>${escapeText(c.title)}</h3><p>${f.map((x)=>'.'+escapeText(x)).join(' · ')}${c.size?' · '+escapeText(c.size):''}</p>${accessTag(c)}</a>`;}
function libraryPageHTML(item){const c=item.content||{},img=safeImage(c.image),f=formatsOf(c),free=c.access!=='members',file=free?https(c.file):'';
  return `<article class="res-page lib-page"><a class="text-link" href="#/resources#library">← Resource library</a><span class="eyebrow">${escapeText(libCat(c.category))}</span><h1 class="display md">${escapeText(c.title)}</h1><p class="lede">${escapeText(c.summary)}</p>
  <dl class="lib-facts"><dt>File types</dt><dd>${f.length?f.map((x)=>'.'+escapeText(x)).join(' · '):'Not specified'}</dd><dt>Compatibility</dt><dd>${escapeText(c.compatibility||'Not specified')}</dd><dt>Size</dt><dd>${escapeText(c.size||'Not specified')}</dd><dt>License</dt><dd>${escapeText(c.license||'Not specified')}</dd><dt>Access</dt><dd>${free?'Free to download':'Members with active monthly, yearly or permanent access'}</dd></dl>
  <p class="res-actions" id="libAction" data-access="${free?'free':'members'}" data-file="${escapeText(free?'':String(c.file||''))}">${free?(file?`<a class="btn accent" href="${escapeText(file)}" target="_blank" rel="noopener">Download ↗</a>`:'<span class="note">The file is not attached yet.</span>'):'<span class="note">Members only: checking your access…</span>'}</p>
  ${img?`<figure class="article-fig"><img src="${escapeText(img)}" alt="${escapeText(c.imageAlt||'')}" loading="lazy"></figure>`:''}<div class="res-body">${bodyHTML(c.body)}</div>${item.publishedAt?`<p class="note">Published ${escapeText(String(item.publishedAt).slice(0,10))}.</p>`:''}</article>`;}
export function videoEmbed(url){
  let u;try{u=new URL(String(url||''));}catch{return '';}
  if(u.protocol!=='https:')return '';
  const host=u.hostname.replace(/^www\./,'');let src='';
  if(host==='youtu.be')src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(u.pathname.slice(1).split('/')[0]);
  else if(host==='youtube.com'||host==='youtube-nocookie.com'){const id=u.searchParams.get('v')||(u.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)||[])[1];if(id)src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id);}
  else if(host==='bilibili.com'||host==='player.bilibili.com'){const bv=(u.pathname.match(/\/(BV[0-9A-Za-z]+)/)||[])[1]||u.searchParams.get('bvid');if(bv)src='https://player.bilibili.com/player.html?bvid='+encodeURIComponent(bv)+'&autoplay=0';}
  else if(host==='vimeo.com'||host==='player.vimeo.com'){const id=(u.pathname.match(/\/(\d+)/)||[])[1];if(id)src='https://player.vimeo.com/video/'+encodeURIComponent(id);}
  return src?`<div class="res-video"><iframe src="${escapeText(src)}" title="Video" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture"></iframe></div>`:'';
}
const https=(u)=>{try{const x=new URL(String(u||''));return x.protocol==='https:'?x.href:'';}catch{return '';}};
export function resourceCardHTML(item){
  if(isLibrary(item))return libraryCardHTML(item);
  const c=item.content||{},type=resourceTypes[c.type]?c.type:'paper',meta=[c.authors,c.date].filter(Boolean).map(escapeText).join(' · '),img=safeImage(c.image);
  return `<a class="sim-res res-card" href="#/resources/pub/${escapeText(item.id)}"><span class="eyebrow">${escapeText(resourceTypes[type].replace(/s$/,''))}${meta?' · '+meta:''}</span>${img?`<img class="res-cover" src="${escapeText(img)}" alt="" loading="lazy">`:''}<h3>${escapeText(c.title)}</h3><p>${escapeText(c.summary)}</p><span class="sim-res-cta">${type==='tutorial'&&c.video?'Watch':type==='paper'&&(c.file||c.link)?'Read the paper':'Read'} →</span></a>`;
}
export function resourcePageHTML(item){
  if(isLibrary(item))return libraryPageHTML(item);
  const c=item.content||{},type=resourceTypes[c.type]?c.type:'paper',file=https(c.file),link=https(c.link),img=safeImage(c.image);
  const acts=[file?`<a class="btn accent" href="${escapeText(file)}" target="_blank" rel="noopener">${type==='paper'?'Open the PDF':'Download the file'} ↗</a>`:'',link?`<a class="btn" href="${escapeText(link)}" target="_blank" rel="noopener">${type==='paper'?'Publisher\u2019s page':'Open the link'} ↗</a>`:''].join(' ');
  return `<article class="res-page"><a class="text-link" href="#/resources">← Resources</a><span class="eyebrow">${escapeText(resourceTypes[type].replace(/s$/,''))}${c.date?' · '+escapeText(c.date):''}</span><h1 class="display md">${escapeText(c.title)}</h1>${c.authors?`<p class="res-authors">${escapeText(c.authors)}</p>`:''}<p class="lede">${escapeText(c.summary)}</p>${acts?`<p class="res-actions">${acts}</p>`:''}${videoEmbed(c.video)}${img&&!c.video?`<figure class="article-fig"><img src="${escapeText(img)}" alt="${escapeText(c.imageAlt||'')}" loading="lazy"></figure>`:''}<div class="res-body">${bodyHTML(c.body)}</div>${item.publishedAt?`<p class="note">Published ${escapeText(String(item.publishedAt).slice(0,10))}.</p>`:''}</article>`;
}
export const publishedResources=(published)=>(published||[]).filter(d=>d.kind==='resource'&&d.content).sort((a,b)=>String(b.content.date||b.publishedAt||'').localeCompare(String(a.content.date||a.publishedAt||'')));
export async function publishedContent(){
  if(!Cloud.configured())return null;
  try{const result=await Cloud.publicRpc('pc_public_site_content');if(!Array.isArray(result))throw Error('Invalid content response.');return result;}catch{return null;}
}
export async function editContent(action,args={}){
  return Cloud.rpc('pc_site_edit',{p_action:action,...args});
}

// The whole About page from its content (2026-11-17): the public page and the founder editor's live preview both use this, so
// what the editor shows is what visitors see
export function aboutPageHTML(content){
  const about={...aboutDefault,...(content||{})},L=String(about.headline||'').split('\n'),headline=escapeText(L[0])+(L.length>1?'<br><span>'+L.slice(1).map(escapeText).join('<br>')+'</span>':'');
  const P=[['Start from the deliverable','We work back from the drawing, the figure or the report you have to hand in, and keep only the steps that get you there.'],['Keep your tools','CAD, Rhino and Revit stay where they are. SimuSite reads your model so you do not redraw it, re-enter settings or re-lay out sheets.'],['Say what a number is','Every result says whether it matches a reference tool, is verified against known answers, or is a screening estimate.'],['Compare on the same baseline','Two options are only compared when the site, the weather and the study settings are the same, and the page says so.'],['Keep the history','Each result belongs to the model version it ran on. Changing the design never overwrites the evidence behind an earlier decision.'],['Pictures are not proof','A rendering shows a space; it does not test it. Light, air, sound and movement are computed, and labelled as such.']];
  const C=[['Sun hours','Matches Ladybug Direct Sun Hours on the same inputs, point for point.','Reference check'],['Daylight factor','Within tolerance of Radiance (CIE overcast sky) at every test point.','Reference check'],['Fire evacuation','Passes 18 verification tests after IMO MSC.1/Circ.1533.','Verification'],['Everything else','Screening estimates for comparing options, and labelled that way on every result.','Labelled']];
  return `<div class="wrap about-page">
  <header class="about-hero"><div class="page-head"><span class="eyebrow">About SimuSite</span><h1 class="display md">${headline}</h1><p class="lede">${escapeText(about.intro)}</p></div>
    <aside class="about-glance" aria-label="At a glance"><span class="eyebrow">At a glance</span><ul><li><b>One model</b> for site, plan, simulation and the report</li><li><b>Sun, wind, daylight, people, water</b> and more, computed in your browser</li><li><b>Every result</b> tied to the model version it ran on</li><li><b>Checked</b> against Ladybug and Radiance where a reference exists</li></ul></aside></header>
  <section class="about-pair"><article class="about-block"><span class="eyebrow">The problem</span><h2>Performance questions arrive after the design is fixed.</h2><p>Sun, daylight and wind are usually checked late, by someone else, in another tool. The model is rebuilt, the settings typed in again, the figures laid out by hand, and by then the plan has moved on.</p></article>
    <article class="about-block"><span class="eyebrow">Our approach</span><h2>Ask the question on the model you already have.</h2><p>Bring your design in, run the study on a saved version, change one thing and compare. The figures, the method and the limits travel together into the report.</p><a href="#/simulations">See the studies →</a></article></section>
  <section class="about-beliefs"><div class="about-sechead"><span class="eyebrow">What we believe</span><h2>Six rules we design by.</h2></div><ol>${P.map(([h,t],i)=>`<li><span>0${i+1}</span><div><h3>${h}</h3><p>${t}</p></div></li>`).join('')}</ol></section>
  <section class="about-checks"><div class="about-sechead"><span class="eyebrow">How we check our numbers</span><h2>Say what each result is, and how far to trust it.</h2></div><div class="about-checkgrid">${C.map(([h,t,k])=>`<div><small>${k}</small><h3>${h}</h3><p>${t}</p></div>`).join('')}</div><a class="about-checklink" href="#/blog/fire-evacuation-accuracy">Read how the fire evacuation model is verified →</a></section>
  <section id="aboutStory" class="about-story"><div class="about-sechead"><span class="eyebrow">Our story</span><h2>${escapeText(about.storyTitle)}</h2></div><div class="about-storybody">${bodyHTML(about.story)}<p class="note">Early-design screening does not establish code compliance or replace professional engineering verification.</p></div></section>${aboutExtrasHTML(about)}
  <section class="about-cta"><div><h2>Start with a question you have today.</h2><p>Sun hours and Daylight are free on every project, and every study runs free on the example projects.</p></div><div class="about-ctas"><a class="btn accent" href="#/new-project">Start a project</a><a class="btn" href="#/start-study">Try an example</a></div></section>
  </div>`;
}
