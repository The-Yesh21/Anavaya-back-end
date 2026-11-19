import { Scale } from "lucide-react";
import { Reveal } from "./Reveal";
import { HandwrittenText } from "./HandwrittenText";
import { APP_URL } from "./constants";

function HeroVisual() {
  return (
    <figure className="triage-desk">
      <div className="triage-stage" role="img" aria-label="A case folder rises from a waiting stack and moves into the High tray of a three-tier priority rack.">
        <div className="triage-plane">
          <div className="waiting-pile"><span>Incoming cases</span></div>
          <div className="filing-rack">
            {["Low", "Medium", "High"].map((priority, index) => (
              <div className="filing-tray" key={priority} style={{transform: `translateZ(${index * 45}px)`}}>
                <span>{priority}</span>
              </div>
            ))}
          </div>
          <div className="travelling-file"><span>Case file</span><i /><i /></div>
        </div>
      </div>
      <figcaption className="mx-auto max-w-xs text-center text-sm leading-relaxed text-muted-foreground">
        From the waiting stack to a priority queue. The decision tree assigns each case a place.
      </figcaption>
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
