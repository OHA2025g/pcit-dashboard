import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClerkProvider, useAuth } from "@clerk/react";

// Brand Clerk here once: it styles sign-in, sign-up and the user menu.
const appearance = {
  variables: {
    colorPrimary: "#1E3A8A",
    colorForeground: "#0F172A",
    colorBackground: "#F4F6FA",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#0F172A",
    fontFamily: "'IBM Plex Sans', sans-serif",
    borderRadius: "0.25rem",
  },
};

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AuthModeContext = createContext({ localMode: false, getToken: async () => null });
export const useLocalAuth = () => useContext(AuthModeContext);

function ClerkTokenBridge({ children }) {
  const { getToken } = useAuth();
  return (
    <AuthModeContext.Provider value={{ localMode: false, getToken }}>
      {children}
    </AuthModeContext.Provider>
  );
}

// Starts Clerk from the backend's runtime config, so deploy's live keys need no rebuild.
// Must render inside <BrowserRouter> so Clerk navigates without reloading.
// When Clerk keys are missing/placeholder, local_mode unlocks the dashboard for testing.
export default function ClerkAuthProvider({ children }) {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async (attempt = 0) => {
      try {
        const cfg = await (await fetch(`${BACKEND_URL}/api/clerk/config`)).json();
        if (cfg.local_mode || cfg.enabled) return cancelled || setConfig(cfg);
      } catch {}
      if (cancelled) return;
      if (attempt >= 20) return setUnavailable(true);
      setTimeout(() => load(attempt + 1), 1500);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  if (unavailable) return <p style={{ padding: 24 }}>Sign-in is unavailable right now. Refresh the page to try again.</p>;
  if (!config) return null;

  if (config.local_mode) {
    return (
      <AuthModeContext.Provider value={{ localMode: true, getToken: async () => "local-dev" }}>
        {children}
      </AuthModeContext.Provider>
    );
  }

  return (
    <ClerkProvider
      publishableKey={config.publishable_key}
      proxyUrl={config.proxy_url || undefined}
      appearance={appearance}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      afterSignOutUrl="/"
    >
      <ClerkTokenBridge>{children}</ClerkTokenBridge>
    </ClerkProvider>
  );
}
