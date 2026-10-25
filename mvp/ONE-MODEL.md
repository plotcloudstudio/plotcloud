# One model in the Workspace (2026-10-25)

Before: the Workspace kept two models side by side. Plan Studio's model (`draft.studio`: walls, rooms, doors, furniture…) was drawn
by the Plan, Perspective and Properties panes; everything else (imported meshes, the earlier Workspace's boxes such as the sample's
ground and neighbouring blocks) was a list of components drawn only by a separate **Shaded** view. Something imported could not be
seen next to the walls you were drawing, and the two lists could drift apart.

Now there is **one model**, Plan Studio's:

| What | Where it lives now | Drawn by |
|---|---|---|
| Walls, rooms, openings, furniture, lights, levels | `draft.studio` (as before) | Plan, Perspective, Properties |
| Masses, schemes, the site from the map | `draft.studio.masses`, `.schemes`, `.site` | Plan, Perspective |
| Imported meshes (OBJ, STL, GLB, FBX, 3DM, DAE, PLY…) | `draft.studio.imports` (name, layer, type, material, position, size) with the triangles in `draft.meshes` | Plan (outline + faint triangles), Perspective (the mesh) |
| The earlier Workspace's boxes (ground, context blocks) | Moved into `draft.studio.imports` once, as box meshes | Plan, Perspective |

* **The Shaded view is gone** from the view menu. A Workspace remembered on Shaded opens on Perspective. PNG export takes the
  Perspective view.
* **Imports are editable like the rest**: click one in the Plan to select it, drag to move it, type its position in Properties,
  hide it with its layer's eye, lock its layer, delete it, undo. Its size stays as imported.
* **The triangles are kept beside the model** (`draft.meshes`, keyed by the import's id), not inside it, so undo and the live sync
  between the panes stay small however big the mesh is. Versions keep both (a saved version has its own copy).
* **A saved draft stays saved**: when an older project is opened and its boxes or meshes move in, its latest version gets the same
  move if the draft was identical to it, so it does not suddenly show unsaved changes.
* **Simulations**: imports are not rooms and are not sent to simulations, except the earlier context blocks (type *mass*), which
  still cast shadows in Sun hours and count as context in wind and noise, as before.
* Exports (OBJ, GLB, STL, DXF, 3DM, DAE, IFC) take the whole model, imports included.

## My furniture (2026-10-25)

Workspace › Furniture opens with **My furniture**: *Import furniture* reads one piece from an .obj, .glb, .stl or .3dm file (all its
meshes merged, standing on the floor; units read from the size — a piece is 0.1–8 m — or from the .3dm), makes its picture in the
same light and view as the library's pictures, and keeps it in your account (this browser) for every project. Click a card, then
click in the Plan to place it on the current level (R turns the next one, Esc stops). Every piece placed in a project shares one
mesh (`draft.meshes[<piece id>]`, the import's `ref`), has its own position and quarter turns (Turn 90° in its panel), and is on the
Furniture layer. Removing a piece from My furniture keeps the ones already placed. Test: `tests/mvp-my-furniture.cjs`.

## On "a single Plan Studio instance"

The plan said "a single Plan Studio instance". What is single now is the **model**: one source of truth that every pane edits and
draws. The Workspace still shows Plan Studio three times (Plan, Perspective, Properties) because that layout was asked for and kept
("keep the current Workspace as the base page, no big changes"); the three panes share the one model through the hub and stay in
step during a drag. Folding them into one page is possible later, but it would change the layout people have started to learn.

## Tests

`tests/mvp-one-model.cjs`: no Shaded view (and a remembered Shaded opens Perspective); the sample's boxes move into Plan Studio's
model and still cast shadows; an older saved project stays saved after the move; an OBJ import lands in Plan Studio's model and in
the layer tree, is drawn by Perspective, can be positioned in Properties, dragged in the Plan, hidden by its layer, kept in a
version, selected and deleted, and is all still there after a reload. `tests/mvp-workspace-panes.cjs` was updated for the one model.
