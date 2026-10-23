import * as S from '../store.js';
import { $, $$, refreshWho, toast } from '../app.js';

export function render(app, _, params) {
  let mode = params.get('signup') ? 'signup' : 'login';
  const next = params.get('next') || 'account';
  const draw = () => {
    const up = mode === 'signup';
    app.innerHTML = `<div class="auth">
      <div style="flex:1 1 420px;max-width:520px">
        <h1 class="display md">${up ? 'Start free.' : 'Welcome back.'}<br><span>${up ? 'Keep it together.' : 'Pick up where you left off.'}</span></h1>
        <p class="lede" style="margin-top:22px">Your account keeps the site, the defaults every simulation uses, and your projects with their versions and results.</p>
        <ol class="numlist" style="margin-top:30px"><li><span>01</span><b>Set your site and defaults once</b></li><li><span>02</span><b>Keep every project and version in one place</b></li><li><span>03</span><b>Every tool stays free; Pro adds projects</b></li></ol>
      </div>
      <form id="f" class="card" style="flex:1 1 380px;max-width:440px;padding:28px;display:grid;gap:14px" aria-label="${up ? 'Create an account' : 'Log in'}">
        <div class="seg" role="group" aria-label="Log in or create an account" style="display:grid;grid-template-columns:1fr 1fr"><button type="button" data-m="signup" aria-pressed="${up}">Create account</button><button type="button" data-m="login" aria-pressed="${!up}">Log in</button></div>
        ${up ? '<label class="f">Name<input name="name" autocomplete="name" required></label>' : ''}
        <label class="f">Email<input name="email" type="email" autocomplete="email" required placeholder="you@studio.com"></label>
        <label class="f">Password<input name="password" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" required minlength="6"></label>
        <button class="btn accent lg">${up ? 'Create account →' : 'Log in →'}</button>
        <p class="note" style="text-align:center">Prototype: there is no server yet. Your details stay in this browser and no password is stored.</p>
      </form></div>`;
    $$('[data-m]', app).forEach((b) => b.onclick = () => { mode = b.dataset.m; draw(); });
    $('#f', app).onsubmit = (e) => {
      e.preventDefault(); const fd = new FormData(e.target), email = String(fd.get('email')).trim();
      const A = S.account(); A.user = { name: String(fd.get('name') || A.user?.name || email.split('@')[0]).trim(), email, plan: 'trial', since: new Date().toISOString() };
      S.save(); refreshWho(); toast(up ? 'Account created' : 'Signed in'); location.hash = '#/' + next;
    };
  };
  draw();
}
