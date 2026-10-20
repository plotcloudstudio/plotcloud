/* PlotCloud public shell. Product tools, scene data and existing routes stay in index.html / emb/. */
(() => {
  'use strict';
  const link = (to, label, cls = '') => `<a href="#/${to}" data-go="${to}"${cls ? ` class="${cls}"` : ''}>${label}</a>`;
  const groups = [
    {id:'site', title:'Site & Model', text:'Understand the place and develop your design.', ids:new Set(['sitectx','atlas','tracer','furniture','facade','detaillab','lsystem','doors3d','stairs3d'])},
    {id:'analysis', title:'Analyze', text:'Study sunlight, daylight, airflow, movement and structure.', ids:new Set(['sunhours','wind','vent','structure','evac','isovist','cameras','views','daylight','spacesyntax'])},
    {id:'present', title:'Render & Present', text:'Prepare images, materials and presentation boards.', ids:new Set(['architectural-render','render','cutout','depth','lines','upscale','sky','composer','axon','studio','palette','topo'])},
    {id:'utility', title:'Utilities & References', text:'Scales, dimensions, codes and other supporting tools.', ids:new Set()}
  ];
  const describe = {
    'architectural-render':'Direct a render from a sketch, photo or model image. Requires an external rendering service.',
    sitectx:'Find an address, build the surrounding context and take the site into your design.',
    tracer:'Trace a scaled plan image, then export it or open it in Plan Studio.',
    daylight:'Explore daylight distribution, sDA, ASE and daylight factor in your rooms.',
    wind:'Screen airflow around buildings and site massing.',
    vent:'Explore airflow through rooms and openings.',
    composer:'Arrange drawings, images and captions on a presentation board.',
    render:'Prepare color masks, material references and a render pack for local rendering.',
    scale:'Convert real dimensions to drawing scale and choose a suitable sheet.',
    cutout:'Image tools for cutouts, linework, depth, upscaling and skies.'
  };
  const info = id => id === '__plan' ? {title:'Plan Studio',desc:'Draw walls, furnish rooms and send your model to an analysis tool.'} : tFind(id);
  const to = id => id === '__plan' ? 'studio' : id === 'sitectx' ? 'site' : `tool/${id}`;
  const title = id => tCap(info(id).title);
  function catalog() {
    const hidden = new Set((CMS.tools && CMS.tools.hidden) || []);
    const ids = [...new Set(TSECTIONS.flatMap(s => s[4]))].filter(id => !hidden.has(id) && !(TMETA[id] || []).includes('dev'));
    return [...ids, '__plan'].map(id => ({id, group:id==='__plan'?'site':(groups.find(g=>g.ids.has(id))||groups[3]).id}));
  }
  function state() {
    const p = new URLSearchParams(location.hash.split('?')[1] || '');
    return {group:groups.some(g=>g.id===p.get('group'))?p.get('group'):'all',query:p.get('q')||''};
  }
  const thumb = id => {
    if(id==='__plan')return '<img src="img/proto/studio.jpg" alt="Plan Studio floor plan and 3D room view" loading="lazy">';
    const preview=document.createElement('div');preview.innerHTML=tVis(id);
    preview.querySelectorAll('input,button,select,textarea,form,a').forEach(el=>el.remove());
    preview.querySelectorAll('*').forEach(el=>[...el.attributes].forEach(a=>{if(a.name.startsWith('data-')||a.name==='tabindex')el.removeAttribute(a.name)}));
    return '<div aria-hidden="true">'+preview.innerHTML+'</div>';
  };
  function card(id) {
    const x = info(id), method = TMETHOD[id];
    return `<article class="pc-tool" data-catalog-tool="${id}">
      ${`<a href="#/${to(id)}" data-go="${to(id)}" class="pc-tool-image" aria-label="Open ${esc(title(id))}">${thumb(id)}</a>`}
      <div class="pc-tool-content"><h3>${link(to(id),esc(title(id)))}</h3><p>${esc(describe[id]||x.desc)}</p>
      <div class="pc-tool-bottom">${link(to(id),'Open tool <span aria-hidden="true">↗</span>','pc-open')}
      ${method?`<details class="pc-method"><summary>Method & files</summary><p>${method.map(esc).join('<br>')}</p></details>`:''}</div></div></article>`;
  }
  function resultMarkup() {
    const {group,query} = state(), q = query.trim().toLowerCase();
    const matches = catalog().filter(x => (group==='all'||x.group===group) && (!q||(info(x.id).title+' '+info(x.id).desc+' '+(describe[x.id]||'')+' '+groups.find(g=>g.id===x.group).title+' '+(TMETHOD[x.id]||[]).join(' ')).toLowerCase().includes(q)));
    const section = (g,items) => `<section class="pc-tool-section" id="tools-${g.id}" aria-labelledby="tools-title-${g.id}"><div class="pc-section-heading"><div><h2 id="tools-title-${g.id}">${g.title}</h2><p>${g.text}</p></div><span class="pc-count">${items.length} tools</span></div><div class="pc-tool-grid">${items.map(x=>card(x.id)).join('')}</div></section>`;
    let h = `<p class="pc-result-count" role="status">${matches.length} tools${q?' matching “'+esc(query.trim())+'”':''}</p>`;
    if(!matches.length)return h+'<div class="pc-empty"><h2>No matching tools</h2><p>Try a broader search, or clear the filters.</p><button type="button" class="btn sec" data-shell-reset>Clear search & filters</button></div>';
    for(const g of groups){const items=matches.filter(x=>x.group===g.id);if(!items.length)continue;
      const body=section(g,items);
      h+=g.id==='utility'&&group==='all'&&!q?`<details class="pc-utilities"><summary>Utilities & References <span>${items.length} tools · codes, scales and dimensions</span></summary>${body}</details>`:body;
    }
    return h;
  }
  P.tools = () => {
    const s = state();
    return `<div class="pc-catalog"><section class="wrap pc-catalog-head"><div class="pc-eyebrow">Tools</div><h1>What are you working on?</h1><p>Choose a task, open a tool and bring your own model or start with an example.</p></section>
    <div class="pc-tool-controls"><div class="wrap"><label class="pc-search"><span class="sr-only">Search tools</span><input type="search" data-shell-search aria-label="Search tools" placeholder="Search daylight, floor plans, rendering…" value="${esc(s.query)}"></label>
    <div class="pc-group-tabs" role="group" aria-label="Tool categories">${[{id:'all',title:'All tools'},...groups].map(g=>`<button type="button" data-shell-group="${g.id}" aria-pressed="${s.group===g.id}">${g.title}</button>`).join('')}</div></div></div>
    <div class="wrap" data-shell-results>${resultMarkup()}</div>
    <aside class="wrap pc-catalog-help"><p>Need a reference or a resource?</p><div>${link('library','Browse resources')}${link('tool/gh-plugins','Grasshopper plugin directory')}${link('learn','Guides & support')}</div></aside></div>`;
  };
  P.home = () => `<div class="pc-home">
    <section class="wrap pc-hero" aria-labelledby="pc-hero-title"><div class="pc-hero-copy"><p class="pc-eyebrow">Architecture, in your browser</p><h1 id="pc-hero-title">Design.<br> Analyze.<br> Present.</h1><p class="pc-hero-description">Tools for architects and architecture students to develop layouts, study performance and present their work.</p><div class="pc-actions">${link('tools','Explore tools <span aria-hidden="true">→</span>','btn')}<a href="#pc-example" data-anchor="pc-example" class="pc-text-link">See the workflow <span aria-hidden="true">↘</span></a></div><p class="pc-hero-note">Start with an individual tool. Build a connected workflow when you need it.</p></div>
    <figure class="pc-product-preview"><div class="pc-preview-bar"><span><i></i> Plan Studio</span><span>Product screenshot</span></div><a href="#/studio" data-go="studio" aria-label="Open Plan Studio"><img src="img/proto/studio.jpg" alt="PlotCloud Plan Studio showing a furnished floor plan with dimensions and a 3D room view" fetchpriority="high" width="1440" height="816"></a><figcaption>Draw a plan. Furnish the space. Test the design.</figcaption></figure></section>
    <section class="wrap pc-start" aria-labelledby="pc-start-title"><div class="pc-section-heading"><h2 id="pc-start-title">Choose your next step.</h2>${link('tools','All tools ↗','pc-text-link')}</div><div class="pc-task-grid">${groups.slice(0,3).map((g,i)=>`<a href="#/tools?group=${g.id}" data-go="tools?group=${g.id}" class="pc-task"><span class="pc-task-number">0${i+1}</span><h3>${g.title}</h3><p>${g.text}</p><span class="pc-task-cta">${['Explore site & modeling tools','Explore analysis tools','Explore rendering & presentation'][i]} <span aria-hidden="true">→</span></span></a>`).join('')}</div></section>
    <section class="pc-example" id="pc-example" aria-labelledby="pc-example-title"><div class="wrap"><div class="pc-section-heading"><div><p class="pc-eyebrow">A workflow to explore</p><h2 id="pc-example-title">From a place to a design decision.</h2></div></div><p class="pc-example-intro">Start with the site, develop a layout and choose an analysis. Each tool can also be used on its own.</p><div class="pc-example-grid">${[
      ['site','01 · Understand the site','img/proto/site.jpg','Site Planner showing surrounding buildings and site context','Find an address and establish the surroundings.'],
      ['studio','02 · Develop the plan','img/proto/studio.jpg','Plan Studio floor plan and room modeling interface','Draw rooms, place furniture and refine the layout.'],
      ['tool/daylight','03 · Test a design decision','img/proto/sim.jpg','Daylight example showing a floor plan heatmap and analysis results','Explore daylight distribution and export your results.']
    ].map(([url,h,img,alt,txt])=>`<article><a href="#/${url}" data-go="${url}"><img src="${img}" alt="${alt}" loading="lazy" width="1440" height="900"><h3>${h}</h3></a><p>${txt}</p></article>`).join('')}</div><p class="pc-example-caption">Product screenshots show different example models. Analysis tools display their methods, inputs and limitations.</p></div></section>
    <section class="wrap pc-next" aria-labelledby="pc-next-title"><div><p class="pc-eyebrow">Resources for the work</p><h2 id="pc-next-title">Keep your next step simple.</h2><p>Find compatible design files, explore the tools or compare membership options.</p></div><div class="pc-next-links">${link('tools','Open the tools ↗')}${link('library','Browse resources ↗')}${link('pricing','Compare plans ↗')}</div></section></div>`;

  NAV.splice(0,NAV.length,['tools','Tools'],['library','Resources'],['pricing','Pricing']);
  const previousChrome = chrome;
  chrome = function(page) {
    previousChrome(page);
    const root=page.split(/[/?]/)[0];
    document.body.classList.add('pc-shell');
    document.body.classList.toggle('pc-home-page',root==='home');
    document.body.classList.toggle('pc-tools-page',root==='tools');
    const active=root==='site'||root==='studio'||root==='tool'?'tools':root==='res'||root==='resources'?'library':root;
    const nav=document.getElementById('nav');nav.setAttribute('aria-label','Main navigation');
    nav.innerHTML=NAV.map(([k,l])=>`<a href="#/${k}" data-go="${k}"${k===active?' class="on" aria-current="page"':''}>${l}</a>`).join('');
    document.getElementById('mpanel').innerHTML=nav.innerHTML+'<hr>'+ (signed()?link('account','My account')+link('project','My project')+(S.role==='admin'?link('admin','Admin'):'')+'<a href="#/home" data-act="logout">Log out</a>':link('login','Log in or join'));
    document.getElementById('burger').setAttribute('aria-expanded','false');
    for(const id of ['sitelink','wblink','gform'])document.getElementById(id).hidden=true;
    document.querySelector('.hflow').hidden=true;
  };
  const footer=document.querySelector('footer.site .fg');
  footer.innerHTML=`<div><h5>PlotCloud</h5>${link('tools','Tools')}${link('library','Resources')}${link('pricing','Pricing')}</div><div><h5>Help & examples</h5>${link('showroom','Showroom')}${link('learn','Guides & support')}${link('requests','Request a resource')}<a href="mailto:${esc(ST.email||EMAIL)}">Contact</a></div><div><h5>Legal</h5>${link('terms','Terms of Use')}${link('privacy','Privacy Policy')}${link('license','Resource License')}${link('refunds','Refunds & Cancellation')}</div>`;
  const burger=document.getElementById('burger');burger.setAttribute('aria-controls','mpanel');
  burger.addEventListener('click',()=>burger.setAttribute('aria-expanded',String(document.getElementById('mpanel').classList.contains('open'))));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.getElementById('mpanel').classList.remove('open');burger.setAttribute('aria-expanded','false');}});
  function update(group,query){const p=new URLSearchParams();if(group!=='all')p.set('group',group);if(query)p.set('q',query);history.replaceState(null,'','#/tools'+(p.size?'?'+p.toString():''));
    document.querySelector('[data-shell-results]').innerHTML=resultMarkup();bindMini(document.querySelector('[data-shell-results]'));
    document.querySelectorAll('[data-shell-group]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.shellGroup===group)));
  }
  document.addEventListener('input',e=>{if(e.target.matches('[data-shell-search]'))update(state().group,e.target.value);});
  document.addEventListener('click',e=>{if(e.target.closest('#mpanel a')){document.getElementById('mpanel').classList.remove('open');burger.setAttribute('aria-expanded','false');}const group=e.target.closest('[data-shell-group]');if(group){update(group.dataset.shellGroup,state().query);return;}if(e.target.closest('[data-shell-reset]')){document.querySelector('[data-shell-search]').value='';update('all','');document.querySelector('[data-shell-search]').focus();}});
  // Catalog diagnostics used by regression tests; it contains identifiers, never model or account data.
  window.PlotCloudCatalog={groups:groups.map(g=>g.id),ids:()=>catalog().map(x=>x.id)};
  route();
})();
