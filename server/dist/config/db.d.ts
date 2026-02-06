import { Pool } from 'pg';
export declare const pool: Pool;
export declare function query<T = any>(sql: string, params?: any[]): Promise<T[]>;
export declare function verifyConnection(): Promise<void>;
//# sourceMappingURL=db.d.ts.map