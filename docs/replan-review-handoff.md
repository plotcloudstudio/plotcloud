# Replan review handoff (Claude → Codex) — complete delivery, work packages 01–16

```text
整体交付范围与任务 ID：docs/claude-implementation-todo.md 工作包 01–16（逐项状态见下表）
工作树绝对路径：/home/user/plotcloud（云端容器；Codex 从 GitHub 分支检查）
分支：claude/adoring-mayer-bl1u41
Base commit / Head commit：base 1e9f086（= origin/main = 线上代码文件逐字节一致）；任务文档 9fa0148…e6c25b0；实现提交 a15988d、6ea8ca7、25b3da3 及本文件所在提交（git log 1e9f086..HEAD）
进入任务前的 dirty files：无。全部改动均在上述提交中，可用 git diff e6c25b0..HEAD 查看
改动文件与行为说明：见 §2
已完成 / 复用并验收 / 部分完成 / 阻塞：见 §1
对应完整规划 AC 编号：见 §1 每行
本地启动命令与 URL：python3 -m http.server 8765 --bind 127.0.0.1（仓库根目录）→ http://127.0.0.1:8765/mvp/
测试命令、结果和日志/证据路径：见 §3；日志与截图在 docs/replan-evidence/
真实求解器已执行哪些、哪些仅用测试替身：见 §4
演示模型/EPW 的来源、许可和复现步骤：仓库自带示例 Courtyard studio (sample)；EPW 为测试脚本合成（非真实站点），见 §4
正常路径与失败路径复现步骤：见 §5
迁移、备份、回退方式：见 §6
已知问题和未验证项：见 §7
是否提交 / 是否合并 / 是否部署：已提交并推送到 claude/adoring-mayer-bl1u41；未合并；未部署（线上仍是 1e9f086）
```

## 1. Status per work package

Legend:

- **Done**: implemented, with automated tests run here.
- **Partly**: what exists works and is tested. The listed parts are missing.
- **Blocked**: needs an external engine, service, credential or real professional input that this environment does not have.

