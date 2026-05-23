import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [teacher, setTeacher]   = useState(null);
  const [loading, setLoading]   = useState(true);

  const refreshMe = useCallback(async () => {
    if (!api.hasToken()) { setLoading(false); return; }
    try {
      const data = await api.get('/auth/me');
      if (data) setTeacher(data);
    } catch {
      api.clearToken();
      setTeacher(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshMe(); }, [refreshMe]);

  function login(token, teacherData) {
    api.setToken(token);
    setTeacher(teacherData);
  }

  function logout() {
    api.del('/auth/logout').catch(() => {});
    api.clearToken();
    setTeacher(null);
  }

  const isPro    = teacher?.plan === 'pro' || teacher?.plan === 'school';
  const isSchool = teacher?.plan === 'school';

  return (
    <AuthContext.Provider value={{ teacher, loading, login, logout, refreshMe, isPro, isSchool }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
