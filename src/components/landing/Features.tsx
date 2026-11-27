import { useState } from "react";
import { Bot, FileText, FolderKanban, Network, Pause, Play, Video } from "lucide-react";
import { Reveal } from "./Reveal";
import { ScrollStack } from "./ScrollStack";

const features = [
  {
    icon: Bot,
    title: "Hybrid AI Pipeline",
    text: "Extract facts from filings and see the rules behind each priority.",
  },
  {
    icon: Network,
    title: "Live D3.js Dashboard",
    text: "Open any decision node to inspect its split and outcomes.",
  },
  {
    icon: FolderKanban,
    title: "Case Management",
    text: "Attach multiple filings and run a single Decision Tree verdict across the combined evidence.",
  },
  {
    icon: Video,
    title: "Live Courtroom",
    text: "Run a mock trial with role-based video, transcription, and session export.",
  },
  {
    icon: FileText,
    title: "Auto-Generated Reports",
    text: "Download the decision path and constitutional analysis as a PDF.",
  },
];

export function Features() {
  return (
    <section className="snap-section px-6 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">Capabilities</p>
              <h2 className="heading-section mt-5 text-foreground">
                Key <span className="text-glass">features</span>
              </h2>
            </div>
          </div>
        </Reveal>

        <ScrollStack items={features} label="Key features" />
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
    <section className="snap-section border-y border-border/80 bg-surface/60 py-14 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 px-6 md:px-10">
        <p className="eyebrow">Engineered with</p>
        {/* A real control, not hover-only: the marquee must be stoppable by keyboard
            and pointer alike (and it halts on focus-within via the same state). */}
        <button
          type="button"
          onClick={() => setPaused((v) => !v)}
          aria-pressed={paused}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-primary/25 bg-surface/80 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-xs transition-all duration-200 hover:border-primary/50 hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
              className="rounded-full border border-primary/25 bg-background/70 px-6 py-2.5 text-sm font-medium whitespace-nowrap text-foreground/85 shadow-2xs backdrop-blur-md transition-colors hover:border-primary/50 hover:text-primary"
            >
              {tech}
            </li>
          ))}
          {/* Duplicate set exists only to make the loop seamless — hidden from AT. */}
          {stack.map((tech) => (
            <li
              key={`dup-${tech}`}
              aria-hidden="true"
              className="rounded-full border border-primary/25 bg-background/70 px-6 py-2.5 text-sm font-medium whitespace-nowrap text-foreground/85 shadow-2xs backdrop-blur-md transition-colors hover:border-primary/50 hover:text-primary"
            >
              {tech}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
