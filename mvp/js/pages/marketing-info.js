import {publishedContent,aboutDefault,initialPosts,researchPosts,categories,blogKinds,isEventPost,isResearchPost,upcoming,escapeText,bodyHTML,postHTML,aboutExtrasHTML,aboutPageHTML} from '../site-content.js';
// Public information pages. Original product notes, grounded in current workflows.
export async function renderAbout(app,rest,params,{isCurrent=()=>true}={}){
  // About (2026-11-16): the order of an architect-led company page (who we are, the problem, the approach, what we believe, how we
  // check, our story, start), in our own layout and only with things that are true; the team appears when it is entered in the
  // site content (no invented people, quotes or logos)
  app.innerHTML=aboutPageHTML(null);
  const published=await publishedContent();if(!isCurrent())return;
  app.innerHTML=aboutPageHTML(published?.find(d=>d.kind==='about')?.content||null);
}
export async function renderBlog(app,rest=[],params,{isCurrent=()=>true}={}){
  app.innerHTML='<div class="wrap"><span class="eyebrow">PlotCloud Blog</span><h1 class="display md">Research and events.<br><span>From the studio.</span></h1><p class="lede">Research notes on how the studies are built and checked, and the talks, workshops and campus visits where we show them.</p><p role="status">Loading stories…</p></div>';
  const published=await publishedContent();if(!isCurrent())return;
  const managed=published===null?initialPosts:published.filter(d=>d.kind==='blog');
  const posts=[...researchPosts.filter(p=>!managed.some(x=>x.id===p.id)),...managed];
  if(rest[0]){
    const post=posts.find(p=>p.id===rest[0]);app.innerHTML='<div class="wrap cms-blog"><a class="text-link" href="#/blog">← All stories</a>'+(post?postHTML(post,{detail:true}):'<h1>Story not found.</h1><p>This story may have been unpublished.</p>')+'</div>';return;
  }
  app.innerHTML=`<div class="wrap cms-blog"><header class="page-head"><span class="eyebrow">PlotCloud Blog</span><h1 class="display md">Research and events.<br><span>From the studio.</span></h1><p class="lede">Research notes on how the studies are built and checked, and the talks, workshops and campus visits where we show them.</p></header><nav class="cms-blog-filter" aria-label="Kinds of post">${Object.entries({all:'All',...blogKinds}).map(([id,label])=>`<button class="btn" type="button" data-blog-category="${id}" aria-pressed="${id==='all'}">${label}</button>`).join('')}</nav><div id="cmsStories"></div></div>`;
  const draw=category=>{app.querySelectorAll('[data-blog-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.blogCategory===category)));const order=(p)=>upcoming(p)?0:1,selected=posts.filter(p=>category==='all'||(category==='events'?isEventPost(p):category==='research'?isResearchPost(p):p.content.category===category)).sort((a,b)=>order(a)-order(b));app.querySelector('#cmsStories').innerHTML=selected.map(p=>postHTML(p)).join('')||`<p class="cms-empty">${category==='events'?'No events published yet. Talks, workshops and campus visits appear here.':'Nothing published here yet.'}</p>`;};
  app.querySelectorAll('[data-blog-category]').forEach(b=>b.onclick=()=>draw(b.dataset.blogCategory));draw('all');
}
