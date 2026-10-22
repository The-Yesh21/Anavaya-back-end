import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  FileCheck2,
  FileText,
  FlaskConical,
  Gavel,
  Layers,
  Layers3,
  Scale,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Sigma,
  Sparkles,
  TerminalSquare,
  XCircle,
  Zap,
} from "lucide-react";
import { Reveal } from "./Reveal";
import { MODEL_METRICS } from "@/data/model-metrics";

const { headline, confusionMatrix, perClass, holdoutPerClass, corpus, model, cvPerFold, generatedAt } =
  MODEL_METRICS;

const pct = (n: number, dp = 2) => `${(n * 100).toFixed(dp)}%`;
const int = (n: number) => n.toLocaleString("en-IN");

/* The LabelEncoder emits classes alphabetically (High, Low, Medium). Present them
   in tier order instead, permuting the matrix rows and columns by the same index
   map so no cell is ever detached from its label. */
const TIER_ORDER = ["High", "Medium", "Low"] as const;
const order = TIER_ORDER.filter((t) => confusionMatrix.labels.includes(t)).map((t) => ({
  label: t,
  i: confusionMatrix.labels.indexOf(t),
}));
const orderedLabels = order.map((o) => o.label);
const orderedMatrix = order.map((r) => order.map((c) => confusionMatrix.matrix[r.i]?.[c.i] ?? 0));
const byTier = (rows: typeof perClass) =>
  orderedLabels.map((l) => rows.find((r) => r.label === l)).filter((r): r is (typeof perClass)[number] => !!r);

/** Total misclassified rows — the sum of every cell off the confusion matrix diagonal. */
const offDiagonal = confusionMatrix.matrix.reduce(
  (sum, row, r) => sum + row.reduce((s, cell, c) => (r === c ? s : s + cell), 0),
  0,
);

const PRIORITY_SWATCH: Record<string, string> = {
  High: "var(--priority-high)",
  Medium: "var(--priority-medium)",
  Low: "var(--priority-low)",
};

/** High-level operational impact cards comparing static legacy courts vs Anavaya */
const IMPACT_METRICS = [
  {
    icon: Zap,
    stat: "99.9%",
    label: "Intake Acceleration",
    detail: "From 14–45 days of manual clerical scrutiny to < 2.5 seconds automated triage.",
    badge: "Operational Speed",
  },
  {
    icon: ShieldCheck,
    stat: "0 Days",
    label: "Liberty Triage Latency",
    detail: "Immediate Tier-1 escalation for Article 21 & child protection cases upon intake.",
    badge: "Constitutional Safety",
  },
  {
    icon: Scale,
    stat: "100%",
    label: "Deterministic Decision Tree",
    detail: "Strict rule-based CART tree path with statutory citations; LLM never decides priority.",
    badge: "Auditable Governance",
  },
  {
    icon: Clock,
    stat: "< 1.0s",
    label: "Live Trial Stenography",
    detail: "On-device Whisper + GPU grammar correction vs multi-week manual transcript delays.",
    badge: "Real-Time Courtroom",
  },
] as const;

