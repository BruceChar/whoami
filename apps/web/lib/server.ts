/**
 * delphi Web —— 服务端共享工具
 * 与 CLI 共用同一套 core 引擎与本地档案（DELPHI_DATA_DIR 或 ~/.delphi）。
 */
import {
  ProfileStore,
  getLLMProvider,
  UserCognitiveProfile,
  LLMAgent,
} from "@delphi/core";
import { cache } from "react";

export function getStore(): ProfileStore {
  return new ProfileStore();
}

export const getProfile = cache((): UserCognitiveProfile => {
  return getStore().get();
});

export function getAgent(): (LLMAgent & import("@delphi/core").LLMProvider) | null {
  return getLLMProvider();
}
