import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

const morning = 6;
const evening = 18;
export const THEME_INIT_SCRIPT = `(function(){var h=new Date().getHours();document.documentElement.classList.toggle('dark',h<${morning}||h>=${evening});})();`;

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    let timer: number;
    let lastPeriod = "";
    function sync() {
      const now = new Date();
      const hour = now.getHours();
      const next = hour < morning || hour >= evening ? "dark" : "light";
      const boundary = new Date(now);
      if (hour >= evening) boundary.setDate(boundary.getDate() + 1);
      boundary.setHours(next === "light" ? evening : morning, 0, 0, 0);
      // Keep a manual choice until the next local morning or evening.
      const period = boundary.toISOString();
      if (period !== lastPeriod) {
        lastPeriod = period;
        document.documentElement.classList.toggle("dark", next === "dark");
        setTheme(next);
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(sync, boundary.getTime() - now.getTime());
    }
    sync();
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={theme === "dark"}
      className={`group relative inline-flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border border-primary/25 bg-surface/80 backdrop-blur-md text-primary shadow-xs transition-all duration-300 hover:scale-105 hover:border-primary/60 hover:bg-primary/10 hover:shadow-[0_0_18px_-3px_color-mix(in_oklab,var(--primary)_35%,transparent)] active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${className}`}
    >
      {theme === "dark" ? (
        <Sun className="h-4.5 w-4.5 transition-transform duration-300 group-hover:rotate-45" strokeWidth={1.8} aria-hidden="true" />
      ) : (
        <Moon className="h-4.5 w-4.5 transition-transform duration-300 group-hover:-rotate-12" strokeWidth={1.8} aria-hidden="true" />
      )}
    </button>
  );
}
