// Homepage scene lifecycle. Only this presentation state is stored; project data is untouched.
const MODES = ['sun', 'wind', 'rain', 'sound'];
const KEY = 'pc-toronto-hero-mode';
let memoryMode = null;
function lastMode() {
  try { return sessionStorage.getItem(KEY) || memoryMode; } catch { return memoryMode; }
}
function remember(mode) {
  memoryMode = mode;
  try { sessionStorage.setItem(KEY, mode); } catch { /* Private-mode storage is optional. */ }
}
export function mountHomeHero(figure) {
  const frame = figure.querySelector('iframe');
  const next = () => MODES[(MODES.indexOf(lastMode()) + 1) % MODES.length];
  let mode = next(), lastAdvance = -Infinity, active = true, wasHidden = document.hidden;
  remember(mode);
  const theme = () => document.documentElement.dataset.theme === 'night' ? 'night' : 'day';
  const send = () => frame.contentWindow?.postMessage({type:'plotcloud-hero-config', mode, theme:theme()}, location.origin);
  const advance = () => {
    if (!active || performance.now() - lastAdvance < 500) return;
    lastAdvance = performance.now(); mode = next(); remember(mode); send();
  };
  const onMessage = event => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === 'plotcloud-hero-ready') send();
    if (event.data?.type === 'plotcloud-hero-state' && MODES.includes(event.data.mode)) {
      mode = event.data.mode; remember(mode);
    }
  };
  const onVisibility = () => {
    if (document.hidden) { wasHidden = true; return; }
    if (wasHidden) { wasHidden = false; advance(); }
  };
  const onPageShow = event => { if (event.persisted) advance(); };
  const onTheme = () => send();
  window.addEventListener('message', onMessage);
  window.addEventListener('pc-theme', onTheme);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pageshow', onPageShow);
  frame.addEventListener('load', send);
  // Bundled scene has no external CSS, engine or module requests.
  frame.src = `../hero/toronto-standalone.html?embed=1&mode=${mode}&theme=${theme()}`;
  return () => {
    active = false;
    window.removeEventListener('message', onMessage);
    window.removeEventListener('pc-theme', onTheme);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pageshow', onPageShow);
    frame.removeEventListener('load', send);
  };
}
