# Workspace v2 (step 1): skeleton reconciliation

`#/workspace-v2` is the merged Workspace skeleton, laid out like Rhino: tool rail and panel on the left, a large viewport, layers on the right and a status bar at the bottom. The archived Workspace (`#/workspace`, `js/pages/workspace.js`, `js/viewport.js`) is unchanged and remains available for rollback. The nav entry "Workspace v2" carries a TEMP badge until review decides.

New files: `js/pages/workspace-v2.js`, `js/viewport2.js`, plus a `Workspace v2` block at the end of `css/mvp.css`. Edited: `js/app.js` (one route) and `index.html` (one nav link).

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
| Left · Model | "Add a component" (Massing block / Wall / Window / Room / Slab) | Right column, top of Layers | Moved. Same options; new parts go to their category's layer |
| Left · Model | Links: Plan Studio ↗ · Site Planner ↗ · Plan tracer ↗ | Left panel, Project state | Kept. The "bringing their models in is Planned" sentence is dropped: the tool rail replaces it (placement in step 2) |
| Left · Layers | "+ Layer" | Right column, Layers header | Moved, same behaviour |
| Left · Layers | Layer row: colour, name/expand, count, Hide/Show, Lock | Right column: table row with colour, name/expand, count, eye icon, lock icon | Moved. Hide removes the layer from the view; Lock blocks picking in the view and in the tree, and clears the selection if it was on that layer |
| Left · Layers | Component list (click to select) | Right column, inside each expanded layer | Moved. Items on hidden or locked layers are disabled |
| Centre | 3D viewport (orbit, pan, zoom, click to select) | Centre, fills the remaining space | Kept |
| Centre | View buttons: Shaded / Wireframe / Plan | Floating menu at the top left of the viewport. Display: Shaded / Ghosted / Wireframe. View: Perspective, plus one "Plan · Level n" per level | Replaced, see below |
| Centre | Fit | Top right of the viewport | Kept |
| Centre | PNG | Top right of the viewport | Kept |
| Centre | Status badge (project · version · unsaved changes) | Status bar, right side | Moved |
| Centre | Help line (orbit / pan / zoom / select) | Bottom of the viewport | Kept. Text changes with the view |
| Right · Selection | Empty state ("Click a component… N components on M layers") | Right column, Selection | Kept |
| Right · Selection | Name, Layer, Type, Material or floor/ceiling finish, Position x/y/z, Size w/d/h | Left panel, Parameters state (opens when you select something) | Moved. Same fields, same rules (imported meshes keep their size); edits go to the same draft and redraw the view |
| Right · Selection | Clear, Duplicate, Delete | Right column, Selection, with a one-line summary and "Edit parameters" | Kept |
| Right · Versions | Unsaved / up-to-date line, description, Save version, Open / Simulate on each version | Right column, Versions | Kept, same behaviour |
| Right · Next | "Choose a simulation" (red) and its note | Right column, Next | Kept |

## New in step 1, and what is real

| New | Works now | Not yet |
|---|---|---|
| Tool rail: Draw room, Door, Window, Furniture, Light, Project | Switches the left panel. Names are copied exactly from the current Plan Studio: Draw room 11 (Draw rooms 5, Add structure 6), Door 4, Window 2, Furniture 39 in 12 categories, Light 6 | Clicking an item only shows "Placement arrives in Step 2" and adds nothing |
| Display modes | Material change only: Shaded = solids fully opaque (glass stays see-through, room volumes show nothing), Ghosted = every part 50% with edges, Wireframe = edges only. The selection stays highlighted in every mode | — |
| Plan views | One entry per level read from the model: each slab top is a level. The sample has a single slab, so there is one entry, "Plan · Level 1". Top orthographic camera, cut 1.2 m above the level | — |
| Elevation | Orthographic front camera, looking north, on the same scene. Drag pans, scroll zooms, click selects | Other sides |
| Walkthrough | Camera at 1.6 m in the first room on the level. Drag looks around, scroll moves forward or back | Collisions, stairs, real walk mode |
| Import site | The button and the rule: site geometry goes on the Site layer, locked | Clicking shows "Site import arrives in Step 2". Plan Studio's "Real site" exists, but it lives inside Plan Studio and cannot be called from this page without changing Plan Studio, so it will be extracted in step 2 |
| Status bar: End, Near, Mid, Cen, Gumball, Clearance | Settings are saved in this browser and survive a reload | No snapping, gumball or clearance behaviour yet (step 6); the tooltips say so |

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
