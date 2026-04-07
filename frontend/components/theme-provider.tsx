// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";

type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "system";

type ThemeContextValue = {
  mounted: boolean;
  theme: ThemeMode;
  themePreference: ThemePreference;
  setTheme: (theme: ThemeMode) => void;
  setThemePreference: (theme: ThemePreference) => void;
  toggleTheme: () => void;
};

const THEME_STORAGE_KEY = "omegax-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(themePreference: ThemePreference, theme: ThemeMode = resolveTheme(themePreference)) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = themePreference;
}

function resolveSystemTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(themePreference: ThemePreference): ThemeMode {
  return themePreference === "system" ? resolveSystemTheme() : themePreference;
}

function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === "dark" || storedTheme === "light" || storedTheme === "system"
    ? storedTheme
    : "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("system");
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    const nextThemePreference = readThemePreference();
    const nextTheme = resolveTheme(nextThemePreference);

    applyTheme(nextThemePreference, nextTheme);
    setThemeState(nextTheme);
    setThemePreferenceState(nextThemePreference);
    setMounted(true);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (readThemePreference() !== "system") return;
      const resolvedTheme = resolveSystemTheme();
      applyTheme("system", resolvedTheme);
      setThemeState(resolvedTheme);
      setThemePreferenceState("system");
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  function setTheme(nextTheme: ThemeMode) {
    setThemePreference(nextTheme);
  }

  function setThemePreference(nextThemePreference: ThemePreference) {
    const nextTheme = resolveTheme(nextThemePreference);
    applyTheme(nextThemePreference, nextTheme);

    if (nextThemePreference === "system") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextThemePreference);
    }

    setThemeState(nextTheme);
    setThemePreferenceState(nextThemePreference);
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <ThemeContext.Provider
      value={{
        mounted,
        theme,
        themePreference,
        setTheme,
        setThemePreference,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
