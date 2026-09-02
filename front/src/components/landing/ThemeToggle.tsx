import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('anavaya-theme');var t=s==='dark'||s==='light'?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("anavaya-theme", next);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="glass-panel fixed top-5 right-5 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full text-primary shadow-[var(--shadow-gold)] transition-all hover:border-primary/50 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {theme === "dark" ? (
        <Sun className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
      )}
    </button>
  );
}
