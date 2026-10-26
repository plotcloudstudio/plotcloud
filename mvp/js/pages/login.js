import * as S from '../store.js';
import { $, $$, refreshWho, toast } from '../app.js';
import * as C from '../cloud.js';

export function render(app, _, params) {
  let mode = params.get('signup') ? 'signup' : 'login'; const cloud = C.configured();
  if (cloud && C.user()) { location.hash = '#/' + (params.get('next') || 'home'); return; }
  const next = params.get('next') || 'home';   // the Dashboard, unless the person was on their way somewhere
  const draw = () => {
    const up = mode === 'signup';
    app.innerHTML = `<div class="auth">
      <div style="flex:1 1 420px;max-width:520px">
        <h1 class="display md">${up ? 'Start free.' : 'Welcome back.'}<br><span>${up ? 'Keep it together.' : 'Pick up where you left off.'}</span></h1>
        <p class="lede" style="margin-top:22px">Your account keeps the site, the defaults every simulation uses, and your projects with their versions and results.</p>
        <ol class="numlist" style="margin-top:30px"><li><span>01</span><b>Set your site and defaults once</b></li><li><span>02</span><b>Keep every project and version in one place</b></li><li><span>03</span><b>Sun hours and Daylight stay free; unlock other tools with monthly beta access</b></li></ol>
      </div>
      <form id="f" class="card" style="flex:1 1 380px;max-width:440px;padding:28px;display:grid;gap:14px" aria-label="${cloud?(up?'Create an account':'Log in'):'Local browser profile'}">
        <div class="seg" role="group" aria-label="Log in or create an account" style="display:grid;grid-template-columns:1fr 1fr"><button type="button" data-m="signup" aria-pressed="${up}">Create account</button><button type="button" data-m="login" aria-pressed="${!up}">Log in</button></div>
        ${up ? '<label class="f">Name<input name="name" autocomplete="name" required></label>' : ''}
        <label class="f">Email<input name="email" type="email" autocomplete="email" required placeholder="you@studio.com"></label>
        <label class="f">Password<input name="password" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" ${cloud?'required minlength="8"':'disabled placeholder="Cloud registration is not connected"'}></label>
        <button class="btn accent lg" id="go">${cloud?(up?'Create account →':'Log in →'):'Continue with local profile →'}</button>
        ${cloud ? `<button type="button" class="btn" id="link">Email me a sign-in link instead</button>` : ''}
        <p class="msg" id="authMsg" role="status" aria-live="polite"></p>
        <p class="note" style="text-align:center">${cloud ? 'Your projects stay in this browser and, once you are signed in, are copied to your PlotCloud account so they follow you to your other devices. The sample project stays in the browser.' : 'Cloud accounts are not switched on for this site yet: your details stay in this browser and no password is stored.'}</p>
      </form></div>`;
    $$('[data-m]', app).forEach((b) => b.onclick = () => { mode = b.dataset.m; draw(); });
    const say = (t, warn) => { const m = $('#authMsg', app); m.textContent = t; m.className = 'msg' + (warn ? ' warn' : ' ok'); };
    if (cloud) $('#link', app).onclick = async () => { const email = String(new FormData($('#f', app)).get('email') || '').trim(); if (!email) return say('Type your email first.', true);
      try { await C.emailLink(email); say(`Sent: open the link in the email to ${email} on this device.`); } catch (er) { say(er.message, true); } };
    $('#f', app).onsubmit = async (e) => {
      e.preventDefault(); const fd = new FormData(e.target), email = String(fd.get('email')).trim();
      if (cloud) { const go = $('#go', app); go.disabled = true;
        try { const r = up ? await C.signUp(email, String(fd.get('password')), String(fd.get('name') || '').trim()) : await C.signIn(email, String(fd.get('password')));
          if (r.confirm) { say(`Almost there: confirm your email with the link sent to ${email}, then come back.`); go.disabled = false; return; }
          refreshWho(); toast(up ? 'Account created · syncing your projects' : 'Signed in · syncing your projects'); location.hash = '#/' + next; }
        catch (er) { say(er.message === 'Invalid login credentials' ? 'Wrong email or password.' : er.message, true); go.disabled = false; }
        return; }
      const A = S.account(); A.user = { name: String(fd.get('name') || A.user?.name || email.split('@')[0]).trim(), email, plan: 'free', since: new Date().toISOString() };
      S.save(); refreshWho(); toast('Local profile opened · not a cloud registration'); location.hash = '#/' + next;
    };
  };
  draw();
}
