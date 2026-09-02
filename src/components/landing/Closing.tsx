import { Reveal } from "./Reveal";
import { APP_URL, GITHUB_URL } from "./constants";

export function ClosingCTA() {
  return (
    <section className="snap-section px-6 py-28 md:px-10">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border border-border bg-surface px-8 py-20 text-center sm:px-14">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: "var(--gradient-gold)" }}
        />
        <span
          aria-hidden="true"
          className="absolute -top-24 left-1/2 h-56 w-[520px] -translate-x-1/2 rounded-full bg-primary/15 blur-[110px]"
        />
        <Reveal>
          <h2 className="font-display text-4xl text-foreground sm:text-6xl">Justice shouldn't wait.</h2>
        </Reveal>
        <Reveal delay={140}>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            Anavaya is open-source, runs locally, and keeps your data on your machine. No cloud. No lock-in.
          </p>
        </Reveal>
        <Reveal delay={260}>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <a
              href={APP_URL}
              className="inline-flex items-center justify-center rounded-md bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition-all hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Try Anavaya Now →
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-md border border-primary/40 px-7 py-3.5 text-sm font-semibold text-primary transition-all hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              View on GitHub →
            </a>
          </div>
        </Reveal>
        <Reveal delay={360}>
          <p className="mt-10 text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Built for the Indian Judiciary · Powered by Constitutional AI
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="snap-section-auto flex items-center border-t border-border px-6 py-16 md:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
        <p>© 2026 Anavaya — AI-Powered Case Priority System</p>
        <nav className="flex items-center gap-6">
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            GitHub
          </a>
          <a href={`${GITHUB_URL}#readme`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Documentation
          </a>
          <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
