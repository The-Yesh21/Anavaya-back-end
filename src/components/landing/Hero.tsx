import { Scale } from "lucide-react";
import { Reveal } from "./Reveal";
import { TechText } from "@/components/ui/TechText";
import { SideRays } from "@/components/ui/SideRays";
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
          <div className="travelling-file"><span>Case file</span><i /><b className="priority-seal">High priority</b></div>
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
      className="snap-section relative isolate items-center overflow-hidden px-4 pt-24 pb-14 sm:px-6 sm:pt-32 sm:pb-24 md:px-10"
    >
      {/* Subtle flat ambient background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[560px] w-[860px] -translate-x-1/2 rounded-full bg-surface/40 blur-3xl"
      />

      {/* Celestial judicial volumetric light beam */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-75 dark:opacity-60"
      >
        <SideRays
          rayColor1="#C5A059"
          rayColor2="#F5E4C3"
          origin="top-right"
          speed={1.8}
          intensity={1.7}
          spread={2.2}
          density={5.5}
          sharpness={0.48}
          glow={1.2}
          falloff={1.5}
          dust={0.3}
          followMouse={true}
          mouseInfluence={0.4}
        />
      </div>

      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
        <div>
          <Reveal delay={0}>
            <span className="inline-flex items-center gap-2.5 rounded-full border border-primary/35 bg-primary/[0.08] px-4 py-1.5 text-xs font-semibold tracking-[0.22em] uppercase text-primary shadow-xs backdrop-blur-md transition-all hover:border-primary/60 hover:bg-primary/[0.12]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <Scale className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              AI-Powered Justice
            </span>
          </Reveal>

          <Reveal delay={120}>
            <h1 className="heading-hero text-foreground">
              Every Case Matters.
              <span className="mt-1 block h-12 w-full max-w-xl sm:h-16 md:h-20 text-foreground dark:text-[#F4E8D1]">
                <TechText
                  text="Anavaya sorts it."
                  fontFamily='"Inter Tight", ui-sans-serif, system-ui, sans-serif'
                  fontWeight={900}
                  fontSize={82}
                  letterSpacing={-0.05}
                  align="left"
                  color="currentColor"
                  accentColor="#C5A059"
                  reveal="letter"
                  dashLength={4}
                  dashGap={2}
                  specks={12}
                  intro="type"
                  introDuration={1.6}
                  clickKick={true}
                  draggable={true}
                  guides={false}
                />
              </span>
            </h1>
          </Reveal>

          <Reveal delay={240}>
            <p className="body-1 prose-justify mt-5 max-w-xl text-muted-foreground">
              Anavaya helps court staff triage filings and review the evidence and decision path behind each priority.
            </p>
          </Reveal>

          <Reveal delay={400}>
            <div className="mt-7 flex flex-wrap gap-4">
              <a
                href={APP_URL}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary sm:w-auto px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-xs transition-all duration-300 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span>Try Anavaya Now</span>
                <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
                  →
                </span>
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
