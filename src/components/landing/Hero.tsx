import { FileText, GitBranch, Scale } from "lucide-react";
import { Reveal } from "./Reveal";
import { HandwrittenText } from "./HandwrittenText";
import { APP_URL } from "./constants";

function HeroVisual() {
  return (
    <figure className="mx-auto w-full max-w-md rounded-xl border border-border bg-card text-card-foreground shadow-xl">
      <figcaption className="flex items-center justify-between gap-3 border-b border-border px-6 py-4 text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-widest">Demo case file</span>
        <span className="font-mono">ANV-2026-0053</span>
      </figcaption>
      <div className="px-6 py-6 sm:px-8">
        <h2 className="font-display text-3xl leading-tight">Customs appeal</h2>
        <p className="mt-2 text-sm text-muted-foreground">A dispute over port storage charges.</p>
        <div className="my-5 space-y-2 border-y border-border py-4">
          {["Customs appeal memorandum", "Bill of entry and port schedule"].map((name) => (
            <div key={name} className="flex items-center gap-3 text-sm">
              <FileText aria-hidden="true" className="size-4 shrink-0 text-primary" />{name}
            </div>
          ))}
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Extracted facts</p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt>Category</dt><dd className="text-right font-medium">Customs / Import–Export</dd>
          <dt>Severity</dt><dd className="text-right font-medium">No injury</dd>
        </dl>
      </div>
      <div className="rounded-b-xl border-t border-border bg-secondary px-6 py-4 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm"><GitBranch aria-hidden="true" className="size-4" />Decision tree result</span>
          <strong className="text-primary">Low priority</strong>
        </div>
        <details className="mt-3 text-sm text-muted-foreground">
          <summary className="w-fit cursor-pointer rounded underline underline-offset-4 focus-visible:outline-2">Inspect the first three decisions</summary>
          <ol className="mt-3 list-decimal space-y-1 pl-5">
            <li>Violent case type? No.</li>
            <li>High power imbalance? No.</li>
            <li>No injury recorded? Yes.</li>
          </ol>
        </details>
      </div>
    </figure>
  );
}

export function Hero() {
  return (
    <section
      id="top"
      className="snap-section relative isolate items-center overflow-hidden px-6 pt-32 pb-24 md:px-10"
    >
      {/* Layered glowing gold ambient backgrounds */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[560px] w-[860px] -translate-x-1/2 rounded-full bg-primary/12 blur-[150px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 -right-20 -z-10 h-[400px] w-[400px] rounded-full bg-accent/8 blur-[120px]"
      />

      <div className="mx-auto grid w-full max-w-6xl items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <Reveal delay={0}>
            <span className="inline-flex items-center gap-2.5 rounded-full border border-primary/35 bg-primary/[0.08] px-4 py-1.5 text-xs font-semibold tracking-[0.22em] uppercase text-primary shadow-[0_0_20px_-3px_color-mix(in_oklab,var(--primary)_30%,transparent)] backdrop-blur-md transition-all hover:border-primary/60 hover:bg-primary/[0.12]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <Scale className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              AI-Powered Justice
            </span>
          </Reveal>

          <Reveal delay={120}>
            <h1 className="font-display mt-8 text-5xl leading-[1.05] font-semibold tracking-tight text-balance text-foreground sm:text-6xl lg:text-7xl">
              Every Case Matters.
              <span className="mt-2.5 block text-gradient-gold drop-shadow-xs">
                <HandwrittenText text="Anavaya sorts it." delay={300} />
              </span>
            </h1>
          </Reveal>

          <Reveal delay={240}>
            <p className="mt-7 max-w-xl text-[1.125rem] leading-[1.75] text-muted-foreground">
              Behind every case file is a{" "}
              <span className="font-serif italic font-medium text-foreground">human life on hold</span>.
              When millions wait in the shadows of judicial delay, Anavaya ensures that urgent cries for{" "}
              <span className="font-serif italic font-medium text-foreground">liberty, protection, and fundamental rights</span>{" "}
              are never buried in paper —{" "}
              <em className="font-serif italic font-normal text-primary underline decoration-primary/40 underline-offset-4">
                triaging cases in seconds with the living conscience of the Constitution of India.
              </em>
            </p>
          </Reveal>

          <Reveal delay={310}>
            <div className="mt-6 flex flex-wrap items-center gap-2.5 text-xs font-medium text-foreground/80">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-surface/80 px-2.5 py-1 backdrop-blur-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Deterministic CART Tree
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-surface/80 px-2.5 py-1 backdrop-blur-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Local GPU Inference
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-surface/80 px-2.5 py-1 backdrop-blur-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Articles 21 &amp; 14 Audited
              </span>
            </div>
          </Reveal>

          <Reveal delay={400}>
            <div className="mt-10 flex flex-wrap gap-4">
              <a
                href={APP_URL}
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition-all duration-300 hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[0_20px_45px_-12px_color-mix(in_oklab,var(--primary)_60%,transparent)] active:translate-y-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span>Try Anavaya Now</span>
                <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
                  →
                </span>
              </a>
              <a
                href="#architecture"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/35 bg-primary/[0.04] px-7 py-3.5 text-sm font-semibold text-primary backdrop-blur-sm transition-all duration-300 hover:border-primary/60 hover:bg-primary/10 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                View Architecture
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <HeroVisual />
        </Reveal>
      </div>
    </section>
  );
}
