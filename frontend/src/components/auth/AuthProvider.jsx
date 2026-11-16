import { createContext, useCallback, useContext, useMemo, useState } from "react";
import axios from "axios";

const TOKEN_KEY = "ppd_token";
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const AUTH_API = `${BACKEND_URL}/api/auth`;

const AuthContext = createContext({
  token: null,
  isAuthenticated: false,
  getToken: async () => null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export default function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readStoredToken());

  const persist = useCallback((next) => {
    setToken(next);
    try {
      if (next) localStorage.setItem(TOKEN_KEY, next);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {}
  }, []);

  const getToken = useCallback(async () => token, [token]);

  const login = useCallback(async ({ email, password }) => {
    const { data } = await axios.post(`${AUTH_API}/login`, { email, password });
    persist(data.access_token);
    return data;
  }, [persist]);

  const register = useCallback(async ({ email, password, name }) => {
    const { data } = await axios.post(`${AUTH_API}/register`, { email, password, name });
    persist(data.access_token);
    return data;
  }, [persist]);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await axios.post(`${AUTH_API}/logout`, null, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {}
    persist(null);
  }, [persist, token]);

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      getToken,
      login,
      register,
      logout,
    }),
    [token, getToken, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
