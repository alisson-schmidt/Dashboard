import React, { createContext, useContext, useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cm_dashboard_theme");
      if (saved === "light" || saved === "dark") return saved;
    }
    return "dark";
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("cm_dashboard_theme", newTheme);
      document.documentElement.classList.remove("dark", "light");
      document.documentElement.classList.add(newTheme);
      document.documentElement.setAttribute("data-theme", newTheme);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  useEffect(() => {
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-xs text-xs font-mono font-bold transition-all cursor-pointer border ${
        theme === "dark"
          ? "bg-[#1f1f23] text-amber-300 border-amber-500/20 hover:border-amber-500/40 hover:bg-[#25252b]"
          : "bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200"
      } ${className}`}
      title={theme === "dark" ? "Alternar para Modo Claro" : "Alternar para Modo Escuro"}
    >
      <div className="flex items-center gap-2">
        {theme === "dark" ? (
          <Sun className="w-4 h-4 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4 text-indigo-600" />
        )}
        <span>{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>
      </div>
      <span
        className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${
          theme === "dark"
            ? "bg-amber-400/10 text-amber-300 border border-amber-400/20"
            : "bg-indigo-600/10 text-indigo-700 border border-indigo-600/20"
        }`}
      >
        {theme === "dark" ? "Escuro" : "Claro"}
      </span>
    </button>
  );
}
