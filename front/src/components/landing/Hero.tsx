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
      {/* glow */}
      <div className="animate-pulse-glow absolute inset-[12%] rounded-full bg-primary/20 blur-[90px]" />

      {/* rotating rings */}
      <div className="animate-spin-slow absolute inset-0 rounded-full border border-primary/20" />
      <div className="animate-spin-slower absolute inset-[10%] rounded-full border border-dashed border-primary/15" />

      <svg viewBox="0 0 400 400" className="relative h-full w-full">
        <defs>
          <linearGradient id="goldGrad" gradientUnits="userSpaceOnUse" x1="40" y1="40" x2="360" y2="360">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* hexagons */}
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
        <g stroke="var(--primary)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeOpacity="0.8">
          <path d="M200 120 L200 290" />
          <path d="M130 150 L270 150" />
          <path d="M150 290 L250 290" />
          <path d="M130 150 L130 176" strokeWidth="1.2" />
          <path d="M270 150 L270 176" strokeWidth="1.2" />
          <circle cx="200" cy="120" r="7" fill="var(--primary)" stroke="none" />
          <path d="M130 176 L108 200 L152 200 Z" fill="var(--primary)" fillOpacity="0.12" />
          <path d="M270 176 L248 200 L292 200 Z" fill="var(--primary)" fillOpacity="0.12" />
        </g>


        {/* document glyphs */}
        <g className="animate-float-slow" style={{ animationDelay: "3s", transformOrigin: "312px 110px" }}>
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
          <g stroke="var(--primary)" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round">
            <line x1="298" y1="94" x2="326" y2="94" />
            <line x1="298" y1="106" x2="326" y2="106" />
            <line x1="298" y1="118" x2="314" y2="118" />
          </g>
        </g>
        <g className="animate-float-slow" style={{ animationDelay: "4.4s", transformOrigin: "80px 300px" }}>
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
          <g stroke="var(--primary)" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round">
            <line x1="66" y1="288" x2="94" y2="288" />
            <line x1="66" y1="300" x2="94" y2="300" />
            <line x1="66" y1="312" x2="82" y2="312" />
          </g>
        </g>

        {/* priority dots */}
        <circle cx="200" cy="336" r="5" fill="var(--priority-high)" />
        <circle cx="222" cy="336" r="5" fill="var(--priority-medium)" />
        <circle cx="244" cy="336" r="5" fill="var(--priority-low)" />
      </svg>
    </div>
  );
}

export function Hero() {
  return (
    <section className="snap-section relative isolate items-center overflow-hidden px-6 py-24 md:px-10">
      <div
        aria-hidden="true"
        className="absolute -top-40 left-1/2 -z-10 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]"
      />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <Reveal delay={0}>
            <span className="eyebrow inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5">
              <Scale className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              AI-Powered Justice
            </span>
          </Reveal>

          <Reveal delay={120}>
            <h1 className="font-display mt-8 text-5xl leading-[1.05] font-semibold text-balance text-foreground sm:text-6xl lg:text-7xl">
              Every Case Matters.
              <span className="text-gradient-gold mt-2 block">Anavaya sorts it.</span>
            </h1>
          </Reveal>

          <Reveal delay={240}>
            <p className="mt-7 max-w-xl text-[1.125rem] leading-[1.7] text-muted-foreground">
              An AI-powered case priority and triage system for judicial authorities. Classifies FIRs,
              complaints, and court documents into High, Medium, and Low priority in seconds —{" "}
              <em className="emphasis">grounded in the Constitution of India.</em>
            </p>
          </Reveal>

          <Reveal delay={330}>
            <p className="mt-4 text-sm tracking-wide text-primary/80">
              Built for judges, registrars, and court staff.
            </p>
          </Reveal>

          <Reveal delay={420}>
            <div className="mt-10 flex flex-wrap gap-4">
              <a
                href={APP_URL}
                className="inline-flex items-center justify-center rounded-md bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition-all hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Try Anavaya Now →
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-md border border-primary/40 px-7 py-3.5 text-sm font-semibold text-primary transition-all hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
