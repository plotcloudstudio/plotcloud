# PlotCloud simulation-first MVP prototype

A runnable prototype of PlotCloud reorganised around simulations: **Home → Workspace → Simulations → Results**, with **Resources** as the free entry point.
It lives in `/mvp/` next to the production site and does not change it. Open `mvp/index.html` through any static server (the production site's server is enough), e.g. `python3 -m http.server` at the repo root, then visit `/mvp/`.

## User journey

Upload model → organise layers and components → save model version → select simulation → run analysis → save result → compare versions.

| Step | Where | Status |
|---|---|---|
| Upload model (.obj, .stl, .glb, read locally, units and up axis) | Workspace › Model | Working |
| 3D viewport: shaded, wireframe (acoustics view), plan | Workspace | Working |
| Layers: show/hide, lock, add; components: select, rename, move to layer, type, material, room finishes, position/size, duplicate, delete | Workspace | Working |
| Save version (immutable snapshot + note), reopen any version, unsaved-changes state | Workspace › Versions | Working (this browser only) |
| Browse all 14 analysis tools, open each full tool | Simulations | Working (links to production tools) |
| Run on a saved version with settings | Simulations › Preview | **Mock**: prototype estimate, labelled in the UI |
| Save result linked to version + settings | Run screen | Working (stores the mock result) |
| Version × simulation matrix, A/B compare with deltas, settings check, model diff, trend | Results | Working on stored results |
| Send a version into a full tool and save its real result back | — | **Planned** (labelled in the UI) |
| Log in / sign up, account with default site, simulation defaults, your projects | Account (`#/login`, `#/account`) | **Mock** auth kept in this browser; no server, no password stored |
| Worldwide site search (address, place or `lat, lon`), map, true north | Account › Site | Working: Nominatim (OSM) address search, OSM map embed |
| Site data: time zone, Köppen climate, annual rain, mean wind + prevailing direction, ground elevation, buildings mapped nearby | Account › Site | Working: Open-Meteo (ERA5 last full year, Copernicus DEM) and Overpass. A value a source does not return is shown as missing, never guessed |
| Pricing (Free / Pro CAD 9 mo or CAD 79 yr, 7-day trial / Teams) | Pricing | Prices as on the production site; no payment in the prototype |
| Day / night theme (saved per browser) | Header | Working |
| Cloud storage, sharing, real accounts and billing | — | Not in the prototype |

Labels used in the UI: `Mock` (prototype estimate), `Working tool` (opens the existing PlotCloud tool), `Planned`.

## Inventory of what PlotCloud has today (preserved, linked, not modified)

**Analysis (14)** — all open from Simulations via `../index.html#/tool/<id>`:
sunhours (Sun hours), daylight, wind (Wind flow), vent (Natural ventilation), stormwater (Stormwater & waterlogging), acoustics (Indoor acoustics),
spacesyntax, movementdepth (Movement & spatial depth), evac (Circulation), isovist (Isovist safety), views (View analysis), cameras (Camera coverage),
structure (Structural analysis), span (Structure sizer).

**Model building** — Plan Studio (`#/studio`), 3D model generator (`furniture`), Facade studio, DetailLab.

**Presentation tools** — Color palettes, Pin-up composer, Board studio, Exploded site axon, Physical model (`topo`).
Also in the production site: Site analysis atlas (`emb/atlas.html`), Render workspace (`emb/render.html`), Boards.

**References** — Building code finder (BC/ON), Accessibility finder, LEED v5 finder, Ergonomics cheat sheet, Scale & sheets.

**Resource library** (`#/library`, `#/showroom`) — CAD, Rhino, Revit, Grasshopper, 3D & case study models, diagrams & graphics, site & urban kits, presentation and portfolio templates.

Dependencies: static site, three.js 0.169/0.170 from jsDelivr, rhino3dm for .3dm, Overpass/OSM for site context, IndexedDB/localStorage in the browser, a small render API in `server/`.

## Code layout

```
mvp/index.html          shell, nav, import map (three.js 0.170.0)
mvp/css/mvp.css         all styles; tokens match the production simulation tools
mvp/js/app.js           hash router, helpers, Mock/Working labels
mvp/js/data.js          simulation catalog (real tool ids), resources, sample model
mvp/js/store.js         projects / versions / runs in localStorage; model diff
mvp/js/mocksim.js       prototype estimates (replace with real engine adapters)
mvp/js/viewport.js      three.js viewport (shaded / wire / plan, picking) and mesh import
mvp/js/site.js          worldwide geocoding + site data (Nominatim, Open-Meteo, Overpass) and Köppen class
mvp/js/pages/*.js       home, workspace, simulations, results, resources, pricing, login, account
mvp/img/                holographic simulation renders, -day and -night versions
```

## Data model (ready for a backend)

```
account { user, site, defaults }                        site: { label, lat, lon, north, tz, koppen, rain, wind, windDir, elev, buildings, year }
project { id, name, site, draft, versions[], runs[] }   site copied from the account when the project is created
version { id, n, note, created, model }                 immutable
model   { units, north, layers[{name,color,visible,locked}], components[{id,name,type,layer,g:{x,y,z,w,d,h},mat,room?,mesh?}] }
run     { id, versionId, simId, settings, results, created, source: 'prototype-mock' | 'full-tool' }
```

## Next steps toward the full platform

1. Adapter per tool: export a version as the scene format each tool already reads (Plan Studio scene JSON / `plotcloud-scene`), open the tool with it, and post the tool's result back (`source: 'full-tool'`). The production tools already exchange scenes this way with Plan Studio.
2. Replace `mocksim.js` previews with those real results; keep the label until then.
3. Move `store.js` to an API (projects, versions, runs) with accounts.
4. Bring Plan Studio models into the workspace as versions.
