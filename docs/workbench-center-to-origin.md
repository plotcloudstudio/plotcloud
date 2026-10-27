# Center to origin

For designers importing an offset model or positioning a study model before simulation, the Workbench command bar now offers **Center to origin** in Plan and Perspective. It avoids creating reference points just to align a complete model.

- With a selection, translate that selection as a rigid group. With no selection, use visible, unlocked model objects across levels.
- Read the actual world-space mesh vertices in metres, Z up. Translate the combined X/Y bounding-box center to `(0, 0)` and the lowest point to `Z=0`; preserve dimensions, rotations, triangles and relative placements.
- Move hosted openings with their walls, generated slabs with their walls, and stair openings with their stairs. Reject a locked or hidden dependency before making changes.
- Native elements inherit level elevation. A vertical move requires the entire affected level; a partial level cannot be moved vertically by changing wall or furniture height. An incomplete selection gives an explanation and makes no changes.
- Site location, north and context data are preserved. Centering the design still changes its position relative to stationary Site context; use this command for intentional model alignment.
- Use one shared Undo transaction and the existing model-change/simulation handoff. Repeating the command on centered geometry adds no history. Fit remains a camera-only command.

Verification: `tests/workbench-center.cjs` covers exact bounds, atomic dependency validation, level elevations, Plan/Perspective commands, unchanged unselected objects, idempotence and Undo. `tests/imported-model-audit.cjs` additionally checks the private uploaded 3DM, all relative placements and every transferred simulation vertex. The private fixture and geometry artifacts are excluded from publication. `tests/workbench-rhino-layout.cjs` checks the additional button at desktop widths and the existing edit/send workflow.
