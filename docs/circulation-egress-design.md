# Circulation 与 Fire Evacuation：实现设计

日期：2026-11-04。状态：代码审查与开发设计，尚未实现疏散求解器。

## 1. 从建筑师的交付成果反推

主要任务：建筑师在方案阶段，比较出口、走廊、家具和楼梯方案，交付可追溯的疏散路径图、瓶颈说明和 A/B 比较报告。住宅、办公、学校和医疗建筑不能共用一套未经确认的人群假设。

目前 PlotCloud 能生成单层房间间的动线路径。要回答疏散问题，还需要明确“谁从哪里出发、何时开始、通过什么设施、到哪里才算完成”。首期目标是几何检查与明确假设下的疏散筛查；消防合规判断和烟气可生存时间不属于这一阶段。

产品建议：保留 Circulation（日常动线），让 Fire Evacuation 使用独立场景与结果，二者复用导航、几何、项目版本和报告底层。不要更改现有 `evac` ID 或把旧结果重新解释成逃生结果。

## 2. 已检查的代码事实

| 位置 | 当前能力 | 与疏散需求的差距 |
| --- | --- | --- |
| `mvp/js/circulation-engine.js`，`EV` | 0.4 m 导航格、A*、Dijkstra、禁止对角穿墙、路径拉直 | 没有按人的身体宽度与行动能力构建可通行空间 |
| 同文件 `run()` | 所有房间对生成路径；按两个房间的 use 乘积配权重；蚁群探索轨迹 | 并非起点到安全出口的人口撤离；蚂蚁数量不代表人数 |
| 同文件 `ANT_V` 与回放 | 1.3 m/s；按算法轮次安排轨迹起始时间 | 不是报警响应时间，也没有真实排队和速度互动 |
| 同文件 `density` | 累计经过各格的路径长度，界面显示 m walked / m² | 不等于瞬时拥挤密度 persons / m² |
| 同文件 `clearWidth()` | 已有基于距离变换的栅格局部宽度函数 | 当前 `run()` 未调用；局部厚度不能直接当成门净宽或法规宽度 |
| `emb/modeler.html`，`levelPlan()` | 导出当前楼层墙线、门洞/开洞缺口、家具矩形边和房间点 | 未带出门语义、净宽、开门状态、墙厚、多楼层连接或安全终点；房间没有稳定 ID |
| `mvp/js/workspace-chrome.js`，`placesOf()` | 按房名推测使用率，可手动覆盖；走廊不作为目的地 | 同名房间共享参数键；没有人数、角色、时间表和方向性起终点需求 |
| 同文件 `evac` 分支 | 显示不可达房间对、最长/平均路径、路径热图；保存楼层与加权模式 | 保存的 settings 没有完整 circUse 明细；需补齐才能复算原结果 |
| `mvp/js/capabilities.js` | 描述明确限定为日常步行筛查 | 引用的 `tests/mvp-new-sims.cjs` 实际主要测旧版 wayfinding/privacy/noise，不是疏散验证证据 |

几何风险需用专门算例确认：`freeCell()` 会向附近空格吸附，未验证是否隔墙；`route()` 把原始端点接回路径；蚁群线经过 Chaikin 平滑与 wobble 后没有逐段验证完整人体扫掠区域。逃生路径必须重新验证，不能直接沿用显示曲线。墙线与家具边界还需转换为实体障碍和限定的楼板可行走区域，防止路径从建筑外绕行。

## 3. 参数应分为几何、人员、情景和方法

