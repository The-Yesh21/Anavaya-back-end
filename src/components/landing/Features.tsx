import { useState } from "react";
import { Bot, FileText, FolderKanban, Network, Pause, Play, ScanSearch, Video } from "lucide-react";
import { Reveal } from "./Reveal";

const features = [
  {
    icon: Bot,
    title: "Hybrid AI Pipeline",
    text: "LLM perceives facts; Decision Tree decides priority. Best of both worlds: rich extraction plus deterministic classification.",
  },
  {
    icon: Network,
    title: "Live D3.js Dashboard",
    text: "Interactive decision tree visualization. Click any node to see how the model reasons through features to reach a priority.",
  },
  {
    icon: FolderKanban,
    title: "Case Management",
    text: "Create cases, attach multiple documents, analyze individually or all at once. Aggregate priority = highest document wins.",
  },
  {
    icon: ScanSearch,
    title: "Chakshu — Evidence Fact-Checker",
    text: "Browser-based lie detection with speech transcription, physiological analysis, and hybrid evidence verification using AI.",
  },
  {
    icon: Video,
    title: "Live Courtroom",
    text: "WebRTC-powered mock courtroom with real-time speech transcription (Whisper ASR), multi-role simulation, and session export.",
  },
  {
    icon: FileText,
    title: "Auto-Generated Reports",
    text: "PDF reports with constitutional analysis, decision path flowcharts (Mermaid), and priority justification — ready for judicial review.",
  },
];

export function Features() {
  return (
    <section id="features" className="snap-section px-6 py-24 md:px-10">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">Capabilities</p>
              <h2 className="font-display mt-5 text-4xl text-foreground sm:text-5xl">Key features</h2>
            </div>
            <p className="max-w-sm text-[0.9375rem] leading-[1.65] text-muted-foreground">
              Everything from intake to a judge-ready report, running on hardware the court already owns.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <Reveal key={f.title} delay={i * 200}>
                <div className="glass-panel group h-full rounded-xl p-7 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-gold)]">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <h3 className="font-display mt-6 text-xl text-foreground">{f.title}</h3>
                  <p className="mt-3 text-[0.9375rem] leading-[1.65] text-muted-foreground">{f.text}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const stack = [
  "Python",
  "FastAPI",
  "scikit-learn",
  "PyTorch",
  "Ollama",
  "D3.js",
  "WebRTC",
  "Whisper ASR",
  "EasyOCR",
  "Tailwind CSS",
  "PyMuPDF",
  "MediaPipe",
];

export function TechStack() {
  const [paused, setPaused] = useState(false);

  return (
    <section className="snap-section border-y border-border bg-surface py-12">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 px-6 md:px-10">
        <p className="eyebrow">Built with</p>
        {/* A real control, not hover-only: the marquee must be stoppable by keyboard
            and pointer alike (and it halts on focus-within via the same state). */}
        <button
          type="button"
          onClick={() => setPaused((v) => !v)}
          aria-pressed={paused}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {paused ? (
            <Play className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Pause className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          )}
          {paused ? "Resume scrolling" : "Pause scrolling"}
        </button>
      </div>

      <div
        className="relative mt-8 overflow-hidden"
        onFocusCapture={() => setPaused(true)}
        onMouseEnter={() => setPaused(true)}
      >
        <ul
          className="animate-marquee flex w-max list-none gap-4"
          style={paused ? { animationPlayState: "paused" } : undefined}
        >
          {stack.map((tech) => (
            <li
              key={tech}
              className="rounded-full border border-primary/20 bg-background/60 px-6 py-2.5 text-sm whitespace-nowrap text-foreground/85"
            >
              {tech}
            </li>
          ))}
          {/* Duplicate set exists only to make the loop seamless — hidden from AT. */}
          {stack.map((tech) => (
            <li
              key={`dup-${tech}`}
              aria-hidden="true"
              className="rounded-full border border-primary/20 bg-background/60 px-6 py-2.5 text-sm whitespace-nowrap text-foreground/85"
            >
              {tech}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
