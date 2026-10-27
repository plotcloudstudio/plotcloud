# Workbench: Rhino-informed layout and live simulation handoff

The approved layout is organized around a dominant model viewport. Commands are
in a reserved header, building tools and furniture stay in the left library, and
Properties, Layers and Versions are text tabs in the right inspector. Selecting a
model object opens Properties without removing the library. Extra view panels
(Explode, Walkthrough and Interior elevation) are under View tools. Long lists
scroll rather than being divided into height-dependent pages. Tools can be
collapsed to give the canvas more room.

The command strip delegates to Plan Studio's actual tools and shared history.
Delete removes the current selection; with no selection it starts the existing
deletion tool. Input fields retain ordinary text-editing keyboard behavior. Host
Delete/Backspace, Undo/Redo and Escape support selection and model actions; Select
also retains Ceiling plan. Disabled engine actions stay disabled, including
display-only modes. The command line displays the current tool's own instructions;
it does not claim a Rhino command-language implementation.

Blue screen-space selection rectangles, native SVG bounding rectangles and the
3D Gumball's blue box are removed for Workspace views. Handles, dimensions,
selection in Layers, the inspector and the Gumball remain available. Standalone
Plan Studio keeps its prior annotation behavior. Dark model label plates now use
gray with readable text; the existing gray editing background and light mode stay.

Furniture categories use a selector and have a clearly scoped category search.
Existing custom furniture imports remain in My furniture. Placement, drag/drop,
walls, fence families, level management, layer locks and their actual model APIs
are preserved.

## Send to Simulation

Choose a study next to Send to Simulation (Sun hours by default). Clicking sends
the active Workspace model rather than reopening the catalogue or an older
version. The shell temporarily blocks editing while it flushes the active model
and waits for derived geometry, then creates/reuses an exact version, records the
current level and enters the selected engine. The study starts through the real
Run study action after model/weather preparation. The engine's long-run
confirmation, required inputs, access checks and result saving still apply.
Sun-based handoffs begin with Draft quality; results can be rerun at higher quality.
The router now removes only legacy project/version URL parameters, preserving
the one-time automatic-start instruction until it is consumed.

## Verification

- `tests/workbench-rhino-layout.cjs`: three desktop sizes, panel separation and
  no overlapping commands, stable library on selection, right properties, no blue
  selection frames, Delete/Undo, category search, Ceiling plan retention, view
  tools, both themes, narrow fallback and actual Sun Hours computation after an
  immediate geometry edit and version handoff.
- `tests/workbench-levels.cjs`: add/remove/cancel, Undo/Redo, custom layer removal,
  protected last level, hosted-object cleanup and synchronized levels.
- `tests/workbench-editing.cjs`: real Perspective wall drawing, furniture placement
  and drag/drop, both fence families, crossing selection, site locks, levels in
  both views and the direct handoff route.
- `tests/workbench-gumball.cjs`: actual wall, slab, fence, mass, hosted opening,
  imported mesh, light and ceiling transforms; locks, cancellation and shared undo.

This is a web architectural workbench informed by Rhino's layout and interaction
patterns, not a claim of feature or file-format parity with Rhino.
