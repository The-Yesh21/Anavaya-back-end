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
      className="inline-flex flex-shrink-0 items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Scale className="h-5 w-5 text-primary" strokeWidth={2} aria-hidden="true" />
      <span className="font-display text-lg font-semibold tracking-tight text-foreground">Anavaya</span>
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
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled || open
          ? "border-b border-border bg-background/85 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between gap-6 px-6 md:px-10">
        <Wordmark />

        <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          {/* Bordered, not filled: the hero owns the single primary CTA above the fold. */}
          <a
            href={APP_URL}
            className="hidden cursor-pointer items-center justify-center rounded-md border border-primary/45 px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:inline-flex"
          >
            Open dashboard
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-border text-primary transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:hidden"
          >
            {open ? (
              <X className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Sections"
          className="border-t border-border bg-background/95 px-6 py-4 backdrop-blur-xl lg:hidden"
        >
          <ul className="flex flex-col">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block cursor-pointer rounded-md px-2 py-3 text-[0.9375rem] text-foreground/85 transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li className="mt-3 sm:hidden">
              <a
                href={APP_URL}
                className="inline-flex w-full cursor-pointer items-center justify-center rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Open dashboard
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
