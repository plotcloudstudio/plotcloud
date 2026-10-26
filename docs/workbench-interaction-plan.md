# Workbench interaction plan

For architects modeling a building and its furniture in a project, then sending a saved version to performance analysis. The workflow should reduce repeated tool selection, imports and manual version preparation when changing views.

## Implemented behavior

- Plan and Perspective use Plan Studio's modeling tools and the same project model. Palette tools act in the active view. Changing views transfers the active tool, furniture family, opening type and imported-furniture placement state. Drawing uses the current level plane; openings use the existing wall-hit logic.
- Furniture cards support drag-and-drop into the active view and click-to-place. Walls can be drawn directly in Perspective. Rectangle and arc tools retain their original drawing gestures.
- Balcony railing and Backyard fence require a path before generation. Enter or double-click finishes the path. Each segment determines the selected family's length, center and direction while retaining its parameters. Cancelling an unfinished path creates no objects. Draw room no longer shows a separate Fence entry.
- Drag empty space to box-select: right-to-left crossing or left-to-right containment. Hit testing currently uses projected object bounds. Shift adds; Ctrl/Cmd removes. The views and Layers share a selection set. Hidden and locked layers cannot be selected.
- Send to Simulation saves a new version when needed and selects that version before opening Simulation. The user still chooses the study and its calculation settings there.
- Edit site and Finish site editing unlock and relock the Site layer. The button label follows the layer's lock state.
- The Level control holds the floor list and a + button to add a floor. The adjacent view menu contains only Plan, Ceiling plan and Perspective. It calls Plan Studio's existing add-level operation. Newly added levels are synchronized after all views receive the updated model.
- Perspective Gumball supports planar move/rotation for authored walls, manual slabs, floor openings, fences, masses and furniture, plus movement of lights, ceiling panels and imported meshes. Wall endpoint connections and hosted openings follow the edited wall. Openings slide on the host axis; imports retain their quarter-turn rotation format. Automatic slabs and locked objects expose no transform handles. Escape or pointer cancellation restores the pre-drag model; a completed drag is one shared undo step. This does not add free vertical transforms or group transforms.

## Full linked-model management remains separate

Existing account site associations and project-local site data are preserved. The Site edit control is a layer-editing mode, not full Revit-style external file-link management.

Full linked-model support would need a reference record containing the source project/file, source version, coordinate transform and link status. The host model should treat it as a reference; source editing and explicit reload should preserve version history. Permissions, unavailable sources, update conflicts and outdated analysis results require defined behavior. Unlocking a layer must not be presented as this complete capability.

Ordinary objects retain their existing category layers and imported layers. Arbitrary custom-layer assignment for native walls, slabs and other objects would also require visibility, lock, export and historical-version rules.

## Validation

`tests/workbench-gumball.cjs` checks the simplified menu, level selection, object-type adapters, wall connections, hosted constraints, cancellation, shared undo/redo and lock behavior.

`tests/workbench-editing.cjs` covers drawing a wall in Perspective, furniture placement and palette drag, retaining tools across views, starting major tools in 3D, actual mouse box-selection, both fence families, site lock controls, adding levels in both views, and Simulation navigation.

Serve the repository on port 8765 by default. TEST_BASE and CHROMIUM_PATH override the server and browser. Browser tests use local Three.js assets to reduce CDN dependence. Tool-start checks are not full end-to-end acceptance of every gesture in every tool.

## Static report example

The sample PDF contains only Simulation comparisons, using clearly identified synthetic daylight-factor and sun-hours data. It does not implement report generation or claim real project results. The report, labels, captions, legends, units, tables, notes and disclosures are in English.

## Level operation audit (October 26, 2026)

The Workspace toolbar now pairs Add level with Delete current level. The Level menu also offers Rename current level and Add level below. Deletion lists the affected element count, requires confirmation, keeps at least one floor and chooses the nearest remaining lower/upper floor. It uses the shared model history so Plan and Perspective agree and Undo/Redo restores/removes the contents.

The earlier hidden delete handler omitted lighting, ceiling, level-owned masses and imported objects. Deletion now removes all explicitly level-owned model elements and openings hosted on removed walls, prunes their hidden IDs, and leaves unrelated levels, site context and saved versions. Locked elements/layers block removal until unlocked. Newly added levels use unique IDs and names even after a middle floor was removed. Empty custom Workspace layers have a remove button; built-in, nonempty and locked layers are protected. Duplicate/empty layer names produce feedback.

Validation: tests/workbench-levels.cjs covers cancellation, deletion, Undo/Redo, hosted/orphan-prone content, Perspective, last-level protection, rename and adding below. tests/workbench-gumball.cjs covers prior transforms and selection. Theme changes also update the Plan drawing and Perspective background; model/result palettes remain owned by each tool.
