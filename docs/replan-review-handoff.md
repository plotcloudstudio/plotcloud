# Replan review handoff (Claude → Codex)

## Batch 1 — items 01, 02, 03, 04

```text
批次与任务 ID：第一批 01 确认代码基线 · 02 项目/方案/运行数据契约 · 03 统一参数解析与来源链 · 04 完整项目备份与恢复
工作树绝对路径：/home/user/plotcloud（云端容器；Codex 通过 GitHub 分支检查）
分支：claude/adoring-mayer-bl1u41
Base commit / Head commit：base 1e9f086（= origin/main，线上 153 个代码文件逐字节一致）+ 文档提交 9fa0148、26a5426；head 见本文件所在提交（git log -1）
进入任务前的 dirty files：无（git status 干净）。本批改动全部在本分支的单个提交中，可用 git diff 26a5426..HEAD 区分
改动文件与行为说明：见下文“改动”
已完成 / 复用并验收 / 部分完成 / 阻塞：见下文“状态”
对应完整规划 AC 编号：AC03、AC08、AC20、AC24（数据部分）、AC29；以及数据迁移与基线检查
本地启动命令与 URL：python3 -m http.server 8765 --bind 127.0.0.1 → http://127.0.0.1:8765/mvp/
测试命令、结果和日志/证据路径：见下文“测试”；日志 docs/replan-evidence/batch-1/
真实求解器已执行哪些、哪些仅用测试替身：见下文“求解器与替身”
演示模型/EPW 的来源、许可和复现步骤：示例项目 Courtyard studio (sample)（仓库自带）；EPW 为测试脚本合成的“QA Climate”，非真实站点，无许可问题
正常路径与失败路径复现步骤：见下文“复现”
迁移、备份、回退方式：见下文“迁移与回退”
已知问题和未验证项：见下文
是否提交 / 是否合并 / 是否部署：已提交并推送到 claude/adoring-mayer-bl1u41；未合并；未部署（线上仍为 1e9f086）
```

### 改动

| 文件 | 行为 |
|---|---|
| `mvp/js/contract-hash.js` (new) | 同步 SHA-256（与 WebCrypto/Node 结果一致，有测试）+ canonical JSON 哈希 |
| `mvp/js/parameters.js` (new) | 唯一解析入口 `resolve()`：study-object → plan-object → study-global → project-config → derived → template → recipe-fallback；同作用域显式优先；显式冲突返回 `status:'conflict'` 且无值，需 `chooseConflict`；`setParameter` 校验单位/范围/IANA 时区并按 path+scope+study+target 写同一记录（事件链）；`restoreDefault` 仅停用目标覆写；`valueOrigin / acquisition / modeAtAcquisition` 三字段独立，`provenanceLabel` 组合标签；`studySnapshot`/`applicability` 按研究订阅的物理输入判断旧结果；`effectiveTable` 导出最终值与来源；`recordConditionsChange` 把现有 sharedConditions 的每次变化写成记录；`syncMirror`/`mirrorMismatches` 维护投影一致性 |
| `mvp/js/project-contract.js` (new) | schema 2：`contract{schema,uiMode,currentPlanId,config{revision,template,history}}`、`plans`（A/B/C lineage）、不可变 `planRevisions`（模型 hash、条件快照、参数表、physicalHash/inputHash、模板版本；uiMode 不进 hash）、`assets`（当前与历史引用的 EPW）、`runGroups/reportRevisions/feedback` 容器；`migrateProject`（幂等，历史条件写“unrecorded”不倒填）；`initProject`（账户值仅在新建时复制）；`freezePlan`（同输入复用、变化即新修订）、`derivePlan`、`lineage`、`runContract`、`templateDiff/upgradeTemplate`（独立变更，不改已存修订）、`integrityProblems` |
| `mvp/js/project-backup.js` (new) | 备份 v2：项目全量 + EPW 原文 + `missingAssets` 清单 + 完整性 hash；恢复前检查格式/schema/完整性/每个资产 SHA-256/EPW 行数/引用完整性/天气引用均“包含或列为缺失”/ID 冲突；任一失败抛错，浏览器内容不变；EPW 先按内容地址写入并回读校验，再写项目；ID 冲突默认作为副本加入，可选替换；v1 文件走旧路径并说明不含天气 |
| `mvp/js/store.js` | 载入时迁移（迁移前把原数据以 v1 备份格式存入 IndexedDB `pc-mvp-v1:before-schema-2`，仅一次）；`createProject`/`seed` 调 `initProject`；`addRun` 附加 `planRevisionId/inputs/inputHash/recipe`（失败只记 `contractError`，不阻止保存结果）；`updateConditions` 记录来源（新增 `keepRevision` 选项用于新项目初始设置）；新增 `revertConditions`、`setProjectParameter`、`restoreProjectDefault`、`rollbackPlan`、`addRestored`、`replaceAll`、`preMigrationBackup`；`putProject`（云端拉回）先迁移 |
| `mvp/js/project-climate.js` | `putClimateRecord`（恢复时按 hash 校验后写入）；记录 `stationChosen`；说明文字改为 EPW 包含在完整备份中 |
| `mvp/js/pages/account.js` | 备份按钮生成 v2（显示包含/缺失的天气文件）；恢复显示检查结果、副本数量、缺失天气；三种模式；修复：恢复后 `await render()` 再写消息（原代码异步 render 会覆盖消息） |
| `mvp/js/pages/project-settings.js` | 单项目完整备份按钮；取消编辑改走 `revertConditions`（留下 revert 事件） |
| `mvp/js/pages/start-study.js`, `new-site.js` | 原先直接改 `sharedConditions` 的三处改为经 `updateConditions` 记录来源 |
| `tests/replan-contracts.mjs` (new) | 12 个 node:test 契约测试（02/03） |
| `tests/project-backup.cjs` (new) | 浏览器端到端：旧数据迁移、两个独立浏览器存储间备份恢复、损坏包拒绝、真实 UTCI 重跑 |
| `.github/workflows/browser-smoke.yml` | 契约测试加入 node --test；新增 project-data 组（project-backup、mvp-dashboard） |
| `docs/replan-implementation-status.md` (new) | 01 基线记录 |

