import { useState } from "react";
import { Compass, RotateCcw, Scale, Sparkles, Move } from "lucide-react";
import { Reveal } from "./Reveal";
import { TechText } from "@/components/ui/TechText";

type WordmarkKey = "ANAVAYA" | "JUSTICE" | "CONSTITUTION 21";
type IntroMode = "assemble" | "type" | "metrics";

const WORDMARKS: { id: WordmarkKey; label: string; tag: string; description: string }[] = [
  {
    id: "ANAVAYA",
    label: "ANAVAYA",
    tag: "Core Engine",
    description: "The AI-powered judicial triage and case priority architecture.",
  },
  {
    id: "JUSTICE",
    label: "JUSTICE",
    tag: "Rule of Law",
    description: "Zero black-box decisions — transparent, auditable, and deterministic.",
  },
  {
    id: "CONSTITUTION 21",
    label: "CONSTITUTION 21",
    tag: "Article 21 Mandate",
    description: "Protection of life, personal liberty, and the right to a speedy trial.",
  },
];

export function TechWordmarkShowcase() {
  const [selectedWord, setSelectedWord] = useState<WordmarkKey>("ANAVAYA");
  const [introMode, setIntroMode] = useState<IntroMode>("assemble");
  const [guides, setGuides] = useState<boolean>(true);
  const [replayKey, setReplayKey] = useState<number>(0);

  const activeMeta = WORDMARKS.find((w) => w.id === selectedWord) ?? WORDMARKS[0]!;

  const handleReplay = () => {
    setReplayKey((k) => k + 1);
  };

  return (
    <section
      id="wordmark-showcase"
      className="snap-section relative isolate overflow-hidden px-6 py-24 md:px-10"
      aria-label="Interactive Legal-Tech Wordmark Showcase"
    >
      {/* Background ambient lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[480px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.03] blur-3xl"
      />

      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.06] px-3.5 py-1 text-xs font-semibold tracking-wider text-primary uppercase">
                <Scale className="h-3.5 w-3.5" aria-hidden="true" />
                Constitutional Precision
              </span>
              <h2 className="heading-section mt-4 text-foreground">
                Vector <span className="text-glass">rigor</span> in every character
              </h2>
            </div>
            <p className="body-2 max-w-md text-muted-foreground">
              Every case on the docket is governed by strict constitutional boundaries. Explore
              the typography of justice — drag glyphs to test spring physics, or hover to reveal vector paths.
            </p>
          </div>
        </Reveal>

        {/* Wordmark Selector & Interactive Controls */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-5">
          {/* Wordmark Tabs */}
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Wordmark selection">
            {WORDMARKS.map((item) => {
              const active = selectedWord === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSelectedWord(item.id);
                    setReplayKey((k) => k + 1);
                  }}
                  className={`group relative inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                    active
                      ? "border border-primary/60 bg-surface text-primary shadow-xs"
                      : "border border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-surface/50 hover:text-foreground"
                  }`}
                >
                  <span className="font-mono uppercase tracking-wider">{item.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[0.65rem] uppercase font-mono ${
                      active
                        ? "bg-primary/15 text-primary"
                        : "bg-surface text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    {item.tag}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Canvas Controls: Mode, Guides & Replay */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Intro animation selector */}
            <div className="inline-flex items-center rounded-lg border border-border/80 bg-surface/70 p-0.5 backdrop-blur-xs">
              {(["assemble", "type", "metrics"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setIntroMode(mode);
                    setReplayKey((k) => k + 1);
                  }}
                  className={`rounded-md px-2.5 py-1 text-[0.7rem] font-medium capitalize transition-colors ${
                    introMode === mode
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Guides toggle */}
            <button
              type="button"
              onClick={() => setGuides((g) => !g)}
              aria-pressed={guides}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                guides
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
              }`}
              title="Toggle typographic baseline and metric guides"
            >
              <Compass className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Guides {guides ? "ON" : "OFF"}</span>
            </button>

            {/* Replay Intro */}
            <button
              type="button"
              onClick={handleReplay}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground active:scale-95"
              title="Replay intro animation"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Replay</span>
            </button>
          </div>
        </div>

        {/* Interactive Canvas Stage */}
        <div className="relative mt-6 overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-surface/50 to-surface/20 p-6 md:p-10 shadow-subtle backdrop-blur-md">
          {/* Subtle Blueprint grid pattern */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:24px_24px]"
          />

          {/* Interaction status hint */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-[#C9A227] animate-pulse" />
              <span className="font-mono text-[0.7rem] uppercase tracking-wide">
                Canvas Active: {activeMeta.description}
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[0.68rem]">
              <span className="inline-flex items-center gap-1">
                <Move className="h-3 w-3 text-primary/70" /> Drag Glyphs
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-[#C9A227]" /> Click Kick
              </span>
              <span>•</span>
              <span>Hover Vector Path</span>
            </div>
          </div>

          {/* TechText Mount */}
          <div className="relative h-48 sm:h-56 md:h-72 w-full touch-pan-y text-foreground dark:text-[#F4E8D1]">
            <TechText
              key={`${selectedWord}-${introMode}-${replayKey}`}
              text={selectedWord}
              fontFamily='"Inter Tight", ui-sans-serif, system-ui, sans-serif'
              fontWeight={700}
              fontSize={selectedWord === "CONSTITUTION 21" ? 105 : 135}
              letterSpacing={-0.03}
              color="currentColor"
              accentColor="#C5A059"
              align="center"
              reach={220}
              softness={0.7}
              dashLength={4}
              dashGap={2}
              strokeWidth={1.5}
              lineStyle="dashed"
              reveal="letter"
              specks={15}
              selection={true}
              labels={true}
              draggable={true}
              bounce={0.4}
              sweep={true}
              speed={1}
              clickKick={true}
              intro={introMode}
              introDuration={1.8}
              guides={guides}
              className="h-full w-full"
            />
          </div>

          {/* Technical Telemetry Footer */}
          <div className="mt-6 flex flex-wrap items-center justify-between border-t border-border/60 pt-4 text-[0.7rem] font-mono text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>BOUNDS: CART-VERIFIED</span>
              <span className="hidden sm:inline">DAMPING: 0.40</span>
              <span className="hidden sm:inline">SPECKS: 15 EA</span>
              <span>STROKE: 1.5PX / DASHED 4:2</span>
            </div>
            <div className="text-right">
              <span className="font-semibold text-primary">LEGAL-TECH PRECISION STACK</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
