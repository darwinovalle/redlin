import { createContext, useContext, useEffect, useState } from 'react';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('auth');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const login = (userData) => {
    setUser(userData);
    try { localStorage.setItem('auth', JSON.stringify(userData)); } catch {}
  };

  const logout = () => {
    setUser(null);
    try { localStorage.removeItem('auth'); } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);