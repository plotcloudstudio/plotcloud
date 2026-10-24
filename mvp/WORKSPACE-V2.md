# Workspace (merged, formerly Workspace v2): reconciliation

`#/workspace` is now the merged Workspace (it was `#/workspace-v2`; old links redirect). It is laid out, laid out like Rhino: tool rail and panel on the left, a large viewport, layers on the right and a status bar at the bottom. The earlier Workspace (`js/pages/workspace.js`, `js/viewport.js`) is unchanged and kept as an archive at `#/workspace-archive` for rollback. The TEMP nav entry is gone.

New files: `js/pages/workspace-v2.js`, `js/viewport2.js`, plus a `Workspace v2` block at the end of `css/mvp.css`. Edited: `js/app.js` (one route) and `index.html` (one nav link).

## Top bar

| Control | Placement |
|---|---|
| Main nav, PROTOTYPE badge and its hint, Day / Night, Log in / Start free | Unchanged |
| All tools ↗ | Removed from the formal site (merged version only). Kept only in the archived Workspace's top bar, unchanged |

## Where every control of the archived Workspace went

| Archived Workspace | Control | Workspace v2 | Status |
|---|---|---|---|
| Left · Project | Project dropdown | Left panel, Project state (default) | Kept |
| Left · Project | Site line (place · north) | Left panel, Project state | Kept |
| Left · Project | "Sample project… kept in this browser" / "Stored in this browser." | Left panel, Project state | Kept |
| Left · Model | "Import .obj · .stl · .glb" button | Left panel → Import model | Kept, same text |
| Left · Model | Drop zone "or drop a file here · read locally" | Left panel → Import model | Kept, same text |
| Left · Model | File input (.obj, .stl, .glb, .gltf) | Left panel → Import model | Kept |
| Left · Model | Units: Metres / Millimetres / Centimetres / Feet (default Metres) | Left panel → Import model | Kept: same options, order, values and default |
| Left · Model | Up axis: File default / Z up / Y up (default File default) | Left panel → Import model | Kept: same options, order, values and default |
| Left · Model | Import status message | Left panel → Import model | Kept. Now also says how many meshes went to each layer |
| Left · Model | Unit and axis conversion (`importModel` in viewport.js) | Same function, imported unchanged | Kept |
| Left · Model | Imported meshes all go to the Imported layer | Sorted by mesh name: walls → Walls, furniture → Furniture, windows → Glazing, slabs → Structure, roofs → Roof, anything else → Imported | Changed as specified |
| Left · Model | "Add a component" (Massing block / Wall / Window / Room / Slab) | Removed at review | Furniture is now placed from the left panel (drag or click, as in Plan Studio). Walls, rooms, slabs and windows will come from the Draw room and Window tools in step 2; until then they can be duplicated from existing parts |
| Left · Model | Links: Plan Studio ↗ (Site Planner and Plan tracer were removed 2026-10-24) | Left panel, Project state | Kept. The "bringing their models in is Planned" sentence is dropped: the tool rail replaces it (placement in step 2) |
| Left · Layers | "+ Layer" | Right column, Layers header | Moved, same behaviour |
| Left · Layers | Layer row: colour, name/expand, count, Hide/Show, Lock | Right column: table row with colour, name/expand, count, eye icon, lock icon | Moved. Hide removes the layer from the view; Lock blocks picking in the view and in the tree, and clears the selection if it was on that layer |
| Left · Layers | Component list (click to select) | Right column, inside each expanded layer | Moved. Items on hidden or locked layers are disabled |
| Centre | 3D viewport (orbit, pan, zoom, click to select) | Centre, fills the remaining space | Kept |
| Centre | View buttons: Shaded / Wireframe / Plan | Floating menu at the top left of the viewport. Display: Shaded / Ghosted / Wireframe. View: Perspective, plus one "Plan · Level n" per level | Replaced, see below |
| Centre | Fit | Top right of the viewport | Kept |
| Centre | PNG | Left panel, Project state → Export (with Import) | Moved at review |
| Centre | Status badge (project · version · unsaved changes) | Status bar, right side | Moved |
| Centre | Help line (orbit / pan / zoom / select) | Bottom of the viewport | Kept. Text changes with the view |
| Right · Selection | Empty state ("Click a component… N components on M layers") | Right column, Selection | Kept |
| Right · Selection | Name, Layer, Type, Material or floor/ceiling finish, Position x/y/z, Size w/d/h | Left panel, Parameters state (opens when you select something) | Moved. Same fields, same rules (imported meshes keep their size); edits go to the same draft and redraw the view |
| Right · Selection | Clear, Duplicate, Delete | Right column, Selection, with a one-line summary and "Edit parameters"; with several selected: count, Clear, Delete all | Kept |
| Right · Versions | Unsaved / up-to-date line, description, Save version, Open / Simulate on each version | Right column, Versions | Kept, same behaviour |
| Right · Next | "Choose a simulation" (red) and its note | Right column, Next | Kept |

