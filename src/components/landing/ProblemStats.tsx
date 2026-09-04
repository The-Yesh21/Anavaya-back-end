import { Clock, Gavel, Layers, Target } from "lucide-react";
import { Reveal, CountUp } from "./Reveal";
import { MODEL_METRICS } from "@/data/model-metrics";

export function ProblemBand() {
  return (
    <section className="snap-section relative px-6 py-20 md:px-10">
      <div className="mx-auto max-w-5xl border-y border-border/70 py-14 text-center">
        <Reveal>
          <p className="eyebrow">The problem</p>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="font-display mx-auto mt-6 max-w-3xl text-3xl leading-snug text-balance text-foreground sm:text-4xl">
            Over 4 crore cases sit pending across Indian courts. A single matter can wait years for its first
            substantive hearing.
          </h2>
        </Reveal>
        <Reveal delay={220}>
          <p className="mx-auto mt-6 max-w-2xl text-[1.0625rem] leading-[1.7] text-muted-foreground">
            Court staff triage thousands of FIRs, complaints, and pleadings by hand every day. Urgency is
            judged page by page, under time pressure, with no consistent record of why one file moved ahead of
            another. Anavaya gives that first pass structure, speed, and a written justification.
          </p>
        </Reveal>
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
      <div className="glass-panel mx-auto grid max-w-6xl grid-cols-1 rounded-xl sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          const body = (
            <>
              <Icon className="mx-auto h-6 w-6 text-primary" strokeWidth={1.5} aria-hidden="true" />
              <p className="font-display tnum mt-5 text-4xl font-semibold text-foreground">
                {"display" in stat ? stat.display : <CountUp value={stat.value} suffix={stat.suffix} />}
              </p>
              <p className="mt-3 text-[0.8125rem] leading-relaxed tracking-wide text-muted-foreground">
                {stat.label}
              </p>
            </>
          );
          return (
            <Reveal
              key={stat.label}
              delay={i * 140}
              className="border-b border-border last:border-b-0 sm:[&:nth-child(-n+2)]:border-b sm:[&:nth-child(n+3)]:border-b-0 lg:border-r lg:border-b-0 lg:last:border-r-0"
            >
              {"href" in stat ? (
                <a
                  href={stat.href}
                  className="block h-full cursor-pointer px-7 py-10 text-center transition-colors hover:bg-primary/[0.06] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
