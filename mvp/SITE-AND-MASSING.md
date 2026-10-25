# From a place on the map to masses on the site (2026-10-25)

One path for the first hour of a project, all in the browser, all with open data:

1. **Dashboard › New project › From the map** (`#/new-site`). Find the place, set the study radius (100–500 m), draw or pick
   the plot, *Load the site*. Choosing a site for an existing project: Workspace › Project › Site › *Choose another site on the map*.
2. **Plan Studio gets the site** on the locked *Site* layer: buildings (with the source of every height), roads with their
   widths, water and green areas, trees, and the ground.
3. **Massing** (Workspace rail › Massing, or Plan Studio › Draw plan › Massing): draw masses on the plot and read the site
   figures as you go.
4. **Edit the surroundings** where the map data is wrong: change a height, leave a building out, draw one that is missing.

## Data and where it comes from

| What | Source | Notes |
|---|---|---|
| Buildings, building parts, roads, water, green areas, trees | OpenStreetMap (© OpenStreetMap contributors, ODbL 1.0) via Overpass (overpass-api.de, overpass.kumi.systems, maps.mail.ru in turn), the OpenStreetMap API as a last resort for sites up to 400 m | The source, licence and time are stored with the site |
| Heights | OSM `height` / `building:height`, else `building:levels` × 3 m, else an estimate you choose (storeys × 3 m), labelled on the plan (`est.`, `(floors)`, `(yours)`) | Never silent |
| Ground | AWS Terrain Tiles (Terrarium, zoom 15, about 3–5 m; SRTM, NED and other public data) | Heights relative to the site point; buildings stand on the lowest ground under them |

## Massing

* **Mass outline** (click corners; the first corner, Enter or a double-click closes; Backspace removes the last corner; Esc cancels)
  and **Rectangle mass** (drag). Corners snap to the plot, to other masses and to neighbouring buildings, then to Plan Studio's own snaps.
* A mass has a name, a use (colour only), storeys and floor-to-floor height; entering a height in metres rounds to whole storeys.
  Drag it to move it, drag a white corner to reshape it, Duplicate, Delete, Undo.
* A mass stands on the lowest ground under its outline. It is on no level and on the **Masses** layer (Workspace layer *Masses*,
  Plan Studio layer registry `mass`); it shows in 2D, 3D (with a line at every floor) and in the Workspace's object list.
* **Site figures** (top left of the plan): plot area, footprint, coverage (footprint ÷ plot), GFA, FAR (GFA ÷ plot), tallest.
  Overlapping masses (a tower on a podium) are counted once: where they overlap, the tallest counts (0.25 m raster).
  A mass that crosses the plot boundary is flagged.
* **GFA here is footprint × storeys, outer walls included.** It is a design figure, not the floor area a zoning bylaw or a building
  code counts (no exclusions, no balconies, no setbacks or height limits are checked).
* **Sun hours** gets every mass as a proposed building, with the site's neighbours casting shadows.

## Sun on the site (preview)

*Sun on* in the site-figures card shades the ground around the masses with its hours of direct sun for 21 March, 21 June or
21 December, and recalculates as you draw.

* Same sun position as Sun hours (the NOAA code of `emb/sunhours.html`; the test compares 60 positions: identical). The day is split
  into 15-minute steps; a step counts when the sun is more than 0.25° up, as in Sun hours.
* Shadows from the masses and from every site building with a height, standing on the terrain. A ground point is in shade when the
  ray to the sun enters a building below its top. The test checks a 10 m wall against the exact ray–plane answer: identical.
* Grid 2–4 m over the plot and the masses plus 25 m all round. It is a preview: *Send to Simulation › Sun hours* is the full
  calculation (finer grid, time step, the sun's path, exports).
* Figures: share of the plot's open ground with at least 2 hours (the BRE guide "Site layout planning for daylight and sunlight" asks
  for at least half of a garden or amenity area on 21 March), the plot's average, the average on the ground around the plot, and how
  much sun the masses take from it (the same ground with and without them).
* Not modelled: trees, reflected light, terrain shading beyond the site's grid, sunlight on facades and windows (that is Sun hours'
  façade mode and Daylight).

## Schemes

The tabs **A B +** in the card are schemes: each holds its own masses; the site, walls and everything else are shared (stored once).
**+** copies the open scheme; double-click the open tab to rename it; *Delete* removes it (Undo brings it back).
**Compare** shows every scheme side by side (masses, footprint, coverage, GFA, FAR, tallest, plot ≥ 2 h sun, sun around the plot,
all on one patch of ground so they compare) and one sentence per scheme against the first, for example:

> Scheme B against Scheme A: +6,343 m² GFA (+300 %), a tallest mass 38.4 m higher; the ground around the plot gets 0.7 h less sun on 21 March (−11 %).

Save points are the project's versions (Workspace › Save version), which keep every scheme.
Send to Simulation › Sun hours reads the open scheme, with the site's buildings and the terrain.

## Editing the surroundings

Unlock the *Site* layer in the Workspace (it is locked by default), then click a building:

* **Height** — a new value is kept as yours (`hSource: 'user'`, `edited`), shown as `(yours)` on the plan.
* **Leave out** — for a building that has been demolished or is part of your scheme. It casts no shadow and is in no simulation;
  it stays as a faint dashed outline so you can click it and **Put it back**.
* **Neighbour building** (Massing panel) — draw one that is missing from the map; it starts at 12 m, set its height.
* A re-import of the same area keeps what you drew and what you changed (`SITEC.reimport`).
* Site context sub-layers: Buildings, Roads & paths, Water & green, Trees, Ground (terrain).

## Tests

* `tests/mvp-new-site.cjs` — the map flow with real OpenStreetMap and terrain (needs the network).
* `tests/mvp-massing.cjs` — massing in the Workspace (tool, model, layer, Properties pane, 3D pane, site figures, Sun hours) and in
  Plan Studio with a small labelled OpenStreetMap fixture (snapping, overlap, FAR, corner drag, boundary flag, delete, editing,
  leave out, put back, a drawn neighbour, re-import, sub-layers, undo, 3D), the sun preview and schemes, and the preview's sun
  position and shadows against Sun hours' own code and an exact answer. No network needed.

## Not done yet

Setbacks, height limits and zoning envelopes; masses on top of other masses (a raised base); turning a mass into floors and
rooms (Step 5); sun on facades in the preview; comparing schemes in Results with full simulation runs.
