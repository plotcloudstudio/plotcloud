// Actual Workspace calculations and downloaded reports. Only model/site inputs are fixtures.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {cacheCDN} = require('./resource-access-fixture.cjs');

const base = process.env.TEST_BASE || 'http://127.0.0.1:8790';
async function main() {
  const artifacts = process.env.ARTIFACT_DIR || await fs.mkdtemp(path.join(os.tmpdir(),'pc-workspace-report-'));
  await fs.mkdir(artifacts,{recursive:true});
  const browser = await chromium.launch({
    executablePath:process.env.CHROMIUM_PATH || undefined,
    args:['--enable-unsafe-swiftshader']
  });
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
    await cacheCDN(context);
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/mvp/');
    await page.locator('.lp').waitFor();

    // Explicit local fixture with reviewed Vancouver coordinates and an empty site context.
    const fixture = await page.evaluate(async()=>{
      const S = await import('./js/store.js');
      const {toStudio} = await import('./js/studio-convert.js');
      const {sitec} = await import('./js/studio-bridge.js');
      const {sampleModel} = await import('./js/data.js');
      const SC = await sitec();
      const project = S.projects()[0];
      const location = S.conditionsOf(project).site;
      const site = SC.newSite({lat:location.lat,lon:location.lon,label:location.label},{kind:'radius',r:25});
      Object.assign(site,{tz:-8,dst:1,tzSource:'user'});
      const models = ['A','B'].map(variant=>{
        const model = sampleModel(variant);
        model.studio = toStudio(model,location);
        model.studio.site = structuredClone(site);
        return model;
      });
      return {project:project.id,models};
    });

    const runs = [];
    for (const [index,model] of fixture.models.entries()) {
      await page.evaluate(async({projectId,model,index})=>{
        const S = await import('./js/store.js');
        const project = S.project(projectId);
        project.draft = model;
        const version = S.saveVersion(project,index===0?'Baseline glazing':'Larger glazing and south overhang');
        localStorage.setItem('pc-mvp-current',projectId);
        localStorage.setItem('pc-mvp-ver:'+projectId,version.id);
        S.save();
      },{projectId:fixture.project,model,index});
      await page.goto(base+'/mvp/#/simulations/sunhours');
      await page.waitForFunction(()=>location.hash.startsWith('#/workspace')&&window.__ws2?.ready()&&window.__wsStudy?.state().id==='sunhours',null,{timeout:120000});
      await page.locator('.sp-studycard [data-st=run]').click();
      await page.waitForFunction(()=>{
        const study = window.__wsStudy.state();
        return !study.busy && (study.res || study.err);
      },null,{timeout:120000});
      assert.equal(await page.evaluate(()=>__wsStudy.state().err),'');
      if (index===0) {
        const before = await page.evaluate(async id=>{
          const S = await import('./js/store.js');
          const project = S.project(id), conditions = structuredClone(S.conditionsOf(project));
          S.updateConditions(project,{...conditions.site,north:(conditions.site.north||0)+15},conditions.defaults);
          return {conditions,runs:project.runs.length};
        },fixture.project);
        // An already queued click must also reject inputs changed since the calculation.
        await page.locator('[data-st=save]').dispatchEvent('click');
        await page.waitForFunction(()=>__wsStudy.state().err.includes('changed after calculation'));
        assert.equal(await page.evaluate(async id=>(await import('./js/store.js')).project(id).runs.length,fixture.project),before.runs);
        await page.evaluate(async({id,conditions})=>{
          const S = await import('./js/store.js');
          S.updateConditions(S.project(id),conditions.site,conditions.defaults);
        },{id:fixture.project,conditions:before.conditions});
      }
      await page.locator('[data-st=save]').click();
      await page.waitForFunction(()=>!!__wsStudy.state().saved);
      const run = await page.evaluate(async id=>{
        const S = await import('./js/store.js');
        return structuredClone(S.project(id).runs.at(-1));
      },fixture.project);
      assert.equal(run.source,'workspace');
      assert.ok(Number.isFinite(run.results.ground));
      assert.ok(run.results.field.pts.length>0);
      assert.ok(run.settings.sharedConditions.signature);
      assert.equal(run.settings.sharedConditions.effective.tz,-8);
      assert.equal(run.settings.method,'Ladybug Direct Sun Hours');
      assert.equal(run.settings.provenance.engine,'sunhours');
      assert.equal(run.settings.provenance.versionId,run.versionId);
      assert.ok(run.settings.provenance.engineRelease);
      assert.ok(run.settings.provenance.modelHash);
      assert.ok(run.settings.provenance.recordedAt);
      runs.push(run);
      // A full reload also tests persistence outside the running Workspace instance.
      await page.goto('about:blank');
      await page.goto(base+'/mvp/');
      await page.locator('.lp').waitFor();
    }
    assert.notEqual(runs[0].versionId,runs[1].versionId);
    console.log('PASS two actual Workspace Sun Hours calculations, version-linked saves and reload');

    await page.goto(base+'/mvp/#/simulations/isovist');
    await page.waitForFunction(()=>window.__ws2?.ready()&&window.__wsStudy?.state().id==='isovist',null,{timeout:120000});
    await page.locator('.sp-studycard [data-st=run]').click();
    await page.waitForFunction(()=>{
      const study = __wsStudy.state();
      return !study.busy && (study.res || study.err);
    },null,{timeout:120000});
    assert.equal(await page.evaluate(()=>__wsStudy.state().err),'');
    assert.equal(await page.evaluate(()=>__wsStudy.state().res.settings.view.length),2);
    console.log('PASS a resolved default Isovist viewpoint is recorded before input stability checks');

    for (const study of ['vehicle-swept-path','parking-layout']) {
      await page.goto(base+'/mvp/#/simulations/'+study);
      await page.waitForFunction(id=>location.hash.startsWith('#/workspace')&&window.__ws2?.ready()&&window.__wsStudy?.state().id===id,study,{timeout:120000});
      assert.ok(await page.locator('.sp-studycard').isVisible());
    }
    console.log('PASS vehicle and parking catalog entries open their existing Workspace study cards');

    await page.goto(base+'/mvp/#/comparison-report/'+fixture.project);
    await page.locator('#reportA').selectOption(runs[0].versionId);
    await page.locator('#reportB').selectOption(runs[1].versionId);
    await page.locator('#reportStudy').selectOption('sunhours');
    const download = async kind=>{
      const event = page.waitForEvent('download');
      await page.locator('[data-report-export="'+kind+'"]').click();
      const file = await event;
      const target = path.join(artifacts,file.suggestedFilename());
      await file.saveAs(target);
      return fs.readFile(target);
    };
    const evidence = JSON.parse((await download('json')).toString());
    assert.equal(evidence.sections.length,1);
    const section = evidence.sections[0];
    assert.equal(section.a.id,runs[0].id);
    assert.equal(section.b.id,runs[1].id);
    assert.equal(section.metrics[0].a,runs[0].results.ground);
    assert.equal(section.metrics[0].b,runs[1].results.ground);
    assert.equal(section.metrics[0].delta,runs[1].results.ground-runs[0].results.ground);
    assert.notEqual(section.evidence.status,'unverified');
    assert.match((await download('metrics')).toString(),/B minus A/);
    assert.match((await download('fields')).toString(),/Sun hours/);
    const html = (await download('html')).toString();
    assert.ok(html.includes(runs[0].id)&&html.includes(runs[1].id));
    assert.ok(html.includes('<svg'));
    const pdf = await download('pdf');
    assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
    assert.ok(pdf.length>20000);
    await page.locator('#reportPreviewButton').click();
    const preview = page.frameLocator('#reportPreview').locator('body');
    await preview.waitFor();
    const previewText = await preview.textContent();
    assert.ok(previewText.includes(runs[0].id)&&previewText.includes(runs[1].id));
    await page.screenshot({path:path.join(artifacts,'workspace-comparison-report.png')});
    assert.deepEqual(errors,[]);
    console.log('PASS actual Workspace results in PDF, HTML, evidence JSON, metric/field CSV and print preview');
  } finally {
    await browser.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
