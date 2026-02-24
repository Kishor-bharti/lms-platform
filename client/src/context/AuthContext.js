import { createContext, useContext, useMemo } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Read once per mount. Values are set at login and stable for the session.
  // On logout the page navigates away, so re-mounting picks up fresh empty state.
  const value = useMemo(() => {
    try {
      const token = window.localStorage.getItem('accessToken');
      const role  = (window.localStorage.getItem('role') ?? '').toLowerCase();
      const user  = JSON.parse(window.localStorage.getItem('user') ?? 'null');
      return { token, role, user, isAuthenticated: !!token };
    } catch {
      return { token: null, role: '', user: null, isAuthenticated: false };
    }
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
