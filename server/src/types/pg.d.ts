declare module 'pg' {
  export interface QueryResult<T = any> {
    rows: T[];
  }

  export interface PoolConfig {
    host?: string | undefined;
    port?: number | undefined;
    user?: string | undefined;
    password?: string | undefined;
    database?: string | undefined;
    max?: number | undefined;
    ssl?: boolean | { rejectUnauthorized?: boolean } | undefined;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
    end(): Promise<void>;
  }

  export { Pool as default };
}
