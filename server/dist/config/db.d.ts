import mysql from 'mysql2/promise';
export declare const pool: mysql.Pool;
export declare function query<T = any>(sql: string, params?: any[]): Promise<T[]>;
//# sourceMappingURL=db.d.ts.map