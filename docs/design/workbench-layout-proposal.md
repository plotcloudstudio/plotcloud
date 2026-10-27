# Workbench layout proposal — approved

## Purpose

An architectural modeling workspace for creating or adjusting a model, checking its
organization, saving a version and handing that version to Simulation. The model
viewport is the main working surface. Tool count is not the organizing principle.

## Observed problems

At 1440 × 900, the floating level/view/display bar overlaps the embedded editing
toolbar and the simulation/site actions. The bottom model hint and zoom controls
overlap. Selecting an object replaces the left tool library with parameters, so
the library moves out of the user's workflow. Furniture categories occupy much of
the library before furniture appears. Height-based pagination hides list items.

The existing product already has synchronized Plan/Perspective modeling, model
layers and locks, level management, saved versions, imported furniture, site
editing and simulation handoff. The redesign preserves these capabilities.

## Proposed information architecture

| Region | Responsibility | Default contents |
| --- | --- | --- |
| Project context | Identify the draft and its saved state | Project name, Draft, honest browser-storage status, Save version |
| Dedicated command bar | View and direct model actions | Plan / Ceiling plan / Perspective, Level with add/delete, display style, Select/Move/Rotate/Delete, Undo/Redo, View tools, Send to Simulation |
| Left library | Choose what to create or place | Labeled tool categories, relevant search, category selector, continuous tool/furniture list, import action |
| Main viewport | Edit the shared model | Current model and gumball; commands do not overlay the canvas |
| Right inspector | Inspect model organization and selection | Text tabs: Layers, Properties, Versions |
| Status/viewport utilities | Explain the current action and navigate | One short contextual hint; Snaps, Gumball, Clearance; Fit, zoom controls |

Selection opens Properties on the right while preserving the left library.
No selection shows a clear empty state. Multi-selection reports its count and
exposes only applicable actions. Site remains a linked model with an explicit
Edit site action in project controls. Ordinary layer changes do not edit the site.

Explode, Walkthrough and Interior elevation remain available under View tools;
their detailed controls open a clearly named right panel with a return action.
They do not permanently compete with Layers, Properties and Versions tabs.

## Layout and interaction contract

- Desktop first: target approximately 260 px for the library including the category
  rail and 280 px for the inspector at 1440 px. The canvas gets the remaining width.
  Panels can collapse; at narrower desktop widths, use an explicit library drawer
  instead of squeezing the canvas between both open panels.
- The display-style selector is relevant in Perspective. Plan does not need an
  extra "Plan drawing" pill, and the view menu contains exactly Plan, Ceiling plan
  and Perspective. Levels stay in the Level menu.
- Commands live in reserved grid rows, never in independently positioned floating
  bars. At short heights, side panels scroll independently. Do not shrink fonts or
  paginate controls to force them into the viewport.
- Furniture search and categories affect the library only; they must not change
  selection, the active level, saved geometry or the current modeling tool.
- All commands delegate to the existing Plan Studio model and tool APIs. Keep a
  single model, selection and undo history across Plan and Perspective.
- Properties retain existing editor nodes and listeners. Reorganize presentation
  without cloning control IDs or duplicating model state.
- Menu, drawer and tool panels have visible close/return controls, keyboard access,
  focus management, and visible selected states. Escape dismisses transient UI
  before canceling the modeling operation.
- Narrow-screen concept: viewport first, one bottom drawer at a time; Build,
  Layers, Properties and Versions are accessible without fitting desktop sidebars
  onto the phone. Dedicated mobile modeling work is deferred; preserve usable
  fallback behavior during the desktop redesign.
- All product labels remain English. Gray dark mode uses the existing theme
  tokens; the canvas stays gray rather than pure black. Retain light mode.

## Concept artifacts

- Desktop: `/workspace/generated_images/exec-a1549278-aaf2-4f1e-9c5c-bef5bd81d6be.png`
- Narrow portrait: `/workspace/generated_images/exec-c8ce8de6-0fa5-485b-a01e-109d24c81208.png`

These images illustrate composition, not implemented screens. Their model
dimensions, furniture imagery and compacted labels are illustrative. Implementation
must use actual project geometry, existing assets, real commands and existing
data. The inspector and library width targets above take precedence over incidental
proportions in generated images. No simulation result or new backend is implied.

## Proposed implementation and acceptance order

1. Reserve command/status rows, remove top/bottom overlaps, preserve viewport size
   and existing Plan/Perspective/level operations.
2. Stabilize the library and right Properties inspector; retain selection, locks,
   imported-object parameters and undo/redo.
3. Replace height-based pagination with native panel scrolling; add relevant
   furniture search/category navigation without losing placement and drag/drop.
4. Consolidate View tools and version saving; retain explicit simulation handoff.
5. Verify 1440 × 900, 1280 × 600 and 1024 × 768 in both themes: no overlapping
   controls; every command/list entry reachable; properties do not remove the
   library; model selection, adding/deleting levels, cancellation, undo/redo,
   furniture placement in both views, saving and handoff still work. Check narrow
   overflow and drawer close/focus recovery without claiming a full mobile CAD UI.

The user approved the concept and requested Rhino-informed interaction throughout.
Implementation and validation are described in `../workbench-rhino-layout.md`.
