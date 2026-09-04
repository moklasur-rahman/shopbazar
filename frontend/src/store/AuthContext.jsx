import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { STORAGE_KEYS } from "../config";

const AuthContext = createContext(null);

/** localStorage-এ আগের সেশনের কোনো চিহ্ন আছে কি না */
function hasStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.auth);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    // mock মোডে থাকে user, আসল API-তে থাকে refresh টোকেন
    return Boolean(parsed?.user || parsed?.refresh);
  } catch {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // পেজ রিলোডের পর সেশন ফিরিয়ে আনা।
  // আগে সবসময় /auth/me/ ডাকা হতো — লগইন না থাকলেও। তাতে প্রতিবার
  // পাতা খুললে কনসোলে অকারণে ৪০১ এরর আসত। এখন আগে দেখা হয় সংরক্ষিত
  // সেশন আছে কি না, তবেই সার্ভারে যাওয়া হয়।
  useEffect(() => {
    let alive = true;

    if (!hasStoredSession()) {
      setLoading(false);
      return;
    }

    api.auth
      .me()
      .then((u) => alive && setUser(u))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const u = await api.auth.login(credentials);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (payload) => {
    const u = await api.auth.register(payload);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      isAuthenticated: Boolean(user),
      isVendor: user?.role === "vendor",
    }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
