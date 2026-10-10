import { useEffect, useRef } from "react";
import { Scale } from "lucide-react";
import { Reveal } from "./Reveal";
import { APP_URL } from "./constants";

function HeroVisual() {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      node.style.setProperty("--px", `${x * 26}px`);
      node.style.setProperty("--py", `${y * 26}px`);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className="relative mx-auto aspect-square w-full max-w-[520px]"
      style={{ transform: "translate3d(var(--px, 0), var(--py, 0), 0)", transition: "transform 400ms ease-out" }}
    >
      {/* Outer ambient glow */}
      <div className="absolute inset-8 rounded-full bg-primary/10 blur-[80px]" />

      {/* Slow rotating gold ring */}
      <div className="animate-spin-slow absolute inset-0 rounded-full border border-primary/20 shadow-[0_0_30px_-5px_color-mix(in_oklab,var(--primary)_15%,transparent)]" />

      <svg viewBox="0 0 400 400" className="relative h-full w-full">
        <defs>
          <linearGradient id="goldGrad" gradientUnits="userSpaceOnUse" x1="40" y1="40" x2="360" y2="360">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.3" />
          </linearGradient>
          <radialGradient id="scaleCenterGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Central aura */}
        <circle cx="200" cy="210" r="130" fill="url(#scaleCenterGlow)" />

        {/* floating hexagons */}
        <g className="animate-float-slow" style={{ transformOrigin: "80px 90px" }}>
          <polygon
            points="80,55 110,72 110,108 80,125 50,108 50,72"
            fill="var(--surface-strong)"
            stroke="url(#goldGrad)"
            strokeWidth="1.5"
          />
        </g>
        <g className="animate-float-slow" style={{ animationDelay: "1.8s", transformOrigin: "320px 300px" }}>
          <polygon
            points="320,270 346,285 346,315 320,330 294,315 294,285"
            fill="var(--surface-strong)"
            stroke="url(#goldGrad)"
            strokeWidth="1.5"
          />
        </g>

        {/* scales of justice */}
        <g stroke="var(--primary)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeOpacity="0.85">
          <path d="M200 120 L200 290" />
          <path d="M130 150 L270 150" />
          <path d="M150 290 L250 290" />
          <path d="M130 150 L130 176" strokeWidth="1.2" />
          <path d="M270 150 L270 176" strokeWidth="1.2" />
          <circle cx="200" cy="120" r="7" fill="var(--primary)" stroke="none" />
          <path d="M130 176 L108 200 L152 200 Z" fill="var(--primary)" fillOpacity="0.14" />
          <path d="M270 176 L248 200 L292 200 Z" fill="var(--primary)" fillOpacity="0.14" />
        </g>

        {/* document glyphs */}
        <g>
          <rect
            x="288"
            y="78"
            width="48"
            height="62"
            rx="5"
            fill="var(--surface-strong)"
            stroke="url(#goldGrad)"
            strokeWidth="1.4"
          />
          <g stroke="var(--primary)" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round">
            <line x1="298" y1="94" x2="326" y2="94" />
            <line x1="298" y1="106" x2="326" y2="106" />
            <line x1="298" y1="118" x2="314" y2="118" />
          </g>
        </g>
        <g>
          <rect
            x="56"
            y="272"
            width="48"
            height="62"
            rx="5"
            fill="var(--surface-strong)"
            stroke="url(#goldGrad)"
            strokeWidth="1.4"
          />
          <g stroke="var(--primary)" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round">
            <line x1="66" y1="288" x2="94" y2="288" />
            <line x1="66" y1="300" x2="94" y2="300" />
            <line x1="66" y1="312" x2="82" y2="312" />
          </g>
        </g>

        {/* priority indicator dots with subtle halos */}
        <g>
          <circle cx="196" cy="336" r="8" fill="var(--priority-high)" fillOpacity="0.25" />
          <circle cx="196" cy="336" r="4.5" fill="var(--priority-high)" />

          <circle cx="220" cy="336" r="8" fill="var(--priority-medium)" fillOpacity="0.25" />
          <circle cx="220" cy="336" r="4.5" fill="var(--priority-medium)" />

          <circle cx="244" cy="336" r="8" fill="var(--priority-low)" fillOpacity="0.25" />
          <circle cx="244" cy="336" r="4.5" fill="var(--priority-low)" />
        </g>
      </svg>
    </div>
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
              <span className="text-gradient-gold mt-2 block drop-shadow-xs">Anavaya sorts it.</span>
            </h1>
          </Reveal>

          <Reveal delay={240}>
            <p className="mt-7 max-w-xl text-[1.125rem] leading-[1.75] text-muted-foreground">
              An AI-powered case priority and triage system for judicial authorities. Classifies FIRs,
              complaints, and court documents into High, Medium, and Low priority in seconds —{" "}
              <em className="emphasis font-normal not-italic text-primary/95 underline decoration-primary/40 underline-offset-4">
                grounded in the Constitution of India.
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
