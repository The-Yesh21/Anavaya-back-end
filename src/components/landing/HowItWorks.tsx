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
              className="relative flex-shrink-0 snap-start md:w-[300px]"
            >
              <div className="glass-panel group h-full rounded-xl p-6 transition-all hover:border-primary/40 hover:shadow-[var(--shadow-gold)] md:mr-6">
                <div className="flex items-center justify-between">
                  <step.icon className="h-6 w-6 text-primary" strokeWidth={1.5} aria-hidden="true" />
                  <span className="font-display text-3xl text-primary/40 transition-colors group-hover:text-primary/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="font-display mt-5 text-xl text-foreground">{step.title}</h3>
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
        <div className="mx-auto mt-10 max-w-4xl rounded-xl border border-primary/35 bg-primary/[0.06] p-8">
          <p className="eyebrow">
            <Lock className="mr-2 inline h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            The founding invariant
          </p>
          <p className="font-display mt-4 text-2xl leading-snug text-foreground">
            The AI reads. The decision tree decides.
          </p>
          <p className="mt-4 text-[0.9375rem] leading-[1.7] text-foreground/80">
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