## New in step 1, and what is real

| New | Works now | Not yet |
|---|---|---|
| Tool rail: Draw room, Door, Window, Furniture, Light, Project | Switches the left panel. Names are copied exactly from the current Plan Studio: Draw room 11 (Draw rooms 5, Add structure 6), Door 4, Window 2, Furniture 39 in 12 categories, Light 6. The furniture list is read from Plan Studio's own catalogue (`furniture/models.js`) and each piece shows Plan Studio's picture (`img/furniture/`, saved from its library at default sizes). Door, window, stair and light tiles use Plan Studio's tile icons (`img/tools/`, `js/tool-icons.js`) | Clicking an item only shows "Placement arrives in Step 2" and adds nothing |
| Display modes | Material change only: Shaded = solids fully opaque in Plan Studio's warm model colours, by material (plaster and gypsum beige, concrete grey-beige, timber light oak, glass pale blue, grass green), with thin dark edges; glass stays see-through and room volumes show nothing. Ghosted = every part 50% with edges, Wireframe = edges only. The selection stays highlighted in every mode | — |
| Plan views | One entry per level read from the model: each slab top is a level. The sample has a single slab, so there is one entry, "Plan · Level 1". Top orthographic camera, cut 1.2 m above the level | — |
| Elevation | Orthographic front camera, looking north, on the same scene. Drag pans, scroll zooms, click selects | Other sides |
| Walkthrough | Camera at 1.6 m in the first room on the level. Drag looks around, scroll moves forward or back | Collisions, stairs, real walk mode |
| Import site | The button and the rule: site geometry goes on the Site layer, locked | Clicking shows "Site import arrives in Step 2". Plan Studio's "Real site" exists, but it lives inside Plan Studio and cannot be called from this page without changing Plan Studio, so it will be extracted in step 2 |
| Status bar: End, Near, Mid, Cen, Gumball | Settings are saved in this browser and survive a reload | No snapping or gumball behaviour yet (step 6); the tooltips say so |
| Status bar: Clearance | Works now (brought forward at review). A dashed red outline round each furniture piece: footprint plus the free space it wants, using Plan Studio's rules from `furniture/models.js` (default front 0.6 m, back and sides 0.3 m; bed and fridge front 0.9 m, sofa front 0.8 m, and so on). Front is −y, as in Plan Studio. A hint only: it blocks and snaps nothing. Visible in every view, hidden behind solids in perspective. The setting survives a reload | Pieces without a stored kind get one guessed from the name (for example "Long table" → Dining table). Parameters show the guess and a "Furniture kind" dropdown to correct it, which is saved on the piece |


## Added at review (round 2)

