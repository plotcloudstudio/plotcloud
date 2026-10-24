# Projects & Results: batch runs and the compare workbench (2026-10-24)

## One data layer
* **Results** — every run (from a simulation page or a batch) keeps the engine's figures, and now also a small picture of the
  engine's view (`results.thumb`) and, where the engine has them, its values point by point in plan metres (`results.field`):
  Sun hours (hours on the ground, averaged per cell), Daylight (daylight factor), View analysis (share of a 90° cone),
  Space syntax and Movement & spatial depth (integration). Other engines keep figures and picture only.
  Only the newest result of a version keeps its picture and values; if the browser runs out of room, older pictures go first.
* **Diff** (`js/diff.js`) — two versions compared object by object, by id: Plan Studio's own objects (walls, doors / windows /
  openings, furniture, slabs, floor openings, fences, lights, ceiling items) and the model's other components. Position, size,
  rotation, kind, layer or any parameter differing = Modified; in one version only = Added / Removed. Rooms, automatic floors and
  the roof are derived from the walls and not listed. Both versions are prepared by Plan Studio itself (studio-bridge), so ids and
  geometry are Plan Studio's; an older version is converted the same way simulations convert it.

## Run simulations (batch)
Tick any studies, open one to change its inputs (the inputs its own page takes from Account: site, work plane, wind, storm, band…,
plus level / room), then **Run selected (N)**. It runs on the latest saved version; unsaved Workspace changes are saved as a new
version first. Each study runs its own simulation page (`#/batch-run`, `sim-engine.js` in batch mode) in an invisible frame, one
after another: the engine gets the model and inputs, presses its own Run (and Start for long runs), and when it is idle with fresh
figures the result is saved exactly as "Save result" saves it (source `batch`). Overall progress and Queued / Running / Done / Failed
per study; a failure is shown in red with Retry and does not stop the rest.
Not in batches: Circulation and Isovist safety need points a person places in the plan (destinations, an observer); they say so and
link to their pages.

## Compare versions
Version A / B (default: previous vs latest), Scope, Display, Sync cameras (on by default). Settings are kept in this browser (`pc-mvp-cmp`).
* **Whole model** — two 3D views (roof off, as in Plan Studio's 3D). Solid colour (default), Ghosted overlay, Highlight only (grey but
  the changes). Modified yellow, Added green, Removed red; a removed object shows in B as a red outline where it stood (an added one
  as a green outline in A). The list and the views are linked both ways, and the count line checks list rows = highlighted objects.
* **One level** — two plans of the chosen level, same colours and list; Sync cameras links pan and zoom.
* **One simulation** — both versions' results: the result maps (one colour scale, walls over them) or the engine pictures, and the
  figures as v A | v B | B − A (absolute or %), changed cells yellow. A threshold slider marks the points that changed at least that
  much, at once, from the saved values (nothing is run again); "Only changed areas" fades the rest. A version without the result says
  "Not run on vN" with Run it now.

Checks: `tests/mvp-results-compare.cjs`.
