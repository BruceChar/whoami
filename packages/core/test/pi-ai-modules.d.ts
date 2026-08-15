/**
 * pi-ai 子路径模块的轻量类型声明（moduleResolution: Node 无法解析 ESM exports 子路径）
 * 仅用于测试；运行时通过动态 import 使用。
 */
declare module "@earendil-works/pi-ai/providers/faux" {
  export function fauxProvider(options?: Record<string, unknown>): any;
  export function fauxAssistantMessage(content: unknown, options?: Record<string, unknown>): any;
  export function fauxText(text: string): any;
  export function fauxToolCall(name: string, args: Record<string, unknown>, options?: Record<string, unknown>): any;
  export function createFauxCore(options?: Record<string, unknown>): any;
}
declare module "@earendil-works/pi-ai/providers/deepseek" {
  export function deepseekProvider(): any;
}
declare module "@earendil-works/pi-ai/providers/openai" {
  export function openaiProvider(): any;
}
declare module "@earendil-works/pi-ai/providers/anthropic" {
  export function anthropicProvider(): any;
}
declare module "@earendil-works/pi-ai/providers/openrouter" {
  export function openrouterProvider(): any;
}
declare module "@earendil-works/pi-ai/providers/google" {
  export function googleProvider(): any;
}
