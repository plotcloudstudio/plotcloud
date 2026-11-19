import * as S from '../store.js';
import { $, $$, refreshWho, toast } from '../app.js';
import * as C from '../cloud.js';

export function render(app, _, params) {
  let mode = params.get('signup') ? 'signup' : 'login'; const cloud = C.configured();
  // a password-reset link signed the person in: ask for the new password (2026-11-17)
  if (cloud && C.user() && params.get('set')) {
    app.innerHTML = `<div class="auth"><form id="pw" class="card" style="flex:1 1 380px;max-width:440px;padding:28px;display:grid;gap:14px;margin:0 auto" aria-label="Set a new password"><h1 class="display md" style="font-size:34px">Set a new password.</h1><p class="note">For ${C.user().email}. ${C.PASSWORD_RULE} ${C.BREACH_NOTE}</p><label class="f">New password<input name="password" type="password" autocomplete="new-password" required minlength="10"></label><label class="f">Repeat it<input name="again" type="password" autocomplete="new-password" required minlength="10"></label><button class="btn accent lg" id="pwGo">Save the new password →</button><p class="msg" id="pwMsg" role="status" aria-live="polite"></p></form></div>`;
    const say = (t, warn) => { const m = $('#pwMsg', app); m.textContent = t; m.className = 'msg' + (warn ? ' warn' : ' ok'); };
    $('#pw', app).onsubmit = async (e) => { e.preventDefault(); const fd = new FormData(e.target), pw = String(fd.get('password')); if (pw !== String(fd.get('again'))) return say('The two passwords differ.', true); if (!C.passwordOk(pw)) return say(C.PASSWORD_RULE, true);
      const go = $('#pwGo', app); go.disabled = true; const n = await C.breachCount(pw); if (n > 0) { say(C.breachMsg(n), true); go.disabled = false; return; } try { await C.setPassword(pw); toast('Password changed'); location.hash = '#/home'; } catch (er) { say(er.message, true); go.disabled = false; } };
    return;
  }
  if (cloud && C.user()) { location.hash = '#/' + (params.get('next') || 'home'); return; }
  const next = params.get('next') || 'home';   // the Dashboard, unless the person was on their way somewhere
  const draw = () => {
    const up = mode === 'signup';
    const nav=app.closest('.lp-public')?.querySelector('.lp-nav');if(nav){nav.querySelectorAll('.lp-login,.lp-btn').forEach(a=>a.removeAttribute('aria-current'));nav.querySelector(up?'.lp-btn':'.lp-login')?.setAttribute('aria-current','page');}
    document.title='PlotCloud — '+(up?'Get started':'Log in');
    app.innerHTML = `<div class="auth">
      <div style="flex:1 1 420px;max-width:520px">
        <h1 class="display md">${up ? 'Start free.' : 'Welcome back.'}<br><span>${up ? 'Keep it together.' : 'Pick up where you left off.'}</span></h1>
        <p class="lede" style="margin-top:22px">Your account keeps the site, the defaults every simulation uses, and your projects with their versions and results.</p>
        <ol class="numlist" style="margin-top:30px"><li><span>01</span><b>Set your site and defaults once</b></li><li><span>02</span><b>Keep every project and version in one place</b></li><li><span>03</span><b>Sun hours and Daylight stay free, every study is free on the examples; the other studies on your own projects need monthly access</b></li></ol>
      </div>
      <form id="f" class="card" style="flex:1 1 380px;max-width:440px;padding:28px;display:grid;gap:14px" aria-label="${cloud?(up?'Create an account':'Log in'):'Local browser profile'}">
        <div class="seg" role="group" aria-label="Log in or create an account" style="display:grid;grid-template-columns:1fr 1fr"><button type="button" data-m="signup" aria-pressed="${up}">Create account</button><button type="button" data-m="login" aria-pressed="${!up}">Log in</button></div>
        ${up ? '<label class="f">Name<input name="name" autocomplete="name" required></label>' : ''}
        <label class="f">Email<input name="email" type="email" autocomplete="email" required placeholder="you@studio.com"></label>
        <label class="f">Password<input name="password" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" ${cloud?'required minlength="10"':'disabled placeholder="Cloud registration is not connected"'}></label>${cloud&&up?`<p class="note" style="margin:-6px 0 0">${C.PASSWORD_RULE} ${C.BREACH_NOTE}</p>`:''}
        <button class="btn accent lg" id="go">${cloud?(up?'Create account →':'Log in →'):'Continue with local profile →'}</button>
        ${cloud ? `<button type="button" class="btn" id="link">Email me a sign-in link instead</button>${up ? '' : '<button type="button" class="btn ghost" id="forgot">Forgot your password?</button>'}` : ''}
        <p class="msg" id="authMsg" role="status" aria-live="polite"></p>
        <p class="note" style="text-align:center">${cloud ? 'Your projects stay in this browser and, once you are signed in, are copied to your PlotCloud account so they follow you to your other devices. The sample project stays in the browser.' : 'Cloud accounts are not switched on for this site yet: your details stay in this browser and no password is stored.'}</p>
      </form></div>`;
    $$('[data-m]', app).forEach((b) => b.onclick = () => { mode = b.dataset.m; draw(); });
    const say = (t, warn) => { const m = $('#authMsg', app); m.textContent = t; m.className = 'msg' + (warn ? ' warn' : ' ok'); };
    if (cloud) $('#link', app).onclick = async () => { const email = String(new FormData($('#f', app)).get('email') || '').trim(); if (!email) return say('Type your email first.', true);
      try { await C.emailLink(email); say(`Sent: open the link in the email to ${email} on this device.`); } catch (er) { say(er.message, true); } };
    if (cloud) $('#forgot', app)?.addEventListener('click', async () => { const email = String(new FormData($('#f', app)).get('email') || '').trim(); if (!email) return say('Type your email first, then press Forgot your password.', true);
      try { await C.resetPassword(email); say(`If ${email} has an account, an email with a link to set a new password is on its way.`); } catch (er) { say(er.message, true); } });
    $('#f', app).onsubmit = async (e) => {
      e.preventDefault(); const fd = new FormData(e.target), email = String(fd.get('email')).trim();
      if (cloud) { const go = $('#go', app); go.disabled = true;
        if (up && !C.passwordOk(String(fd.get('password')))) { say(C.PASSWORD_RULE, true); go.disabled = false; return; }
        if (up) { const n = await C.breachCount(String(fd.get('password'))); if (n > 0) { say(C.breachMsg(n), true); go.disabled = false; return; } }
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
