import { useEffect, useState } from "react";
import { FileText, ScanText, BrainCircuit, GitBranch, ScrollText } from "lucide-react";
import { Reveal, useInView } from "./Reveal";

const stages = [
  { icon: FileText, label: "Document in" },
  { icon: ScanText, label: "Text extracted" },
  { icon: BrainCircuit, label: "Facts perceived" },
  { icon: GitBranch, label: "Tree decides" },
  { icon: ScrollText, label: "Priority scored" },
];

const outcomes = [
  { label: "High", color: "var(--priority-high)", note: "Life, liberty, or bodily harm at stake" },
  { label: "Medium", color: "var(--priority-medium)", note: "Rights or property harm, no immediate danger" },
  { label: "Low", color: "var(--priority-low)", note: "Routine civil, procedural, or administrative" },
];

/** Animated roadmap: a case travelling the pipeline until a priority score is assigned. */
export function PriorityRoadmap() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setActive(stages.length);
      return;
    }
    let step = 0;
    setActive(0);
    const id = setInterval(() => {
      step = (step + 1) % (stages.length + 2);
      setActive(step);
    }, 1100);
    return () => clearInterval(id);
  }, [inView]);

  const scored = active >= stages.length;

  return (
    <section id="architecture" className="snap-section px-6 py-24 md:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal>
          <p className="eyebrow">Architecture</p>
          <h2 className="font-display mt-5 max-w-2xl text-4xl sm:text-5xl">
            The roadmap a case travels to its <em className="emphasis">priority score</em>
          </h2>
        </Reveal>

        <div ref={ref} className="glass-panel mt-14 rounded-2xl p-6 sm:p-10">
          {/* Track */}
          <div className="relative">
            <span
              aria-hidden="true"
              className="absolute top-6 right-0 left-0 hidden h-px border-t border-dashed border-primary/30 md:block"
            />
            <ol className="relative grid gap-8 md:grid-cols-5 md:gap-4">
              {stages.map((s, i) => {
                const Icon = s.icon;
                const on = i <= active;
                return (
                  <li key={s.label} className="flex items-center gap-4 md:flex-col md:text-center">
                    <span
                      className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border transition-all duration-500"
                      style={{
                        borderColor: on ? "var(--primary)" : "var(--border)",
                        backgroundColor: on
                          ? "color-mix(in oklab, var(--primary) 16%, transparent)"
                          : "transparent",
                        boxShadow: i === active ? "var(--shadow-gold)" : "none",
                        transform: i === active ? "scale(1.08)" : "scale(1)",
                      }}
                    >
                      <Icon
                        className="h-5 w-5 transition-colors duration-500"
                        strokeWidth={1.6}
                        style={{ color: on ? "var(--primary)" : "var(--muted-foreground)" }}
                        aria-hidden="true"
                      />
                    </span>
                    <p
                      className="font-display text-base transition-opacity duration-500 md:mt-3"
                      style={{ opacity: on ? 1 : 0.55 }}
                    >
                      {s.label}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Outcomes */}
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {outcomes.map((o, i) => {
              const lit = scored && i === 0;
              return (
                <div
                  key={o.label}
                  className="rounded-xl border p-5 transition-all duration-700"
                  style={{
                    borderColor: lit ? o.color : "var(--border)",
                    backgroundColor: lit ? `color-mix(in oklab, ${o.color} 12%, transparent)` : "transparent",
                    opacity: scored ? (lit ? 1 : 0.45) : 0.7,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: o.color }}
                      aria-hidden="true"
                    />
                    <p className="font-display text-lg">{o.label} priority</p>
                  </div>
                  <p className="mt-2 text-[0.9375rem] leading-[1.6] text-muted-foreground">{o.note}</p>
                </div>
              );
            })}
          </div>

          <p className="mt-8 text-[0.9375rem] leading-[1.7] text-muted-foreground">
            The same document always walks the same path — so the same score comes out every time, and every
            branch taken can be shown to the bench.
          </p>
        </div>
      </div>
    </section>
  );
}
