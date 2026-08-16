# whoami (delphi )🪞 —— 一面照向内心的镜子

> Be water my friend.

**delphi** 是一个**自我认知 Agent**：通过分析你的**表达过程**（而非仅内容），帮助你认识自己、看见自己如何思考、发现思维漏洞、追踪认知成长。

本仓库实现了文档 `whoami.md`（完整需求说明 v1）中的 **CLI 本地模式 + Web 端**：数据本地存储、隐私优先，分析由真实 LLM（pi-ai）驱动（需配置 API Key）。

> 为什么叫 delphi？—— 德尔斐神庙刻着古希腊最著名的箴言：**「认识你自己」(γνῶθι σεαυτόν)**。这正是本项目的使命。

## 快速开始

要求：Node.js 20+、pnpm 9+。

```bash
pnpm install
pnpm build                 # 构建 core + cli
pnpm test                  # 运行核心引擎单元测试（node:test，50 项）

# 配置 LLM（二选一）：
export DELPHI_LLM_PROVIDER=deepseek
export DEEPSEEK_API_KEY=sk-你的密钥
# 或写入配置文件 <dataDir>/config.json（Web 端「设置」页也会写这里）
# { "provider": "deepseek", "model": "deepseek-v4-flash", "apiKey": "sk-..." }

# CLI
pnpm run delphi            # 未配置 Key 时自动弹出配置帮助
delphi doctor              # 检查配置状态

# Web：开发 / 构建 / 生产
pnpm web                   # http://localhost:3088
pnpm web:build
```

数据保存在 `~/.delphi/profile.json`（一个 JSON 文件包含全部认知档案，可随时导出/备份/恢复）。
可用环境变量 `DELPHI_DATA_DIR` 指定数据目录（便于测试隔离，CLI 与 Web 共享同一档案）。

### Web 界面

极简舒适风格。进入首页即**对话模式**（默认隐式），左侧边栏展示**会话历史**；对话标题为 **Be water my friend.**，顶部展示全局统计（会话数 / 洞察数 / 画像版本，点击进入分析面板）。首次使用会引导设置**称呼**（个人基础信息，可在设置页修改）。输入框上方的**隐式 / 显式 / 引导式**切换按钮控制分析模式，键入 `/` 弹出**工具模板**（V-T-D / SIGN / SWOT / 成就事件 / 兴趣矩阵 / 每日回馈 / 从业分析 / 人生设计），由 LLM 主持对应流程。右侧**可折叠洞察栏**展示最近洞察、画像叙事与转折点，可展开到「洞察」主页面。**「⚙️ 设置」**页选择提供商后自动列出可选模型（下拉选择），多个提供商的 API Key 会被记住，切换提供商无需重新配置。

## LLM Agent（pi-ai 接入，必需）

delphi 通过 [@earendil-works/pi-ai](https://github.com/earendil-works/pi)（Unified LLM API）接入真实大模型。
未配置 API Key 时，CLI 弹出配置帮助并退出，Web 提示去「设置」页配置。

| 环境变量                    | 说明                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `DELPHI_LLM_PROVIDER`     | `deepseek` / `openai` / `anthropic` / `openrouter` / `google`；缺省自动探测已配置 Key 的提供商 |
| `DELPHI_LLM_MODEL`        | 模型 id（缺省用各提供商默认模型，如 deepseek-v4-flash）                                                  |
| `<PROVIDER>_API_KEY`      | 鉴权（如`DEEPSEEK_API_KEY`、`OPENROUTER_API_KEY`）                                                   |

**配置优先级**：环境变量 > 配置文件 `<dataDir>/config.json`（Web「设置」页写入，`delphi doctor` 可查看）。

**LLM 能力**：

- 对话回复由真实模型生成（工具调用循环：`get_cognitive_profile` / `search_memory` 读取你的认知档案）
- 对话回复语言跟随用户输入，由 LLM 自动判断（系统提示词为英文）
- 认知标记、价值观/技能/主题/内驱源/天赋领域等结构化抽取全部由 LLM 完成（无规则匹配）
- 会话结束自动深度分析：摘要 + 自动洞察（⭐）
- 个人画像六维自然语言叙事、从业分析综合评述

## 功能一览（对照文档）

| 文档章节    | 功能                                                              | 命令                                                                          |
| ----------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 三、3.1-3.3 | 三层思维分析模式（隐式/显式/引导式）                              | `delphi chat`，对话内 `/stealth` `/transparent` `/guide` `/analyze` |
| 四、4.1.1   | 回馈分析法（每日满意/不满意）                                     | `delphi daily`                                                              |
| 四、4.1.2   | 自由对话（隐式分析主战场）                                        | `delphi chat`                                                               |
| 四、4.2.1   | V-T-D 价值观-天赋-梦想                                            | `delphi vtd`                                                                |
| 四、4.2.2   | SIGN 天赋信号探测                                                 | `delphi sign`                                                               |
| 四、4.3.1   | SWOT 分析（Agent 增强：优势阴影/劣势再框定/控制圈分离）           | `delphi swot`                                                               |
| 四、4.3.2   | 核心能力模型（选领域→能力自评→交叉验证隐藏优势）                  | `delphi capability`                                                         |
| 四、4.3.3   | 成就事件萃取（STAR）                                              | `delphi achievement`                                                        |
| 四、4.4.1   | 兴趣矩阵（四象限能量评分）                                        | `delphi interest`                                                           |
| 五          | 分享与反馈收集（360°：分享链接 + 共识报告 + 自我/外部差异）       | `delphi feedback`；Web `/settings` 生成链接，`/f/<id>` 公开表单            |
| 六          | 从业分析引擎                                                      | `delphi career`                                                             |
| 七          | 人生设计引擎（Connect The Dots / 重力问题 / 多重人生 / 原型设计） | `delphi life`                                                               |
| 八、7.2     | 认知仪表盘                                                        | `delphi space dashboard`                                                    |
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
│   └── web/                      # Web 端（Next.js 14 App Router + Tailwind）
│       ├── app/                      # /（对话）· /insights（洞察）· /settings（设置）+ API
│       ├── components/               # Sidebar / Chat / MetricBar / Sparkline
│       └── lib/server.ts             # 服务端共享（core 引擎 + 档案 + LLM）
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
- **隐私优先**：数据本地存储，`~/.delphi/` 一个目录，可导出/备份/删除

## 与文档的工程取舍（说明）

| 文档建议                | 本实现                                    | 原因                                                                           |
| ----------------------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| SQLite (better-sqlite3) | JSON 单文件档案（`store.ts`，原子写入） | 零原生依赖、跨平台零编译、可直接导出/备份/恢复；SQLite 可后续无缝替换          |
| Ink (React for CLI)     | readline + chalk（ASCII 艺术）            | Ink 依赖 yoga 原生模块且难以脚本化测试；当前实现全部命令均可管道输入自动化验证 |
| 中文规则词库 / 规则引擎 | 纯 LLM 结构化抽取（`llm/extraction.ts`）   | 与「LLM 驱动一切、不是规则匹配」原则一致：无固定关键词词库，全部由模型从原文抽取      |
| Turborepo               | pnpm workspaces                           | 减少工具链复杂度；构建为`tsc` 项目引用，可随时升级 turbo                     |

## 测试

```bash
pnpm test    # 27 项单元测试（偏差检测/认知标记/模式切换/框架/画像/存储）
```

CLI 全部交互命令支持管道输入，可脚本化冒烟测试：

```bash
printf '今天很累，老板总是加需求\n/quit\n' | DELPHI_DATA_DIR=/tmp/t pnpm run delphi chat
```
