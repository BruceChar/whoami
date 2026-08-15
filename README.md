
# whoami (delphi )🪞 —— 一面照向内心的镜子

> Be water my friend.

**delphi** 是一个**自我认知 Agent**：通过分析你的**表达过程**（而非仅内容），帮助你认识自己、看见自己如何思考、发现思维漏洞、追踪认知成长。

本仓库实现了文档 `whoami.md`（完整需求说明 v1）中的 **CLI 本地模式**：完全离线、隐私优先、所有数据本地存储。

> 为什么叫 delphi？—— 德尔斐神庙刻着古希腊最著名的箴言：**「认识你自己」(γνῶθι σεαυτόν)**。这正是本项目的使命。

## 快速开始

要求：Node.js 20+、pnpm 9+

```bash
pnpm install
pnpm build                 # 构建 core + cli
pnpm test                  # 运行核心引擎单元测试（node:test，27 项）

# 方式一：直接运行
pnpm run delphi

# 方式二：全局安装命令
pnpm run link:global       # 之后可以直接敲 delphi
delphi
```

数据保存在 `~/.delphi/profile.json`（一个 JSON 文件包含全部认知档案，可随时导出/备份/恢复）。
可用环境变量 `DELPHI_DATA_DIR` 指定数据目录（便于测试隔离）。

## 功能一览（对照文档）

| 文档章节    | 功能                                                              | 命令                                                                          |
| ----------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 三、3.1-3.3 | 三层思维分析模式（隐式/显式/引导式）                              | `delphi chat`，对话内 `/stealth` `/transparent` `/guide` `/analyze` |
| 四、4.1.1   | 回馈分析法（每日满意/不满意）                                     | `delphi daily`                                                              |
| 四、4.1.2   | 自由对话（隐式分析主战场）                                        | `delphi chat`                                                               |
| 四、4.2.1   | V-T-D 价值观-天赋-梦想                                            | `delphi vtd`                                                                |
| 四、4.2.2   | SIGN 天赋信号探测                                                 | `delphi sign`                                                               |
| 四、4.3.1   | SWOT 分析（Agent 增强：优势阴影/劣势再框定/控制圈分离）           | `delphi swot`                                                               |
| 四、4.3.3   | 成就事件萃取（STAR）                                              | `delphi achievement`                                                        |
| 四、4.4.1   | 兴趣矩阵（四象限能量评分）                                        | `delphi interest`                                                           |
| 五          | 从业分析引擎                                                      | `delphi career`                                                             |
| 六          | 人生设计引擎（Connect The Dots / 重力问题 / 多重人生 / 原型设计） | `delphi life`                                                               |
| 七、7.2     | 认知仪表盘                                                        | `delphi space dashboard`                                                    |
| 七、7.3     | 成长时间线（17 指标 + 转折点 + 练习效应校正）                     | `delphi space timeline`                                                     |
| 七、7.4     | 思维档案库                                                        | `delphi space archive`                                                      |
| 七、7.5     | 洞察收藏夹                                                        | `delphi space insights`                                                     |
| 七、7.6     | 原型实验室                                                        | `delphi space lab`                                                          |
| 七、7.7     | 设置与隐私（导出/备份/导入/清空）                                 | `delphi space settings`                                                     |
| 八、8.x     | 个人画像（认知指纹 + 能量地图 + 六维活画像，版本化）              | `delphi persona`                                                            |
| 九          | 统一数据模型（`UserCognitiveProfile`）                          | 全部命令汇入同一档案                                                          |

启动 `delphi`（无参数）即进入文档 10.1 的交互主菜单。

## 目录结构（对照文档 11.2）

```
whoami/
├── packages/
│   └── core/                    # 核心引擎（CLI/Web 共享）
│       └── src/
│           ├── models/types.ts       # 统一数据模型（文档第九章）
│           ├── storage/store.ts      # JSON 文件存储（本地隐私优先）
│           ├── analyzer/             # 认知标记 / 7 种偏差 / 归因 / 抽象层级
│           ├── engine/               # 三层模式 + 模式切换器
│           ├── llm/                  # LLM Provider 抽象 + pi-ai 接入 + Agent 工具
│           ├── frameworks/           # 回馈/VTD/SIGN/SWOT/成就/兴趣矩阵
│           ├── profiler/             # 成长追踪 + 转折点检测
│           ├── persona/              # 认知指纹 / 能量地图 / 画像组装
│           ├── outputs/              # 从业分析 / 人生设计
│           └── services/             # 档案服务编排
├── apps/
│   ├── cli/                      # CLI 本地模式（Commander + readline + chalk）
│   │   └── src/
│   │       ├── commands/             # chat/daily/vtd/swot/sign/career/lifeDesign/persona...
│   │       ├── commands/space/       # dashboard/timeline/archive/insights/lab/settings
│   │       └── ui/                   # 盒式边框/进度条/火花线/输入助手
│   └── web/                      # Web 端（Next.js，待实现）
├── tsconfig.base.json
└── package.json                  # pnpm workspace
```

## 设计原则的实现

- **镜子原则**：Agent 永远说「我注意到…」，不说「你应该…」（见显式模式输出）
- **三层模式**：`/stealth`（静默分析）→ `/transparent`（metacog 实时快照）→ `/guide`（元思考引导）
- **数据统一**：每个工具的产出汇入同一份 `UserCognitiveProfile`，交叉验证
- **迭代进化**：每次档案更新后全量重算 17 项指标、成长阶段、从业分析、画像（`recomputeProfile`）
- **真实成长**：练习效应校正——前 5 次会话的「表面提升」斜率被标记并从趋势中扣除
- **反标签**：画像只描述动态模式与变化，绝不贴「你是 XX 型」的固定标签
- **隐私优先**：完全离线，`~/.delphi/` 一个目录，可导出/备份/删除

## 与文档的工程取舍（说明）

| 文档建议                | 本实现                                    | 原因                                                                                      |
| ----------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| SQLite (better-sqlite3) | JSON 单文件档案（`store.ts`，原子写入） | 零原生依赖、跨平台零编译、可直接导出/备份/恢复；SQLite 可后续无缝替换                     |
| Ink (React for CLI)     | readline + chalk（ASCII 艺术）            | Ink 依赖 yoga 原生模块且难以脚本化测试；当前实现全部命令均可管道输入自动化验证            |
| compromise.js (NLP)     | 中文优先的规则词库（`lexicons.ts`）     | 完全离线、可解释；`MessageMarkers` 数据结构已预留，后续可换 LLM/NLP Provider 而不改模型 |
| Turborepo               | pnpm workspaces                          | 减少工具链复杂度；构建为`tsc` 项目引用，可随时升级 turbo                                |

## 测试

```bash
pnpm test    # 27 项单元测试（偏差检测/认知标记/模式切换/框架/画像/存储）
```

CLI 全部交互命令支持管道输入，可脚本化冒烟测试：

```bash
printf '今天很累，老板总是加需求\n/quit\n' | DELPHI_DATA_DIR=/tmp/t pnpm run delphi chat
```