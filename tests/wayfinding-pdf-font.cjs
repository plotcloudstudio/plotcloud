// The signage PDF's schedule (2026-11-19): arrows, ≥ and accented names come out as written (DejaVu Sans in the PDF, not the
// built-in Helvetica); a schedule with Chinese names is placed as pictures of the table drawn with the browser's fonts.
// Text is read back with pdftotext (poppler) where it is installed.
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { execFileSync } = require('node:child_process');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const p = await b.newPage(), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '/mvp/'); await p.waitForFunction(() => document.querySelector('#app h1'));
    const make = (rows) => p.evaluate(async (rows) => { const W = await import('./js/wayfinding-walk.js'); const c = document.createElement('canvas'); c.width = 400; c.height = 280; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 400, 280);
      const blob = await W.drawingPDF(c.toDataURL('image/png'), rows, 'Wayfinding signage · test'); const u = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768)); return btoa(s); }, rows);
    const row = (o) => ({ id: 'S1', floor: 'Level 1', point: '#3', where: 'Main corridor', type: 'Directional', mount: 'Ceiling-hung', faces: 'North (0°)', says: '→ Registration · ↑ Lifts ≥ 2 · Café', priority: 'High (≥ 35)', visibility: '12/14', status: 'Seen', ...o });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-')), f1 = path.join(dir, 'latin.pdf'), f2 = path.join(dir, 'cjk.pdf');
    fs.writeFileSync(f1, Buffer.from(await make([row({}), row({ id: 'S2', where: 'Zoë’s wing — Œ', says: '← Pharmacy · ↓ Exit' })]), 'base64'));
    fs.writeFileSync(f2, Buffer.from(await make([row({ where: '挂号大厅', says: '→ 门诊 · ↑ 电梯' }), row({ id: 'S2' })]), 'base64'));
    let tool = true; try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); } catch { tool = false; }
    const raw1 = fs.readFileSync(f1, 'latin1'); assert(/DejaVu/.test(raw1), 'the PDF embeds DejaVu Sans');
    if (tool) { const t = execFileSync('pdftotext', ['-layout', f1, '-']).toString();
      for (const s of ['Signage schedule', '→ Registration', '↑ Lifts ≥ 2', 'Café', 'High (≥ 35)', '← Pharmacy', 'Zoë’s wing — Œ', 'North (0°)']) assert(t.includes(s), 'the schedule says "' + s + '"\n' + t.slice(0, 800));
      console.log('PASS the schedule in DejaVu Sans: arrows, ≥, ° and accented names read back as written (pdftotext)'); }
    else console.log('PASS the PDF embeds DejaVu Sans (pdftotext not installed: the text was not read back)');
    const raw2 = fs.readFileSync(f2, 'latin1'), pages = (raw2.match(/\/Type\s*\/Page[^s]/g) || []).length, imgs = (raw2.match(/\/Subtype\s*\/Image/g) || []).length;
    assert(pages === 2 && imgs >= 2, 'a schedule with Chinese names: the drawing and the table as pictures (' + pages + ' pages, ' + imgs + ' images)');
    if (tool) { const t = execFileSync('pdftotext', [f2, '-']).toString(); assert(!/[À-ÿ]{3,}/.test(t), 'no broken text: ' + t.slice(0, 200)); }
    console.log(`PASS a schedule with Chinese names: ${pages} pages, the table placed as a picture drawn with the browser's fonts (no broken text)`);
    assert.deepEqual(errs, [], 'no page errors'); fs.rmSync(dir, { recursive: true, force: true });
  } finally { await b.close(); }
})();
