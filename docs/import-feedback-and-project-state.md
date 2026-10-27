# Import feedback and project state

The import destination is an explicit choice: **New project** (default) or **Add to current project**. The button describes that choice before opening the file picker. Adding to the sample requires a separate destination acknowledgement in the scale review, in addition to the dimensions confirmation. Selecting or cancelling the file picker reports what happened. New-project import does not depend on the old project’s Plan pane being ready.

Both Workspace and Simulation show the actual 25 MiB / 80,000 triangle reader limits and a downloadable 10 × 8 × 6 m, Z-up OBJ example. OBJ does not declare standard units: choose Metres and Z up in the review. Simulation import creates a separate project with a reviewed first version. This does not give arbitrary imported meshes room/wall semantics required by some studies.

Failures show an accessible error and Retry last import, retaining the File object for that session. Reader network-module failures use a fresh module URL on retry. Rhino script/WASM initialization rejection clears the cached rejected promise so retry can initialize again. File-size checks run before reading. These recovery paths are verified; they do not establish the cause of Muse’s specific first-upload failures. A failed attempt may still require choosing a file again if the browser session loses its file handle.

Saving a version locks the workspace immediately, flushes the active native snapshot and derived geometry, then records and selects the version. The global context, footer and Versions panel use that same selected version. Opening v1 after saving v2 keeps v1 selected when choosing a study. Nested Plan/Perspective/Parameters headings use the parent project name; historical model metadata is preserved.

Simulation Save result has an immediate pending state, duplicate-click guard and a 10-second acknowledgement timeout. If the engine gives no acknowledgement, the user sees a retry instruction; successful saving locks that result identity. Engines without a completion contract reset the manual save lock when their native Run is clicked. Automatic saving remains limited to engines exposing a verified completion contract.

The persistent workflow shows engine-reported numeric progress where available. Otherwise it shows an indeterminate progress indicator and measured elapsed time, explicitly noting that detailed progress is unavailable. No percentage is fabricated. Native engine controls, long-run confirmation, Stop and stale-result rules remain authoritative.

Explanatory import notes wrap and carry their full text as a title. Mesh-object singular/plural and the Custom grid label are corrected. These are desktop workflow repairs, not a new mobile editor layout.

## Verification

- `tests/import-feedback-and-project-state.cjs`: actual nested editor names with deliberately mismatched legacy metadata; double-click version saving; all version labels and historical selection; explicit default destination; sample acknowledgement; a real aborted OBJ reader request followed by a successful retry; successful separate project creation; file limits and downloadable example; Rhino initialization rejection/retry; Simulation error/retry; unknown-engine elapsed/indeterminate progress and save lock reset.
- `tests/simulation-workflow.cjs`: real Sun Hours and Daylight calculation/save/stale guards; no-acknowledgement save timeout and retry; duplicate-click lock; uniform Draft/Standard confirmation.
- `tests/import-scale-and-resolution.cjs`: waits for the new imported project rather than the already-ready sample; original scale, grid blocking, immutable grid labels and auto-save regression.
- `tests/simulation-panel-scroll.cjs` with Sun Hours and Daylight: continuous Settings/Export at three window sizes and actual computed result/PNG saving.

The older full hosted UI smoke inventory expects paid standalone pages to render without authorization. Its access-gate mismatch is separate from these targeted regressions; production payment gates are retained.
