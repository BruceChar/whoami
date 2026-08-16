/**
 * delphi —— 本地 JSON 文件存储（隐私优先，所有数据在本地）
 *
 * 存储布局（默认 ~/.delphi/）：
 *   profile.json      用户认知档案（统一数据模型，全部数据）
 *   backups/          历史备份
 *   exports/          导出文件
 */
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  UserCognitiveProfile,
  createEmptyProfile,
} from "../models/types";

export const DEFAULT_DATA_DIR = path.join(os.homedir(), ".delphi");

export interface StoreOptions {
  dataDir?: string;
  userId?: string;
}

/**
 * 数据目录解析优先级：
 * 1. 显式传入 opts.dataDir
 * 2. 环境变量 DELPHI_DATA_DIR（便于测试与多实例隔离）
 * 3. 默认 ~/.delphi
 */
export function resolveDataDir(opts?: StoreOptions): string {
  if (opts?.dataDir) return opts.dataDir;
  const env = process.env.DELPHI_DATA_DIR;
  if (env && env.trim()) return env.trim();
  return DEFAULT_DATA_DIR;
}

export class ProfileStore {
  readonly dataDir: string;
  readonly userId: string;
  private profilePath: string;
  private profile: UserCognitiveProfile;

  constructor(opts: StoreOptions = {}) {
    this.dataDir = resolveDataDir(opts);
    this.userId = opts.userId || "local-user";
    this.profilePath = path.join(this.dataDir, "profile.json");
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(path.join(this.dataDir, "backups"), { recursive: true });
    fs.mkdirSync(path.join(this.dataDir, "exports"), { recursive: true });
    this.profile = this.load();
  }

  /** 读取档案（每次启动从磁盘加载，保证跨进程一致） */
  private load(): UserCognitiveProfile {
    try {
      if (fs.existsSync(this.profilePath)) {
        const raw = fs.readFileSync(this.profilePath, "utf-8");
        const parsed = JSON.parse(raw) as UserCognitiveProfile;
        // 兜底：旧版本档案缺少新字段时合并默认值
        const base = createEmptyProfile(this.userId, this.dataDir);
        return mergeProfile(base, parsed);
      }
    } catch (err) {
      console.warn(`[delphi] 档案读取失败，将新建：${(err as Error).message}`);
    }
    return createEmptyProfile(this.userId, this.dataDir);
  }

  /** 原子写入档案 */
  save(): void {
    this.profile.updatedAt = new Date().toISOString();
    const tmp = this.profilePath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.profile, null, 2), "utf-8");
    fs.renameSync(tmp, this.profilePath);
  }

  /** 获取当前档案（可变引用，修改后调用 save() 持久化） */
  get(): UserCognitiveProfile {
    return this.profile;
  }

  /** 生成当前档案的备份文件 */
  backup(label = "manual"): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dest = path.join(this.dataDir, "backups", `profile-${label}-${stamp}.json`);
    fs.writeFileSync(dest, JSON.stringify(this.profile, null, 2), "utf-8");
    return dest;
  }

  /** 导出档案 JSON 到 exports 目录，返回文件路径 */
  exportJson(): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dest = path.join(this.dataDir, "exports", `profile-${stamp}.json`);
    fs.writeFileSync(dest, JSON.stringify(this.profile, null, 2), "utf-8");
    return dest;
  }

  /** 从 JSON 文件恢复档案 */
  importJson(filePath: string): void {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as UserCognitiveProfile;
    const base = createEmptyProfile(this.userId, this.dataDir);
    this.profile = mergeProfile(base, parsed);
    this.profile.settings.dataDir = this.dataDir;
    this.save();
  }

  /** 清空全部数据（重置档案） */
  reset(): void {
    this.profile = createEmptyProfile(this.userId, this.dataDir);
    this.save();
  }
}

/** 深度合并：以 base 为骨架，用 incoming 覆盖已有字段（用于版本兼容） */
function mergeProfile(base: UserCognitiveProfile, incoming: Partial<UserCognitiveProfile>): UserCognitiveProfile {
  const merged: UserCognitiveProfile = {
    ...base,
    ...incoming,
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
