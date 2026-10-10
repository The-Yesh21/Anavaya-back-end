import { Clock, Gavel, Layers, Target } from "lucide-react";
import { Reveal, CountUp } from "./Reveal";
import { MODEL_METRICS } from "@/data/model-metrics";

export function ProblemBand() {
  return (
    <section className="snap-section relative px-6 py-20 md:px-10">
      {/* Subtle radial ambient background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_75%_55%_at_50%_50%,color-mix(in_oklab,var(--primary)_7%,transparent),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-5xl border-y border-border/80 py-16 text-center">
        {/* Subtle center gold accent notch */}
        <span
          aria-hidden="true"
          className="absolute top-0 left-1/2 h-1 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/45 shadow-[0_0_12px_var(--primary)]"
        />
        <Reveal>
          <p className="eyebrow">The problem</p>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="font-display mx-auto mt-6 max-w-3xl text-3xl leading-snug tracking-tight text-balance text-foreground sm:text-4xl">
            Over <span className="text-gradient-gold">4 crore cases</span> sit pending across Indian courts. A
            single matter can wait years for its first substantive hearing.
          </h2>
        </Reveal>
        <Reveal delay={220}>
          <p className="mx-auto mt-6 max-w-2xl text-[1.0625rem] leading-[1.75] text-muted-foreground">
            Court staff triage thousands of FIRs, complaints, and pleadings by hand every day. Urgency is
            judged page by page, under time pressure, with no consistent record of why one file moved ahead of
            another. Anavaya gives that first pass structure, speed, and a written justification.
          </p>
        </Reveal>
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-1/2 h-1 w-16 -translate-x-1/2 translate-y-1/2 rounded-full bg-primary/45 shadow-[0_0_12px_var(--primary)]"
        />
      </div>
    </section>
  );
}

/* Figures come from the evaluation run (src/data/model-metrics.ts), not from copy,
   so the headline bar cannot drift from what the shipped model actually scored. */
const { headline, corpus } = MODEL_METRICS;

const stats = [
  {
    icon: Target,
    display: `${(headline.holdoutAccuracy * 100).toFixed(1)}%`,
    label: `Accuracy on ${headline.holdoutRows} unseen real judgments`,
    href: "#accuracy",
  },
  {
    icon: Layers,
    value: corpus.total_rows,
    suffix: "",
    label: "Labelled cases in the training corpus",
  },
  {
    icon: Clock,
    display: "< 2 sec",
    label: "Priority classification, start to finish",
  },
  {
    icon: Gavel,
    value: 8,
    suffix: "",
    label: "Legal categories · Excise · Customs · Insolvency · Constitutional · Property · Criminal · Company · Civil",
  },
] as const;

export function StatsBar() {
  return (
    <section className="snap-section px-6 py-24 md:px-10">
      <div className="glass-panel mx-auto grid max-w-6xl grid-cols-1 overflow-hidden rounded-2xl border border-border/80 shadow-[0_8px_30px_-6px_color-mix(in_oklab,var(--primary)_10%,transparent)] sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          const body = (
            <div className="group flex flex-col items-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/[0.08] text-primary shadow-[0_0_15px_-3px_color-mix(in_oklab,var(--primary)_25%,transparent)] transition-all duration-300 group-hover:scale-110 group-hover:border-primary/60 group-hover:bg-primary/[0.15]">
                <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <p className="font-display tnum mt-5 text-4xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
                {"display" in stat ? stat.display : <CountUp value={stat.value} suffix={stat.suffix} />}
              </p>
              <p className="mt-3 text-[0.8125rem] leading-relaxed tracking-wide text-muted-foreground">
                {stat.label}
              </p>
            </div>
          );
          return (
            <Reveal
              key={stat.label}
              delay={i * 140}
              className="border-b border-border/80 last:border-b-0 sm:[&:nth-child(-n+2)]:border-b sm:[&:nth-child(n+3)]:border-b-0 lg:border-r lg:border-b-0 lg:last:border-r-0"
            >
              {"href" in stat ? (
                <a
                  href={stat.href}
                  className="block h-full cursor-pointer px-7 py-10 text-center transition-all duration-300 hover:bg-primary/[0.05] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {body}
                  <span className="sr-only"> — see the full evaluation</span>
                </a>
              ) : (
                <div className="px-7 py-10 text-center">{body}</div>
              )}
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
