# Center imported model

For designers importing an offset building before simulation, the Workbench command bar offers **Center imported model** in Plan and Perspective. The command applies exclusively to imported building geometry. It cannot move native furniture, furniture imported from the library, imported objects identified as furniture, authored walls, floors, masses, levels or Site context.

With an imported building selection, translate its eligible objects as a rigid group. With no selection, use visible, unlocked building imports. Mixed selections ignore furniture and authored elements; a furniture-only or authored-only selection shows an explanation and makes no changes. Select all parts of a multi-object building, or clear the selection to center all eligible building imports together.

Read actual world-space mesh vertices in metres, Z up. Translate the combined X/Y bounding-box center to `(0, 0)` and the lowest point to `Z=0`; preserve dimensions, rotations, triangles and relative placements. There is no native level-elevation adjustment. Imported furniture is excluded using the existing furniture type and library reference metadata. Unclassified file content remains imported geometry; this command does not infer building semantics from triangles.

Use one shared Undo transaction and the existing simulation handoff. Repeating the command on centered geometry adds no history. Fit remains camera-only. Site data stays fixed, so centering changes the building's position relative to stationary context. Existing furniture editing tools are unchanged; the new centering feature has no furniture editing behavior.

Verification: `tests/workbench-center.cjs` covers building-only scope, native and imported furniture exclusions, unchanged authored geometry and levels, exact bounds, atomic validation, Plan/Perspective commands, idempotence and Undo. `tests/imported-model-audit.cjs` checks the private 54-object 3DM, relative placements and every simulation vertex, calculation and result save. Private fixtures and geometry artifacts are excluded from publication.
