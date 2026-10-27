# Reviewed model scale and stable solar resolution

For a designer importing a building and evaluating shadows, attractive images and plausible averages are insufficient if the model has been read at the wrong scale or is smaller than its sampling grid. The current changes add checks at import and before calculation, preserve the applied scale, and shorten the study workflow.

## Import review

Workspace imports and the new study-page upload use the same review dialog. It shows declared source units (or explicitly Unknown for unitless formats), original XYZ dimensions and min/max coordinates, interpreted units/up-axis, an additional scale factor, optional known CAD width and resulting metre dimensions. Maximum extent below 1 m or above 100 m is marked suspicious. These are review thresholds, not proof of invalid geometry: a scale model or large site can be intentional. Import remains disabled until the current dimensions are explicitly confirmed; changing a scale field resets confirmation. Cancellation does not change the existing model.

Rhino units and glTF metres are detected; unitless OBJ/STL files are not silently assigned a guessed architectural scale. The chosen conversion transforms every component and triangle consistently, preserves raw metadata and is saved in importAudit. Sub-millimetre detail is no longer rounded to a millimetre at this step. Uploading from a study creates a separate project and saved version directly; engines that require indoor/structural semantics still report missing analytical inputs rather than fabricate them from a visible mesh.

## Resolution and domain

Draft / Standard / Fine request at least 8 / 16 / 32 cells across the shorter nonzero footprint, capped at 2 / 1 / 0.5 m respectively. Device speed never changes their spatial settings. Fewer than four cells across that footprint blocks calculation, heatmap creation, averages and saving; four to eight cells requires an explicit coarse-resolution acknowledgement. This basic check does not guarantee resolution of every narrow opening or facade feature.

The preparation stage does not silently widen spacing. Excessive point counts require a smaller analysis extent or explicit user-selected grid. Ground cells use ceiling counts so their actual X/Y spacing cannot exceed the requested spacing; actual ground spacing, requested grid, point count, quality and time step are recorded separately. Result labels retain the actual numeric grid precision, including values such as 0.074 or 0.025 m.

Automatic ground padding is proportional to model width/height (with 0.05 m floor and 60 m cap), replacing the former minimum 10 m padding. The display extent follows the same scale. Source scale confirmation is respected; suspicious legacy/unreviewed inputs need an explicit scale acknowledgement before calculation. Ray offsets and bottom-face tolerance scale with model geometry.

## Time, progress and saving

Before device calibration there is no made-up duration estimate. After measured runs, separate sunlight/radiation/comfort ray rates support a 0.5×–2× time range; preparation and display overhead are explicitly additional. Draft and Standard use the same confirmation logic. Preset grid labels remain fixed after calibration. Progress reports measured sampling/ray-tracing phases and elapsed time, not a simulated timer. Immutable run settings, actual total elapsed time and effective ground spacing are attached to saved results.

Solar and other engines with an explicit verified-ready state auto-save a fresh completed result once by default. Manual saving remains available by disabling Auto-save. Stale, blocked, cancelled and failed calculations are not saved. Existing studies without a verified completion contract retain manual saving; their completion is not inferred from a plausible-looking number. Hidden host modelers skip unused thumbnail rendering; Workspace already uses rendered library assets.

## Verification and limits

`tests/import-scale-and-resolution.cjs` reproduces a 0.276 m building with an 8 m grid, validates source metadata and 1/100 m warnings, explicit factors and known dimensions, verifies zero results while blocked, stable labels and exact grid text after calculation, progress, automatic version creation and one saved result. `tests/simulation-workflow.cjs` checks manual mode, stale data, both Draft/Standard confirmation ranges, cancellation and Daylight. `tests/simulation-panel-scroll.cjs` checks Settings/Export in one scrolling panel at three sizes and numerical preservation through PNG export. The private Rhino audit checks source centimetres, 54 placed mesh objects, original triangle transfer and a completed/saved study using an explicitly chosen resolving custom grid.

The four original Muse test files were not supplied with this feedback, so these are targeted reproductions and the existing private 3DM fixture, not a claim to have rerun those four originals. Previously saved results are not recalculated or rewritten automatically. EPW automatic station matching/download remains unimplemented: current shared weather ingestion is manual upload, validation, browser-local storage and distribution to supported studies.
