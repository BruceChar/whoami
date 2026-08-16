/** delphi — native dynamic import helper. */
const dynamicImportFn = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<any>;

export function dynamicImport(specifier: string): Promise<any> {
  return dynamicImportFn(specifier);
}
