/**
 * delphi —— 原生动态 import 辅助
 * TS 在 module: commonjs 下会把 `import()` 降级为 `require()`，无法加载纯 ESM 包。
 * 通过 Function 构造器保留原生动态 import（pi-ai 为 ESM-only）。
 */
const dynamicImportFn = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<any>;

export function dynamicImport(specifier: string): Promise<any> {
  return dynamicImportFn(specifier);
}
