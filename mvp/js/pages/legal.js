import {esc} from '../app.js';

export async function render(app,[id='terms']) {
  const res=await fetch('legal-content.json?v=mail-20261117-1');
  if(!res.ok)throw Error('Policy text could not load.');
  const data=await res.json(),titles={terms:'Terms of use',privacy:'Privacy policy',license:'Resource license',refunds:'Refund policy'};
  if(!titles[id])id='terms';
  const text=data[id].replaceAll('{{OWNER}}','SimuSite').replaceAll('{{YEAR}}',String(new Date().getFullYear())).replaceAll('{{EMAIL}}','plotcloudstudio@gmail.com');
  app.innerHTML=`<div class="wrap resource-page resource-utility"><span class="eyebrow">SimuSite policies</span><h1>${titles[id]}</h1><p class="note">Updated ${esc(data.updated)}</p><nav class="lp-policy-links" aria-label="Policies">${Object.entries(titles).map(([key,title])=>`<a href="#/legal/${key}"${key===id?' aria-current="page"':''}>${title}</a>`).join('')}</nav>${text.split(/\n\s*\n/).map(p=>{if(!p.startsWith('## '))return `<p>${esc(p).replace(/\n/g,'<br>')}</p>`;const [heading,...body]=p.split('\n');return `<h2>${esc(heading.slice(3))}</h2>${body.length?`<p>${esc(body.join('\n')).replace(/\n/g,'<br>')}</p>`:''}`;}).join('')}</div>`;
}
