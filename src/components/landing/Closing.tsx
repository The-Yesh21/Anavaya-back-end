import { Scale } from "lucide-react";
import { Reveal } from "./Reveal";
import { APP_URL, GITHUB_URL } from "./constants";

export function ClosingCTA() {
  return (
    <section className="snap-section px-6 py-28 md:px-10">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-primary/30 bg-surface/90 px-8 py-20 text-center shadow-[0_12px_45px_-12px_color-mix(in_oklab,var(--primary)_20%,transparent)] backdrop-blur-xl sm:px-14">
        {/* Subtle top gold gradient border */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent"
        />
        {/* Ambient radial glow */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 left-1/2 h-64 w-[560px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]"
        />

        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-4 py-1.5 text-xs font-semibold tracking-[0.22em] uppercase text-primary shadow-xs">
            <Scale className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Judicial Integrity
          </span>
        </Reveal>

        <Reveal delay={120}>
          <h2 className="font-display mt-7 text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
            Justice shouldn't wait.
          </h2>
        </Reveal>

        <Reveal delay={200}>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            Anavaya is open-source, runs locally on GPU or CPU, and keeps every case record strictly inside court
            infrastructure. Zero cloud upload. Zero vendor lock-in.
          </p>
        </Reveal>

        <Reveal delay={280}>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <a
              href={APP_URL}
              className="group inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition-all duration-300 hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[0_20px_45px_-12px_color-mix(in_oklab,var(--primary)_60%,transparent)] active:translate-y-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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

        <Reveal delay={360}>
          <p className="mt-12 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
            Built for the Indian Judiciary · Grounded in Constitutional Doctrine
          </p>
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
