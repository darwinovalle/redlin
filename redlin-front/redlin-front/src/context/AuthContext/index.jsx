import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../../services/api';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('auth');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  // Report the browser timezone once per change so reminders/streak/calendar
  // use the user's local day boundaries. Requires auth; failures are ignored.
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      if (localStorage.getItem('redlin_tz') !== tz) {
        authService.setTimezone(tz)
          .then(() => { localStorage.setItem('redlin_tz', tz); })
          .catch(() => {});
      }
    } catch {}
  }, []);

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