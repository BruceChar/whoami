# delphi 🪞 —— 一面照向内心的镜子

> Be water my friend.

## 这是什么

**delphi 是一个自我认知 Agent**：通过分析你的**表达过程**（而非仅内容），帮助你认识自己、看见自己如何思考、发现思维漏洞、追踪认知成长。

名字取自德尔斐神庙的箴言——**「认识你自己」(γνῶθι σεαυτόν)**。它不是问卷、不是规则匹配、不是贴标签：所有分析、追问、洞察均由真实 LLM（需自备 API Key）基于对话上下文动态生成，只反射、不评判，对话回复语言跟随你的输入自动切换。

## 本地启动

要求：Node.js 23.4+（使用内置 `node:sqlite`）、pnpm 9+。

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

数据保存在 `~/.delphi/`（可用环境变量 `DELPHI_DATA_DIR` 指定目录）。存储后端可切换：

- `DELPHI_STORAGE=sqlite`（默认）：单个 `delphi.db`（事务化，首次使用自动导入旧的 JSON 数据）
- `DELPHI_STORAGE=file`：JSON 文件（`profile.json` / `users.json` / `config.json`，人类可读）
- `DELPHI_STORAGE=postgres`：托管生产用（异步适配器规划中，见 `DEPLOYMENT.md`）

### CLI（本地管理工具）

CLI 不再承担聊天（对话请使用 Web 端），而是**管理 Web 登录的同一批用户与工作区**：

```bash
delphi users list                # 列出所有用户
delphi users add <username>      # 创建用户（--nickname / --password 或交互输入）
delphi users rename <u> <昵称>   # 修改用户昵称
delphi users reset-password <u>  # 重置用户密码
delphi users delete <u>          # 删除用户及其工作区（需确认）
delphi workspace clear <u>       # 清空用户工作区（保留账号）
delphi workspace export <u>      # 导出用户档案 JSON
delphi doctor                    # 检查 LLM 配置状态
```

### Web

```bash
pnpm web        # http://localhost:3088（开发）
pnpm web:build  # 生产构建
```

Web 有两种部署模式（`DELPHI_MODE`，详见 `DEPLOYMENT.md`）：**local 模式**（默认）免登录，首次聊天时引导设置昵称，数据存本地；**hosted 模式**需要登录（用户名系统唯一、不区分大小写、5–64 位字母数字下划线 + 密码 + 昵称，无需真实身份信息；Google / 微信登录预留），数据按账号隔离于 `~/.delphi/users/<userId>/`。

## 使用方法

- **对话**：Web 端直接输入即可。delphi 默认在**隐式模式**下后台观察你的思维模式（归因、确定性、情绪-事实、思维漏洞等），不打断对话；输入 `/` 可调出工具模板。
- **深度探索**：V-T-D（价值观-天赋-梦想）、SIGN 天赋探测、SWOT、成就事件萃取、兴趣矩阵、核心能力模型——均为 LLM 引导的对话式流程，不是固定问卷。
- **反馈收集（360°）**：在 Web 设置页生成分享链接发给亲友，对方在独立公开页面（无任何你的数据）填写反馈；外部视角汇入档案，校准自我认知。
- **洞察**：右侧洞察栏 / 洞察页查看成长时间线、六维画像（认知指纹、能量地图、思维地形等）、转折点与外部反馈共识。
- **隐私**：CLI 数据全部本地保存；分析由你自行配置的 LLM 提供商执行，delphi 自身不运营任何数据服务器。
