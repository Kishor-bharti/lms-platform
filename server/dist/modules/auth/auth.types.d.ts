export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';
export type Status = 'ACTIVE' | 'INACTIVE';
export interface User {
    id: number;
    name: string;
    email: string;
    password_hash: string;
    role: Role;
    status: Status;
    created_at: Date;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface LoginResponse {
    token: string;
    user: {
        id: number;
        name: string;
        role: Role;
    };
}
//# sourceMappingURL=auth.types.d.ts.map