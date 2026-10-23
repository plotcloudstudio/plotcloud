import { $, $$ } from '../app.js';

// Plans and prices as on the current PlotCloud pricing page.
export function render(app) {
  let yearly = true;
  app.innerHTML = `<div class="wrap">
    <div style="text-align:center"><span class="eyebrow">Pricing</span>
      <h1 class="display" style="margin-top:18px">Free tools.<br><span>Pro projects.</span></h1>
      <p class="lede" style="margin:22px auto 0;font-size:18px">Every analysis and design tool is free. PlotCloud Pro keeps one project together: your site, model versions, simulation results and comparisons.</p>
      <div class="seg" role="group" aria-label="Billing period" style="margin-top:30px"><button type="button" data-y="0">Monthly</button><button type="button" data-y="1">Yearly · save 27%</button></div></div>
    <div class="plans">
      <article class="pplan"><div><span class="eyebrow">Free</span><p style="margin-top:10px"><span class="price">CAD 0</span> <span class="muted">forever</span></p><p class="muted">For trying an idea on any site.</p></div>
        <ul><li>✓ Every analysis and design tool</li><li>✓ PNG export from each tool</li><li>✓ Free starter resource sets</li><li>✓ Save sets and vote on requests</li></ul>
        <a class="btn lg" href="#/login?signup=1">Start free</a><p class="note" style="text-align:center">No card, no time limit.</p></article>
      <article class="pplan pro"><span class="ribbon">7 days free</span><div><span class="eyebrow">PlotCloud Pro</span><p style="margin-top:10px"><span class="price" id="price"></span> <span class="muted" id="per"></span></p><p class="muted" id="pnote"></p></div>
        <ul><li>✓ Everything in Free</li><li>✓ Projects with your site and defaults</li><li>✓ Saved model versions</li><li>✓ Simulation results saved to versions</li><li>✓ Version comparison</li><li>✓ The full resource library</li><li>✓ Vector and high-resolution exports</li></ul>
        <a class="btn accent lg" href="#/login?signup=1">Start 7-day free trial</a><p class="muted small" style="text-align:center">No credit card required. Nothing is charged when the trial ends.</p></article>
      <article class="pplan"><div><span class="eyebrow">Teams &amp; Education</span><p style="margin-top:10px"><span class="price" style="font-size:40px">Contact us</span></p><p class="muted">For architecture firms, instructors and departments.</p></div>
        <ul><li>✓ Access for your practice or course</li><li>✓ Commercial and group resource licensing</li><li>✓ Support for your design workflow</li><li>✓ Project files processed in the browser</li></ul>
        <a class="btn lg" href="../index.html#/pricing">Contact us</a><p class="note" style="text-align:center">Tell us your team size and workflow.</p></article>
    </div>
    <h2 class="display sm" style="margin-top:96px">What each plan includes</h2>
    <div style="overflow-x:auto;margin-top:20px"><table class="t" style="min-width:640px"><thead><tr><th>Feature</th><th style="text-align:center">Free</th><th style="text-align:center;color:var(--red)">Pro</th><th style="text-align:center">Teams</th></tr></thead><tbody>
      ${[['All analysis, design and present tools', 1, 1, 1], ['PNG export from each tool', 1, 1, 1], ['Free starter resource sets', 1, 1, 1], ['Projects with site and defaults', 0, 1, 1], ['Saved versions and results', 0, 1, 1], ['Version comparison', 0, 1, 1], ['Full library, vector and high-res export', 0, 1, 1]]
        .map(([f, a, b, c]) => `<tr><td>${f}</td>${[a, b, c].map((x) => `<td style="text-align:center">${x ? '✓' : '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <h2 class="display sm" style="margin-top:96px">Good questions</h2>
    <div class="cols" style="margin-top:12px">${[['How does the free trial work?', 'You get PlotCloud Pro for 7 days with no credit card. On the last day you choose to keep Pro or go back to Free. Nothing is charged automatically.'], ['Are the tools really free?', 'Yes. Every analysis and design tool works on the Free plan. Pro is for keeping your work together: projects, versions, results and the full library.'], ['Can I cancel?', 'Yes, anytime from your account. You keep Pro until the end of the period you paid for.'], ['Can my practice or school use PlotCloud?', 'Yes. Contact us about team access, educational use and commercial resource licensing.']]
      .map(([q, a]) => `<div style="padding:22px 0;border-top:1px solid var(--line)"><b style="font-size:17px">${q}</b><p class="muted" style="margin-top:8px">${a}</p></div>`).join('')}</div>
    <p class="note" style="margin-top:36px">Prices in Canadian dollars, plus GST/HST/PST where it applies.</p>
  </div>`;
  const set = () => { $('#price', app).textContent = yearly ? 'CAD 79' : 'CAD 9'; $('#per', app).textContent = yearly ? '/ year' : '/ month'; $('#pnote', app).textContent = yearly ? 'CAD 6.58 a month, billed yearly' : 'Billed monthly · cancel anytime'; $$('[data-y]', app).forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.y === '1') === yearly))); };
  $$('[data-y]', app).forEach((b) => b.onclick = () => { yearly = b.dataset.y === '1'; set(); }); set();
}
