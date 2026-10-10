import { Upload, ScanText, BrainCircuit, SlidersHorizontal, GitBranch, ScrollText, BarChart3, Lock } from "lucide-react";
import { Reveal } from "./Reveal";

const steps = [
  {
    icon: Upload,
    title: "Upload Document",
    text: "Drop a PDF, JPG, PNG, or WebP file — FIR, complaint, or court pleading.",
  },
  {
    icon: ScanText,
    title: "Text Extraction",
    text: "PyMuPDF extracts text from PDFs; EasyOCR reads images (WebP, BMP, TIFF via Pillow).",
  },
  {
    icon: BrainCircuit,
    title: "AI Feature Extraction",
    text: "Local LLM (Ollama qwen2.5:3b) on GPU pulls structured facts: parties, crime type, severity, vulnerability, influence, legal category — with a 2s rule-based fallback.",
  },
  {
    icon: SlidersHorizontal,
    title: "Feature Tuning",
    text: "Normalizes LLM output, maps 8 legal categories into 4 model buckets, applies constitutional keyword classification.",
  },
  {
    icon: GitBranch,
    title: "Decision Tree Classification",
    text: "scikit-learn CART tree (depth 8, balanced weights) on 5 categorical + TF-IDF features assigns High/Medium/Low — deterministic, reproducible, auditable.",
  },
  {
    icon: ScrollText,
    title: "Constitutional Analysis",
    text: "Rule-based engine maps priority to Articles 21, 14, 23–24, 19, 300A and more, with state duty, proportionality, and rights balancing.",
  },
  {
    icon: BarChart3,
    title: "Output",
    text: "Excel dashboard, per-case PDF reports with Mermaid flowcharts, DOT decision graphs, and live D3.js visualization.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="snap-section-loose relative px-6 py-24 md:px-10">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="eyebrow">How it works</p>
          <h2 className="font-display mt-5 max-w-2xl text-4xl text-foreground sm:text-5xl">The Anavaya Flow</h2>
        </Reveal>
      </div>

      {/* Horizontal pipeline (desktop) / vertical stepper (mobile) */}
      <div className="mx-auto mt-14 max-w-full">
        <div className="flex snap-x snap-mandatory flex-col gap-6 overflow-x-auto px-1 pb-6 md:mx-auto md:max-w-6xl md:flex-row md:gap-0">
          {steps.map((step, i) => (
            <Reveal
              key={step.title}
              delay={i * 110}
              className="relative flex-shrink-0 snap-start md:w-[310px]"
            >
              <div className="glass-panel group relative h-full overflow-hidden rounded-2xl border border-border/80 p-7 transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/50 hover:shadow-[0_14px_36px_-10px_color-mix(in_oklab,var(--primary)_28%,transparent)] md:mr-6">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.08] text-primary shadow-[0_0_15px_-3px_color-mix(in_oklab,var(--primary)_20%,transparent)] transition-all duration-300 group-hover:scale-110 group-hover:border-primary/50 group-hover:bg-primary/[0.16]">
                    <step.icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="font-display text-3xl font-semibold tracking-tight text-primary/30 transition-colors duration-300 group-hover:text-primary/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="font-display mt-5 text-xl font-semibold text-foreground transition-colors group-hover:text-primary">
                  {step.title}
                </h3>
                <p className="mt-3 text-[0.9375rem] leading-[1.65] text-muted-foreground">{step.text}</p>
              </div>

              {/* connector */}
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 -right-1 hidden h-px w-6 -translate-y-1/2 border-t border-dashed border-primary/45 md:block"
                />
              )}
            </Reveal>
          ))}
        </div>
      </div>

      {/* Founding invariant */}
      <Reveal delay={120}>
        <div className="relative mx-auto mt-12 max-w-4xl overflow-hidden rounded-2xl border border-primary/35 bg-surface/90 p-8 shadow-[0_10px_36px_-10px_color-mix(in_oklab,var(--primary)_16%,transparent)] backdrop-blur-xl sm:p-10">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-80"
          />
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-xs font-semibold tracking-[0.2em] uppercase text-primary">
              <Lock className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" />
              The founding invariant
            </span>
          </div>
          <p className="font-display mt-5 text-2xl font-semibold leading-snug text-foreground sm:text-3xl">
            The AI reads. <span className="text-gradient-gold">The decision tree decides.</span>
          </p>
          <p className="mt-4 text-[0.9375rem] leading-[1.75] text-foreground/85">
            In plain terms: the language model only reads a document and summarizes what it contains — who is
            involved, what happened, how serious it looks. It never assigns the priority. That call belongs to
            a fixed decision tree with rules you can print out and inspect. The same document therefore always
            produces the same result, and every High, Medium, or Low can be traced back to the exact facts and
            constitutional articles behind it. Any change that lets the model influence the final
            classification breaks this principle.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
