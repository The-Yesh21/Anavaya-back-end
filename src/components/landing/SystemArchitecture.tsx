import {
  ChevronDown,
  Database,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  Mic,
  ScanText,
  Server,
  ShieldCheck,
  Upload,
  Video,
} from "lucide-react";
import { Reveal } from "./Reveal";

function Connector({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center py-1" aria-hidden="true">
      <span className="h-4 w-px bg-primary/25" />
      <span className="my-1 rounded-full border border-primary/20 bg-background/70 px-2.5 py-0.5 font-mono text-[0.65rem] text-primary/90">
        {label}
      </span>
      <span className="h-3 w-px bg-primary/25" />
      <ChevronDown className="-mt-1 h-4 w-4 text-primary/50" strokeWidth={2.2} />
    </div>
  );
}

const clients = [
  { icon: LayoutDashboard, name: "Dashboard", role: "case board" },
  { icon: Upload, name: "Upload", role: "PDF intake" },
  { icon: Video, name: "Courtroom", role: "live trial" },
];

const around = [
  { icon: FolderKanban, title: "Cases", path: "PDF → merge → one verdict" },
  { icon: Mic, title: "Transcripts", path: "speech → Whisper → text" },
  { icon: Video, title: "Trials", path: "room → media → record" },
];

const outcomes = [
  { label: "High", color: "var(--priority-high)" },
  { label: "Medium", color: "var(--priority-medium)" },
  { label: "Low", color: "var(--priority-low)" },
];

const recordChips = ["case_results.xlsx", "cases/*.json", "courtrooms/*.json", "reports/*.pdf"];

export function SystemArchitecture() {
  return (
    <section id="architecture" className="snap-section relative px-6 py-24 md:px-10">
      <div className="mx-auto w-full max-w-4xl">
        <Reveal>
          <p className="eyebrow text-center">System Architecture</p>
          <h2 className="heading-section mx-auto mt-4 max-w-2xl text-center text-foreground">
            One <span className="font-semibold text-primary">engine</span> at the centre, everything else built around it
          </h2>
        </Reveal>

        <Reveal delay={80}>
          <div className="glass-panel mt-12 rounded-3xl border border-border/80 p-5 sm:p-8">
            {/* Clients */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {clients.map((c) => {
                const Icon = c.icon;
                return (
                  <div
                    key={c.name}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-border/70 bg-background/40 px-2 py-3 text-center"
                  >
                    <Icon className="h-4.5 w-4.5 text-primary" strokeWidth={1.8} aria-hidden="true" />
                    <span className="text-[0.8125rem] font-semibold text-foreground">{c.name}</span>
                    <span className="text-[0.7rem] text-muted-foreground">{c.role}</span>
                  </div>
                );
              })}
            </div>

            <Connector label="HTTP · WebSocket" />

            {/* Service */}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl border border-border/70 bg-surface/60 px-4 py-3">
              <Server className="h-4 w-4 text-primary" strokeWidth={1.8} aria-hidden="true" />
              <span className="text-[0.8125rem] font-semibold text-foreground">FastAPI · Uvicorn</span>
              <span className="font-mono text-[0.7rem] text-muted-foreground">REST · WS · static</span>
            </div>

            <Connector label="document text" />

            {/* Reading layer */}
            <div className="rounded-xl border border-border/70 bg-surface/60 px-4 py-3">
              <div className="flex items-center justify-center gap-2">
                <ScanText className="h-4 w-4 text-primary" strokeWidth={1.8} aria-hidden="true" />
                <span className="text-[0.8125rem] font-semibold text-foreground">Reading layer</span>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {["PyMuPDF", "EasyOCR", "Ollama qwen2.5:3b"].map((t) => (
                  <span
                    key={t}
                    className="rounded-md border border-border/70 bg-background/60 px-2 py-0.5 font-mono text-[0.65rem] text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <Connector label="labelled features" />

            {/* Middle engine */}
            <div className="relative rounded-2xl border-2 border-primary/45 bg-card px-4 pt-7 pb-5 text-center shadow-xs sm:px-6">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[0.6rem] font-bold tracking-[0.18em] whitespace-nowrap text-primary-foreground uppercase">
                Middle engine
              </span>

              <GitBranch
                className="mx-auto h-6 w-6 text-primary"
                strokeWidth={1.9}
                aria-hidden="true"
              />
              <h3 className="font-display mt-2 text-xl font-semibold text-foreground sm:text-2xl">
                CART Decision Tree
              </h3>
              <p className="mt-1 font-mono text-[0.65rem] text-muted-foreground">
                deterministic · the only step that assigns priority
              </p>

              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {["severity", "vulnerability", "influence", "TF-IDF"].map((f) => (
                  <span
                    key={f}
                    className="rounded-md border border-primary/25 bg-primary/[0.07] px-2 py-0.5 font-mono text-[0.65rem] text-primary"
                  >
                    {f}
                  </span>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {outcomes.map((o) => (
                  <div
                    key={o.label}
                    className="rounded-lg border py-2 text-center"
                    style={{
                      borderColor: `color-mix(in oklab, ${o.color} 45%, transparent)`,
                      backgroundColor: `color-mix(in oklab, ${o.color} 10%, transparent)`,
                    }}
                  >
                    <span className="text-xs font-bold" style={{ color: o.color }}>
                      {o.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Connector label="verdict + audit trail" />

            {/* Records */}
            <div className="rounded-xl border border-border/70 bg-surface/60 px-4 py-3">
              <div className="flex items-center justify-center gap-2">
                <Database className="h-4 w-4 text-primary" strokeWidth={1.8} aria-hidden="true" />
                <span className="text-[0.8125rem] font-semibold text-foreground">Records</span>
              </div>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {recordChips.map((r) => (
                  <span
                    key={r}
                    className="rounded-md border border-border/70 bg-background/60 px-2 py-1 text-center font-mono text-[0.65rem] text-muted-foreground"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>

            {/* Designed around it */}
            <div className="mt-6 border-t border-border/60 pt-5">
              <p className="text-center font-mono text-[0.65rem] tracking-wider text-muted-foreground uppercase">
                Designed around the engine
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {around.map((a) => {
                  const Icon = a.icon;
                  return (
                    <div
                      key={a.title}
                      className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/40 px-3 py-2"
                    >
                      <Icon className="h-4 w-4 flex-shrink-0 text-primary" strokeWidth={1.8} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-[0.8125rem] font-semibold text-foreground">{a.title}</p>
                        <p className="font-mono text-[0.65rem] text-muted-foreground">{a.path}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={140}>
          <p className="mt-5 flex flex-wrap items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            LLM reads, tree decides — the priority can never be generated.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
