# First-study and comparison-report workflow

Scope: product usability first. Existing pricing/access rules and the deferred hosted-account setup remain in place. No classroom procurement or sales workflow is introduced.

## First successful study

The Simulations catalog had a scope error: `access` was local to render but used by catalog without being passed. Catalog now receives that state and renders all current studies without that exception. The catalog links to `#/start-study` and uses the same readiness checks as the engine page.

A guided study creates a separate editable project and baseline version from the existing example model. It preserves existing projects, uses explicitly labelled Vancouver example conditions, and copies fresh defaults instead of inheriting a user's unrelated EPW/site. Users can instead inspect their current project. The homepage primary action opens the guided entry. Guided studies initialize their engine in Draft quality once per load, without later prefills overwriting manual quality changes. Sun hours and Daylight run through their existing full engines; no result numbers are supplied by the tutorial.

`study-readiness.js` checks a saved version, changed working draft, metre units, finite wall coordinates, presence of plan/massing input, location/north, required EPW metadata and daylight defaults. The engine page also verifies that a referenced EPW exists in browser storage. Blockers appear before its engine starts, with Workspace/conditions/retry links and an explicit save-version action. Missing windows, example sites and generic-year assumptions are warnings. A count of walls is not proof of a closed room: engine conversion remains authoritative and failures now expose recovery links. Model checks are conservative and do not claim completeness or compliance.

The host offers an input-review dialog and the sequence Run → Save result → edit one variable → save another version → rerun → compare. Switching project/version/level goes through the router so the old engine listener is cleaned up. The router has a reload/recovery screen for module/page failures. Saved screenshots now retain up to 800×640 pixels at JPEG quality 0.85, with no upscaling, for clearer exports.

## Real comparison exports

`#/comparison-report/<project>` uses selected version IDs and optional study ID. It selects the latest actual `full-tool` or `batch` run for each version/study; prototype mock results are excluded. Partial pairs are marked missing and have no numeric delta. Same-version comparison and absent engine evidence produce actionable errors. The report contains simulation evidence only, not costs, unrelated design evaluation or promised grades.

Exports: directly downloaded PDF; standalone semantic HTML; metrics CSV; saved-field CSV; evidence JSON. Generation occurs in the browser using bundled jsPDF 4.2.1 (MIT) and DejaVu Sans (licenses included). No report service receives project data. Account cloud syncing, when configured, remains governed by existing settings. User interpretation is labelled, stored separately from the model, included in exports and remains exportable if note persistence fails. The sandboxed Blob preview uses white paper intentionally, separate from the gray application theme.

Metrics use explicit units. A change between percentage-valued metrics is reported in percentage points; relative change divides by the absolute baseline and is undefined when it is zero. Missing figures are never replaced by zero. CSV quotes text and guards formula-like strings. Original engine labels/values, run IDs/times, selected model-version IDs/notes, engine release when recorded, stored settings, input differences and method limitations are retained. New run provenance labels host context at save time separately from effective run settings. Unknown legacy metadata remains unknown. The evidence JSON is not a complete replacement for a project/model backup.

`comparison-evidence.js` compares nested recorded inputs, including effective shared conditions, without treating revision numbers, save times and model-version IDs as scientific input differences. It distinguishes matching/differing/unknown/missing evidence and unverified preview sources. The Results page shares this logic and no longer asserts that matching recorded settings prove model changes caused a difference. Incompatible field labels/units are not treated as directly comparable maps.

## Figure inventory and local specialist pass

Owner: local report implementation and review (no delegated agent).

1. Paired sample maps: job is spatial comparison of saved fields; data shape is paired x/y/value arrays with units and recorded sample steps. Both use one extent and one sequential blue scale, without good/bad judgement. Model coordinates are in metres with +Y up; available saved wall outlines are contextual, not a full context drawing. There is no interpolation or recalculation. HTML uses SVG; PDF uses vector cells/lines with an explicit legend. Combined fields over 16,000 samples fall back to saved previews; full available values remain in CSV. Invalid samples are excluded from maps, not invented.
2. Saved previews: used when paired fields are missing, incompatible or too large. Kept as original engine captures with explicit warnings that views/scales may differ; not presented as quantitative difference maps.
3. Metric table: typed finite values, missing markers, absolute delta/percentage-point units and separate relative change. Neutral wording avoids automatic optimization claims.

QA: matching units and common range; fixed-coordinate transforms; zero/missing values; actual vector contents visible inside the PDF clip frame; image-data validation; escaped user text; readable A4 layout and out-of-page text checks. The local fresh pass found and corrected an empty clipping path that initially hid PDF map contents. The first-study browser test raster-checks the map region to prevent a text-only PDF success from hiding that issue.

## Validation

`tests/study-evidence.cjs`: readiness, nested input differences, source filtering, partial pairs, percent units, zero baseline, field compatibility and CSV safety.

`tests/first-study-report.cjs`: catalog and failed-module recovery, separate example project, input review, two actual Sun Hours engine runs with one context-height change, version-linked saves/provenance, report preview, PDF download and extracted text, visible map samples, CSV/JSON downloads, mobile overflow and missing-model/version recovery. The generated PDF is based on real engine calculations in the isolated browser, not manually populated metrics. Local screenshots and PDF page renders support visual review.

Legacy access tests verify that the two free studies and paid gates still behave as before. Tests are local; GitHub Pages deployment status and production source hashes are verified separately. Direct production interaction depends on the execution environment's network policy.
