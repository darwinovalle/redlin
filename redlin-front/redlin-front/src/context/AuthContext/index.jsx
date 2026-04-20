import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('auth');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const login = useCallback((userData) => {
    setUser(userData);
    try { localStorage.setItem('auth', JSON.stringify(userData)); } catch {}
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try { localStorage.removeItem('auth'); } catch {}
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);