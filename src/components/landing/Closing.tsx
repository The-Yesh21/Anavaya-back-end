import { Scale } from "lucide-react";
import { Reveal } from "./Reveal";
import { APP_URL, GITHUB_URL } from "./constants";

export function ClosingCTA() {
  return (
    <section className="px-6 py-16 md:px-10 md:py-24">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-border bg-card px-6 py-12 text-center shadow-xs backdrop-blur-xl sm:px-14 sm:py-16">
        <Reveal delay={120}>
          <h2 className="heading-section text-foreground">
            Try the judicial workbench
          </h2>
        </Reveal>

        <Reveal delay={280}>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <a
              href={APP_URL}
              className="group inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-300 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span>Try Anavaya Now</span>
              <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/40 bg-surface/80 px-7 py-3.5 text-sm font-semibold text-primary backdrop-blur-sm transition-all duration-300 hover:border-primary/70 hover:bg-primary/10 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              View on GitHub →
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="snap-section-auto border-t border-border/80 bg-surface/40 px-6 py-14 backdrop-blur-md md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/[0.08] text-primary shadow-xs">
              <Scale className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="font-display text-base font-semibold tracking-tight text-foreground">Anavaya</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="text-xs text-muted-foreground">© 2026 AI-Powered Case Priority System</span>
          </div>

          <nav className="flex items-center gap-6 text-sm">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground/80 transition-colors hover:text-primary"
            >
              GitHub
            </a>
            <a
              href={`${GITHUB_URL}#readme`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground/80 transition-colors hover:text-primary"
            >
              Documentation
            </a>
            <a
              href={`${GITHUB_URL}/issues`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground/80 transition-colors hover:text-primary"
            >
              Issues
            </a>
          </nav>
        </div>

        {/* Refined legal & constitutional attribution note */}
        <div className="mt-8 border-t border-border/60 pt-6 text-center sm:text-left">
          <p className="text-xs leading-relaxed text-muted-foreground/80">
            Adheres strictly to the doctrine of judicial discretion. The language model performs information extraction only;
            case triage tiers are assigned solely by a deterministic, auditable Decision Tree grounded in Articles 14, 21, and
            Schedule VII of the Constitution of India.
          </p>
        </div>
      </div>
    </footer>
  );
}