| WP | Status | What exists (tested) | Missing / blocked | AC |
|---|---|---|---|---|
| 01 Baseline | Done | Live site and `1e9f086` compared byte for byte (153/153 code files). 22 studies, routes and supporting features recorded in `docs/replan-implementation-status.md`. Baseline tests run on an isolated worktree of `1e9f086` | Pages source setting not readable (no GitHub settings access) | — |
| 02 Data contract | Done (data layer) | Schema 2: Project config (template, use template, uiMode), Plans A/B/C lineage, immutable PlanRevisions, Assets, ParameterRecords, RunGroups, ReportRevisions, Feedback, run lineage. Idempotent migration, plus a pre-migration v1 copy in IndexedDB. Project isolation. Rollback creates a new revision | Recipe is recorded per run as `{id, engine, version:'unrecorded'}`; no versioned engine identity yet | AC03, AC24 |
| 03 Parameters | Done (resolver); Partly (UI coverage) | One resolver with 7 scopes, the provenance triple, conflicts, restore default, template upgrade as a separate change, study dependency hashes and applicability. The project page, the shared-conditions page and the Workbench analysis-property pane all write the same records | Results/Simulation pages still show the existing `runConditionsStatus`, not the new `applicability()` | AC08, AC20 |
| 04 Backup | Done | Backup v2 with EPW contents, missing-asset list, integrity hash and referential checks; damaged files are rejected with nothing changed. Restored in a separate browser profile and the restored EPW drove a real UTCI rerun | Site-page surroundings in IndexedDB `pc-site` are not included (MVP models carry their context inside the model) | AC29 |
| 05 Projects and mode | Done | `#/project/new`: Simple needs only an address or coordinates; Advanced opens all fields. `#/project/<id>`: details, status, client, Simple/Advanced switch (no data change, tested by hash), single override and restore in both modes. Dashboard cards show mode and counts. "Create a project" on the homepage | Address search uses the existing geocoder (network; not exercised in tests — coordinates were used) | AC01, AC02 |
| 06 Three types + registry | Done | Registry for all 22 studies (one primary category each, method, inputs, outputs, test file) plus 36 target capabilities with honest status (screening / reference / data / not connected). Catalogue filters, capability map, `#/tables` from saved run IDs. Old routes untouched | Table views are T03/T04/T05/T06/T09 over saved runs; T07 parameter sweep is not built | AC14, AC15 |
| 07 Weather + templates | Done (checks, templates); Partly (station display) | EPW validator: 8760/8784 without truncation, continuity, duplicates, sub-hourly and partial files rejected, per-field missing values, per-study blocking (readiness shows it). Versioned office/residential/school concept templates plus an explicit generic template; schedules aligned to the EPW calendar (leap day kept); lighting area vs fixtures without double counting; room-level override | Template values are PlotCloud concept assumptions, labelled as such — not a code or regional library. Station metadata display reuses the existing project-climate panel (unchanged). Download/upload failure paths reuse existing behaviour and tests | AC05–AC07, AC09 |
| 08 Readiness + Workbench | Partly | Readiness per study on the overview (existing `inspectStudy` plus EPW field checks). Default study package runs only ready studies (tested on the sample: Sun hours + Daylight; no EPW, so no radiation/UTCI). Workbench pane writes optical / thermal / acoustic / structural / lighting / include-in-analysis records per object | **Current browser engines do not read these new object records yet** (they read geometry and material names); adapters are not written. Viewport visibility vs include-in-analysis is recorded but not applied by engines. Structural blocking reuses the existing structure study | AC10–AC13 |
| 09 Adopt and run Plan B | Done for one rule; Blocked for unattended runs | Daylight window rule: evidence (run, metric, target from the project brief, low-DF area), whitelisted `window.resize` patch with wall, height and neighbour-opening constraints. Adoption is one idempotent transaction and refuses a stale basis. Plan B is derived from A's fixed revision; A is unchanged. A run group reruns the affected studies already in A's package via the existing browser batch; Resume, Retry and Cancel are available. Tested with real engine runs | **Hosted queue / trusted worker not connected**: runs need the page open (stated in the UI). Shading devices and other patches are not connected (the current daylight engine has no shading-object input) | AC18, AC19, AC30 (browser part) |
| 10 A/B | Done | B−A, relative, percentage points, zero base undefined, missing never zero, target-based verdict only when a target exists; design / scenario / not-comparable / unverified; point differences only on coinciding sensors; geometry differences listed separately; no attribution split | Synchronised dual viewports reuse the existing Results compare (unchanged) | AC21–AC23 |
| 11 Reports, sharing, Plan C | Done (files, revisions, offline review); Blocked (hosted share) | One ReportSpec from saved runs feeds PPTX (own OOXML writer: native text, table, editable bars, saved previews with source; Chinese checked in python-pptx and LibreOffice) and the existing PDF/HTML/CSV/JSON. New revision each time with changed vs reused chapters. Review HTML file for the client → returned JSON imported as feedback bound to the report revision → Plan C via the same transaction | **Hosted share links / revocation not built** (needs a deployed backend table and policy; nothing claims a link exists). Native PowerPoint chart objects with an embedded sheet are not produced (bars are editable shapes) | AC25–AC28 |
| 12 Regression and handoff | Done | See §3 | Mobile checks are layout and navigation only | AC31–AC33 (partial) |
| 13 HB-Radiance | Blocked (reference DF verified) | Existing local Radiance DF reference path run here with real Radiance (pyradiance 1.3.1): open 100 %, closed 0 %, glazing scaling as expected | Annual DA/cDA/UDI, sDA/ASE, glare, electric lighting: no recipe adapter or job exporter; marked "not connected" in the registry | AC16 |
| 14 HB-Energy | Blocked | Existing EnergyPlus file round trip (reviewed epJSON + EPW) unchanged | EnergyPlus binary unavailable here (download failed); no automatic thermal model from geometry; PMV/adaptive need a thermal model | AC17 |
| 15 Butterfly / Dragonfly / UWG | Blocked | Registry lists them as not connected, with needs | No OpenFOAM, Dragonfly or UWG runtime or adapter | — |
| 16 Ecosystem, Rendering, Boards | Partly | `#/rendering` client for the existing operator render service (tested against the real local service: health check, provider failure reported, nothing saved). Renders are saved as presentation-only assets. `#/boards` builds a PNG sheet from saved previews and renders with run IDs in captions | Rendering needs a deployed service plus image-model credentials (not available). HVAC, standards recipes, district energy: not connected | AC32 (entries) |

