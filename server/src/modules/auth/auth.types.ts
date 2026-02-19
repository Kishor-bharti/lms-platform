// ─── Row returned by the JOIN login query ──────────────────────
export interface UserRow {
  id: string;   // UUID
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  is_active: boolean;
  roles: string[]; // array_agg result, e.g. ['admin']
}

// ─── Valid role tokens ──────────────────────────────────────────
export type LoginAsRole = 'admin' | 'teacher' | 'student';

// ─── Inbound request body ───────────────────────────────────────
export interface LoginRequest {
  email: string;
  password: string;
  loginAs: LoginAsRole;
}

// ─── Outbound response ──────────────────────────────────────────
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
    activeRole: string;
  };
}
