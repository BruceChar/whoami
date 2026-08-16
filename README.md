# delphi 🪞 —— 一面照向内心的镜子

> Be water my friend.

## 这是什么

**delphi 是一个自我认知 Agent**：通过分析你的**表达过程**（而非仅内容），帮助你认识自己、看见自己如何思考、发现思维漏洞、追踪认知成长。

名字取自德尔斐神庙的箴言——**「认识你自己」(γνῶθι σεαυτόν)**。它不是问卷、不是规则匹配、不是贴标签：所有分析、追问、洞察均由真实 LLM（需自备 API Key）基于对话上下文动态生成，只反射、不评判，对话回复语言跟随你的输入自动切换。

## 本地启动

要求：Node.js 20+、pnpm 9+。

```bash
pnpm install
pnpm build        # 构建 core + CLI
pnpm test         # 运行核心引擎单元测试
```

配置 LLM（二选一）：

```bash
# 方式一：环境变量
export DELPHI_LLM_PROVIDER=deepseek        # deepseek | openai | anthropic | openrouter | google
export DEEPSEEK_API_KEY=sk-你的密钥

# 方式二：配置文件 <dataDir>/config.json
# { "provider": "deepseek", "model": "deepseek-v4-flash", "apiKey": "sk-你的密钥" }
```

数据保存在 `~/.delphi/`（可用环境变量 `DELPHI_DATA_DIR` 指定目录）。

### CLI

```bash
pnpm run delphi    # 进入对话（默认隐式模式，直接开聊）
delphi doctor      # 检查 LLM 配置状态
```

启动后**直接以自然语言对话**，不再显示命令菜单；需要工具时通过斜杠指令：

- `/` 查看可用指令快捷列表；`/help` 查看完整帮助
- `/daily` 每日回馈 · `/vtd` 价值观-天赋-梦想 · `/sign` SIGN 天赋探测 · `/swot` SWOT 分析 · `/achievement` 成就事件萃取 · `/interest` 兴趣矩阵 · `/capability` 核心能力模型
- `/career` 从业分析 · `/life` 人生设计 · `/feedback` 360° 反馈收集 · `/persona` 个人画像
- `/space` 用户空间（dashboard / timeline / archive / insights / lab / settings）
- `/export` 导出档案 · `/reset` 清空数据 · `/quit` 结束

### Web

```bash
pnpm web        # http://localhost:3088（开发）
pnpm web:build  # 生产构建
```

Web 需要**登录**：用户名（系统唯一、不区分大小写、5–64 位字母数字下划线）+ 密码 + 昵称（显示名，注册时填写即用），无需任何真实身份信息；Google / 微信登录预留。数据按账号隔离于 `~/.delphi/users/<userId>/`。

## 使用方法

- **对话**：直接输入即可。delphi 默认在**隐式模式**下后台观察你的思维模式（归因、确定性、情绪-事实、思维漏洞等），不打断对话；CLI 输入 `/`、Web 输入 `/` 可调出工具模板。
- **深度探索**：V-T-D（价值观-天赋-梦想）、SIGN 天赋探测、SWOT、成就事件萃取、兴趣矩阵、核心能力模型——均为 LLM 引导的对话式流程，不是固定问卷。
- **反馈收集（360°）**：在 Web 设置页生成分享链接发给亲友，对方在独立公开页面（无任何你的数据）填写反馈；外部视角汇入档案，校准自我认知。
- **洞察**：右侧洞察栏 / 洞察页查看成长时间线、六维画像（认知指纹、能量地图、思维地形等）、转折点与外部反馈共识。
- **隐私**：CLI 数据全部本地保存；分析由你自行配置的 LLM 提供商执行，delphi 自身不运营任何数据服务器。
