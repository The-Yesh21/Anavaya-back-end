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
      <div className="mx-auto grid max-w-6xl gap-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <Reveal>
          <div className="flex items-center gap-2">
            <span className="eyebrow">Constitutional imperative</span>
          </div>
          <blockquote className="font-display mt-8 text-3xl leading-[1.3] text-balance text-foreground sm:text-4xl">
            "In India, over 4 crore cases are pending across courts. Officers manually triage thousands of
            documents daily.{" "}
            <span className="text-gradient-gold">Anavaya changes that — instantly.</span>"
          </blockquote>
          <p className="mt-6 max-w-lg text-[0.9375rem] leading-[1.7] text-muted-foreground">
            Without reliable triage, urgent matters involving personal liberty can be lost in the sheer
            volume of commercial filings. Anavaya ensures high-stakes human matters rise to immediate
            attention.
          </p>
        </Reveal>

        <div className="space-y-4">
          {benefits.map((b, i) => {
            const Icon = b.icon;
            return (
              <Reveal key={b.title} delay={i * 160}>
                <div className="glass-panel group rounded-2xl border border-border/80 border-l-4 border-l-primary p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_12px_32px_-10px_color-mix(in_oklab,var(--primary)_25%,transparent)]">
                  <div className="flex items-center gap-3.5">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.08] text-primary shadow-xs transition-transform duration-300 group-hover:scale-105">
                      <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <h3 className="font-display text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                      {b.title}
                    </h3>
                  </div>
                  <p className="mt-3 text-[0.9375rem] leading-[1.65] text-muted-foreground">{b.text}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>

      {/* Trust & human oversight band */}
      <div className="relative mx-auto mt-20 max-w-6xl overflow-hidden rounded-2xl border border-border/80 bg-surface/80 p-8 shadow-sm backdrop-blur-xl sm:p-12">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        />
        <Reveal>
          <div className="max-w-2xl">
            <p className="eyebrow">Trust &amp; human oversight</p>
            <h3 className="font-display mt-5 text-3xl font-semibold text-foreground sm:text-4xl">
              A tool for the bench — <span className="text-gradient-gold">accountable by construction.</span>
            </h3>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {trust.map((t, i) => {
            const Icon = t.icon;
            return (
              <Reveal key={t.title} delay={i * 150}>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.08] text-primary shadow-xs">
                  <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <h4 className="font-display mt-4 text-lg font-semibold text-foreground">{t.title}</h4>
                <p className="mt-2 text-[0.9375rem] leading-[1.65] text-muted-foreground">{t.text}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
