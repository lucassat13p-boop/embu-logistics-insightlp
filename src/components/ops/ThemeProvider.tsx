import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "operations-hub-theme";
const ThemeContext = createContext<{ theme: Theme; dark: boolean; setTheme: (theme: Theme) => void }>({ theme: "light", dark: false, setTheme: () => {} });

// Runs before the page paints; never changes the login's appearance.
export const themeBootstrap = `(function(){try{var p=location.pathname;if(p==='/auth'||p==='/')return;var t=localStorage.getItem('${STORAGE_KEY}');var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [theme, updateTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(false);

  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") updateTheme(stored);
    } catch { /* Theme remains usable when browser storage is unavailable. */ }
    setReady(true);
  }, []);

  useLayoutEffect(() => {
    if (!ready) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const active = pathname !== "/auth" && pathname !== "/" && (theme === "dark" || (theme === "system" && media.matches));
      document.documentElement.classList.toggle("dark", active);
      setDark(active);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme, ready, pathname]);

  function setTheme(value: Theme) {
    updateTheme(value);
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* Retain the selection for this session. */ }
  }

  return <ThemeContext.Provider value={{ theme, dark, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);