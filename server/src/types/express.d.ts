declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;   // UUID from JWT payload
        role: string; // activeRole: 'admin' | 'teacher' | 'student'
      };
    }
  }
}

export {};
