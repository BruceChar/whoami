/**
 * delphi Web — shared server-side helpers.
 * Uses the same core engine and local profile store as the CLI
 * (DELPHI_DATA_DIR or ~/.delphi).
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
