declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;    // UUID (was number, but our DB uses UUID primary keys)
        role: string;  // lowercase: 'admin' | 'teacher' | 'student'
      };
    }
  }
}

export {};
