import { createContext, useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";
import { useLocalAuth } from "@/components/auth/ClerkAuthProvider";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function useApi() {
  const { getToken } = useLocalAuth();
  return useCallback(
    async (method, path, { params, data, headers, responseType } = {}) => {
      const token = await getToken();
      const res = await axios({ method, url: `${API}${path}`, params, data, responseType, headers: { ...headers, Authorization: `Bearer ${token}` } });
      return res.data;
    },
    [getToken]
  );
}

export const errMsg = (e) => e?.response?.data?.detail || e?.message || "Request failed";

const MeContext = createContext(null);
export const useMe = () => useContext(MeContext);

export function MeProvider({ children }) {
  const api = useApi();
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const refresh = useCallback(() => api("get", "/me").then(setMe).catch((e) => setError(errMsg(e))), [api]);
  useEffect(() => { refresh(); }, [refresh]);
  return <MeContext.Provider value={{ me, error, refresh }}>{children}</MeContext.Provider>;
}