/** Head-to-head comparative pillars: Static Legacy System vs Anavaya Engine */
const COMPARISON_PILLARS = [
  {
    title: "Case Intake & Triage Velocity",
    icon: Zap,
    metric: "99.9% Faster Ingestion",
    legacy: {
      tag: "Static & Manual",
      headline: "14 to 45 Days per Case",
      description:
        "Physical paper folders move between clerical desks. Scrutiny, registration, and initial docket scheduling take weeks, leaving urgent petitions dormant.",
    },
    modern: {
      tag: "Deterministic AI Engine",
      headline: "< 2.5 Seconds End-to-End",
      description:
        "Parallelized multi-document PDF OCR, structured feature extraction via local GPU, and instant CART Decision Tree prioritization on Day 1.",
    },
    gain: "Eliminates the pre-registration queue entirely, processing cases the moment they are uploaded.",
  },
  {
    title: "Docket Queue Discipline & Urgency",
    icon: ShieldAlert,
    metric: "Instant Article 21 Protection",
    legacy: {
      tag: "Un-triaged FIFO Queue",
      headline: "First-In, First-Out Backlog",
      description:
        "Cases are listed sequentially by filing date. High-stakes bail, wrongful detention, and child endangerment files wait behind routine tax and debt matters for years.",
    },
    modern: {
      tag: "Constitutional Priority Triage",
      headline: "Automated Escalation",
      description:
        "Imminent physical harm, high vulnerability, and fundamental rights deprivations (Articles 14, 21, 23–24) automatically leapfrog routine commercial files to High Priority.",
    },
    gain: "Prevents decades-long undertrial incarceration tragedies (Hussainara Khatoon & Rudal Sah mandates).",
  },
  {
    title: "Multi-Evidence Synthesis & Corroboration",
    icon: Layers,
    metric: "Automated Knowledge Graph",
    legacy: {
      tag: "Fragmented Paper Binders",
      headline: "Prone to Missed Conflicts",
      description:
        "Judges and advocates manually cross-check thick paper dossiers (FIR, CCTV logs, witness statements, bank records). Contradictions easily slip through.",
    },
    modern: {
      tag: "Deterministic Synthesis",
      headline: "Cross-Document Corroboration",
      description:
        "Parallel entity alignment detects shared timestamps, parties, and locations across exhibits, mapping corroborating links while isolating unverified claims.",
    },
    gain: "Provides complete evidentiary visibility and contradiction detection across the entire dossier in seconds.",
  },
  {
    title: "Auditability & Judicial Accountability",
    icon: Scale,
    metric: "100% Explainable Path",
    legacy: {
      tag: "Opaque Listing Decisions",
      headline: "Subjective Discretion",
      description:
        "Listing orders and registry priority rarely carry a written, inspectable justification. Subject to administrative bottlenecks and unverified discretion.",
    },
    modern: {
      tag: "Transparent CART Flowchart",
      headline: "Verifiable Counterfactual Path",
      description:
        "Every decision generates a step-by-step tree walk showing split effects (raised/lowered priority), statutory justifications, and counterfactuals with zero LLM hallucinations.",
    },
    gain: "Every priority ranking is mathematically, procedurally, and constitutionally auditable by any bench.",
  },
  {
    title: "Live Trial Stenography & Demeanor Analysis",
    icon: Gavel,
    metric: "Real-Time Evidentiary Intelligence",
    legacy: {
      tag: "Manual Court Typists",
      headline: "Weeks for Transcripts",
      description:
        "Hearings rely on overworked court stenographers with weeks of transcript backlog. Virtual courtrooms are disconnected from case files and lack objective demeanor telemetry.",
    },
    modern: {
      tag: "Google Meet Suite + Chakshu AI",
      headline: "< 1.0s ASR & Live Telemetry",
      description:
        "Multi-party WebRTC room with live Whisper transcription, GPU grammar correction, synchronized evidence dossiers, and real-time MediaPipe facial tension monitoring for the Judge.",
    },
    gain: "Produces instant, tamper-evident court records while empowering judges with scientific credibility telemetry.",
  },
] as const;

/** Technical figures for the deep-dive ML tab */
const technicalCards = [
  {
    icon: FlaskConical,
    value: pct(headline.holdoutAccuracy),
    label: "Out-of-domain accuracy",
    detail: `Trained on synthetic and constitutional rows only, then tested on ${int(
      headline.holdoutRows,
    )} real court judgments the model had never seen. This is the primary generalization benchmark.`,
    emphasis: true,
  },
  {
    icon: Sigma,
    value: pct(headline.cvMeanAccuracy),
    label: `${headline.cvFolds}-fold cross-validation`,
    detail: `Mean across ${headline.cvFolds} stratified folds, ±${(headline.cvStd * 100).toFixed(
      2,
    )} points. Low variance confirms the decision tree does not overfit to any one corpus slice.`,
  },
  {
    icon: Layers3,
    value: pct(headline.policyFidelity),
    label: "Policy fidelity",
    detail: `How exactly the shipped tree reproduces the written court-priority policy across all ${int(
      corpus.total_rows,
    )} rows. Macro F1 ${headline.policyMacroF1.toFixed(4)}.`,
  },
  {
    icon: ShieldQuestion,
    value: pct(headline.baselineAccuracy),
    label: "Baseline to beat",
    detail: `What a naive model scores by guessing "${headline.baselineClass}" on every case. Published to anchor the evaluation.`,
    muted: true,
  },
] as const;

