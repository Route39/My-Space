import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { getTenantSlug } from "@/lib/tenant";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem("attendy_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setEmployee(data.employee);
    } catch (e) {
      localStorage.removeItem("attendy_token");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMe();
    const slug = getTenantSlug();
    if (slug) api.get(`/tenant/${slug}`).then((r) => setTenant(r.data)).catch(() => {});
  }, [loadMe]);

  const login = async (email, password) => {
    const slug = getTenantSlug();
    const { data } = await api.post("/auth/login", { email, password, tenant_slug: slug || undefined });
    localStorage.setItem("attendy_token", data.token);
    setUser(data.user);
    const me = await api.get("/auth/me");
    setEmployee(me.data.employee);
    return data.user;
  };

  const setSession = async (token) => {
    localStorage.setItem("attendy_token", token);
    const me = await api.get("/auth/me");
    setUser(me.data.user);
    setEmployee(me.data.employee);
    return me.data.user;
  };

  const logout = () => {
    localStorage.removeItem("attendy_token");
    setUser(null);
    setEmployee(null);
  };

  return (
    <AuthContext.Provider value={{ user, employee, tenant, loading, login, setSession, logout, refresh: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
