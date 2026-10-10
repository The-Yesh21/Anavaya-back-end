import { useEffect, useState } from "react";
import { Menu, Scale, X } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { APP_URL } from "./constants";

/** Kept in document order so tab order and visual order agree. */
const links = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#architecture", label: "Architecture" },
  { href: "#accuracy", label: "Accuracy" },
  { href: "#why", label: "Why it matters" },
  { href: "#features", label: "Features" },
] as const;

/** The Anavaya wordmark — scales of justice, matching the favicon. */
function Wordmark() {
  return (
    <a
      href="#top"
      className="group inline-flex flex-shrink-0 items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/[0.08] text-primary shadow-xs transition-all duration-300 group-hover:border-primary/60 group-hover:bg-primary/[0.15] group-hover:shadow-[0_0_15px_-3px_color-mix(in_oklab,var(--primary)_35%,transparent)] group-hover:scale-105">
        <Scale className="h-4.5 w-4.5" strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="font-display text-lg font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
        Anavaya
      </span>
    </a>
  );
}

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile sheet on Escape so keyboard users are never trapped.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || open
          ? "border-b border-border/80 bg-background/80 backdrop-blur-md shadow-[0_4px_30px_-10px_color-mix(in_oklab,var(--primary)_12%,transparent)]"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between gap-6 px-6 md:px-10">
        <Wordmark />

        <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-primary/[0.08] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {/* Bordered, not filled: the hero owns the single primary CTA above the fold. */}
          <a
            href={APP_URL}
            className="group hidden cursor-pointer items-center justify-center gap-1.5 rounded-full border border-primary/40 bg-primary/[0.06] px-5 py-2 text-sm font-semibold text-primary shadow-xs transition-all duration-300 hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_20px_-3px_color-mix(in_oklab,var(--primary)_45%,transparent)] hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:inline-flex"
          >
            <span>Open dashboard</span>
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-primary/25 bg-surface/80 text-primary shadow-xs transition-all duration-300 hover:border-primary/60 hover:bg-primary/10 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:hidden"
          >
            {open ? (
              <X className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Sections"
          className="border-t border-border/80 bg-background/90 px-6 py-5 shadow-2xl backdrop-blur-2xl lg:hidden"
        >
          <ul className="flex flex-col gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-[0.9375rem] font-medium text-foreground/85 transition-colors hover:bg-primary/[0.08] hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span>{l.label}</span>
                  <span className="text-primary/50 text-xs">↗</span>
                </a>
              </li>
            ))}
            <li className="mt-4 pt-3 border-t border-border/60 sm:hidden">
              <a
                href={APP_URL}
                className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition-all hover:brightness-110 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Open dashboard →
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
