// A colour picker in the manner of an image editor's (2026-10-31): a saturation/brightness field, a hue strip, the new and the
// current colour side by side, and HEX, RGB and HSB values to type. mountPicker(host, hex, { onInput, onChange, presets })
// returns { set(hex), get() }. onInput fires while dragging, onChange when a value is settled (pointer up, Enter, a preset).
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const hexToRgb = (h) => { const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(h || '').trim()); if (!m) return null; let s = m[1]; if (s.length === 3) s = s.split('').map((c) => c + c).join(''); const n = parseInt(s, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
export const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
export function rgbToHsb(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; return [h, mx ? d / mx * 100 : 0, mx * 100]; }
export function hsbToRgb(h, s, v) { s /= 100; v /= 100; const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]; }

export function mountPicker(host, hex, { onInput = () => {}, onChange = () => {}, presets = [] } = {}) {
  let [H, S, B] = rgbToHsb(...(hexToRgb(hex) || [31, 63, 224])), cur = rgbToHex(...hsbToRgb(H, S, B));
  host.innerHTML = `<div class="cp">
    <div class="cp-sv" tabindex="0" aria-label="Saturation and brightness"><i class="cp-dot"></i></div>
    <div class="cp-hue" tabindex="0" aria-label="Hue"><i class="cp-bar"></i></div>
    <div class="cp-side"><div class="cp-sw"><span class="cp-new" title="New"></span><span class="cp-old" title="Current"></span></div>
      <label class="cp-f cp-hex">#<input data-k="hex" maxlength="7" spellcheck="false"></label>
      <div class="cp-g">${['R', 'G', 'B'].map((k) => `<label class="cp-f">${k}<input data-k="${k}" type="number" min="0" max="255"></label>`).join('')}</div>
      <div class="cp-g">${[['h', 'H', 360, '°'], ['s', 'S', 100, '%'], ['v', 'B', 100, '%']].map(([k, n, mx]) => `<label class="cp-f">${n}<input data-k="${k}" type="number" min="0" max="${mx}"></label>`).join('')}</div></div>
    ${presets.length ? `<div class="cp-pre">${presets.map((c) => `<button type="button" data-pre="${c}" style="background:${c}" title="${c}" aria-label="${c}"></button>`).join('')}</div>` : ''}</div>`;
  const $ = (q) => host.querySelector(q), sv = $('.cp-sv'), hue = $('.cp-hue'), inp = (k) => $(`[data-k="${k}"]`);
  function draw(skip) {
    const rgb = hsbToRgb(H, S, B), hx = rgbToHex(...rgb); sv.style.background = `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,hsl(${H},100%,50%))`;
    $('.cp-dot').style.left = S + '%'; $('.cp-dot').style.top = (100 - B) + '%'; $('.cp-bar').style.top = (H / 360 * 100) + '%'; $('.cp-new').style.background = hx; $('.cp-old').style.background = cur;
    const vals = { hex: hx.slice(1).toUpperCase(), R: Math.round(rgb[0]), G: Math.round(rgb[1]), B: Math.round(rgb[2]), h: Math.round(H), s: Math.round(S), v: Math.round(B) };
    for (const [k, v] of Object.entries(vals)) if (k !== skip) inp(k).value = v; return hx; }
  const fire = (settle) => { const hx = draw(); onInput(hx); if (settle) { cur = hx; draw(); onChange(hx); } };
  const drag = (el, f) => el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); const mv = (ev) => { const r = el.getBoundingClientRect(); f(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1)); fire(false); };
    mv(e); const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); fire(true); }; el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); });
  drag(sv, (x, y) => { S = x * 100; B = (1 - y) * 100; }); drag(hue, (x, y) => { H = Math.min(359.9, y * 360); });
  sv.addEventListener('keydown', (e) => { const d = e.shiftKey ? 10 : 1; if (e.key === 'ArrowLeft') S = clamp(S - d, 0, 100); else if (e.key === 'ArrowRight') S = clamp(S + d, 0, 100); else if (e.key === 'ArrowUp') B = clamp(B + d, 0, 100); else if (e.key === 'ArrowDown') B = clamp(B - d, 0, 100); else return; e.preventDefault(); fire(true); });
  hue.addEventListener('keydown', (e) => { const d = e.shiftKey ? 10 : 1; if (e.key === 'ArrowUp') H = clamp(H - d, 0, 359.9); else if (e.key === 'ArrowDown') H = clamp(H + d, 0, 359.9); else return; e.preventDefault(); fire(true); });
  host.addEventListener('input', (e) => { const k = e.target.dataset.k; if (!k) return; const v = e.target.value;
    if (k === 'hex') { const rgb = hexToRgb(v); if (!rgb || v.replace('#', '').length !== 6) return; [H, S, B] = rgbToHsb(...rgb); }
    else if ('RGB'.includes(k)) { const rgb = ['R', 'G', 'B'].map((q) => clamp(+inp(q).value || 0, 0, 255)); [H, S, B] = rgbToHsb(...rgb); }
    else { H = clamp(+inp('h').value || 0, 0, 359.9); S = clamp(+inp('s').value || 0, 0, 100); B = clamp(+inp('v').value || 0, 0, 100); }
    onInput(draw(k)); });
  host.addEventListener('change', (e) => { if (e.target.dataset.k) fire(true); });
  host.addEventListener('click', (e) => { const b = e.target.closest('[data-pre]'); if (!b) return; [H, S, B] = rgbToHsb(...hexToRgb(b.dataset.pre)); fire(true); });
  draw();
  return { set(h) { const rgb = hexToRgb(h); if (!rgb) return; [H, S, B] = rgbToHsb(...rgb); cur = rgbToHex(...rgb); draw(); }, get: () => rgbToHex(...hsbToRgb(H, S, B)) };
}