| 类别 | 必要输入 | 如何进入计算 |
| --- | --- | --- |
| 建筑空间 | 实际楼板范围、墙厚、障碍物、走廊净宽、起点区域 | 构建可行走多边形；障碍按身体包络扩张；不可从模型空白处抄近路 |
| 门与出口 | 门的稳定 ID、实际净宽、开启方向/状态、锁闭、可用时段、是否为最终出口 | 门作为独立 portal；容量与可用性约束；普通房门不是安全出口 |
| 垂直设施 | 楼梯两端楼层/位置、宽度、踏步/坡度、扶手影响、平台、坡道 | 跨楼层有向连接；累计实际距离、行走时间与合流排队 |
| 人员 | 每个区域人数、初始分布、身体包络、自由速度分布、响应时间分布、路线熟悉度 | 初始化真实人员状态；人口与起点需要用户确认 |
| 无障碍与协助 | 行动能力、轮椅/辅助器具、可用路径、协助人数、协助准备时间 | 不用年龄直接指定固定速度；无法独立下楼的人不能自动走普通楼梯 |
| 医疗情景 | 可自行疏散/需协助/卧床人员、工作人员数量、病床包络、分区边界 | 协助人员作为有限资源；水平转移与最终撤离分别记录 |
| 时间与出口选择 | 报警起算点、启动延迟、分批通知、指定/熟悉出口、换路规则 | 事件时间线；按可达性、预计时间、排队和熟悉度决定路线 |
| 故障情景 | 一扇出口锁闭、走廊受阻、某时刻路线失效 | 独立 A/B 场景；明确阻断是用户设定，不是已计算火灾蔓延 |
| 方法参数 | 时间步、几何分辨率、随机种子、容量曲线来源、重复次数 | 高级设置；记录来源与范围，做收敛和敏感性检查 |
| 规范信息 | 地区、适用规范版本、用途分类、项目条件 | 独立规则检查层；没有规则包时结果为“未核查”，不得写“通过” |

不能统一硬编码“所有门至少 X m”“所有项目最多 Y m”。出口数量、独立性、死端、共用路径、疏散距离、门扇和楼梯要求要由明确版本的地区规则包判断；每条结论应带条文依据、输入和适用条件。

## 4. 推荐的代码分层

以下文件为拟新增，并非已有实现：

```text
mvp/js/movement/
  scene-adapter.js       # 从现有模型提取带稳定 ID 的楼层、房间、门、楼梯
  geometry.js            # 楼板裁剪、障碍实体、净距与路径段碰撞检查
  navigation.js          # 分楼层导航 + portal/楼梯连通图，按行动能力过滤
  demand.js              # 日常动线 OD 需求与时段；不替代疏散人口
mvp/js/egress/
  scenario.js            # 场景 schema、单位、校验、缺失项与数据来源
  routing.js             # 出口选择、不可达识别与受控重算
  solver.js              # 首期：人员事件与通道容量队列
  worker.js              # 后台运行、进度、取消、种子复现
  metrics.js             # 逃生距离、人数状态、排队、完成时间与不确定性
  report.js              # 路径图、出口表、时间线、情景比较与输入证据
```

当前 `workspace-chrome.js` 负责 UI 与引擎适配，不继续在其中增加成百行求解代码。`fire-evacuation` 占位路由只有在完成首期验收后才转换成可运行入口。

建议的 TypeScript 数据合同（当前项目是 JS，可用 JSDoc 表达）：

```ts
type EgressScenario = {
  schemaVersion: number;
  projectId: string;
  modelVersionId: string;
  geometryHash: string;
  levelIds: string[];
  timeOrigin: 'alarm' | 'ignition';
  occupants: OccupantGroup[]; // roomId, count, profileId, spatial distribution
  profiles: MobilityProfile[]; // dimensions, speed distribution, response distribution
  portals: Portal[]; // modelObjectId, clearWidthM, capacity model, availability
  links: LevelConnection[]; // stair/ramp, endpoints, restrictions, travel model
  safeDestinations: SafeDestination[]; // final exit / refuge / compartment transfer
  events: ScenarioEvent[]; // timeS, targetId, closure / reopening
  assistance: AssistancePlan[];
  method: { id: string; version: string; timeStepS: number; seed: number };
  assumptions: Assumption[]; // value, units, source, confirmed/estimated/unknown
};
```

