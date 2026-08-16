# 商业化部署（Vercel 等第三方托管）

同一套代码、两种部署模式，区别只在**存储后端**与**登录策略**：

| 模式 | 环境变量 | 登录 | 数据存储 | 适合 |
| --- | --- | --- | --- | --- |
| **local**（默认） | `DELPHI_MODE=local` | 无（首次聊天填昵称） | 本地 JSON 文件 `~/.delphi/` | 个人本地 / 自托管 |
| **hosted** | `DELPHI_MODE=hosted` | 用户名 + 密码（多用户） | 数据库（每用户工作区） | Vercel / 商业化 |

## 本地以 hosted 模式运行（无需数据库）

hosted 模式在本地/自托管时**不需要数据库**：用户与工作区仍然落在本地文件（`<dataDir>/users.json` + `<dataDir>/users/<id>/`），与 local 模式唯一的区别是**需要登录**（多用户）。数据库适配器只在部署到 Vercel 这类无持久文件系统的平台时才必需。

```bash
# 开发模式
DELPHI_MODE=hosted pnpm web                 # http://localhost:3088

# 生产模式（先构建）
pnpm web:build
DELPHI_MODE=hosted pnpm --filter @delphi/web start
```

说明：
- 首次访问会跳到 `/login`，注册后即可使用（第一个注册的账号会自动接管旧的单用户 `profile.json` 数据）。
- `DELPHI_AUTH_SECRET` 本地可省略（自动生成并持久化到 `<dataDir>/.auth-secret`）；托管到 Vercel 时必须显式设置。
- 本地的用户/工作区管理可用 CLI：`delphi users list|add|reset-password|...`、`delphi workspace clear|export <username>`。

## 存储后端（DELPHI_STORAGE）

逻辑模型是一组 JSON **文档**（profile / users / config / 每用户档案），物理位置可插拔：

| 后端 | 说明 | 适用 |
| --- | --- | --- |
| `sqlite`（默认） | 单个 `delphi.db`（`node:sqlite`，零原生依赖，事务化）；首次使用自动导入旧的 JSON 文件 | 本地 / 自托管 |
| `file` | 原 JSON 文件（人类可读、可直接备份/导出） | 本地调试、需要可读文件 |
| `postgres` | 数据库 KV（异步适配器，**规划中**） | 托管生产（Vercel 等） |

切换方式：`DELPHI_STORAGE=file|sqlite|postgres`。当前默认 `sqlite`；从旧版本升级时，首次启动会自动把 `profile.json / users.json / config.json` 导入 `delphi.db`，不丢数据。

## 为什么本地文件在 Vercel 上不可行

Vercel 的函数是 **serverless**：文件系统是临时的，`/tmp` 里的写入在函数退出后可能丢失，跨请求不保证持久。因此 hosted 模式必须把当前基于文件的 `profile.json / users.json / config.json` 换成**持久化数据库**。

## 存储抽象（同一套代码的落点）

核心层引入文档存储接口，上层业务代码不变：

```ts
interface DocumentStore {
  load(key: string): Promise<string | null>;   // key → JSON 文本
  save(key: string, value: string): Promise<void>;
}
```

- `LocalFileStore`：当前 fs 实现（local 模式 / CLI）。
- `PostgresStore`：单表 KV（hosted 模式）。

`ProfileStore` 与用户注册表改为通过该接口读写（serverless 上写入必须 `await`，因此 ProfileStore 的 `save()` 需改造为异步，所有调用点同步更新）。

## Postgres 建表（Neon / Supabase 免费档即可）

```sql
create table delphi_kv (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
```

Key 约定（与本地文件一一对应）：

| key | 内容 |
| --- | --- |
| `users` | 用户注册表（用户名/密码哈希/昵称） |
| `users/<userId>/profile` | 每个用户的认知档案 |
| `config` | LLM 配置（provider / model / apiKeys） |

## Vercel 部署步骤

1. 推送仓库，`vercel` 关联（Framework = Next.js，构建命令 `pnpm web:build`）。
2. 创建数据库：**Neon**（Postgres）或 **Supabase**，复制连接串 `postgres://...`。
3. Vercel 项目设置环境变量：
   - `DELPHI_MODE=hosted`
   - `DATABASE_URL=postgres://...`
   - `DELPHI_AUTH_SECRET=<随机长串>` —— **必须显式设置**（serverless 无法像本地那样自动生成并持久化到文件）
   - `DELPHI_LLM_PROVIDER` + `<PROVIDER>_API_KEY`（或由用户在设置页配置，存入数据库）
4. 部署后访问 `https://<project>.vercel.app`，注册/登录 → 数据落库。

## 当前实现状态（诚实说明）

- ✅ 已实现：`DELPHI_MODE` 模式开关；**local 模式免登录**（首次聊天引导填昵称、单用户本地档案、分享链接本地解析）；**hosted 模式**登录 + 每用户工作区隔离 + 分享链接按属主解析。
- ⏳ 待实现：`DocumentStore` + `PostgresStore` 数据库适配器，以及 ProfileStore / 用户注册表的**异步持久化改造**（serverless 上写库必须 await）。
- ⚠️ 在数据库适配器落地之前，**不要用 hosted 模式直接部署到 Vercel**（临时文件系统会丢数据）；当前 hosted 模式适用于自托管（如一台有持久磁盘的服务器或 Docker 卷），local 模式适用于个人本地。

## 成本参考

- Vercel：Hobby 免费 / Pro $20 每月。
- Neon / Supabase：免费档（约 0.5 GB 存储）够个人与早期用户；商业化后再按量升级。
- 备注：LLM 费用按实际 token 由各提供商计费，与部署平台无关。