| Feature | How it works | Not yet |
|---|---|---|
| Interior elevation | Replaces the right-column Elevation button. It opens a plan map of the level's walls, as in Plan Studio. Click a wall on the side you want to look at; a blue arrow shows the direction and the room it is seen from. The view is orthographic on the same scene, clipped to that room (its depth, width and height), so the opposite wall and anything outside the room are cut away. The exterior front elevation stays in the view menu | Labels and dimensions on the elevation |
| Explode | Next to Interior elevation. As in Plan Studio: storeys pulled apart along Z (one band per level, plus a roof band). Gap slider 0–4000 mm (default 1500), storey labels, Reset, Close. Display only; selection is off while exploded | — |
| Export | In the left panel under Import. PNG of the current view; Rhino .3dm (meshes on their layers, metres, written with rhino3dm); SketchUp .dae (Collada, which SketchUp imports); OBJ (Y up); glTF .glb; STL; DXF (3D faces on layers); IFC4 (walls, slabs, windows, furniture and spaces as their IFC classes, tessellated). Hidden layers are left out. Every format was read back in the browser (three.js loaders, rhino3dm, web-ifc) | .skp itself: only SketchUp's SDK can write it |
| Selection like Rhino and Revit | Left-drag a box: left→right selects what is fully inside (solid red box), right→left selects what it touches (dashed blue box). Shift adds, Ctrl or Cmd removes, Esc clears. Right-drag orbits, Shift+right-drag or middle-drag pans. Hovering pre-highlights in blue; Tab and Shift+Tab cycle through everything under the cursor (the hint shows "2 of 4"), and a click selects the highlighted one. In plan views, picking uses the footprint below the cut, as on a drawing. With several selected, the left panel lists them, moves them to a layer or deletes them | — |
| Plan views like Plan Studio | In Plan · Level views a selected furniture piece gets Plan Studio's blue dashed outline, a turn handle (drag to rotate; snaps to 5° on release) and its clear distance to the nearest wall face on all four sides, in millimetres (the measuring code is ported from Plan Studio). Click a distance to type a new one; the piece moves to match, kept between 0 and the space available. Press on a piece and drag to move it (1 cm steps); the distances update live. With Clearance on, plan views draw Plan Studio's dashed red rounded outline round each piece (turned with it); other views keep the 3D floor outline. Picking in plan prefers solids, then rooms, then floors | Resize handles, alignment snapping, on-plan moving of walls and windows |
| Furniture placement | "Add a component" is gone from the right column. Drag a furniture card onto the model, or click it and then click on the floor (a ghost box follows the cursor, snapped to 5 cm; Esc stops). The piece is Plan Studio's own parametric model (`furniture/models.js` + `furniture/geom.js`) with its part colours. It goes on the Furniture layer (placing is refused while that layer is locked or hidden) and is selected after placing. Parameters show Plan Studio's fields in English (for example Mattress width), plus 90° rotation; size follows the parameters. Only the kind, parameters and rotation are saved; the mesh is rebuilt when the page opens | Door, window, wall, room, stair and light tools (step 2); free rotation and on-plan dragging |

## One store

The page keeps one store in this browser (`pc-mvp-ws2`): view and level, display mode, panel, selection (per project), status-bar settings and which layers are expanded. Hide and lock live on the project's layers, as in the archived Workspace, so saved versions keep them. Selection is set in one place, and the viewport, layer tree, left panel, rail and Selection pane all react to that one value.

## Checked in the browser

On a local server, from a clean browser profile:
- The archived Workspace opens as before.
- The nav entry opens `#/workspace-v2` with all five areas.
- The sample shows 8 layers and 19 components (Site 1, Context 2, Structure 1, Walls 5, Glazing 4, Roof 2, Rooms 2, Furniture 2). Site starts locked.
- Selecting from the tree opens Parameters, and edits reach the project data.
- Each display mode sets the expected material opacity, and the selection survives the switch.
- The number of plan entries equals the number of slab levels in the data.
- Elevation and walkthrough switch cameras, with the walkthrough eye at 1.6 m.
- Hiding Furniture removes its 2 parts from the view.
- Locked layers block selection both in the tree and in 30 clicks across the view. Unlocking Site makes it selectable.
- Tool counts match the lists above, and a tool click adds nothing.
- Import options match the archived Workspace. A test OBJ was sorted to Walls, Furniture and Imported.
- Status-bar settings and the display mode survive a reload.
- There is no Drawing entry. Save version adds v3.
- No console errors.

## Global interface rules (patch)

