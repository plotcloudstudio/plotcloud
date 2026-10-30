# Replan implementation status — batch 1 (items 01–04)

Date: 2026-10-30. Author: Claude (implementation). Codex reviews independently.
Scope: `docs/claude-implementation-todo.md` items 01–04 against `docs/plotcloud-product-replan-2026-10-29.md`.

## 1. Code baseline (item 01)

| Item | Value | Evidence level |
|---|---|---|
| Working tree | `/home/user/plotcloud` (cloud container, fresh clone) | checked |
| Branch | `claude/adoring-mayer-bl1u41` (as instructed; not a `codex/` branch) | checked |
| Base commit | `1e9f086b2d2b7f82eb9e1558867ef2ad399978ec` = `origin/main` (2026-10-28 21:33 −07:00) | checked |
| Docs commits on the branch before this work | `9fa0148`, `26a5426` (the plan and the task list), fast-forwarded with `git pull --ff-only` | checked |
| Dirty files before this work | none (`git status` clean). The Windows tree with uncommitted changes described in the plan was not reachable from here and was not touched | checked |
| Build / publish | Static site, no build step. No Pages workflow in `.github/workflows`; `.nojekyll` at root. The site is GitHub Pages at `https://plotcloudstudio.github.io/plotcloud/` | inferred from repo |
| Live site ↔ source | All 153 tracked `.html/.js/.css` files under the root, `mvp/`, `emb/`, `local-compute/` were downloaded from the live site on 2026-10-30 and compared byte for byte with `1e9f086`: **153 identical, 0 different**. Live `mvp/` `last-modified: Thu, 29 Oct 2026 04:35:24 GMT` (after the commit time) | checked (E1/E2) |
| Unknown | The Pages source setting itself (branch/folder) was not read — no GitHub settings access. Data/JSON/image files were not compared | unknown |

Conclusion: the live site is served from `main` at `1e9f086` for every code file. This batch is built on that commit.

### Retired / redirect routes

`legacy-redirect.js` sends the old `render`, `atlas`, `composer`, `studio`, `architectural-render` and `image-toolkit` tools to `#/resources`. The MVP router (`mvp/js/app.js` `PAGES`) has **no Rendering or Boards page**. Rendering and Boards are not present as workflow entries on the live site (consistent with plan §2.2). Restoring them is item 08 and later work, not this batch.

## 2. Analyses and supporting features — actual state at `1e9f086`

`mvp/js/data.js` `SIMS` lists **22** studies. That matches the plan's count. Routes are `#/simulations/<id>`. Old `?project=&version=` links are rewritten in `app.js` `route()`.

| ID | Current group/scope (data.js) | Engine path | Plan §4.5 target |
|---|---|---|---|
| sunhours | Climate · Exterior | `emb/sunhours.html` via `pages/sim-engine.js` | B02 |
| radiation | Climate · Exterior | sunhours engine, `measure: radiation` | B03 |
| utci | Climate · Exterior | sunhours engine, `measure: utci` | B09 |
| daylight | Climate · Interior | `emb/daylight.html` | I01–I04 (browser screening) |
| wind | Climate · Exterior | `emb/wind.html` | B07/B08 |
| vent | Climate · Interior | `emb/vent.html` | I10 / B12 |
| stormwater | Climate · Exterior | `emb/stormwater.html` | site drainage extension |
| acoustics | Acoustics · Interior | `emb/acoustics.html` | interior extension |
| spacesyntax, movementdepth, evac, isovist, views, wayfinding, privacy, cameras | Space & movement · Interior | `emb/<id>.html` (movementdepth reuses the spacesyntax engine) | interior extensions / I12 |
| structure | Structure · Building | `pages/structure-study.js` + `structural-*.js` | structural screening extension |
| climate, passive, skyview, shadebenefit, solarenvelope | Climate & passive design · Exterior | `pages/environment-study.js` + `mvp/js/environment/*` (`family: 'environment'`) | T01, T02, B04, B05, B06 |