出口、房间、楼梯使用 ID，名称只做显示。修改房名不得改变人数；复制楼层必须重新确认连接与出口。缺失出口、楼梯连接或关键几何时返回结构化问题，禁止自动补出不存在的安全通路。

## 5. 求解器首期怎么写

优先实现可审计的“导航图 + 容量队列”筛查，再接连续人群运动模型。首期动画仅作为人员进度的示意重放，不宣称表现了真实挤压或身体接触。

1. 提取楼板、墙厚和门洞，构建连通图。按行动能力剔除无法通过的门、转角和楼梯。
2. 校验人数、起点、最终安全终点和跨层连接。识别一开始就不可达的人员；不把他们从总人数中删除。
3. 根据已记录的分布和随机种子采样人员启动时间、自由速度等。
4. 响应时间结束后选择出口，进入路线。使用预期行走时间、队列延误及熟悉度等可解释项；首期避免没有来源的“恐慌系数”。
5. 通道容量限制人员过门；下游区域必须有空间才允许放行。两个上游队列进入同一楼梯要竞争同一容量。
6. 处理路线失效、等待、协助资源、重新选路；换路使用最小改善阈值/冷却时间，避免每帧反复改出口。
7. 所有人抵达最终安全终点或达到时间上限时结束。尚在避难区、等待协助、不可达、超时分别记录。

核心流程伪代码，不能直接当成已验证实现：

```js
while (clock < scenario.maxTimeS && state.unfinishedCount > 0) {
  applyEventsThrough(clock);              // 门/走廊状态；必要时使路由缓存失效
  releaseReadyOccupants(clock);           // 反应时间已到；协助约束满足
  updateRouteChoicesAtDecisionPoints();
  const proposed = proposeMovements(dt);  // 不能直接修改全局占用
  resolvePortalQueuesAndMergeConflicts(proposed, dt);
  enforceDownstreamStorage(proposed);
  commitMovementsSimultaneously(proposed);// 避免数组遍历顺序决定通行优先权
  recordTerminalArrivals(clock, dt);      // 只有跨越指定终点才算完成
  assertPopulationConservation();
  collectMetrics(clock, dt);
  clock += dt;
}
```

首期容量模型可表达为 `capacity = specificFlow × effectiveWidth`，单位 persons/s；specificFlow 和有效宽度定义必须由明确方法/实测来源提供。不能用随意常数；也不能让空门长期累积“通行积分”，导致人群到达时瞬间全部通过。按服务时间预约下一次可通过时刻，或使用限制突发容量的预算；容量改变和关闭事件要中断/重排预约。

如果后续采用连续微观人群模型，其速度—间距与碰撞机制本身会产生门口流量，不能未经校准再叠加同一套容量限制，否则可能重复计算拥堵。JuPedSim 的模型和路由接口值得用作实现/对照候选，但需要独立验证模型适用范围、多层协助支持、部署成本与许可，不等于接入后自动满足消防要求。

## 6. 结果与报告

- 路径：按房间和行动能力显示到可用安全出口的实际路线、距离、净宽瓶颈、替代路径。轮椅转弯需要扫掠包络，不能只看走廊某处的宽度。
- 人数：总人数、已到最终安全处、已到避难区、等待、不可达、超时，各状态互斥且守恒。
- 时间：最后一人完成时间，以及全体初始人口的 50%/90%/95% 完成时刻；目标比例未达到时返回 null，不只对成功离开者取分位数。
- 瓶颈：出口累计通过量、最大/持续排队、区域占用与容量利用；无连续空间运动模型时，不输出看似精确的局部 persons/m² 热图。
- A/B：共享人口、响应假设和情景参数；用按人员 ID 分配的随机数流保持可比性。不能只对比动画颜色。
- 报告：模型/楼层/出口版本、场景完整快照、计算方法版本、运行时间、随机种子、数据来源、缺失项及适用边界；输入变化标记旧结果过期，但保留历史。

