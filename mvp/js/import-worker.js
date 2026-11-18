// Reading a large OBJ or STL off the page (2026-11-18): the model is parsed here, in a worker, so the Workspace keeps responding and
// shows the progress, and Cancel stops it at once. The result matches three.js's OBJLoader / STLLoader as the import used them:
// one part per OBJ object ('o' or 'g' line; the last name before its faces), polygons split into triangles as a fan, 'l' and 'p'
// lines (no faces) left out; an STL is one part. Each part: its triangles as [x, y, z, …] in the file's own coordinates, unindexed.
// No imports: a worker cannot read the page's import map.
const post = (m, t) => self.postMessage(m, t || []);
self.onmessage = (e) => {
  const { buf, ext, maxTris } = e.data;
  try {
    const parts = ext === 'stl' ? stl(buf) : obj(buf, maxTris);
    const tris = parts.reduce((s, p) => s + p.pos.length / 9, 0);
    post({ type: 'done', parts, tris }, parts.map((p) => p.pos.buffer));
  } catch (err) { post({ type: 'error', message: err.message || String(err), tooBig: err.tooBig || null }); }
};
let lastPct = -1; const progress = (f) => { const pct = Math.floor(f * 100); if (pct !== lastPct) { lastPct = pct; post({ type: 'progress', f }); } };
function tooBig(tris) { const e = Error('too big'); e.tooBig = { tris }; return e; }
function obj(buf, maxTris) {
  let text = new TextDecoder().decode(buf); if (text.indexOf('\r\n') !== -1) text = text.replace(/\r\n/g, '\n'); if (text.indexOf('\\\n') !== -1) text = text.replace(/\\\n/g, '');
  const V = []; const parts = []; let cur = { name: '', out: [], decl: false }; let tris = 0;
  const start = (name) => { if (!cur.out.length) { cur.name = name; cur.decl = true; return; } parts.push(cur); cur = { name, out: [], decl: true }; };
  const vi = (s) => { const i = parseInt(s, 10); return (i >= 0 ? i - 1 : V.length / 3 + i) * 3; };
  const n = text.length; let a = 0, k = 0;
  while (a < n) {
    let b = text.indexOf('\n', a); if (b === -1) b = n;
    if ((++k & 16383) === 0) progress(a / n);
    let i = a; while (i < b && (text.charCodeAt(i) === 32 || text.charCodeAt(i) === 9)) i++;
    const c0 = text.charCodeAt(i), c1 = text.charCodeAt(i + 1);
    if (c0 === 118 && (c1 === 32 || c1 === 9)) {   // v x y z
      const t = text.slice(i + 2, b).trim().split(/\s+/); V.push(+t[0], +t[1], +t[2]);
    } else if (c0 === 102 && (c1 === 32 || c1 === 9)) {   // f a b c …  (a, a/b, a/b/c, a//c)
      const t = text.slice(i + 2, b).trim().split(/\s+/); if (t.length >= 3) {
        const ix = t.map((s) => vi(s.split('/')[0]));
        for (let j = 1; j + 1 < ix.length; j++) { for (const q of [ix[0], ix[j], ix[j + 1]]) cur.out.push(V[q], V[q + 1], V[q + 2]); tris++; }
        if (maxTris && tris > maxTris) throw tooBig(tris);
      }
    } else if ((c0 === 111 || c0 === 103) && (i + 1 >= b || c1 === 32 || c1 === 9)) {   // o name, g name
      start(text.slice(i + 1, b).trim());
    }
    a = b + 1;
  }
  parts.push(cur); progress(1);
  return parts.filter((p) => p.out.length).map((p) => ({ name: p.name, pos: Float32Array.from(p.out) }));
}
function stl(buf) {
  const dv = new DataView(buf), head = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(buf.byteLength, 6))), binary = buf.byteLength >= 84 && (84 + dv.getUint32(80, true) * 50 === buf.byteLength || !/^solid/i.test(head.trim()));   // as STLLoader decides
  if (binary) { const nT = dv.getUint32(80, true), pos = new Float32Array(nT * 9);
    for (let t = 0; t < nT; t++) { const o = 84 + t * 50 + 12; for (let j = 0; j < 9; j++) pos[t * 9 + j] = dv.getFloat32(o + j * 4, true); if ((t & 65535) === 0) progress(t / nT); }
    progress(1); return [{ name: '', pos }]; }
  const text = new TextDecoder().decode(buf), out = [], re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g; let m, k = 0;
  while ((m = re.exec(text))) { out.push(+m[1], +m[2], +m[3]); if ((++k & 65535) === 0) progress(re.lastIndex / text.length); }
  progress(1); return [{ name: '', pos: Float32Array.from(out) }];
}
