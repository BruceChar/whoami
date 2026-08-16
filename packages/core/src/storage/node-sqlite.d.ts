/**
 * Minimal type declaration for node:sqlite (DatabaseSync).
 * The installed @types/node does not ship node:sqlite types yet.
 */
declare module "node:sqlite" {
  export interface StatementSync {
    run(...params: Array<string | number | null>): { changes: number; lastInsertRowid: number | bigint };
    get(...params: Array<string | number | null>): unknown;
    all(...params: Array<string | number | null>): unknown[];
  }
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