## 2. Changed and added files

| File | Behavior |
|---|---|
| `mvp/js/contract-hash.js` | Synchronous SHA-256 and canonical JSON |
| `mvp/js/parameters.js` | Resolver, provenance, validation, conflicts, restore, dependency hash, applicability, projection to `sharedConditions`. DEFS for site, study, program, object and target |
| `mvp/js/project-contract.js` | Schema 2, migration, plans/revisions/lineage, assets, template and program config, stats, integrity |
| `mvp/js/project-backup.js` | Backup v2 / checked restore |
| `mvp/js/epw-validate.js` | EPW checks per the EnergyPlus EPW dictionary |
| `mvp/js/use-templates.js` | Concept use templates, schedules, calendar, lighting load |
| `mvp/js/capabilities.js` | Three-type registry and target capability status |
| `mvp/js/compare-metrics.js` | A/B rules |
| `mvp/js/recommendations.js` | Rule, patch whitelist, adopt transaction, run groups, feedback patch |
| `mvp/js/zip-store.js`, `mvp/js/pptx.js` | ZIP and editable PPTX |
| `mvp/js/report-spec.js` | ReportSpec, report revisions, PPTX slides, review file, feedback |
| `mvp/js/pages/project.js` | Create and overview page |
| `mvp/js/pages/tables.js` | Tables page |
| `mvp/js/pages/rendering.js` | Rendering and Boards pages |
| `mvp/css/project.css` | Styles for the new pages |
| `mvp/js/store.js` | Migration hook, lineage on runs, provenance on condition changes, rollback, restore helpers |
| `mvp/js/project-climate.js` | Uses the validator, stores quality, `putClimateRecord` |
| `mvp/js/study-readiness.js` | Blocks a study when its EPW fields are missing |
| `mvp/js/pages/account.js` | Backup v2 UI. Fix: `await render()` before writing the restore message (it was overwritten before) |
| `mvp/js/pages/project-settings.js` | Per-project backup; revert through the resolver |
| `mvp/js/pages/workspace-v2.js` | Analysis properties pane |
| `mvp/js/pages/simulations.js` | Three categories plus the capability map |
| `mvp/js/pages/dashboard.js` | Address-first entry; mode and counts on cards |
| `mvp/js/pages/start-study.js`, `mvp/js/pages/new-site.js` | Condition writes go through `updateConditions` |
| `mvp/js/app.js` | Routes: `project`, `tables`, `rendering`, `boards` |
| `mvp/index.html` | `project.css` |
| `mvp/home-preview.html` | "Create a project" button |
| `.github/workflows/browser-smoke.yml` | Contract tests plus a project-data group |
| `tests/replan-contracts.mjs`, `tests/replan-modules.mjs` | Contract tests (node) |
| `tests/project-backup.cjs`, `tests/replan-workflow.cjs`, `tests/rendering-boards.cjs` | Browser end-to-end tests |

## 3. Tests

