const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = process.env.BASE_URL || "http://127.0.0.1:8765";
  await page.goto(base + "/emb/sunhours.html");
  await page.waitForFunction(() => window.SunHoursStudy);
  await page.waitForSelector("#empty:not([hidden])");
  assert.equal(
    await page.locator("input[type=file],#north,#city,#lat,#lon").count(),
    0,
  );
  assert.equal(await page.locator("details").count(), 3);
  assert.equal(await page.locator("[data-view]").count(), 3);
  const sc = {
    format: "plotcloud-scene",
    name: "Courtyard v3",
    north: 75,
    loc: { lat: 0, lon: 0, tz: 0 },
    masses: [
      {
        outer: [
          [-20, -20],
          [20, -20],
          [20, -10],
          [-20, -10],
        ],
        base: 0,
        h: 15,
      },
      {
        outer: [
          [-20, -10],
          [-10, -10],
          [-10, 20],
          [-20, 20],
        ],
        base: 0,
        h: 15,
      },
      {
        outer: [
          [10, -10],
          [20, -10],
          [20, 20],
          [10, 20],
        ],
        base: 0,
        h: 10,
      },
    ],
  };
  await page.evaluate(async (sc) => {
    await SunHoursStudy.accept(
      {
        id: "acceptance",
        name: "Courtyard project",
        settings: {
          north: 30,
          location: { lat: 49.28, lon: -123.12, tz: -8, dst: 1 },
        },
      },
      sc,
    );
  }, sc);
  await page.waitForFunction(() => SunHoursStudy.getResult()?.hours);
  assert.match(
    await page.locator("#context").textContent(),
    /Courtyard project · Courtyard v3/,
  );
  assert.equal(
    await page.evaluate(() => SunHoursStudy.getContext().north),
    -30,
  );
  const before = await page.locator("#stage").boundingBox();
  await page.click("#toggleParameters");
  const after = await page.locator("#stage").boundingBox();
  assert.ok(after.width > before.width + 150);
  await page.click("#expandParameters");
  let initial = await page.evaluate(() => ({
    mean: SunHoursStudy.getResult().data.mean,
    geometry: SunHoursStudy.getGeometry().triangles,
  }));
  await page.uncheck("#facades");
  await page.waitForFunction(() => !document.querySelector("#export").disabled);
  assert.ok(
    (await page.evaluate(() => SunHoursStudy.getGeometry().triangles)) <
      initial.geometry,
  );
  await page.check("#isolines");
  await page.waitForFunction(() => !document.querySelector("#export").disabled);
  assert.ok(
    await page.evaluate(() => SunHoursStudy.getGeometry().contourVertices > 0),
  );
  await page.locator("#time").evaluate((e) => {
    e.value = 1080;
    e.dispatchEvent(new Event("input"));
  });
  await page.waitForFunction(
    () =>
      SunHoursStudy.getResult()?.minute === 1080 &&
      !document.querySelector("#export").disabled,
  );
  assert.ok(
    (await page.evaluate(() => SunHoursStudy.getResult().data.mean)) >
      initial.mean,
  );
  assert.equal(
    await page.locator("#hourly [aria-pressed=true]").getAttribute("data-hour"),
    "18",
  );
  await page.click('[data-view="3d"]');
  assert.equal(await page.evaluate(() => SunHoursStudy.getView()), "3d");
  await page.screenshot({ path: "/tmp/plotcloud-sunhours-3d.png" });
  await page.click('[data-view="sun"]');
  assert.equal(await page.evaluate(() => SunHoursStudy.getView()), "sun");
  await page.screenshot({ path: "/tmp/plotcloud-sunhours-sunview.png" });
  await page.click('[data-view="plan"]');
  await page.screenshot({ path: "/tmp/plotcloud-sunhours-plan.png" });
  await page.selectOption("#format", "SVG");
  await page.click("#export");
  assert.match(await page.locator("#exportStatus").textContent(), /via Boards/);
  await page.selectOption("#format", "PDF");
  await page.click("#export");
  assert.match(await page.locator("#exportStatus").textContent(), /via Boards/);
  await page.selectOption("#format", "PNG");
  const downloadPromise = page.waitForEvent("download");
  await page.click("#export");
  const dl = await downloadPromise;
  const path = await dl.path();
  const bytes = fs.readFileSync(path);
  assert.equal(bytes.subarray(1, 4).toString(), "PNG");
  assert.ok(bytes.length > 20000);
  assert.equal(bytes.readUInt32BE(16), 1600);
  assert.equal(bytes.readUInt32BE(20), 1000);
  const summerMean = await page.evaluate(
    () => SunHoursStudy.getResult().data.mean,
  );
  await page.click('[data-date="12-21"]');
  await page.waitForFunction(
    () =>
      SunHoursStudy.getResult()?.date.endsWith("12-21") &&
      !document.querySelector("#export").disabled,
  );
  assert.ok(
    (await page.evaluate(() => SunHoursStudy.getResult().data.mean)) <
      summerMean,
  );
  await page.click("#reset");
  await page.waitForFunction(
    () =>
      SunHoursStudy.getResult()?.minute === 720 &&
      SunHoursStudy.getResult()?.date === "2026-06-21" &&
      !document.querySelector("#export").disabled,
  );
  assert.equal(
    await page.evaluate(() => SunHoursStudy.getContext().north),
    -30,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/plotcloud-sunhours-mobile.png" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(async (sc) => {
    const db = await new Promise((r) => {
      const q = indexedDB.open("pc-project", 1);
      q.onsuccess = () => r(q.result);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(
        {
          id: "acceptance",
          name: "Saved Account project",
          settings: {
            north: 20,
            location: { lat: 49.28, lon: -123.12, tz: -8, dst: 1 },
          },
          scene: JSON.stringify(sc),
          versions: [],
          results: [],
        },
        "cur",
      );
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    db.close();
  }, sc);
  await page.goto(base + "/index.html#/tool/sunhours", {
    waitUntil: "domcontentloaded",
  });
  const tool = page.frameLocator('iframe[data-emb=\"sunhours\"]');
  await tool
    .locator("#context")
    .filter({ hasText: "Saved Account project" })
    .waitFor();
  await tool.locator("#export:not([disabled])").waitFor({ timeout: 60000 });
  assert.equal(await tool.locator("[data-view]").count(), 3);
  assert.equal(
    await tool
      .locator("#stage")
      .evaluate(() => SunHoursStudy.getContext().north),
    -20,
  );
  await page.evaluate(() => PlotCloudUI.setTheme("night"));
  await tool
    .locator("body")
    .evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  assert.equal(
    await tool.locator("body").evaluate((e) => getComputedStyle(e).color),
    "rgb(236, 239, 243)",
  );
  await page.evaluate(() => PlotCloudUI.setTheme("day"));
  await page.screenshot({ path: "/tmp/plotcloud-sunhours-integrated.png" });
  await tool
    .locator("#stage")
    .evaluate(() => SunHoursStudy.accept({ name: "Empty project" }, null));
  assert.equal(
    await tool.locator("#stage").evaluate(() => SunHoursStudy.getResult()),
    null,
  );
  assert.equal(await tool.locator("#export").isDisabled(), true);
  await tool.locator("#empty:not([hidden])").waitFor();
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS Sun Hours: Account context, three views, collapsible parameters, computed data, facade/isolines, real PNG, Boards notices.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
