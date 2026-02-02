import { Role } from '../modules/auth/auth.types';
export interface JwtPayload {
    userId: number;
    role: Role;
}
export declare function signAccessToken(payload: JwtPayload, expiresIn?: number): string;
export declare function verifyAccessToken(token: string): JwtPayload;
//# sourceMappingURL=jwt.d.ts.map