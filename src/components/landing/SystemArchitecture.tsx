import { ArrowDown, ArrowRight, FileStack, GitBranch, ScanText, Server, Video } from "lucide-react";
import { Reveal } from "./Reveal";

const stages = [
  {
    icon: Server,
    title: "Case intake",
    description: "The dashboard sends evidence to FastAPI over HTTP.",
  },
  {
    icon: ScanText,
    title: "Evidence extraction",
    description: "PDF parsing, OCR, and Ollama turn exhibits into case features.",
  },
  {
    icon: GitBranch,
    title: "CART Decision Tree",
    description: "Merged case features determine one priority.",
  },
  {
    icon: FileStack,
    title: "Case records",
    description: "The dashboard shows the verdict, decision path, and PDF report.",
  },
] as const;

export function SystemArchitecture() {
  return (
    <section
      id="architecture"
      aria-labelledby="architecture-title"
      className="snap-section px-4 pt-20 pb-5 sm:px-8 md:px-10 md:pb-10"
    >
      <div className="mx-auto w-full max-w-6xl">
        <Reveal className="text-center">
          <p className="eyebrow">System architecture</p>
          <h2
            id="architecture-title"
            className="font-display mt-2 text-3xl font-semibold text-balance text-foreground sm:text-4xl"
          >
            From evidence to verdict
          </h2>
        </Reveal>

        <Reveal delay={80} className="mt-4 sm:mt-6">
          <figure aria-label="Anavaya case and courtroom architecture">
            <ol className="grid gap-3 lg:grid-cols-4 lg:gap-6" aria-label="Case priority pipeline">
              {stages.map(({ icon: Icon, title, description }, index) => {
                const isTree = index === 2;
                const hasNext = index < stages.length - 1;
                return (
                  <li
                    key={title}
                    className={`relative flex items-start gap-3 rounded-xl border px-3 py-2.5 lg:flex-col lg:p-4 ${isTree ? "border-accent bg-accent/10" : "border-border bg-card"}`}
                  >
                    <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                      <p className="text-xs leading-4 text-muted-foreground lg:mt-1">{description}</p>
                      {isTree && (
                        <p className="mt-1 flex flex-wrap gap-x-2 text-xs font-medium">
                          <span className="text-[var(--priority-high)]">High</span>
                          <span className="text-[var(--priority-medium)]">Medium</span>
                          <span className="text-muted-foreground">Low</span>
                        </p>
                      )}
                    </div>
                    {hasNext && (
                      <>
                        <ArrowDown
                          className="absolute -bottom-3.5 left-1/2 z-10 size-3.5 -translate-x-1/2 text-muted-foreground lg:hidden"
                          aria-hidden="true"
                        />
                        <ArrowRight
                          className="absolute top-1/2 -right-5 hidden size-4 -translate-y-1/2 text-muted-foreground lg:block"
                          aria-hidden="true"
                        />
                      </>
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="mt-3 flex items-start gap-3 rounded-xl border border-border bg-secondary px-3 py-2.5 lg:mt-4 lg:items-center lg:px-4">
              <Video className="mt-0.5 size-5 shrink-0 text-primary lg:mt-0" aria-hidden="true" />
              <div className="lg:flex lg:items-baseline lg:gap-3">
                <h3 className="shrink-0 text-sm font-semibold text-foreground">Live courtroom</h3>
                <p className="text-xs leading-4 text-muted-foreground">
                  FastAPI coordinates rooms over WebSocket, WebRTC carries media, and Whisper transcribes speech.
                </p>
              </div>
            </div>

            <figcaption className="mt-3 text-center text-xs text-muted-foreground sm:mt-4">
              The LLM extracts and summarizes. Only the Decision Tree assigns priority.
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
