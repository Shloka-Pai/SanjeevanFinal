import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { saveToken, getToken, removeToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on app launch
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await api.get('/auth/me', { timeout: 5000 });
        setUser(res.data.user);
      } catch {
        await removeToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/citizen/login', { email, password });
    const { citizen, token } = res.data;
    await saveToken(token);
    setUser({ ...citizen, role: 'citizen' });
    return res.data;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/citizen/register', { name, email, password });
    const { citizen, token } = res.data;
    await saveToken(token);
    setUser({ ...citizen, role: 'citizen' });
    return res.data;
  };

  const logout = async () => {
    await removeToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
