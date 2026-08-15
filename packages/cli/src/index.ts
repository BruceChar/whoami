#!/usr/bin/env node
/**
 * delphi —— 入口
 * 一面照向内心的镜子。Be water my friend.
 */
import { main } from "./cli";

main(process.argv).catch((err) => {
  console.error("[delphi] 运行出错:", err);
  process.exit(1);
});
