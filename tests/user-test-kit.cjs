// The usability test kit (mvp/user-test): the moderator's timer records a task, the SUS score is right, the CSV exports.
// Run with a static server on 8765 (python3 -m http.server 8765 --bind 127.0.0.1); TEST_BASE overrides it.
const { chromium } = require('playwright'); const fs = require('fs');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1100, height: 900 } }), p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto((process.env.TEST_BASE || 'http://127.0.0.1:8765') + '/mvp/user-test/timer.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.selectOption('#pid', 'P2'); await p.fill('#profile', 'architect, 6 years'); await p.click('[data-t="T3"]');
  await p.click('#start'); await p.waitForTimeout(2200); await p.click('#stop');
  await p.click('#outcome [data-v="P"]'); await p.click('#help [data-v="2"]'); await p.click('#seq [data-v="5"]'); await p.fill('#errors', 'looked for storeys in the left panel\nmisread FAR as coverage');
  const rec = await p.evaluate(() => JSON.parse(localStorage.getItem('pc-usertest-v1')).P2.tasks.T3);
  ok(rec.time >= 2 && rec.time <= 4 && rec.outcome === 'P' && rec.help === '2' && rec.seq === '5', `a task is timed and recorded: ${rec.time} s, ${rec.outcome}, help ${rec.help}, SEQ ${rec.seq}`);
  ok(/T3<\/td><td>0:0[234]<\/td><td class="P">P/.test(await p.innerHTML('#sum')) && /<td>2<\/td><\/tr>/.test(await p.innerHTML('#sum')), 'the session table shows it, with 2 errors');
  // SUS: all 4 on positive items (odd), 2 on negative (even) → (3×5 + 3×5) × 2.5 = 75
  for (let i = 0; i < 10; i++) await p.click(`#sus [data-q="${i}"] [data-v="${i % 2 === 0 ? 4 : 2}"]`);
  ok((await p.textContent('#susScore')) === '75.0', 'SUS score is computed the standard way: ' + await p.textContent('#susScore'));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#csv')]); const csv = fs.readFileSync(await dl.path(), 'utf8').split('\n');
  if (process.env.DBG) console.log(csv.join("\n"));
  const rows = csv.filter((l) => /^"P\d"/.test(l));   // a quoted field can hold a line break (the errors list)
  ok(csv[0].startsWith('participant,profile,date,moderator,task') && rows.length === 7 && /"P2","architect, 6 years"/.test(rows[2]) && /"T3".*"P"/.test(rows[2]) && /"75"$/.test(rows[6]), `the CSV has the recording-sheet columns, 7 task rows and the SUS score (${rows.length} rows)`);
  const sheet = fs.readFileSync(require('path').join(__dirname, '../mvp/user-test/recording-sheet.csv'), 'utf8').split('\n')[0].trim();
  ok(sheet === csv[0].trim(), 'the export matches the printed recording sheet’s columns');
  if (errs.length) { console.log('page errors:', errs); process.exitCode = 1; }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
