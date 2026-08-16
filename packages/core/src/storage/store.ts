/** delphi — local profile store (document-based; storage backend is pluggable). */
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  UserCognitiveProfile,
  createEmptyProfile,
} from "../models/types";
import { StorageBackend, resolveStorageBackend } from "./backend";

export const DEFAULT_DATA_DIR = path.join(os.homedir(), ".delphi");

export interface StoreOptions {
  dataDir?: string;
  userId?: string;
  backend?: StorageBackend;
}

/**
 * Data-dir resolution order:
 * 1. explicit opts.dataDir
 * 2. DELPHI_DATA_DIR env (tests / multi-instance isolation)
 * 3. default ~/.delphi
 */
export function resolveDataDir(opts?: StoreOptions): string {
  if (opts?.dataDir) return opts.dataDir;
  const env = process.env.DELPHI_DATA_DIR;
  if (env && env.trim()) return env.trim();
  return DEFAULT_DATA_DIR;
}

/** The profile document key inside the storage backend. */
export const PROFILE_KEY = "profile.json";

export class ProfileStore {
  readonly dataDir: string;
  readonly userId: string;
  private backend: StorageBackend;
  private profile: UserCognitiveProfile;

  constructor(opts: StoreOptions = {}) {
    this.dataDir = resolveDataDir(opts);
    this.userId = opts.userId || "local-user";
    this.backend = opts.backend || resolveStorageBackend(this.dataDir);
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(path.join(this.dataDir, "backups"), { recursive: true });
    fs.mkdirSync(path.join(this.dataDir, "exports"), { recursive: true });
    this.profile = this.load();
  }

  /** Load the profile from the backend on every start (consistent across processes) */
  private load(): UserCognitiveProfile {
    try {
      const raw = this.backend.read(PROFILE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as UserCognitiveProfile;
        // merge defaults for fields missing from older profiles
        const base = createEmptyProfile(this.userId, this.dataDir);
        return mergeProfile(base, parsed);
      }
    } catch (err) {
      console.warn(`[delphi] 档案读取失败，将新建：${(err as Error).message}`);
    }
    return createEmptyProfile(this.userId, this.dataDir);
  }

  /** Persist the profile through the storage backend (atomic per backend). */
  save(): void {
    this.profile.updatedAt = new Date().toISOString();
    this.backend.write(PROFILE_KEY, JSON.stringify(this.profile, null, 2));
  }

  /** Get the profile (mutable; call save() to persist) */
  get(): UserCognitiveProfile {
    return this.profile;
  }

  /** Write a backup of the current profile (as a JSON file under <dataDir>/backups). */
  backup(label = "manual"): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dest = path.join(this.dataDir, "backups", `profile-${label}-${stamp}.json`);
    fs.writeFileSync(dest, JSON.stringify(this.profile, null, 2), "utf-8");
    return dest;
  }

  /** Export the profile JSON to the exports dir; returns the path */
  exportJson(): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dest = path.join(this.dataDir, "exports", `profile-${stamp}.json`);
    fs.writeFileSync(dest, JSON.stringify(this.profile, null, 2), "utf-8");
    return dest;
  }

  /** Restore the profile from a JSON file */
  importJson(filePath: string): void {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as UserCognitiveProfile;
    const base = createEmptyProfile(this.userId, this.dataDir);
    this.profile = mergeProfile(base, parsed);
    this.profile.settings.dataDir = this.dataDir;
    this.save();
  }

  /** Clear all data (reset the profile) */
  reset(): void {
    this.profile = createEmptyProfile(this.userId, this.dataDir);
    this.save();
  }
}

/** Deep merge: keep base as the skeleton, overlay incoming fields (version compat) */
function mergeProfile(base: UserCognitiveProfile, incoming: Partial<UserCognitiveProfile>): UserCognitiveProfile {
  const merged: UserCognitiveProfile = {
    ...base,
    ...incoming,
    userInfo: { ...base.userInfo, ...(incoming.userInfo || {}) },
    settings: { ...base.settings, ...(incoming.settings || {}) },
    cognitiveMarkers: { ...base.cognitiveMarkers, ...(incoming.cognitiveMarkers || {}) },
    frameworkData: {
      ...base.frameworkData,
      ...(incoming.frameworkData || {}),
      vtd: { ...base.frameworkData.vtd, ...(incoming.frameworkData?.vtd || {}) },
      swot: { ...base.frameworkData.swot, ...(incoming.frameworkData?.swot || {}) },
      interestMatrix: { ...base.frameworkData.interestMatrix, ...(incoming.frameworkData?.interestMatrix || {}) },
      feedback: { ...base.frameworkData.feedback, ...(incoming.frameworkData?.feedback || {}) },
      sign: { ...base.frameworkData.sign, ...(incoming.frameworkData?.sign || {}) },
    },
    growthTracking: {
      ...base.growthTracking,
      ...(incoming.growthTracking || {}),
      dimensions: {
        ...base.growthTracking.dimensions,
        ...(incoming.growthTracking?.dimensions || {}),
      },
    },
    analysisOutputs: {
      ...base.analysisOutputs,
      ...(incoming.analysisOutputs || {}),
    },
  };
  if (!merged.userId) merged.userId = base.userId;
  if (!merged.createdAt) merged.createdAt = base.createdAt;
  if (!Array.isArray(merged.sessions)) merged.sessions = [];
  if (!Array.isArray(merged.insights)) merged.insights = [];
  if (!Array.isArray(merged.prototypes)) merged.prototypes = [];
  if (!Array.isArray(merged.personaHistory)) merged.personaHistory = [];
  return merged;
}
