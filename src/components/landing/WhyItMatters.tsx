import { Zap, Landmark, Target, UserCheck, Eye, ShieldCheck } from "lucide-react";
import { Reveal } from "./Reveal";

const benefits = [
  {
    icon: Zap,
    title: "Speed",
    text: "What took hours of manual review now takes seconds. Upload a document, get a priority in under 2 seconds.",
  },
  {
    icon: Landmark,
    title: "Constitutional Grounding",
    text: "Every priority decision is backed by specific Constitutional articles and legal doctrines. Not a black box — fully auditable.",
  },
  {
    icon: Target,
    title: "Safety-First Design",
    text: "When multiple documents exist in a case, the highest priority always wins. No violent case is ever buried under paperwork.",
  },
];

const trust = [
  {
    icon: UserCheck,
    title: "Assists, never replaces",
    text: "Anavaya produces a first-pass triage suggestion. Judicial discretion stays entirely with the bench — every output is a recommendation a human can override without friction.",
  },
  {
    icon: Eye,
    title: "No black-box decisions",
    text: "The classifier is a printable decision tree, not an opaque score. Each result ships with the feature path taken and the constitutional reasoning applied.",
  },
  {
    icon: ShieldCheck,
    title: "Data stays on your machine",
    text: "Extraction, classification, and reporting all run locally. No cloud upload, no third-party API, no case record leaving court infrastructure.",
  },
];

export function WhyItMatters() {
  return (
    <section id="why" className="snap-section px-6 py-24 md:px-10">
      <div className="mx-auto grid max-w-6xl gap-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <Reveal>
          <p className="eyebrow">Why it matters</p>
          <blockquote className="font-display mt-8 text-3xl leading-[1.25] text-balance text-foreground sm:text-4xl">
            "In India, over 4 crore cases are pending across courts. Officers manually triage thousands of
            documents daily.{" "}
            <span className="text-gradient-gold">Anavaya changes that — instantly.</span>"
          </blockquote>
        </Reveal>

        <div className="space-y-5">
          {benefits.map((b, i) => {
            const Icon = b.icon;
            return (
              <Reveal key={b.title} delay={i * 160}>
                <div className="glass-panel rounded-r-lg border-l-2 border-l-primary p-6 transition-all hover:shadow-[var(--shadow-gold)]">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-primary" strokeWidth={1.6} aria-hidden="true" />
                    <h3 className="font-display text-lg text-foreground">{b.title}</h3>
                  </div>
                  <p className="mt-3 text-[0.9375rem] leading-[1.65] text-muted-foreground">{b.text}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>

      {/* Trust & human oversight band */}
      <div className="mx-auto mt-20 max-w-6xl rounded-2xl border border-border bg-surface p-8 sm:p-12">
        <Reveal>
          <div className="max-w-2xl">
            <p className="eyebrow">
              Trust &amp; human oversight
            </p>
            <h3 className="font-display mt-5 text-3xl text-foreground">
              A tool for the bench — accountable by construction.
            </h3>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {trust.map((t, i) => {
            const Icon = t.icon;
            return (
              <Reveal key={t.title} delay={i * 150}>
                <Icon className="h-6 w-6 text-primary" strokeWidth={1.5} aria-hidden="true" />
                <h4 className="font-display mt-4 text-lg text-foreground">{t.title}</h4>
                <p className="mt-2 text-[0.9375rem] leading-[1.65] text-muted-foreground">{t.text}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
