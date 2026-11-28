// Import a CAD plan into Plan Studio (2026-11-27): a DXF read in the browser (dxf-read.js), shown before anything changes: its units
// (from the file, or guessed and said so, and settable), its layers (which to show as the underlay, which hold the walls), the walls
// found from double lines, where it goes. Then the underlay goes onto the current level (thin blue lines to trace and snap to) and,
// if asked, the walls found become Plan Studio walls. Each is one step to undo. Nothing leaves the browser.
import { parseDXF, wallsFromLines, wallLayers, UNITS } from './dxf-read.js?v=dxf-20261127-1';

const MAXSEG = 30000, esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtN = (n) => Math.round(n).toLocaleString('en'), fmt = (n, d = 2) => (+n).toFixed(d);

/** file: a File; ws: Plan Studio's API (underlay, addWalls, levels, camSet); say(text): a status line → resolves { underlay, walls } or null */
export async function openDxfImport(file, ws, say = () => {}) {
  if (!/\.dxf$/i.test(file.name)) { say(`${file.name} is not a DXF. Save the plan as DXF (AutoCAD, Revit, Rhino, ArchiCAD and SketchUp Pro can) and import that.`); return null; }
  if (file.size > 60 * 1024 * 1024) { say(`${file.name} is ${(file.size / 1048576).toFixed(0)} MB: over the 60 MB this reads in a browser. Save only the plan's layers (or one floor) to DXF.`); return null; }
  const text = await file.text(); let res = parseDXF(text); if (!res.ok) { say(res.error); return null; }
  const lv = (() => { try { const L = ws.levels(); return (L.list || []).find((x) => x.id === L.lv) || { id: L.lv, name: L.lv }; } catch { return { id: null, name: 'the current level' }; } })();
  const st = { scale: res.units.scale, show: new Set(Object.keys(res.layers).filter((n) => res.layers[n].n > 0 && !res.layers[n].off)), walls: new Set(wallLayers(res)), place: 'centre', minT: 0.05, maxT: 0.6 };
  const far = () => { const cx = (res.bounds.x0 + res.bounds.x1) / 2, cy = (res.bounds.y0 + res.bounds.y1) / 2; return Math.hypot(cx, cy) > 200; };
  st.place = far() ? 'centre' : 'keep';
  return new Promise((done) => {
    const box = document.createElement('div'); box.className = 'dxi'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Import a CAD plan'); document.body.appendChild(box);
    let found = [], kept = [];
    const off = () => (st.place === 'centre' ? [-(res.bounds.x0 + res.bounds.x1) / 2, -(res.bounds.y0 + res.bounds.y1) / 2] : [0, 0]);
    const compute = () => { const O = off(), mv = (p) => [p[0] + O[0], p[1] + O[1]];
      kept = res.segs.filter((s) => st.show.has(s.layer)); found = wallsFromLines(res.segs.filter((s) => st.walls.has(s.layer)), { minT: st.minT, maxT: st.maxT }).map((w) => ({ ...w, a: mv(w.a), b: mv(w.b) }));
      return { O, mv }; };
    const draw = () => { const { mv } = compute(), B = res.bounds, O = off(), W = 560, H = 300, sx = Math.max(1e-9, B.x1 - B.x0), sy = Math.max(1e-9, B.y1 - B.y0), k = Math.min((W - 20) / sx, (H - 20) / sy), P = (p) => [10 + (p[0] - O[0] - B.x0) * k, H - 10 - (p[1] - O[1] - B.y0) * k];
      const step = Math.max(1, Math.ceil(kept.length / 8000)), lines = []; for (let i = 0; i < kept.length; i += step) { const a = P(mv(kept[i].a)), b = P(mv(kept[i].b)); lines.push(`M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`); }
      const wl = found.map((w) => { const a = P(w.a), b = P(w.b); return `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke-width="${Math.max(1.5, w.t * k).toFixed(1)}"/>`; }).join('');
      const ts = found.map((w) => w.t), tmin = ts.length ? Math.min(...ts) : 0, tmax = ts.length ? Math.max(...ts) : 0, wlen = found.reduce((a, w) => a + Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), 0);
      const L = Object.entries(res.layers).filter(([, x]) => x.n > 0).sort((a, b) => b[1].n - a[1].n);
      const over = kept.length > MAXSEG;
      box.innerHTML = `<div class="dxi-win"><header><b>Import a CAD plan</b><span>${esc(file.name)}</span><button type="button" class="dxi-x" data-dx="cancel" aria-label="Close">×</button></header>
        <div class="dxi-body"><div class="dxi-left">
          <p class="dxi-k">${fmtN(res.segs.length)} lines on ${L.length} layer${L.length === 1 ? '' : 's'}${res.texts.length ? `, ${fmtN(res.texts.length)} texts` : ''}; ${fmt(B.x1 - B.x0, 1)} × ${fmt(B.y1 - B.y0, 1)} m.${Object.keys(res.skipped).length ? ` Not read: ${Object.entries(res.skipped).map(([t, n]) => `${n} ${t.toLowerCase()}${n > 1 ? 's' : ''}`).slice(0, 4).join(', ')}.` : ''}</p>
          <label class="dxi-row">Units <select data-dx="units">${Object.entries(UNITS).map(([c, [n, m]]) => `<option value="${m}" ${Math.abs(m - st.scale) < 1e-12 ? 'selected' : ''}>${n}</option>`).join('')}</select>
            <small class="${res.units.guessed ? 'dxi-warn' : ''}">${res.units.suspect ? `the file says ${res.units.declared}, which would make it ${fmt((B.x1 - B.x0) / res.units.scale * (UNITS[Object.keys(UNITS).find((c) => UNITS[c][0] === res.units.declared)] || [0, 1])[1], 2)} m across: read as ${res.units.name} instead; check a known length` : res.units.guessed ? 'not given in the file: guessed from its size; check a known length' : 'from the file'}</small></label>
          <label class="dxi-row">Place <select data-dx="place"><option value="centre" ${st.place === 'centre' ? 'selected' : ''}>its middle at the plan's origin</option><option value="keep" ${st.place === 'keep' ? 'selected' : ''}>at the drawing's own coordinates</option></select></label>
          <p class="dxi-row">On <b>${esc(lv.name || lv.id || '')}</b> (the level shown in Plan Studio)</p>
          <table class="dxi-lay"><thead><tr><th>Layer</th><th>Lines</th><th title="Shown as the underlay">Show</th><th title="Walls are found on these layers">Walls</th></tr></thead><tbody>
            ${L.map(([n, x]) => `<tr><td>${esc(n)}${x.off ? ' <small>(off in the file)</small>' : ''}</td><td>${fmtN(x.n)}</td><td><input type="checkbox" data-dx-show="${esc(n)}" ${st.show.has(n) ? 'checked' : ''} aria-label="Show ${esc(n)}"></td><td><input type="checkbox" data-dx-wall="${esc(n)}" ${st.walls.has(n) ? 'checked' : ''} aria-label="Walls on ${esc(n)}"></td></tr>`).join('')}</tbody></table>
          <label class="dxi-row">Wall thickness <input type="number" data-dx="minT" value="${st.minT}" min="0.02" max="1" step="0.01"> to <input type="number" data-dx="maxT" value="${st.maxT}" min="0.05" max="1.5" step="0.05"> m</label>
        </div><div class="dxi-right">
          <svg class="dxi-pv" viewBox="0 0 ${W} ${H}" role="img" aria-label="Preview: the underlay in grey, the walls found in blue"><path d="${lines.join('')}" stroke="#9ca3af" stroke-width="0.6" fill="none"/><g stroke="#1d4ed8" stroke-linecap="square">${wl}</g></svg>
          <p class="dxi-k" data-dx-found>${found.length ? `<b>${found.length} wall${found.length === 1 ? '' : 's'}</b> found from double lines (${fmt(wlen, 1)} m, ${tmin === tmax ? fmt(tmin) : `${fmt(tmin)}–${fmt(tmax)}`} m thick), shown in blue.` : 'No walls found from double lines on the layers ticked: tick the layer that holds the walls, or add the underlay and trace it.'}</p>
          <p class="dxi-n">Walls are found where two parallel lines run ${st.minT}–${st.maxT} m apart; openings stay open; check them against the drawing. Curved walls, columns and walls drawn as single lines or hatches are not found: trace them on the underlay (the wall tool snaps to its lines).${over ? ` <span class="dxi-warn">The layers shown have ${fmtN(kept.length)} lines: only the first ${fmtN(MAXSEG)} are kept. Untick hatching, furniture and text layers.</span>` : ''}</p>
        </div></div>
        <footer><button type="button" class="btn sm" data-dx="cancel">Cancel</button><button type="button" class="btn sm" data-dx="under" ${kept.length ? '' : 'disabled'}>Add the underlay only</button><button type="button" class="btn sm primary" data-dx="both" ${found.length ? '' : 'disabled'}>Add the underlay and ${found.length} wall${found.length === 1 ? '' : 's'}</button></footer></div>`; };
    const close = (v) => { box.remove(); document.removeEventListener('keydown', key, true); done(v); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } };
    const go = (withWalls) => { const { mv } = compute(), pts = []; for (const s of kept.slice(0, MAXSEG)) { const a = mv(s.a), b = mv(s.b); pts.push(a[0], a[1], b[0], b[1]); }
      let info = null, n = 0; try { info = ws.underlay({ lv: lv.id, name: file.name, units: res.units.name, layers: [...st.show], pts }); if (withWalls) n = ws.addWalls(found.map((w) => ({ ...w, source: 'dxf:' + w.layer })), { lv: lv.id }); } catch (e) { say('The plan could not be added: ' + (e.message || e)); close(null); return; }
      try { const xs = pts.filter((_, i) => i % 2 === 0), ys = pts.filter((_, i) => i % 2 === 1); if (xs.length) ws.camSet({ cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2, span: Math.max(10, (Math.max(...xs) - Math.min(...xs)) * 1.15, (Math.max(...ys) - Math.min(...ys)) * 1.15) }); } catch { }
      say(`${file.name}: the underlay (${fmtN(pts.length / 4)} lines) is on ${lv.name || 'this level'}${withWalls ? `, with ${n} wall${n === 1 ? '' : 's'} found from it` : ''}. Undo removes ${withWalls ? 'each step' : 'it'}; Layers › Level reference › CAD plan hides it.`);
      close({ underlay: info, walls: n }); };
    box.addEventListener('click', (e) => { const b = e.target.closest('[data-dx]'); if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT') return; const k = b.dataset.dx; if (k === 'cancel') close(null); else if (k === 'under') go(false); else if (k === 'both') go(true); });
    box.addEventListener('change', (e) => { const t = e.target;
      if (t.dataset.dxShow != null) { t.checked ? st.show.add(t.dataset.dxShow) : st.show.delete(t.dataset.dxShow); }
      else if (t.dataset.dxWall != null) { t.checked ? st.walls.add(t.dataset.dxWall) : st.walls.delete(t.dataset.dxWall); }
      else if (t.dataset.dx === 'units') { st.scale = +t.value; res = parseDXF(text, { scale: st.scale }); st.place = far() ? 'centre' : st.place; }
      else if (t.dataset.dx === 'place') st.place = t.value;
      else if (t.dataset.dx === 'minT' || t.dataset.dx === 'maxT') { const v = +t.value; if (Number.isFinite(v) && v > 0) st[t.dataset.dx] = v; }
      draw(); });
    document.addEventListener('keydown', key, true); draw(); box.querySelector('[data-dx="both"]:not([disabled]), [data-dx="under"]')?.focus();
  });
}