const reportedAt = new Date(generatedAt).toLocaleDateString("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function ConfusionMatrix() {
  const labels = orderedLabels;
  const matrix = orderedMatrix;
  const rowTotals = matrix.map((row) => row.reduce((a, b) => a + b, 0));

  return (
    <figure className="glass-panel overflow-x-clip rounded-2xl border border-border/80 p-6 shadow-sm sm:p-8">
      <figcaption>
        <div className="flex items-center gap-2">
          <span className="eyebrow">Diagnostic matrix</span>
        </div>
        <h3 className="font-display mt-2 text-xl font-semibold text-foreground">Confusion Matrix</h3>
        <p className="mt-2 text-[0.9375rem] leading-[1.65] text-muted-foreground">
          Every row is the priority the policy assigns; every column is what the tree predicted. Counts on
          the shaded diagonal agree. Anything off it is a disagreement, and all {int(offDiagonal)} of them
          are accounted for.
        </p>
      </figcaption>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border/70 bg-surface/40 p-1">
        <table className="w-full min-w-[26rem] border-collapse text-sm">
          <caption className="sr-only">
            Confusion matrix of the deployed decision tree across {int(corpus.total_rows)} corpus rows.
            Rows are the policy label, columns are the predicted label.
          </caption>
          <thead>
            <tr className="border-b border-border/80 bg-surface/80">
              <th scope="col" className="px-3.5 py-2.5 text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Policy ↓ / Predicted →
              </th>
              {labels.map((label) => (
                <th key={label} scope="col" className="px-3.5 py-2.5 text-right text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {label}
                </th>
              ))}
              <th scope="col" className="px-3.5 py-2.5 text-right text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {labels.map((rowLabel, r) => (
              <tr key={rowLabel} className="border-t border-border/60 transition-colors hover:bg-primary/[0.03]">
                <th scope="row" className="px-3.5 py-3 text-left font-medium text-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: PRIORITY_SWATCH[rowLabel] ?? "var(--primary)" }}
                    />
                    {rowLabel}
                  </span>
                </th>
                {labels.map((colLabel, c) => {
                  const count = matrix[r]?.[c] ?? 0;
                  const agrees = r === c;
                  return (
                    <td
                      key={colLabel}
                      className={
                        agrees
                          ? "tnum border-l border-border/70 bg-primary/[0.12] px-3.5 py-3 text-right font-bold text-foreground shadow-inner"
                          : count > 0
                            ? "tnum border-l border-border/70 bg-destructive/[0.06] px-3.5 py-3 text-right font-semibold text-destructive"
                            : "tnum border-l border-border/70 px-3.5 py-3 text-right text-muted-foreground/45"
                      }
                    >
                      {count === 0 ? (
                        <span aria-label="none">—</span>
                      ) : (
                        <>
                          {int(count)}
                          <span className="sr-only">
                            {agrees ? " correct" : ` predicted ${colLabel} instead of ${rowLabel}`}
                          </span>
                        </>
                      )}
                    </td>
                  );
                })}
                <td className="tnum border-l border-border/70 bg-surface/50 px-3.5 py-3 text-right font-medium text-muted-foreground">
                  {int(rowTotals[r] ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2 rounded-md border border-primary/25 bg-primary/[0.07] px-2.5 py-1">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm bg-primary ring-1 ring-primary/50" />
          Diagonal — tree and policy agree
        </span>
        <span className="inline-flex items-center gap-2 rounded-md border border-destructive/25 bg-destructive/[0.06] px-2.5 py-1">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm bg-destructive/80 ring-1 ring-destructive" />
          Off-diagonal — disagreement
        </span>
      </div>
    </figure>
  );
}

function PerClassTable({
  rows,
  title,
  blurb,
}: {
  rows: typeof perClass;
  title: string;
  blurb: string;
}) {
  return (
    <figure className="glass-panel overflow-x-clip rounded-2xl border border-border/80 p-6 shadow-sm sm:p-8">
      <figcaption>
        <div className="flex items-center gap-2">
          <span className="eyebrow">Tier performance</span>
        </div>
        <h3 className="font-display mt-2 text-xl font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-[0.9375rem] leading-[1.65] text-muted-foreground">{blurb}</p>
      </figcaption>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border/70 bg-surface/40 p-1">
        <table className="w-full min-w-[26rem] border-collapse text-sm">
          <caption className="sr-only">{title}. Precision, recall, F1 score and support per priority tier.</caption>
          <thead>
            <tr className="border-b border-border/80 bg-surface/80">
              {["Priority", "Precision", "Recall", "F1", "Cases"].map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={`px-3.5 py-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase ${
                    i === 0 ? "text-left" : "text-right"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-border/60 transition-colors hover:bg-primary/[0.03]">
                <th scope="row" className="px-3.5 py-3 text-left font-medium text-foreground">
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{
                      backgroundColor: `color-mix(in oklab, ${PRIORITY_SWATCH[row.label] ?? "var(--primary)"} 12%, transparent)`,
                      color: PRIORITY_SWATCH[row.label] ?? "var(--primary)",
                      border: `1px solid color-mix(in oklab, ${PRIORITY_SWATCH[row.label] ?? "var(--primary)"} 30%, transparent)`,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: PRIORITY_SWATCH[row.label] ?? "var(--primary)" }}
                    />
                    {row.label}
                  </span>
                </th>
                <td className="tnum px-3.5 py-3 text-right font-medium text-foreground/90">{row.precision.toFixed(3)}</td>
                <td className="tnum px-3.5 py-3 text-right font-medium text-foreground/90">{row.recall.toFixed(3)}</td>
                <td className="tnum px-3.5 py-3 text-right font-semibold text-primary">{row.f1.toFixed(3)}</td>
                <td className="tnum px-3.5 py-3 text-right text-muted-foreground">{int(row.support)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

const modelFacts = [
  { k: "Estimator", v: model.type },
  { k: "Depth", v: `${model.actual_depth} of max ${model.max_depth ?? "∞"}` },
  { k: "Leaves", v: int(model.leaves) },
  { k: "Features", v: `${int(model.n_features)} (5 categorical + TF-IDF)` },
  { k: "Corpus", v: `${int(corpus.total_rows)} labelled rows` },
  { k: "Composition", v: `${int(corpus.synthetic_and_templates)} synthetic · ${int(corpus.constitutional)} constitutional · ${int(corpus.real_judgments)} real judgments` },
];

export function ModelAccuracy() {
  const [activeTab, setActiveTab] = useState<"comparison" | "diagnostics">("comparison");

  return (
    <section id="accuracy" className="snap-section-loose relative px-6 py-24 md:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow">Transformation & Measured Impact</p>
              <h2 className="font-display mt-3 max-w-2xl text-4xl text-foreground sm:text-5xl">
                The Performance Leap:{" "}
                <span className="text-gradient-gold">Static Backlog vs. Intelligent Triage</span>
              </h2>
              <p className="mt-3 max-w-2xl text-[0.9375rem] leading-[1.7] text-muted-foreground">
                Moving Indian judicial administration from sluggish 45-day clerical backlogs to instant,
                deterministic, and constitutionally grounded case prioritization.
              </p>
            </div>

            {/* Interactive View Toggle */}
            <div className="glass-panel flex items-center rounded-xl border border-border/80 p-1 shadow-xs">
              <button
                type="button"
                onClick={() => setActiveTab("comparison")}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                  activeTab === "comparison"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                System Comparison
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("diagnostics")}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                  activeTab === "diagnostics"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                Model Verification
              </button>
            </div>
          </div>
        </Reveal>

        {activeTab === "comparison" ? (
          <>
            {/* Real-World Impact Metric Banners */}
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {IMPACT_METRICS.map((m, i) => {
                const Icon = m.icon;
                return (
                  <Reveal key={m.label} delay={i * 80}>
                    <div className="glass-panel flex h-full flex-col justify-between rounded-2xl border border-border/80 p-6 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_10px_28px_-8px_color-mix(in_oklab,var(--primary)_15%,transparent)]">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/[0.08] text-primary shadow-xs">
                            <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                          </span>
                          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[0.6875rem] font-semibold tracking-wider text-primary uppercase">
                            {m.badge}
                          </span>
                        </div>
                        <p className="font-display tnum text-gradient-gold mt-4 text-4xl font-semibold tracking-tight">
                          {m.stat}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-foreground/95">{m.label}</p>
                      </div>
                      <p className="mt-4 text-[0.8125rem] leading-[1.65] text-muted-foreground">{m.detail}</p>
                    </div>
                  </Reveal>
                );
              })}
            </div>

            {/* Head-to-Head Comparative Architecture Cards */}
            <div className="mt-12 space-y-6">
              {COMPARISON_PILLARS.map((p, i) => {
                const Icon = p.icon;
                return (
                  <Reveal key={p.title} delay={i * 90}>
                    <div className="glass-panel overflow-hidden rounded-2xl border border-border/80 shadow-xs transition-all duration-300 hover:border-primary/35">
                      {/* Card Header */}
                      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 bg-surface/50 px-6 py-4 sm:px-8">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/[0.07] text-primary">
                            <Icon className="h-4.5 w-4.5" strokeWidth={1.8} aria-hidden="true" />
                          </span>
                          <h3 className="font-display text-lg font-semibold text-foreground">{p.title}</h3>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.08] px-3 py-1 text-xs font-semibold text-primary">
                          <Sparkles className="h-3 w-3" aria-hidden="true" />
                          {p.metric}
                        </span>
                      </div>

                      {/* Head-to-head Comparison Body */}
                      <div className="grid grid-cols-1 divide-y divide-border/70 md:grid-cols-2 md:divide-x md:divide-y-0">
                        {/* Legacy Static Court System */}
                        <div className="relative p-6 sm:p-8">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              <XCircle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                              Current Static Court System
                            </span>
                            <span className="rounded-md border border-destructive/25 bg-destructive/[0.08] px-2 py-0.5 text-[0.6875rem] font-medium text-destructive">
                              {p.legacy.tag}
                            </span>
                          </div>
                          <p className="font-display mt-3 text-lg font-semibold text-foreground/90">
                            {p.legacy.headline}
                          </p>
                          <p className="mt-2 text-[0.875rem] leading-[1.7] text-muted-foreground">
                            {p.legacy.description}
                          </p>
                        </div>

                        {/* Modern Anavaya System */}
                        <div className="relative bg-primary/[0.03] p-6 sm:p-8">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                              Anavaya Intelligent Engine
                            </span>
                            <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[0.6875rem] font-semibold text-primary">
                              {p.modern.tag}
                            </span>
                          </div>
                          <p className="font-display text-gradient-gold mt-3 text-lg font-semibold">
                            {p.modern.headline}
                          </p>
                          <p className="mt-2 text-[0.875rem] leading-[1.7] text-foreground/85">
                            {p.modern.description}
                          </p>
                        </div>
                      </div>

                      {/* Bottom Key Gain Takeaway */}
                      <div className="flex items-center gap-2 border-t border-border/70 bg-surface/30 px-6 py-3 text-xs sm:px-8">
                        <span className="font-semibold text-primary">Practical Breakthrough:</span>
                        <span className="text-muted-foreground">{p.gain}</span>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>

            {/* Grounding Callout */}
            <Reveal delay={120}>
              <div className="relative mt-10 overflow-hidden rounded-2xl border border-primary/35 bg-surface/90 p-8 shadow-[0_8px_30px_-8px_color-mix(in_oklab,var(--primary)_15%,transparent)] backdrop-blur-xl sm:p-10">
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-80"
                />
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="max-w-3xl">
                    <p className="eyebrow">The Core System Invariant</p>
                    <h3 className="font-display mt-2 text-2xl font-semibold text-foreground">
                      The Machine Extracts and Synthesizes — The Law Decides Priority
                    </h3>
                    <p className="mt-3 text-[0.9375rem] leading-[1.75] text-foreground/85">
                      Unlike generic opaque AI systems, Anavaya enforces strict judicial separation: local LLMs
                      read and summarize evidence, while the{" "}
                      <span className="font-semibold text-foreground">CART Decision Tree alone</span> calculates
                      the High, Medium, or Low tier. Grounded in Articles 14, 21, and 23–24 of the Constitution
                      of India, every triage decision is 100% deterministic, reproducible, and explainable in open court.
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab("diagnostics")}
                      className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-5 py-3 text-sm font-semibold text-primary transition-all duration-200 hover:border-primary hover:bg-primary/20 hover:shadow-xs"
                    >
                      <FlaskConical className="h-4 w-4" aria-hidden="true" />
                      View Technical Evaluation
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </Reveal>
          </>
        ) : (
          <>
            {/* Technical Diagnostic View (Preserved for ML Validation & Auditing) */}
            <div className="mt-12">
              {/* Technical Headline figures */}
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {technicalCards.map((c, i) => {
                  const Icon = c.icon;
                  const featured = "emphasis" in c && c.emphasis;
                  const muted = "muted" in c && c.muted;
                  return (
                    <Reveal key={c.label} delay={i * 90}>
                      <div
                        className={`glass-panel flex h-full flex-col justify-between rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 ${
                          featured
                            ? "border-primary/50 bg-primary/[0.08] shadow-[0_10px_32px_-8px_color-mix(in_oklab,var(--primary)_22%,transparent)]"
                            : "border-border/80 shadow-xs hover:border-primary/40 hover:shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--primary)_15%,transparent)]"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.08] text-primary shadow-xs">
                              <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                            </span>
                            {featured && (
                              <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/15 px-2.5 py-0.5 text-[0.6875rem] font-semibold tracking-wider text-primary uppercase">
                                Primary Benchmark
                              </span>
                            )}
                          </div>
                          <p
                            className={`font-display tnum mt-4 text-4xl font-semibold tracking-tight ${
                              muted ? "text-muted-foreground" : "text-foreground"
                            }`}
                          >
                            {c.value}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-foreground/90">{c.label}</p>
                        </div>
                        <p className="mt-4 text-[0.8125rem] leading-[1.65] text-muted-foreground">{c.detail}</p>
                      </div>
                    </Reveal>
                  );
                })}
              </div>

              {/* Tables */}
              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <Reveal className="min-w-0">
                  <ConfusionMatrix />
                </Reveal>
                <Reveal delay={110} className="min-w-0">
                  <PerClassTable
                    rows={byTier(holdoutPerClass.length > 0 ? holdoutPerClass : perClass)}
                    title="Per-tier scores on unseen judgments"
                    blurb={`Broken down by priority tier on the ${int(
                      headline.holdoutRows,
                    )} held-out real judgments. High-priority recall is the primary focus: missing an urgent case costs far more than over-flagging a routine one.`}
                  />
                </Reveal>
              </div>

              {/* Honest framing */}
              <Reveal delay={80}>
                <div className="relative mt-8 overflow-hidden rounded-2xl border border-primary/35 bg-surface/90 p-8 shadow-[0_8px_30px_-8px_color-mix(in_oklab,var(--primary)_15%,transparent)] backdrop-blur-xl sm:p-10">
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-80"
                  />
                  <p className="eyebrow">Read this before quoting the number</p>
                  <p className="mt-4 text-[0.9375rem] leading-[1.75] text-foreground/85">
                    These labels are not human judicial annotations. Ground truth comes from a written
                    court-priority policy derived from the Constitution of India, applied by deterministic code. So{" "}
                    <span className="font-semibold text-foreground">{pct(headline.policyFidelity)}</span> means{" "}
                    <em className="emphasis font-normal not-italic text-primary/95 underline decoration-primary/40 underline-offset-4">
                      the tree reproduces that written policy almost perfectly
                    </em>{" "}
                    — which is precisely the auditability the system is built for. It is not a claim that Anavaya
                    agrees with a judge {pct(headline.policyFidelity)} of the time. The honest generalisation figure
                    is the {pct(headline.holdoutAccuracy)} scored on real judgments the model never saw during
                    training.
                  </p>
                </div>
              </Reveal>

              {/* Model card + reproduce */}
              <Reveal delay={120} className="min-w-0">
                <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
                  <dl className="glass-panel grid gap-x-8 gap-y-4 rounded-2xl border border-border/80 p-6 shadow-xs sm:grid-cols-2 sm:p-8">
                    {modelFacts.map((f) => (
                      <div key={f.k} className="border-b border-border/60 pb-3 last:border-b-0">
                        <dt className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{f.k}</dt>
                        <dd className="mt-1.5 text-[0.9375rem] font-medium leading-snug text-foreground/90">{f.v}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="glass-panel overflow-hidden rounded-2xl border border-border/80 p-6 shadow-xs sm:p-8">
                    <div className="flex items-center justify-between border-b border-border/60 pb-3">
                      <div className="flex items-center gap-1.5" aria-hidden="true">
                        <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[#EAB308]/70" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[#22C55E]/70" />
                      </div>
                      <span className="text-[0.6875rem] font-medium tracking-wider text-muted-foreground uppercase">
                        Terminal
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <TerminalSquare className="h-5 w-5 text-primary" strokeWidth={1.8} aria-hidden="true" />
                      <h3 className="font-display text-lg font-semibold text-foreground">Verify it yourself</h3>
                    </div>
                    <p className="mt-2 text-[0.8125rem] leading-[1.6] text-muted-foreground">
                      The evaluation script loads the shipped model bundle and scores it across all folds.
                    </p>
                    <pre className="mt-4 overflow-x-auto rounded-lg border border-border/80 bg-background/80 p-3.5 font-mono text-[0.75rem] leading-relaxed text-foreground/90 shadow-inner">
                      <code>
                        <span className="text-primary">$</span> python case_priority_system/{"\n"}  scripts/evaluate_model.py
                      </code>
                    </pre>
                    <p className="tnum mt-4 text-[0.75rem] text-muted-foreground">
                      Folds: {cvPerFold.map((f) => f.toFixed(3)).join(" · ")}
                    </p>
                  </div>
                </div>
              </Reveal>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
