import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('anavaya-theme');var t=s==='dark'||s==='light'?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export function ThemeToggle({ className = "" }: { className?: string }) {
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
      aria-pressed={theme === "dark"}
      className={`group relative inline-flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border border-primary/25 bg-surface/80 backdrop-blur-md text-primary shadow-xs transition-all duration-300 hover:scale-105 hover:border-primary/60 hover:bg-primary/10 hover:shadow-[0_0_18px_-3px_color-mix(in_oklab,var(--primary)_35%,transparent)] active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${className}`}
    >
      {theme === "dark" ? (
        <Sun className="h-4.5 w-4.5 transition-transform duration-300 group-hover:rotate-45" strokeWidth={1.8} aria-hidden="true" />
      ) : (
        <Moon className="h-4.5 w-4.5 transition-transform duration-300 group-hover:-rotate-12" strokeWidth={1.8} aria-hidden="true" />
      )}
    </button>
  );
}
