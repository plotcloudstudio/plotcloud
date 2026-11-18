// The Blog holds research and events (2026-11-17): All / Research / Events filters; a published event (served here in place of the
// content database) shows with its date and place, marked Upcoming while its date is ahead, and sits first; Research lists the two
// research notes and not the event; Events lists the event and not the notes. Nothing is written to the real database.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }), p = await ctx.newPage(), base = process.env.TEST_BASE || 'http://127.0.0.1:8765', errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const ahead = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
    const event = { id: 'post-qa-talk', kind: 'blog', publishedAt: new Date().toISOString(), content: { title: 'QA talk: daylight in early design', category: 'event', university: 'QA School of Architecture', location: 'Toronto', eventDate: ahead, summary: 'A test event.', body: 'Body.' } };
    await ctx.route('**/rest/v1/rpc/pc_public_site_content', (r) => r.fulfill({ json: [event] }));
    await p.goto(base + '/mvp/#/blog'); await p.waitForSelector('[data-blog-category]'); await p.waitForTimeout(800);
    assert.deepEqual(await p.$$eval('[data-blog-category]', (bs) => bs.map((x) => x.textContent)), ['All', 'Research', 'Events']);
    assert.match(await p.locator('#app h1').innerText(), /Research and events/);
    const ids = () => p.$$eval('#cmsStories article[id]', (as) => as.map((a) => a.id));
    const all = await ids(); assert.equal(all[0], 'post-qa-talk', 'the upcoming event first: ' + all); assert(all.includes('fallingwater-model-sources') && all.includes('fire-evacuation-accuracy'));
    const card = await p.locator('#post-qa-talk').innerText(); assert.match(card, new RegExp(`Upcoming[\\s\\S]*Event[\\s\\S]*QA School of Architecture[\\s\\S]*Toronto[\\s\\S]*${ahead}`, "i"));
    await p.click('[data-blog-category=research]'); assert.deepEqual((await ids()).sort(), ['fallingwater-model-sources', 'fire-evacuation-accuracy']);
    await p.click('[data-blog-category=events]'); assert.deepEqual(await ids(), ['post-qa-talk']);
    await p.screenshot({ path: (process.env.SHOT_DIR || require('os').tmpdir()) + '/blog-events.png' });
    console.log('PASS the Blog: All / Research / Events; an upcoming event first, with its host, place and date; each filter lists its own posts');
    // without events, the Events filter says what will appear
    await ctx.unroute('**/rest/v1/rpc/pc_public_site_content'); await ctx.route('**/rest/v1/rpc/pc_public_site_content', (r) => r.fulfill({ json: [] }));
    await p.reload(); await p.waitForSelector('[data-blog-category=events]'); await p.waitForTimeout(800); await p.click('[data-blog-category=events]'); assert.match(await p.locator('#cmsStories').innerText(), /No events published yet/);
    console.log('PASS no events yet: the Events filter says talks, workshops and campus visits will appear there');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