时间起算点必须明确：首期建议“从报警开始的疏散完成时间”。只有从起火计时并明确包含探测、通知、人员响应及运动时间时才讨论完整 RSET；行走时间与排队不能重复相加。未计算烟气/热危害的 ASET 时，不能给出安全裕量或宣称人员能在危险前撤出。

## 7. 实施顺序与验收

**核心第一阶段：几何与路线证据**

提取稳定 ID 和门/楼梯语义，真实墙厚与楼板边界，起点/出口确认，多层连通，不可达和净距检查。输出路线图与输入清单。Circulation 先补用户指定的有向 OD、时段和加权指标；修复同名房间键和结果设置快照。

**核心第二阶段：疏散队列筛查**

人数和启动时间、不同能力、门/楼梯容量、合流、一个出口失效情景、守恒与完成时间、A/B 报告。先支持明确范围的住宅/办公；医疗协助与分区转移需下一阶段真实支持后才开放对应模式。

**辅助/后续：更丰富的人群行为**

连续碰撞避让、双向流、结伴/工作人员协助、病床移动、动态引导、重复场景的不确定性区间。人体外观不是计算能力的证据。

**延后：火灾与合规结论**

烟气/温度/毒性场、失能、完整 ASET/RSET 联合分析、受保护疏散电梯及辖区规则包，分别建立数据接口与验证证据后再提供。普通电梯不能默认参与疏散。

必要测试：

1. 一个人、直走廊、无延迟：应接近距离/速度；增加启动延迟应使结果对应平移。
2. 门宽变化、门关闭、墙角、凹形房间、家具阻挡：不穿墙、不从楼板外绕行、不把高位开洞当门。
3. 100 人经单门：没有瞬时全通过；末人时间随服务容量改变，人数守恒。
4. 两出口、一个失效：可重选出口或明确不可达；不会凭空出现新出口。
5. 上下两层汇入楼梯：共享容量，楼层连接有实际旅行时间；到达楼梯口不算逃出。
6. 无无障碍路线/协助资源不足：保留等待与未完成状态，绝不让轮椅自行走普通楼梯。
7. 两个同名房间、改房名、切楼层：参数按 ID 保持独立，旧结果正确失效。
8. 固定输入和种子复现；时间步减半/网格细化、多人随机重跑的结果收敛与敏感性可解释。
9. UI 完整任务：标出口 → 配人口 → 运行 → 解释瓶颈 → 保存 → 比较 → 导出，并能取消任务和识别过期结果。

测试代码正确性（verification）与同实验/观测数据比较（validation）必须分开记录。通过上面的单元测试不代表具备真实建筑消防预测精度。

## 8. 来源及与产品设计的关系

- NIST TN 1822，2013：[The Process of Verification and Validation of Building Fire Evacuation Models](https://www.nist.gov/publications/process-verification-and-validation-building-fire-evacuation-models)。其验证框架覆盖启动前时间、运动导航、出口使用、路径可用性和流量限制，也讨论行为不确定性。本方案的分层和测试采用这一分类；并非声称 NIST 认可本产品。
- NIST TN 1680，2010：[A Review of Building Evacuation Models, 2nd Edition](https://www.nist.gov/publications/review-building-evacuation-models-2nd-edition)。提供模型功能差异的参考，包括逆向流、出口堵塞、行动较慢人员、结伴及火灾影响。
- [JuPedSim pedestrian models](https://www.jupedsim.org/stable/pedestrian_models/) 与 [routing](https://www.jupedsim.org/v1.4.0/concepts/routing.html)。其公开文档展示了运动模型、个体参数与路线阶段的分离；本文将其列为后续工程候选，并未安装或接入。
- [NIST evacuation timeline discussion](https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=861419)。用于区分探测、报警、反应和运动的时间基准。

除明确写为代码事实或引用资料的内容外，上述模块组织、产品阶段、数据结构和接口均为针对 PlotCloud 的设计建议。