### 状态

| 任务 | 状态 | 说明 |
|---|---|---|
| 01 基线 | 已完成 | 线上与 1e9f086 逐字节一致（代码文件）；22 项、天气、Workbench、比较、报告、本地计算、Rendering/Boards 现状见 status 文档；Pages 设置本身未读取（未知） |
| 02 数据契约 | 部分完成（数据层完成） | Project 配置/PlanRevision/Asset/ParameterRecord/RunGroup/ReportRevision/Feedback 已建；Recipe 仅为 run 上的 `{id, engine, version:'unrecorded'}`，未建注册表（item 06）；无 UI 展示 Plan A/B/C（后续批次） |
| 03 参数解析 | 部分完成 | 解析器、来源三字段、覆写/恢复/冲突、依赖 hash 与适用性、导出表已实现并测试；项目参数页（shared conditions）已写入同一记录；**Workbench 尚未调用 `setParameter`**（API 与 plan-object 作用域已就绪，接入属 item 08）；现有结果状态 UI 仍用原 `runConditionsStatus`，新 `applicability` 尚未显示在界面 |
| 04 备份恢复 | 已完成 | 账户与单项目两入口；独立浏览器存储恢复后实际打开结果并用恢复的 EPW 真实重跑 UTCI，结果一致 |

### 测试

见 “测试结果” 表（由本批最终运行填写，日志在 `docs/replan-evidence/batch-1/`）。

### 求解器与替身

- 真实执行：浏览器 UTCI（sunhours 引擎 `measure: utci`），在 A 存储运行并保存，在 B 存储用恢复的 EPW 再次运行，KPI 一致（除计算耗时）。其余现有测试中的引擎由各自测试执行。
- 测试替身：EPW 为合成文件（非真实气象，仅验证文件流转与引擎可读）；迁移测试中的旧版 run（`rLegacy`）是手工构造的历史记录，不是求解结果。
- 未执行：Radiance/EnergyPlus 本地引擎、云同步（Supabase）真实往返。

### 复现

正常路径：打开 `/mvp/` → Project shared conditions 上传 EPW → 运行 Outdoor thermal comfort 并保存 → Account → Backup & data → Download backup → 另一浏览器配置（或隐私窗口）打开 `/mvp/`、登录本地账户 → Restore 选择文件 → Results 中打开恢复的项目（与示例同 ID 时作为 “(restored 日期)” 副本出现）→ 再运行 UTCI。

失败路径：修改备份中任一数值（完整性失败）；修改 EPW 内容并重算文件 hash（资产 SHA-256 失败）；把 run 的 versionId 改为不存在（引用失败）。三者均显示原因且项目数量/内容不变。自动化：`node tests/project-backup.cjs`。

### 迁移与回退

- 迁移是增量：旧字段（versions、runs、settings、results、sharedConditions）不改写，只新增字段；重复迁移无变化（测试覆盖）。
- 首次迁移前，原数据以 v1 备份格式存入 IndexedDB 键 `pc-mvp-v1:before-schema-2`（`S.preMigrationBackup()` 读取）。若 IndexedDB 不可用，`DB.migrationBackup` 记录 “unavailable”。
- 回退代码：旧代码读取 schema 2 数据时会忽略新增字段（旧代码不认识它们）；如需完全恢复迁移前数据，取出上述 v1 文本，用 Account → Restore（Replace everything）导入。
- 云端：新增字段随项目 JSON 同步；旧设备的项目在 `putProject` 时迁移。未做真实 Supabase 验证。

### 已知问题和未验证项

1. `siteLinked`（默认 true）的项目，非试点引擎仍通过 `S.siteOf()` 运行时读取账户地址——与 02 “禁止运行时隐式读取账户新值” 不符。本批未改此行为（会改变现有引擎输入）；PlanRevision 冻结了实际条件，因此历史不受影响。建议在 item 05/06 统一处理。
2. Run 的 `inputs` 记录项目级有效值；引擎页中单次研究的本地覆写仍只在 `run.settings` 中（未进入参数记录）。
3. 引擎版本未记录（`recipe.version: 'unrecorded'`）。
4. Workbench 未接入参数记录；对象/房间级记录目前只有 API 与契约测试。
5. `new-site.js` 地址设置的 tz/elev 来源统一记为用户手动输入，实际 tz/elev 来自地理服务推导；待 item 07 细分。
6. 示例项目 ID 固定为 `demo-courtyard`，在新浏览器恢复时会作为副本加入（符合冲突规则，但用户可能更希望替换未修改的示例）。
7. 预先存在的失败（基线同样失败，与本批无关）：`tests/simulation-art.cjs`（noise 调色板缺失）、`tests/exterior-layout.cjs`（Settings 标签超时）。详见测试表。
8. 手机：仅检查了账户备份页与项目条件页在 390 px 无横向滚动、按钮可见；未在手机上执行下载/恢复。
9. 迁移后数据体积增加（每版本一条 PlanRevision、每次条件变化一个参数事件）；未做大项目容量测试。
