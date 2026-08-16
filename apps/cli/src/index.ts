#!/usr/bin/env node
/**
  * delphi — entry point.
  * A mirror into the mind. Be water my friend.
 */
import { main } from "./cli";

main(process.argv).catch((err) => {
  console.error("[delphi] 运行出错:", err);
  process.exit(1);
});