- **One entry point per simulation.** "All tools" and every "Open full tool" link are gone from the formal site. Each simulation has one route, `#/simulations/<id>`, reached from the Workspace ("Choose a simulation", or "Simulate" on a version row, then Enter) or from a Simulations card (Enter). Both arrive at the same page in the same state. The project and version come from what was chosen, not from the address; older links that carry `?project=&version=` are cleaned to the same route. "← Back" returns to the page the simulation was entered from. Resources entries never open a simulation.
- **Every simulation runs its PlotCloud engine** (the same `emb/<tool>.html` file the classic tool runs) in one page shell, `js/pages/sim-engine.js`. Nothing on the page computes or draws a result.
  - **Model:** the model is edited only in the Workspace. Each engine gets the version's model in its own input format:
    - Plan tools (Daylight, Natural ventilation, Space syntax, Movement & spatial depth, Isovist, Views, Cameras) get the scene Plan Studio's Send to Simulation makes. Plan Studio runs hidden (`js/studio-bridge.js`), opens the version converted to its model format (`js/studio-convert.js`), and returns `STC.planScene` for the tool and level. It opens the model as saved, so no draft is kept, and its "last project" is put back.
    - Sun hours and Wind get the masses scene (`js/sunscene.js`).
    - Circulation gets the level as Plan Studio's DXF. Stormwater gets the model as OBJ, in its Imported model mode.
    - Indoor acoustics gets the room picked in the bar as one closed wall loop.
    - Structural analysis (quick mode) and Structure sizer get storeys, storey height, bays and the longest room span from the model.
  - **Hidden:** the engine's Model / file section, and its wall, window, door and furniture drawing tools. Analysis placements (check a spot, viewpoint, path, camera, places) stay.
  - **Site and climate** come from Account and are prefilled into the engine's own inputs, where they stay editable: location, north, time zone, prevailing wind, design storm, work plane, occupied hours and eye height.
  - **Layout:** all of the engine's views are kept, Plan + chart included (also for Sun hours). The left sections collapse. The engine's own results column is on the right, with every row it reports (its fit-to-height trimming is turned off; the columns scroll).
  - **Bar:** Back, project, version, level (plan tools on several levels), room (acoustics), and the site chip linking to Account.
  - **Saving:** "Save result to vN" stores the engine's own figures (label and value) with the settings used. Results compares versions on those figures. A result is refused until the engine has produced one.
  - **Retired:** the prototype estimates (`mocksim.js`), their preview page and the seeded mock results. Old mock results are removed when the browser's data loads.
  - **Indoor acoustics** (`emb/acoustics.html`) is on the same tool shell as the other engines: numbered steps on the left, Plan + chart / Plan / Section / 3D, the charts under the plan, legend, report and export on the right. It keeps the reflection-density engine (rays up to 3 reflections, the five-step density ramp, wall ranking, hotspots, six-band RT60). The ceiling, the underside of the roof, is now a ranked surface with its own landing-energy field, and Section shows the reflected energy across the room depth. The 3D is wireframe: walls and ceiling are wire only, so the point wave can be followed as it leaves the source, meets the walls and the ceiling and comes back (1,536 traced rays, coloured by reflection order). After a run, the floor, walls and ceiling carry the result in the same ramp as Plan.
  - **Doors:** the Workspace has no door tool yet. An opening named "door", or one that starts at the floor, goes to the engines as a door. The sample model has an interior door and an entrance.
  - **Acceptance (same input, same output):** the page and the original tool, given the same input (file and inputs), gave identical results for Daylight, Views, Space syntax and Cameras (whole report), Indoor acoustics (RT60, SPL, C50, D50), Stormwater (peak depth, area deeper than 0.05 m, detention, balance), Structural analysis (results section) and Structure sizer (answer, range, system detail, column). Sun hours was checked earlier with identical figures and picture (Custom, 0.5 m grid, 15 min).
  - **Run and saved on the page (sample project):** Natural ventilation (Studio 14.1 ACH, Office 3.8 ACH), Circulation (3 places: average walk 7.6 m), Isovist (one viewpoint: 2.7 % blind), Movement & spatial depth. Wind loads the massing and solves; on the test machine the Standard run did not finish inside the 8-minute test window, so no Wind figure was saved in testing.
  - **Home page figures** (v1 → v2 of the sample) are engine results: sDA 27.5 → 34.5 %, RT60 studio room 2.96 → 0.53 s, quality views 78.6 → 78.9 %.