Environment: Node 22.22.0, Playwright 1.63.0, Chromium (`CHROMIUM_PATH=/opt/pw-browsers/chromium`), Python 3.13 with python-pptx 1.0.2, LibreOffice, pyradiance 1.3.1. Baseline = isolated `git worktree` of `1e9f086` on port 8766. Changed = this branch on port 8765.

RESULTS_TABLE

## 4. Real solvers vs test doubles

- **Real browser engines** in the new tests:
  - Daylight (A run, Plan B rerun, Plan C rerun, default package).
  - Sun hours (default package).
  - UTCI (backup restore rerun).
  - Every existing test exercises its own engine as before.
- **Real Radiance**: the local daylight-factor runner (`tests/local-compute-runner.py`) with pyradiance 1.3.1. EnergyPlus was skipped (no binary).
- **Real render service**: started from `server/render-api.mjs` with an invalid provider key. Only the failure path is verified; no image was generated.
- **Test doubles**:
  - Synthetic EPW files ("QA Climate", generated in the tests — not real weather).
  - A hand-built legacy run in the migration test.
  - A 40×30 px preview image in the Boards test.
  - The client review JSON is produced by the real review page in the test browser with typed text.
- **Plan B numbers**: on the sample, the average DF stayed 2.3 % → 2.3 % at one decimal after the proposed +0.8 m window. That is the real engine result. A separate probe with a much larger window did change sDA/ASE/DF, confirming the patch reaches the solver input. No improvement is claimed.

## 5. Reproduce

- **Workflow**: run `node tests/replan-workflow.cjs`. Manually:
  1. `#/project/new` → enter coordinates → Create.
  2. Overview → switch the mode; Change and Restore default on an input; choose a use template.
  3. Open the sample project overview → set a daylight target above its result → Adopt and run Plan B.
  4. Keep the page open until the run group shows succeeded → Compare plans.
  5. Report: Save revision + PowerPoint, PDF, Review file.
  6. Open the review file, comment and save the JSON → import it under Feedback → "Make the next plan from this" → Adopt and run.
- **Failure paths covered**:
  - No target, so no suggestion.
  - Stale basis refused.
  - Illegal patch (outside the wall, too tall, overlapping an opening) refused with A unchanged.
  - Repeat adoption is a no-op.
  - Damaged, edited or broken-reference backups are refused with nothing changed.
  - Partial, sub-hourly or duplicate EPW refused; missing radiation blocks only the studies that need it.
  - Render without a service, and with a failing provider, saves nothing.

## 6. Migration, backup, rollback

- Schema 1 → 2 only adds fields and is idempotent. The first migration stores the untouched data as a v1 backup in IndexedDB key `pc-mvp-v1:before-schema-2`.
- To roll back the code: older code ignores the new fields. For a full data rollback, restore that v1 text through Account → Restore (Replace everything).
- Backups v2 are restorable in any browser; v1 files still restore.
- Cloud sync sends the new fields inside the project row. Not verified against a live Supabase.

## 7. Known issues and not verified

1. Projects with `siteLinked` still read the Account address at run time for non-pilot engines (pre-existing). PlanRevisions freeze what was used, so history is safe, but this contradicts “no implicit Account reads”. Proposed: switch existing projects to own-site on next save, after review.
2. New object analysis properties are recorded but not consumed by current engines (see WP08).
3. Unattended automatic runs need a hosted queue; browser runs stop when the page closes.
4. Hosted share links, HB-Radiance annual and glare, HB-Energy, CFD, Dragonfly/UWG and the rendering provider are not connected.
5. Template values are concept assumptions. A target is never assumed; the user must enter it.
6. Address search, automatic EPW download and cloud sync were not exercised in the new tests (external services). Their existing tests are listed in §3.
7. Mobile: overview, account backup and project conditions open at 390 px without horizontal scroll. Editing, adoption and report creation were tested on desktop only.
8. The sample project's fixed ID makes a restore into a new browser arrive as a copy (by design of the conflict rule).
