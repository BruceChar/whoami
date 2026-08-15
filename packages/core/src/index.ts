/**
 * @delphi/core —— delphi 核心引擎
 * 纯 TypeScript，零运行时依赖，CLI 与未来 Web 端共享。
 */
export * from "./models/types";
export * from "./storage/store";

// 分析器
export * from "./analyzer/lexicons";
export * from "./analyzer/biasDetector";
export * from "./analyzer/cognitiveMarker";

// 引擎（三层模式）
export * from "./engine/modeSwitcher";
export * from "./engine/stealth";
export * from "./engine/transparent";
export * from "./engine/thinkingEngine";

// 方法论工具库
export * from "./frameworks/flow";
export * from "./frameworks/keywordExtract";
export * from "./frameworks/dailyFeedback";
export * from "./frameworks/vtd";
export * from "./frameworks/sign";
export * from "./frameworks/swot";
export * from "./frameworks/achievement";
export * from "./frameworks/interestMatrix";

// 成长追踪与画像
export * from "./profiler/growthTracker";
export * from "./profiler/inflectionDetector";
export * from "./persona/fingerprint";
export * from "./persona/energyMap";
export * from "./persona/persona";

// 分析输出
export * from "./outputs/careerAnalysis";
export * from "./outputs/lifeDesign";

// 服务层
export * from "./services/profileService";

// LLM（pi-ai 集成）
export * from "./llm/types";
export * from "./llm/json";
export * from "./llm/dynamicImport";
export * from "./llm/piAiProvider";
export * from "./llm/registry";
export * from "./llm/scriptedProvider";
export * from "./llm/agent";
export * from "./llm/enhancedAnalysis";
