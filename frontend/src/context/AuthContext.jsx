import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';

axios.defaults.withCredentials = true;
const API_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/api$/, '') || window.location.origin;

const AuthContext = createContext(null);

function getCached() {
  try { return JSON.parse(localStorage.getItem('userMeta')) } catch { return null }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getCached);
  const [loading, setLoading] = useState(true);
  const freshLoginRef = useRef(false);

  useEffect(() => {
    axios.get(`${API_URL}/auth/me`)
      .then(res => {
        const userData = res.data.user;
        setUser(userData);
        localStorage.setItem('userMeta', JSON.stringify(userData));
      })
      .catch(() => {
        if (!freshLoginRef.current) {
          setUser(null);
          localStorage.removeItem('userMeta');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (role, data) => {
    const res = await axios.post(`${API_URL}/auth/${role}/login`, data);
    const userData = { ...res.data[role], role };
    freshLoginRef.current = true;
    setUser(userData);
    setLoading(false);
    localStorage.setItem('userMeta', JSON.stringify(userData));
    return res.data;
  };

  const register = async (role, data) => {
    const res = await axios.post(`${API_URL}/auth/${role}/register`, data);
    const userData = { ...res.data[role], role };
    freshLoginRef.current = true;
    setUser(userData);
    setLoading(false);
    localStorage.setItem('userMeta', JSON.stringify(userData));
    return res.data;
  };

  const logout = async () => {
    if (!user) return;
    freshLoginRef.current = false;
    try { await axios.post(`${API_URL}/auth/${user.role}/logout`); } catch {}
    setUser(null);
    localStorage.removeItem('userMeta');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, API_URL, API_ORIGIN }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
