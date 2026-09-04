import { FlaskConical, Layers3, ShieldQuestion, Sigma, TerminalSquare } from "lucide-react";
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

/** The four figures that belong in a headline, ordered most-honest-first. */
const cards = [
  {
    icon: FlaskConical,
    value: pct(headline.holdoutAccuracy),
    label: "Out-of-domain accuracy",
    detail: `Trained on synthetic and constitutional rows only, then tested on ${int(
      headline.holdoutRows,
    )} real court judgments the model had never seen. This is the number that matters most.`,
    emphasis: true,
  },
  {
    icon: Sigma,
    value: pct(headline.cvMeanAccuracy),
    label: `${headline.cvFolds}-fold cross-validation`,
    detail: `Mean across ${headline.cvFolds} stratified folds, ±${(headline.cvStd * 100).toFixed(
      2,
    )} points. Low spread means the tree is not depending on any one slice of the corpus.`,
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
    detail: `What you would score by labelling every case "${headline.baselineClass}". Published so the figures above have something to be measured against.`,
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
    <figure className="glass-panel overflow-x-clip rounded-xl p-6 sm:p-8">
      <figcaption>
        <h3 className="font-display text-xl text-foreground">Confusion matrix</h3>
        <p className="mt-2 text-[0.9375rem] leading-[1.65] text-muted-foreground">
          Every row is the priority the policy assigns; every column is what the tree predicted. Counts on
          the shaded diagonal agree. Anything off it is a disagreement, and all {int(offDiagonal)} of them
          are listed below.
        </p>
      </figcaption>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[26rem] border-collapse text-sm">
          <caption className="sr-only">
            Confusion matrix of the deployed decision tree across {int(corpus.total_rows)} corpus rows.
            Rows are the policy label, columns are the predicted label.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Policy ↓ / Predicted →
              </th>
              {labels.map((label) => (
                <th key={label} scope="col" className="px-3 py-2 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {label}
                </th>
              ))}
              <th scope="col" className="px-3 py-2 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {labels.map((rowLabel, r) => (
              <tr key={rowLabel} className="border-t border-border">
                <th scope="row" className="px-3 py-3 text-left font-medium text-foreground">
                  {rowLabel}
                </th>
                {labels.map((colLabel, c) => {
                  const count = matrix[r]?.[c] ?? 0;
                  const agrees = r === c;
                  return (
                    <td
                      key={colLabel}
                      className={
                        agrees
                          ? "tnum border-l border-border bg-primary/[0.09] px-3 py-3 text-right font-semibold text-foreground"
                          : count > 0
                            ? "tnum border-l border-border px-3 py-3 text-right font-semibold text-destructive"
                            : "tnum border-l border-border px-3 py-3 text-right text-muted-foreground/60"
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
                <td className="tnum border-l border-border px-3 py-3 text-right text-muted-foreground">
                  {int(rowTotals[r] ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm bg-primary/[0.35] ring-1 ring-primary/40" />
          Diagonal — tree and policy agree
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm ring-1 ring-destructive" />
          Off-diagonal — disagreement
        </span>
      </p>
    </figure>
  );
}

const PRIORITY_SWATCH: Record<string, string> = {
  High: "var(--priority-high)",
  Medium: "var(--priority-medium)",
  Low: "var(--priority-low)",
};

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
    <figure className="glass-panel overflow-x-clip rounded-xl p-6 sm:p-8">
      <figcaption>
        <h3 className="font-display text-xl text-foreground">{title}</h3>
        <p className="mt-2 text-[0.9375rem] leading-[1.65] text-muted-foreground">{blurb}</p>
      </figcaption>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[26rem] border-collapse text-sm">
          <caption className="sr-only">{title}. Precision, recall, F1 score and support per priority tier.</caption>
          <thead>
            <tr>
              {["Priority", "Precision", "Recall", "F1", "Cases"].map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={`px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase ${
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
              <tr key={row.label} className="border-t border-border">
                <th scope="row" className="px-3 py-3 text-left font-medium text-foreground">
                  <span className="inline-flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: PRIORITY_SWATCH[row.label] ?? "var(--primary)" }}
                    />
                    {row.label}
                  </span>
                </th>
                <td className="tnum px-3 py-3 text-right text-foreground/85">{row.precision.toFixed(3)}</td>
                <td className="tnum px-3 py-3 text-right text-foreground/85">{row.recall.toFixed(3)}</td>
                <td className="tnum px-3 py-3 text-right text-foreground/85">{row.f1.toFixed(3)}</td>
                <td className="tnum px-3 py-3 text-right text-muted-foreground">{int(row.support)}</td>
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
  return (
    <section id="accuracy" className="snap-section-loose relative px-6 py-24 md:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal>
          <p className="eyebrow">Measured performance</p>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
            <h2 className="font-display max-w-2xl text-4xl text-foreground sm:text-5xl">
              How accurate is it, <em className="emphasis">really</em>?
            </h2>
            <p className="max-w-sm text-[0.9375rem] leading-[1.65] text-muted-foreground">
              Measured on {reportedAt} against the exact model file the app ships. No figure on this page is
              typed by hand — they are generated straight from the evaluation run.
            </p>
          </div>
        </Reveal>

        {/* Headline figures */}
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c, i) => {
            const Icon = c.icon;
            const featured = "emphasis" in c && c.emphasis;
            const muted = "muted" in c && c.muted;
            return (
              <Reveal key={c.label} delay={i * 90}>
                <div
                  className={`glass-panel flex h-full flex-col rounded-xl p-6 ${
                    featured ? "border-primary/45 bg-primary/[0.07]" : ""
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${muted ? "text-muted-foreground" : "text-primary"}`}
                    strokeWidth={1.6}
                    aria-hidden="true"
                  />
                  <p
                    className={`font-display tnum mt-5 text-4xl font-semibold ${
                      muted ? "text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {c.value}
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground/90">{c.label}</p>
                  <p className="mt-3 text-[0.8125rem] leading-[1.6] text-muted-foreground">{c.detail}</p>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Tables */}
        {/* min-w-0 on the grid items: without it the min-w-[26rem] tables refuse to
            shrink and blow the page wide on small screens (overflow-x-auto only
            scrolls once the item itself fits the track). */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Reveal className="min-w-0">
            <ConfusionMatrix />
          </Reveal>
          <Reveal delay={110} className="min-w-0">
            <PerClassTable
              rows={byTier(holdoutPerClass.length > 0 ? holdoutPerClass : perClass)}
              title="Per-tier scores on unseen judgments"
              blurb={`Broken down by priority tier on the ${int(
                headline.holdoutRows,
              )} held-out real judgments. High-priority recall is the row to watch: missing an urgent case costs more than over-flagging a routine one.`}
            />
          </Reveal>
        </div>

        {/* Honest framing */}
        <Reveal delay={80}>
          <div className="mt-6 rounded-xl border border-primary/35 bg-primary/[0.06] p-8">
            <p className="eyebrow">Read this before quoting the number</p>
            <p className="mt-4 text-[0.9375rem] leading-[1.75] text-foreground/85">
              These labels are not human judicial annotations. Ground truth comes from a written
              court-priority policy derived from the Constitution of India, applied by code. So{" "}
              {pct(headline.policyFidelity)} means <em className="emphasis">the tree reproduces that written
              policy almost perfectly</em> — which is precisely the auditability the system is built for. It
              is not a claim that Anavaya agrees with a judge {pct(headline.policyFidelity)} of the time. The
              honest generalisation figure is the {pct(headline.holdoutAccuracy)} scored on real judgments the
              model never saw during training, and even that measures agreement with the policy, not with the
              bench. Anavaya proposes a first pass; the bench decides.
            </p>
          </div>
        </Reveal>

        {/* Model card + reproduce */}
        <Reveal delay={120} className="min-w-0">
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
            <dl className="glass-panel grid gap-x-8 gap-y-4 rounded-xl p-6 sm:grid-cols-2 sm:p-8">
              {modelFacts.map((f) => (
                <div key={f.k} className="border-b border-border/60 pb-3 last:border-b-0">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{f.k}</dt>
                  <dd className="mt-1.5 text-[0.9375rem] leading-snug text-foreground/90">{f.v}</dd>
                </div>
              ))}
            </dl>

            <div className="glass-panel rounded-xl p-6 sm:p-8">
              <TerminalSquare className="h-5 w-5 text-primary" strokeWidth={1.6} aria-hidden="true" />
              <h3 className="font-display mt-4 text-lg text-foreground">Check it yourself</h3>
              <p className="mt-2 text-[0.8125rem] leading-[1.6] text-muted-foreground">
                The evaluation script never refits the model — it loads the shipped pickle and scores it.
              </p>
              <pre className="mt-4 overflow-x-auto rounded-md border border-border bg-background/70 p-3 text-[0.75rem] leading-relaxed text-foreground/85">
                <code>python case_priority_system/{"\n"}scripts/evaluate_model.py</code>
              </pre>
              <p className="tnum mt-4 text-[0.75rem] text-muted-foreground">
                Folds: {cvPerFold.map((f) => f.toFixed(3)).join(" · ")}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
