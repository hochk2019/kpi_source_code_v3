declare module 'better-sqlite3' {
  type DatabaseOptions = {
    readonly?: boolean;
    fileMustExist?: boolean;
  };

  type Statement = {
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): unknown;
  };

  class Database {
    constructor(path: string, options?: DatabaseOptions);
    prepare(sql: string): Statement;
    transaction<T extends (...args: any[]) => unknown>(fn: T): T;
    exec(sql: string): this;
    close(): void;
  }

  export default Database;
}
