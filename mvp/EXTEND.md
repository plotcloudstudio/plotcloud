# Extending the site-to-scheme path (2026-10-25)

## 1. Cities: what the open data gives, city by city

`tests/site-cities.cjs` loads the real data the map flow uses for eight city centres, 150 m round a point (run on 2026-10-25):

| Place | Buildings | Mapped height | From floor counts | No height (estimated) | Roads | Trees | Ground relief (raw → buildings filled) |
|---|---|---|---|---|---|---|---|
| Vancouver · Robson St | 61 | 33 % | 56 % | 11 % | 100 | 129 | 10.6 → 10.5 m |
| London · Soho | 305 | 0 % | 81 % | 19 % | 174 | 8 | 6.8 → 5.2 m |
| New York · Midtown | 65 | 91 % | 0 % | 9 % | 124 | 245 | 4.6 → 4.6 m |
| Tokyo · Shibuya | 100 | 71 % | 15 % | 14 % | 293 | 15 | 34.4 → 34.4 m |
| Sydney · CBD | 57 | 5 % | 82 % | 12 % | 180 | 32 | 58.2 → 58.2 m |
| Berlin · Mitte | 29 | 34 % | 55 % | 10 % | 138 | 175 | 23.3 → 23.3 m |
| São Paulo · Paulista | 55 | 98 % | 0 % | 2 % | 78 | 31 | 76.6 → 76.6 m |
| Nairobi · CBD | 7 | 14 % | 14 % | 71 % | 52 | 0 | 24.4 → 24.4 m |

What it says: the flow works anywhere OpenStreetMap is mapped, but **how much you can trust the heights depends on the city**:
New York and São Paulo have mapped heights for nearly every building, London and Sydney mostly floor counts (× 3 m), and in
Nairobi most buildings are missing or unheighted (the estimate you choose fills them, labelled `est.`). The table is the first
thing to look at before trusting Sun hours on a new city; the map step shows the same breakdown for your own site.

Not done: city open-data portals with surveyed heights (Vancouver, New York, London's LiDAR) as a second source — the network
policy of the build machine blocked `opendata.vancouver.ca`, and each portal has its own format and licence.

## 2. Terrain precision

* **Between pixels, not snapped to one.** Heights are now read bilinearly between pixel centres, across tile edges
  (`sampleAt` in `mvp/js/sitedata.js`); before, a sample took the nearest pixel, so the ground stepped by up to a pixel's height
  difference. `tests/terrain-sampling.cjs`: a tilted plane comes back exact; across a tile edge the largest step is 0.25 m against
  2.5 m before.
* **A finer grid for small sites**: 5 m up to 150 m radius (was 10 m), 10 m up to 250 m, 15 m beyond.
* **Buildings no longer raise the ground.** The elevation data is a *surface* model in many places (SRTM measures roofs and tree
  tops). Ground samples that fall inside a building are now filled from the open ground around them (`SITEC.groundFromOpen`); the
  site records how many (`terrain.filled`, `terrain.note`). In the table above this lowered London's relief from 6.8 to 5.2 m;
  elsewhere the relief comes from real slopes (Sydney, São Paulo, Tokyo) or from trees and towers that are not buildings in the data.
* **Accuracy to expect**: the tiles are about 3–5 m apart (zoom 15); vertical accuracy is that of the source — a few metres for
  SRTM, better in the US (NED, bare earth). Good enough to stand buildings on a slope and for shadows on sloping ground; not a survey.

## 3. Validation: noise and wind

* **Outdoor noise** — checked and corrected; see `mvp/VALIDATION.md` §5 (spreading from a road exact; screening now follows
  ISO 9613-2 eq. 14, including the term for a building's depth and the 20/25 dB limits; before, it was up to 5 dB too quiet
  behind tall walls and up to 4 dB too loud behind deep, low buildings). Runs in `tests/validation/run_all.sh` and in the
  engine-validation workflow when `emb/noise.html` changes.
* **Wind** — not validated yet (§6 there): no wind-tunnel comparison has been run. Its figures are not for reports.

## 4. Rhino round trip

* **Import .3dm** in the Workspace (Project › Import model): meshes, and the render meshes of surfaces, polysurfaces and
  extrusions; the file's units are used (millimetres come in as metres), object names are kept, and an object on a Rhino layer the
  project has (Walls, Furniture, …) stays on it. Surfaces saved without render meshes are skipped with a message (shade once in
  Rhino and save). Reads with McNeel's rhino3dm (openNURBS for the web) from jsDelivr.
* **Export .3dm** was already there (one named mesh per object, on its layer, in metres).
* `tests/rhino-roundtrip.cjs`: the sample written to .3dm and read back — 18 of 18 objects, 1,524 of 1,524 triangles, every name
  and layer, positions within 0.5 mm (the import rounds to a millimetre); a 1,000 mm cube comes in as 1 m.
* Not round-tripped: NURBS stay meshes on the way back to Rhino (PlotCloud's model is meshes and Plan Studio objects), and
  Plan Studio's own objects (walls, doors) go out as meshes, not as Rhino objects with parameters.
