import { useState } from "react";
import { ArrowDown, Braces, Clock3, FileUp, GitBranch, ScanText, Scale } from "lucide-react";
import { Reveal } from "./Reveal";
import "./priority-roadmap.css";

const stages = [
  {
    icon: FileUp,
    label: "Document intake",
    output: "Evidence on file",
    description: "The dashboard sends filings to FastAPI and attaches the originals to the case.",
    stack: ["FastAPI", "Multipart upload", "Case registry"],
  },
  {
    icon: ScanText,
    label: "Text extraction",
    output: "Readable exhibits",
    description: "Text is read directly from PDFs. OCR handles supported scanned exhibits.",
    stack: ["PyMuPDF", "pypdf", "EasyOCR"],
  },
  {
    icon: Braces,
    label: "Fact extraction",
    output: "Merged case features",
    description:
      "Ollama extracts and summarizes facts. The case pipeline normalizes and merges features across exhibits.",
    stack: ["Ollama", "Qwen 2.5 3B", "Deterministic feature merge"],
  },
  {
    icon: GitBranch,
    label: "Priority decision",
    output: "High, Medium, or Low",
    description:
      "The CART Decision Tree alone assigns priority. Its branch trace records how it reached the result.",
    stack: ["scikit-learn CART", "Categorical features", "TF-IDF"],
  },
  {
    icon: Scale,
    label: "Statutory sections",
    output: "IPC and related provisions",
    description:
      "The report extracts cited IPC sections and flags potentially relevant provisions using rules based on the recorded case facts.",
    stack: ["Python rules", "Citation matching", "Statutory registry"],
  },
  {
    icon: Clock3,
    label: "Turnaround time",
    output: "Hearing and disposal targets",
    description:
      "Priority sets the recommended hearing and disposal windows. Evidence count informs the estimated number of hearings.",
    stack: ["Priority tier rules", "Evidence count", "Delay risk assessment"],
  },
] as const;

const outcomes = [
  {
    label: "High",
    color: "var(--priority-high)",
    note: "Life, liberty, or bodily harm at stake",
    hearing: "24–72 hours",
    disposal: "30–90 days",
  },
  {
    label: "Medium",
    color: "var(--priority-medium)",
    note: "Rights or property harm without immediate danger",
    hearing: "7–14 days",
    disposal: "90–180 days",
  },
  {
    label: "Low",
    color: "var(--priority-low)",
    note: "Routine civil, procedural, or administrative",
    hearing: "30–60 days",
    disposal: "180–365 days",
  },
] as const;

export function PriorityRoadmap() {
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const active = hovered ?? focused ?? selected;
  const stage = stages[active] ?? stages[0];
  const StageIcon = stage.icon;

  return (
    <section aria-labelledby="roadmap-title" className="snap-section px-4 py-16 sm:px-8 md:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal>
          <p className="eyebrow">Case roadmap</p>
          <h2
            id="roadmap-title"
            className="font-display mt-2 text-3xl font-semibold text-foreground sm:text-4xl"
          >
            From filing to the next hearing
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Hover, focus, or tap a stage to see the technology behind it.
          </p>
        </Reveal>

        <Reveal delay={80} className="glass-panel mt-5 rounded-2xl border border-border p-3 sm:p-5">
          <ol
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
            aria-label="Case processing stages"
          >
            {stages.map(({ icon: Icon, label, output }, index) => (
              <li key={label} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={index === selected}
                  aria-controls="roadmap-stage-detail"
                  data-active={index === active}
                  className="roadmap-stage flex h-full w-full flex-col items-start gap-1 rounded-xl border border-border bg-card px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:min-h-28"
                  onPointerEnter={(event) => {
                    if (event.pointerType !== "touch") setHovered(index);
                  }}
                  onPointerLeave={() => setHovered(null)}
                  onFocus={() => setFocused(index)}
                  onBlur={() => setFocused(null)}
                  onClick={() => setSelected(index)}
                >
                  <Icon
                    className="roadmap-stage-icon mb-1 size-4 text-primary"
                    aria-hidden="true"
                  />
                  <span className="text-sm leading-4 font-semibold text-foreground">{label}</span>
                  <span className="text-xs leading-4 text-muted-foreground">{output}</span>
                </button>
              </li>
            ))}
          </ol>

          <div
            id="roadmap-stage-detail"
            className="roadmap-detail relative mt-3 overflow-hidden rounded-xl border border-border bg-secondary px-3 py-3 sm:px-4"
            role="region"
            aria-label="Stage technology"
          >
            <div key={stage.label} className="roadmap-detail-content flex items-start gap-3">
              <StageIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">{stage.label}</h3>
                <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
                  {stage.description}
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Technology">
                  {stage.stack.map((technology, index) => (
                    <li
                      key={technology}
                      style={{ animationDelay: `${index * 45}ms` }}
                      className="roadmap-tech rounded-md border border-border bg-card px-2 py-0.5 font-mono text-xs text-foreground"
                    >
                      {technology}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <ArrowDown className="size-4 text-primary" aria-hidden="true" />
            Turnaround time (TAT) recommendations
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {outcomes.map((outcome) => (
              <article
                key={outcome.label}
                className="rounded-xl border border-border bg-card px-3 py-2.5"
              >
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: outcome.color }}
                    aria-hidden="true"
                  />
                  {outcome.label} priority
                </h3>
                <p className="mt-1 text-xs leading-4 text-muted-foreground">{outcome.note}</p>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">First hearing</dt>
                    <dd className="font-semibold text-foreground">{outcome.hearing}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Target disposal</dt>
                    <dd className="font-semibold text-foreground">{outcome.disposal}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
