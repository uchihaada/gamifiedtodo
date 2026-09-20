"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

type ThemeKey =
  | "pink"
  | "purple"
  | "blue"
  | "mint"
  | "peach"
  | "yellow";

type AppearanceKey = "light" | "dark" | "system";

type ThemeContextType = {
  theme: ThemeKey;
  appearance: AppearanceKey;
  setTheme: (theme: ThemeKey) => void;
  setAppearance: (appearance: AppearanceKey) => void;
};

const ThemeContext = createContext<
  ThemeContextType | undefined
>(undefined);

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] =
    useState<ThemeKey>("pink");

  const [appearance, setAppearanceState] =
    useState<AppearanceKey>("light");

  useEffect(() => {
    const storedTheme =
      window.localStorage.getItem("app-theme");

    const storedAppearance =
      window.localStorage.getItem("app-appearance");

    if (
      storedTheme === "pink" ||
      storedTheme === "purple" ||
      storedTheme === "blue" ||
      storedTheme === "mint" ||
      storedTheme === "peach" ||
      storedTheme === "yellow"
    ) {
      setThemeState(storedTheme);
    }

    if (
      storedAppearance === "light" ||
      storedAppearance === "dark" ||
      storedAppearance === "system"
    ) {
      setAppearanceState(storedAppearance);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;

    function applyAppearance() {
      const systemDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;

      const shouldUseDark =
        appearance === "dark" ||
        (appearance === "system" && systemDark);

      root.classList.toggle("dark", shouldUseDark);
    }

    applyAppearance();

    if (appearance !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia(
      "(prefers-color-scheme: dark)"
    );

    mediaQuery.addEventListener(
      "change",
      applyAppearance
    );

    return () => {
      mediaQuery.removeEventListener(
        "change",
        applyAppearance
      );
    };
  }, [appearance]);

  function setTheme(nextTheme: ThemeKey) {
    setThemeState(nextTheme);
    window.localStorage.setItem(
      "app-theme",
      nextTheme
    );
  }

  function setAppearance(
    nextAppearance: AppearanceKey
  ) {
    setAppearanceState(nextAppearance);
    window.localStorage.setItem(
      "app-appearance",
      nextAppearance
    );
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        appearance,
        setTheme,
        setAppearance,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useTheme must be used inside ThemeProvider"
    );
  }

  return context;
}