No change in count. The three top-level categories (building/interior/table) are **not implemented**. Today's grouping is the `group`/`scope` above. Planned for item 06.

Supporting features (code read, plus existing tests run where listed in §4):

| Feature | Where | State |
|---|---|---|
| Weather | `project-climate.js`, `automatic-climate.js`, `weather-config.js` | Nearest-station match from a bundled 2023 EPWMap snapshot, nearby station list, download through `WEATHER_PROXY_URL` (a Supabase function is configured), and upload. Validates 8760/8784 rows and temperature/wind fields. Files are stored in IndexedDB `pc-project-climate` by SHA-256 |
| Shared conditions | `store.js` `sharedConditions`, `pages/project-settings.js` | Per-project frozen site and defaults with a revision number. `runConditionsStatus` marks stale results |
| Workbench | `pages/workspace-v2.js`, `emb/modeler.html` | Plan/3D views, layers, objects, versions, Send to Simulation (handoff.js) |
| Compare | `pages/results.js`, `compare-2d`, `diff.js` | Version × study matrix, A/B, model diff |
| Reports | `comparison-report*.js`, `pages/comparison-report.js` | PDF/HTML/CSV/JSON |
| Local compute | `local-compute/`, `mvp/js/local-compute.js` | Radiance DF and an EnergyPlus file round trip run by the user |
| Cloud | `cloud.js`, `supabase/` | Optional sync of project JSON when signed in |
| Backup (before this batch) | `store.exportAll/importAll` | v1 JSON with projects only. **EPW not included** (the UI said so). No integrity or reference checks |

## 3. What this batch adds (items 02–04)

| Module | Purpose |
|---|---|
| `mvp/js/contract-hash.js` | Synchronous SHA-256 (identical to WebCrypto and Node) and canonical JSON |
| `mvp/js/parameters.js` | Single resolver: 7 scopes, the provenance triple, validation, conflicts, restore default, study dependency hashes, applicability, effective table, sharedConditions projection |
| `mvp/js/project-contract.js` | Schema 2: contract/config/template, plans, immutable PlanRevisions, assets, run lineage, schema-1 migration, template upgrade, integrity checks |
| `mvp/js/project-backup.js` | Complete backup v2 (with EPW contents) and checked restore |
| `store.js` | Migrates on load (with a pre-migration v1 copy in IndexedDB). `createProject` freezes Account values once. `addRun` attaches lineage. `updateConditions` records provenance. Adds `revertConditions`, `setProjectParameter`, `restoreProjectDefault`, `rollbackPlan`, `addRestored`, `replaceAll`, `preMigrationBackup` |
| UI | Account → Backup & data now builds and restores the complete backup (three restore modes). Project conditions has a per-project backup button. Stale "EPW not in backups" text updated |

Full behavior and limits: `docs/replan-review-handoff.md`.

## 4. Verification commands

Environment: Node 22.22.0, Python 3.13.17, Playwright 1.63.0, Chromium at `/opt/pw-browsers/chromium` (`CHROMIUM_PATH`). Some existing tests default to `/usr/bin/chromium`, which does not exist here. That is an environment limit, so `CHROMIUM_PATH` was set for every run.

```
python3 -m http.server 8765 --bind 127.0.0.1          # repo root (changed code)
python3 -m http.server 8766 --bind 127.0.0.1          # git worktree of 1e9f086 (baseline)
export TEST_BASE=http://127.0.0.1:<port> CHROMIUM_PATH=/opt/pw-browsers/chromium
node --test server/render-api.test.mjs tests/studio-tab.cjs tests/replan-contracts.mjs
node tests/project-backup.cjs
node tests/<each browser check listed below>.cjs
```

Results: see the table in `docs/replan-review-handoff.md` (§ tests), with logs in `docs/replan-evidence/batch-1/`.
