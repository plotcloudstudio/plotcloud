// Builds the research article on the Fallingwater model (mvp/research/fallingwater-model-article.js) from the checked-in model, the
// saved ventilation and daylight runs (mvp/js/fallingwater-results.js) and the output of tests/example-fallingwater.cjs: every number in
// the article's tables is read from those, never typed. Usage: node tools/build-fallingwater-article.mjs <dir with fallingwater-results.json and the study screenshots>
import fs from 'node:fs';
import path from 'node:path';
import {caseModel, site, source} from '../mvp/js/fallingwater-case.js';
import * as H from '../mvp/js/fallingwater-habs.js';
import evidence from '../mvp/js/fallingwater-results.js';
import {SIMS} from '../mvp/js/data.js';
const dir=process.argv[2];if(!dir)throw Error('the test output directory is needed');
const runs=JSON.parse(fs.readFileSync(path.join(dir,'fallingwater-results.json'),'utf8'));
const m=caseModel().studio,PX=H.PX,ft=(px)=>`${(px*PX).toFixed(2)} m`;
const lvName=Object.fromEntries(m.levels.map(l=>[l.id,l.name]));
const imgDir='img/research/fallingwater',V='?v=fw-20261116-1';
const FIG=[];const fig=(file,caption)=>{FIG.push({file,caption});return `![Fig. ${FIG.length}. ${caption}](${imgDir}/${file}${V})`;};
const table=(head,rows)=>['| '+head.join(' | ')+' |','| '+head.map(()=>'---').join(' | ')+' |',...rows.map(r=>'| '+r.join(' | ')+' |')].join('\n');
// ---- the levels, from sheet 10
const levelRows=[['Main level terrace (living level)','0′-0″','0.000 m'],['Second level terrace (bedroom level)','9′-4″',`${H.LEVELS[1].z.toFixed(3)} m`],['Third level terrace (study level)','17′-3¾″',`${H.LEVELS[2].z.toFixed(3)} m`],['Roof','24′-7⅜″',`${H.ROOF.z.toFixed(3)} m`],['Top of the platform under the hatch','−9′-3⅛″',`${H.HATCH.bottom.toFixed(3)} m`],['Main tower (chimney)','32′-9½″','9.990 m']];
// ---- the model's content by level
const count=(k,lv)=>m[k].filter(o=>o.lv===lv).length,opsOf=(lv)=>m.ops.filter(o=>m.walls.find(w=>w.id===o.wall)?.lv===lv);
const stoneRuns=(lv)=>(H.STONE[lv]||[]).length,glassRuns=(lv)=>(H.WALLS[lv]||[]).filter(w=>w[5]==='glass').length;
const levelContent=m.levels.filter(l=>l.id!=='RF').map(l=>[lvName[l.id],String(count('walls',l.id)),String(stoneRuns(l.id)),String(glassRuns(l.id)),String(opsOf(l.id).filter(o=>o.kind==='win').length),String(opsOf(l.id).filter(o=>o.kind==='door').length),String(count('floors',l.id)),m.names.filter(n=>n.lv===l.id).map(n=>n.name).join(', ')||'—']);
// ---- the fittings, from the plan sheets
const sheetOf={L1:'4',L2:'5',L3:'6'};
const fittings=m.furn.filter(f=>f.lv!=='G1').map(f=>[lvName[f.lv],f.name,f.gen?(f.gen.id==='straight'?'stair (generator)':`catalogue ${f.gen.id}`):'built-in block',`${f.w.toFixed(2)} × ${f.d.toFixed(2)}`,f.gen?'from the generator':`${f.h.toFixed(2)} (catalogue standard)`,sheetOf[f.lv]]);
// ---- the saved ventilation and daylight runs
const level={L1:'Living level',L2:'Bedroom level',L3:'Study level',G1:'Guest house'};
const [a,b]=evidence.runs;
const roomRows=a.rooms.map((r,i)=>[`${level[r.level]} · ${r.name}`,String(r.area),r.ach.toFixed(1),b.rooms[i].ach.toFixed(1),`${r.daylightFactor.toFixed(1)} %`]);
// ---- every study of the Workspace, from the test
const order=SIMS.filter(s=>s.status!=='planned').map(s=>s.id);
const studyRows=Object.entries(runs).sort((x,y)=>order.indexOf(x[0])-order.indexOf(y[0])).map(([id,r])=>r.na?[r.label,'Not applicable',r.na,'',`${r.seconds} s`]:[r.label,r.rows[0]?r.rows[0][0]:'',r.rows[0]?String(r.rows[0][1]):'',r.rows[1]?`${r.rows[1][0]}: ${r.rows[1][1]}`:'',`${r.seconds} s`]);
const studyFigs=Object.entries(runs).sort((x,y)=>order.indexOf(x[0])-order.indexOf(y[0])).filter(([id,r])=>!r.na&&fs.existsSync(path.join(dir,`fallingwater-${id}.png`))).map(([id,r])=>fig(`${id}.jpg`,`${r.label} on the Fallingwater model, as the Workspace shows it after the run (${r.rows.slice(0,2).map(x=>x.join(' ')).join('; ')}).`));
const modelFig=fs.existsSync(path.join(dir,'fallingwater-model.png'))?fig('model.jpg','The model in the Workspace as the example opens: the main house over Bear Run and the falls, the terraces and the roof over the study level, the guest house and its walkway up the hill.'):'';
const body=`## 1. Introduction

SimuSite ships Fallingwater (Edgar J. Kaufmann House, Frank Lloyd Wright, 1937) as the example every study can be tried on. An example is only useful if its geometry is known: a reader comparing a daylight factor or an air-change rate against the real house needs to know where the walls, the glass and the furniture came from, and where the model stops short of the building. This note records that. It is a description of a model and its sources, not a study of the house; the simulation results in Section 5 are screening estimates that depend on the stated inputs.

The model is traced from the measured drawings of the Historic American Buildings Survey, HABS PA-5346 [1], which the Library of Congress publishes as public-domain scans. Nothing in the main house is drawn from memory or from photographs: every wall, opening, slab, stair and piece of furniture in the model is a rectangle or a line on one of those sheets, at the sheet's own scale.

## 2. Sources

| Source | What it supplies | Where it is used |
| --- | --- | --- |
| HABS PA-5346, sheet 4 (first floor plan, ¼″ = 1′-0″) [1] | walls, glass, doors, terraces, the hatch, the kitchen, the dining table and chairs, the hearth boulder and the kettle, the built-ins | living level |
| HABS PA-5346, sheet 5 (second floor plan) [1] | walls, glass, doors, the three baths and their fixtures, the beds, closets and desks | bedroom level |
| HABS PA-5346, sheet 6 (third floor plan) [1] | walls, glass, the study's built-ins, the bath, the sleeping alcove, the full flight of the stair up from the bedroom level | study level |
| HABS PA-5346, sheet 10 (sections looking east and west) [1] | the levels (Table 1), the roof over the study level, the chimney tower, the platform under the hatch | all levels |
| HABS PA-5346, sheet 7 (south elevation) [1] | the water levels of Bear Run and the falls | site |
| HABS PA-5346, sheet 2 (site plan, 1″ = 10′) [1] | the footprint of the guest house, its terrace, pool, canopy and the covered walkway | guest house, site |
| HABS PA-5346, sheet 11 (details) [1] | which rooms have a fireplace (living room, master bedroom, dressing room, study), the hatch, the dressing-room desk | naming of the fireplace masses and the desk |
| HABS PA-5346, sheet 1 and the data pages [1, 2] | the materials: sandstone laid in random courses, reinforced concrete in light ochre, Cherokee-red steel, glass; Wright's built-in furniture | layer materials |
| USGS 3D Elevation Program [3] | the terrain beyond about 25 m from the house | site |
| The project weather file (EPW) | the weather every study runs on | all studies |
| SimuSite's furniture catalogue | the three-dimensional form of beds, baths, basins, toilets, the shower, the range, the refrigerator and the chairs, sized to the plan | fittings |

The sheets are the 2010 Charles E. Peterson Prize entry of Kent State University's College of Architecture and Environmental Design (faculty sponsor Elizabeth Corbin Murphy; delineators John Fritsch, Eric Jenior, Andrew Lallathin, Brent Schrieffer, Adam Smith, Sara Vandenbark and Nicole Zuber) [1]. The Library of Congress call number is HABS PA,26-OHPY.V,1-.

## 3. Method

The master scans are 13,632 × 17,683 pixels at 400 dpi. The three floor plans are at ¼″ = 1′-0″, so one foot is 100 pixels on the scan; the model works at a quarter of that, 25 pixels to the foot (one pixel is ${(PX*1000).toFixed(2)} mm), with the three plans registered in one frame on the long roof slab over the bedrooms and the master terrace, which every sheet draws. A drawing pixel (x, y) becomes a plan point ((x − ${H.ORIGIN[0]}) × ${PX.toFixed(6)}, (${H.ORIGIN[1]} − y) × ${PX.toFixed(6)}) in metres, the living-room floor at height zero. The site plan, at 1″ = 10′, is registered on the same two slabs and scaled by 2.5.

Three kinds of element are read differently. The hatched masonry of the plans was traced as rectangles along the poché and split into straight runs: these are the stone walls, as thick as the hatch. Glass, partitions, doors, stairs, terraces, floor slabs and room names were read by hand from the sheets as line segments or rectangles with their drawing coordinates. Furniture and fixtures are the rectangles the plans draw, at their drawn position and plan size; a bed's head follows the turned-down corner the draughtsman drew, a toilet backs onto the wall it is drawn against. Every coordinate is kept in the source file with a note of the sheet it came from, so any element can be checked against the scan.

What the plans do not give is heights. Levels come from the sections (Table 1). Fixtures take their height from the catalogue model that draws them; built-ins (counters, cabinets, desks, the wardrobes and the bookcase) are plain blocks at the catalogue's standard height for their kind, which is the one dimension in the model not read from a sheet. Curved elements (the parapet round the hatch planter, the stair tower at the foot of the walkway, the curved wall round the stair) are arcs of the drawn radius.

## 4. The model

Table 1. The levels of the main house, from the sections on sheet 10, and their height in the model.

${table(['Level','Sheet 10','Model'],levelRows)}

Table 2. The main house and the guest house by level: walls in the model, the stone runs traced from the hatch, the glass walls, openings, floor slabs and the rooms the sheets name.

${table(['Level','Walls','Stone runs','Glass walls','Windows','Doors','Slabs','Rooms named on the sheet'],levelContent)}

The roof over the study level is a slab at 24′-7⅜″ over the outline of that level's walls, and the roof over the bedrooms is the long slab the sheets draw at the study level; the terraces are concrete trays with half-round parapets as the south elevation shows them. The living-room hatch opens through the floor to the platform above the stream, −9′-3⅛″; the stair from the bedroom level to the study level is drawn whole on sheet 6 (sheet 5 cuts it at the plan height) and the opening above it is cut in the study-level slab.

Table 3. Every fitting in the main house: its level, how it is modelled, its plan size as drawn and its height, and the sheet it is read from. Catalogue pieces are the furniture generators sized to the drawn rectangle; blocks are built-ins.

${table(['Level','Piece','Modelled as','Plan size (m)','Height (m)','Sheet'],fittings)}

The guest house (1939) is drawn only as a footprint on the site plan, so it carries its walls, glass, two rooms, terrace, plunge pool, canopy and walkway, and no furniture. The servants' sitting room, the entry and the coats closet are empty on sheet 4 and are empty in the model.

Materials follow sheet 1 [1] and the data pages [2]: the stone walls and the chimney are sandstone, the trays, parapets and roofs are concrete in light ochre, the window frames and the walkway posts are steel in Cherokee red, the floors are flagstone, the built-ins walnut; the colours are approximate and are only used by the three-dimensional view.

${modelFig}

## 5. Every study on the model

The two saved runs (Table 4) were produced by the Plan Studio engine outside the browser (\`tools/build-fallingwater-results.mjs\`) with the window opening at 5 % and 15 % of the glazed area, wind from ${evidence.conditions.windFromDeg}° at ${evidence.conditions.windSpeedAt10m} m/s at 10 m, ${evidence.conditions.outdoorC} °C outside and ${evidence.conditions.indoorC} °C inside, ${evidence.conditions.terrain} terrain; the daylight factor under a CIE overcast sky on a ${evidence.conditions.workplaneM} m workplane at ${evidence.conditions.gridM} m, glazing transmittance ${evidence.conditions.glazingTransmittance}. Whole-house outdoor air changes: ${a.ach.toFixed(1)} per hour at 5 % opening (${a.airflow.toFixed(0)} L/s) and ${b.ach.toFixed(1)} at 15 % (${b.airflow.toFixed(0)} L/s); mean daylight factor ${a.daylightFactor.toFixed(2)} %. These are tagged with the model's hash (Section 6) and are shown on the example's card.

Table 4. Room by room: floor area, outdoor air changes per hour at 5 % and 15 % effective window opening, and the mean daylight factor.

${table(['Room','Area (m²)','ACH · 5 %','ACH · 15 %','Daylight factor'],roomRows)}

Table 5 lists every study in the Workspace's Add simulation menu run on the model in one browser session by \`tests/example-fallingwater.cjs\`, with the study's own headline result and the time it took on the test machine. The inputs are the study defaults and the project weather; the studies that work on one level at a time were run on the bedroom level, which has the most rooms (seven); the figures that follow are the Workspace's own drawing of each result.

Table 5. Every study, its headline result and its second line, as the Workspace reports them.

${table(['Study','Headline','Value','Second line','Time'],studyRows)}

${studyFigs.join('\n\n')}

## 6. Reproducibility

Case id \`fallingwater-habs-site500-v9\`; model hash \`${evidence.modelHash}\`; engine hash \`${evidence.engineHash}\`; the saved runs were generated ${evidence.generated.slice(0,10)}. The model is \`mvp/js/fallingwater-case.js\` with its drawing coordinates in \`mvp/js/fallingwater-habs.js\` and its details in \`mvp/js/fallingwater-details.js\`; \`node tools/build-fallingwater-results.mjs --check\` confirms that the checked-in results still come from the checked-in model, and \`node tests/example-fallingwater.cjs\` reruns every study. Site: ${site.label}, ${site.lat}° N, ${Math.abs(site.lon)}° W, true north ${site.north}° from the drawings' up.

## 7. Limits

The model is a reconstruction from measured drawings at ¼″ scale, not a survey of the building: a line on the sheet is about 1 inch wide at that scale and the tracing is not better than that. Heights of built-ins are the catalogue's. The guest house has no interior. The terrain within about 25 m of the house, the creek bed and the falls are reconstructed from the sections and the south elevation, not surveyed. The simulation results depend on the stated inputs and on each study's method, described on its card; they are screening estimates for comparing design options, not measured performance of the house.

[Open the example](#/home) · [Measured drawings at the Library of Congress](${source}) · [The model's source](https://github.com/plotcloudstudio/plotcloud/blob/main/mvp/js/fallingwater-case.js)`;
const post={id:'fallingwater-model-sources',kind:'blog',publishedAt:'2026-11-16T00:00:00-08:00',content:{format:'article',journal:'SimuSite Research Notes',journalNote:'Technical note · not peer reviewed',articleType:'Model documentation',
 title:'The Fallingwater example: a model of the main house traced from the HABS PA-5346 measured drawings, and every study run on it',
 authors:[{name:'SimuSite Studio',aff:'a'}],affiliations:[{key:'a',text:'SimuSite, building performance software for architects. Prepared with AI assistance; human review pending.'}],
 history:['Published online 16 November 2026','Version 1','Not submitted to a journal; not peer reviewed'],
 keywords:['Fallingwater','Frank Lloyd Wright','Historic American Buildings Survey','Measured drawings','Building model','Natural ventilation','Daylight factor','Reproducibility'],
 highlights:['Every wall, opening, slab, stair and fitting of the main house is a line or rectangle on a HABS PA-5346 sheet, kept with its sheet coordinates.','Levels from the sections; materials from the survey text; furniture only where the plans draw it, sized as drawn.','The one dimension not on a sheet is the height of built-ins, taken from the catalogue and stated as such.',`Whole-house outdoor air changes ${a.ach.toFixed(1)} h⁻¹ at 5 % window opening and ${b.ach.toFixed(1)} h⁻¹ at 15 %, mean daylight factor ${a.daylightFactor.toFixed(1)} %.`,`${studyRows.filter(r=>r[1]!=='Not applicable').length} studies run on the model in one browser session without an error; each result is shown. Solar Envelope reports that the site has no neighbours to protect.`],
 abstract:`SimuSite's Fallingwater example is a model of Frank Lloyd Wright's main house traced from the Historic American Buildings Survey measured drawings (HABS PA-5346, Library of Congress) at their own scale: the three floor plans give the walls, glass, doors, terraces, stair and every piece of furniture; the sections give the levels; the survey text gives the materials. This note lists the sources sheet by sheet, the method of tracing, the content of the model level by level and fitting by fitting, the two saved ventilation and daylight runs with their inputs, and the result of every study in the Workspace run on the model, with the figure each produces. Heights of built-ins are the only dimension not read from a sheet. The results are screening estimates on the stated inputs, not measured performance of the house.`,
 body,
 backmatter:[{title:'CRediT authorship contribution statement',text:'SimuSite Studio: Conceptualization, Methodology, Software, Validation, Data curation, Writing – original draft. The software and this text were developed with AI assistance (Claude, Anthropic). Human subject-matter review is pending.'},{title:'Declaration of competing interest',text:'The authors develop SimuSite, the software the model is built in.'},{title:'Data availability',text:'The model, its drawing coordinates, the saved runs and the test that reruns every study are in the public repository; the measured drawings are public-domain scans at the Library of Congress.'}],
 references:['Historic American Buildings Survey, Fallingwater, State Route 381 (Stewart Township), Ohiopyle, Fayette County, PA (Edgar J. Kaufmann House), HABS PA-5346, measured drawings sheets 1–11 (2010 Charles E. Peterson Prize entry, Kent State University), Library of Congress Prints and Photographs Division, call number HABS PA,26-OHPY.V,1-, https://www.loc.gov/item/pa1690/','Historic American Buildings Survey, Fallingwater (Edgar J. Kaufmann House), HABS No. PA-5346, written historical and descriptive data, National Park Service, U.S. Department of the Interior, https://tile.loc.gov/storage-services/master/pnp/habshaer/pa/pa1600/pa1690/data/pa1690data.pdf','U.S. Geological Survey, 3D Elevation Program (3DEP), https://www.usgs.gov/3d-elevation-program','D. Hoffmann, Frank Lloyd Wright’s Fallingwater: The House and Its History, Dover Publications, New York, 1978 (as cited in [2]).','E. Kaufmann Jr., Fallingwater: A Frank Lloyd Wright Country House, Abbeville Press, New York, 1986 (as cited in [2]).','SimuSite Studio, How accurate is the fire evacuation simulation? SimuSite Research Notes, 2026, #/blog/fire-evacuation-accuracy'],
 category:'studio',summary:'The Fallingwater example documented: which HABS PA-5346 sheet every wall, slab, stair and fitting comes from, the method of tracing, the levels and materials, the two saved ventilation and daylight runs with their inputs, and every Workspace study run on the model with its figure.',
 image:`${imgDir}/model.jpg${V}`,imageAlt:'The Fallingwater model in the SimuSite Workspace: the living level cut above its floor, Bear Run and the falls below the terraces'}};
fs.writeFileSync(new URL('../mvp/research/fallingwater-model-article.js',import.meta.url),'// Generated by tools/build-fallingwater-article.mjs from the model, the saved runs and the output of tests/example-fallingwater.cjs; edit the script, not this file\nexport const fallingwaterModelPost='+JSON.stringify(post)+';\n');
fs.writeFileSync(path.join(dir,'figures.json'),JSON.stringify(FIG));
console.log('article:',body.length,'chars;',fittings.length,'fittings;',studyRows.length,'studies;',FIG.length,'figures');
