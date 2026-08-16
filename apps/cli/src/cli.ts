/** delphi — 本地管理工具（用户与工作区管理；聊天请使用 Web 端）。 */
import { Command } from "commander";
import {
  ProfileStore,
  loadUsers,
  createLocalUser,
  resetUserPassword,
  renameUser,
  deleteUser,
  clearUserWorkspace,
  exportUserWorkspace,
  publicUser,
  getConfigStatus,
  llmConfigHelp,
  configFilePath,
} from "@delphi/core";
import { askLine, closeRl, EOF_INPUT } from "./ui/ask";
import { c } from "./ui/render";

const pkg = require("../package.json");

export async function main(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name("delphi")
    .description("delphi 本地管理工具：管理 Web 登录用户与工作区（聊天请使用 Web 端）")
    .version(pkg.version);

  // ------------------------------------------------------------------
  // users
  // ------------------------------------------------------------------
  const users = program.command("users").description("用户管理（Web 端登录账号，同一份 users.json）");

  users
    .command("list")
    .description("列出所有用户")
    .action(async () => {
      const list = loadUsers();
      if (list.length === 0) {
        console.log(c.dim("（暂无用户，可在 Web 端注册或使用 `delphi users add` 创建）"));
        closeRl();
        return;
      }
      console.log(c.cyan(`共 ${list.length} 个用户：`));
      for (const u of list) {
        const pub = publicUser(u);
        console.log(
          `  ${u.username.padEnd(20)} ${(u.nickname || "—").padEnd(12)} [${u.provider}] ${u.createdAt.slice(0, 10)} id:${u.userId.slice(0, 8)}`
        );
      }
      closeRl();
    });

  users
    .command("add <username>")
    .option("--nickname <n>", "昵称（显示名）")
    .option("--password <p>", "密码（≥6 位）")
    .description("创建用户")
    .action(async (username: string, opts: { nickname?: string; password?: string }) => {
      const nickname = opts.nickname ?? (await askLine("昵称（显示名）> "));
      const password = opts.password ?? (await askLine("密码（≥6 位）> "));
      if (nickname === EOF_INPUT || password === EOF_INPUT || !nickname.trim() || !password) {
        console.log(c.red("✗ 昵称与密码不能为空"));
        closeRl();
        return;
      }
      const res = createLocalUser({ username, password, nickname });
      if (!res.ok) {
        console.log(c.red(`✗ ${res.error}`));
        closeRl();
        return;
      }
      console.log(c.green(`✓ 已创建用户 ${res.user.username}（昵称 ${res.user.nickname}，id ${res.user.userId}）`));
      closeRl();
    });

  users
    .command("rename <username> <nickname>")
    .description("修改用户昵称")
    .action(async (username: string, nickname: string) => {
      const res = renameUser(username, nickname);
      console.log(res.ok ? c.green(`✓ 昵称已更新：${username} → ${nickname}`) : c.red(`✗ ${res.error}`));
      closeRl();
    });

  users
    .command("reset-password <username>")
    .option("--password <p>", "新密码（≥6 位）")
    .description("重置用户密码")
    .action(async (username: string, opts: { password?: string }) => {
      const password = opts.password ?? (await askLine(`为 ${username} 设置新密码（≥6 位）> `));
      if (password === EOF_INPUT || !password) {
        console.log(c.red("✗ 密码不能为空"));
        closeRl();
        return;
      }
      const res = resetUserPassword(username, password);
      console.log(res.ok ? c.green(`✓ 密码已重置：${username}`) : c.red(`✗ ${res.error}`));
      closeRl();
    });

  users
    .command("delete <username>")
    .description("删除用户及其工作区")
    .action(async (username: string) => {
      const confirm = await askLine(c.red(`⚠ 确认删除用户 ${username}（含其工作区数据）？输入 yes 确认 > `));
      if (confirm !== "yes") {
        console.log(c.dim("已取消"));
        closeRl();
        return;
      }
      const res = deleteUser(username);
      console.log(res.ok ? c.green(`✓ 已删除用户 ${username}`) : c.red(`✗ ${res.error}`));
      closeRl();
    });

  // ------------------------------------------------------------------
  // workspace
  // ------------------------------------------------------------------
  const ws = program.command("workspace").description("用户工作区管理（<dataDir>/users/<id>/）");

  ws.command("clear <username>")
    .description("清空用户工作区（保留账号）")
    .action(async (username: string) => {
      const confirm = await askLine(c.red(`⚠ 确认清空用户 ${username} 的工作区？输入 yes 确认 > `));
      if (confirm !== "yes") {
        console.log(c.dim("已取消"));
        closeRl();
        return;
      }
      const res = clearUserWorkspace(username);
      console.log(res.ok ? c.green(`✓ 已清空 ${username} 的工作区`) : c.red(`✗ ${res.error}`));
      closeRl();
    });

  ws.command("export <username>")
    .description("导出用户档案 JSON")
    .action(async (username: string) => {
      const res = exportUserWorkspace(username);
      console.log(res.ok ? c.green(`✓ 已导出: ${res.path}`) : c.red(`✗ ${res.error}`));
      closeRl();
    });

  // ------------------------------------------------------------------
  // doctor
  // ------------------------------------------------------------------
  program
    .command("doctor")
    .description("检查 LLM 配置状态（API Key / 提供商 / 模型）")
    .action(async () => {
      const store = new ProfileStore();
      const status = getConfigStatus(store.dataDir);
      console.log(c.cyan("\n🔍 delphi 配置检查"));
      console.log(`  数据目录: ${store.dataDir}`);
      if (!status.configured) {
        console.log(c.red("  LLM: 未配置 ✗"));
        console.log("");
        console.log(llmConfigHelp());
      } else {
        console.log(c.green("  LLM: 已配置 ✓"));
        console.log(`  提供商: ${status.provider}`);
        console.log(`  模型: ${status.model || "（默认）"}`);
        console.log(`  API Key: ${status.apiKeyMasked}`);
        console.log(
          `  配置来源: ${status.source === "env" ? "环境变量" : status.source === "file" ? `配置文件 (${configFilePath(store.dataDir)})` : "—"}`
        );
        console.log("");
        console.log(c.dim("Web 端在 http://localhost:3088 登录使用。"));
      }
      closeRl();
    });

  await program.parseAsync(argv);
}
