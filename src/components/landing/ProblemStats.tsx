import { useIsMobile } from "@/hooks/use-mobile";
import { LandingDialog } from "./LandingDialog";
import { useState } from "react";
import { Clock, Gavel, Layers, Target, AlertTriangle, X, ShieldAlert } from "lucide-react";
import { Reveal, CountUp } from "./Reveal";
import { MODEL_METRICS } from "@/data/model-metrics";
import { InfiniteSpiral, SpiralItem } from "@/components/ui/InfiniteSpiral";

interface HistoricDelayCase extends SpiralItem {
  fullDossier: {
    victim: string;
    jurisdiction: string;
    duration: string;
    outcome: string;
    constitutionalViolation: string;
    narrative: string;
    systemicFailure: string;
    anavayaMitigation: string;
  };
}

const delayedJusticeCases: HistoricDelayCase[] = [
  {
    id: "case-machal-lalung",
    tag: "Undertrial Tragedy",
    stat: "54 Years Stolen",
    title: "Machal Lalung • Never Got a Trial",
    description: "Arrested at 23 in 1951 for a minor altercation. Declared fit in 1967, but paperwork was lost. Forgotten in prison until released at age 77 by the Supreme Court.",
    article: "Art. 21 Speedy Trial",
    fullDossier: {
      victim: "Machal Lalung (Tiwa Tribe, Assam)",
      jurisdiction: "Guwahati High Court / Supreme Court of India",
      duration: "54 Years (1951 – 2005)",
      outcome: "Freed at age 77 following suo motu Supreme Court intervention. Passed away shortly after release.",
      constitutionalViolation: "Article 21 (Right to Personal Liberty & Speedy Trial) & Article 14 (Equality Before Law)",
      narrative: "Arrested at age 23 from a remote village in Morigaon, Assam. Though certified sane and fit for trial by doctors in 1967, his case record was misplaced. He spent over half a century behind bars without ever hearing his charges read in open court.",
      systemicFailure: "Complete lack of periodic registry audits, absence of vernacular translation, and zero automated tracking of unrepresented undertrials.",
      anavayaMitigation: "Under Anavaya, any undertrial detention exceeding statutory limits immediately triggers an automatic High Priority Article 21 urgent alert flag, preventing files from slipping into registry black holes.",
    },
  },
  {
    id: "case-vishnu-tiwari",
    tag: "Wrongful Conviction",
    stat: "20 Years Behind Bars",
    title: "Vishnu Tiwari • 16-Year \"Defective\" Appeal",
    description: "Falsely accused in 2000. Jail legal aid appeal remained marked 'defective' in High Court registry for 16 years. Acquitted completely innocent in 2021 after his entire family died.",
    article: "Art. 39A Free Legal Aid",
    fullDossier: {
      victim: "Vishnu Tiwari (Lalitpur, Uttar Pradesh)",
      jurisdiction: "Allahabad High Court",
      duration: "20 Years Incarcerated (2000 – 2021)",
      outcome: "Unanimously acquitted as innocent in March 2021 by the Division Bench. Walked out broken with his entire family deceased.",
      constitutionalViolation: "Article 21 (Personal Liberty) and Article 39A (Equal Justice & Free Legal Aid)",
      narrative: "Convicted in 2003 on fabricated charges, Tiwari sent a jail appeal in 2005. Because of clerical defects that an impoverished prisoner could not rectify without an advocate, his file sat frozen in registry drawers for 16 years without a hearing.",
      systemicFailure: "Bureaucratic apathy where minor paperwork defects paralyze criminal appeals, leaving indigent prisoners with no voice.",
      anavayaMitigation: "Anavaya's multi-document intake engine automatically flags unrepresented prisoners and prioritizes substantive liberty appeals above technical ministerial defects.",
    },
  },
  {
    id: "case-ncrb-undertrials",
    tag: "National Prison Crisis",
    stat: "77.1% Inmates Unconvicted",
    title: "4.3+ Lakh Undertrial Citizens",
    description: "India's prisons operate at 131% capacity. Over three-quarters of all incarcerated citizens have not been convicted of any crime, awaiting triage.",
    article: "Systemic Overcrowding",
    fullDossier: {
      victim: "Over 430,000 Unconvicted Citizens (NCRB Data)",
      jurisdiction: "Pan-India Correctional System",
      duration: "Months to Decades awaiting trial",
      outcome: "Severe prison congestion (131% national occupancy), high illness rates, and pre-trial punishment.",
      constitutionalViolation: "Article 21 (Presumption of Innocence & Dignified Life)",
      narrative: "Prison Statistics India confirms that 77% of India's incarcerated population are undertrials. The vast majority belong to marginalized and economically weaker sections who cannot afford bail bonds or private representation.",
      systemicFailure: "Courts lack automated triaging to separate non-violent undertrials eligible for Sec 436A CrPC release from violent felons.",
      anavayaMitigation: "Anavaya identifies eligibility for statutory bail and personal liberty relief in under 2 seconds, surfacing urgent release candidates to the bench daily.",
    },
  },
  {
    id: "case-uphaar-tragedy",
    tag: "Victims' Agony",
    stat: "24 Years of Adjournments",
    title: "Uphaar Cinema Fire • 59 Human Lives",
    description: "59 people suffocated in the 1997 fire. Grieving parents attended over 700 hearings while wealthy defendants weaponized procedural loopholes and delays.",
    article: "Power Imbalance",
    fullDossier: {
      victim: "59 Theatergoers & The Association of Victims of Uphaar Tragedy (AVUT)",
      jurisdiction: "Delhi Sessions Court / Delhi High Court / Supreme Court",
      duration: "24 Years (1997 – 2021)",
      outcome: "Prolonged legal battle before finality was achieved; evidence tampering trials stretched over two decades.",
      constitutionalViolation: "Article 14 (Equality Before Law) & Article 21 (Right to Speedy Justice for Victims)",
      narrative: "Neelam and Shekhar Krishnamoorthy lost both their teenage children in the fire. For 24 years, corporate defendants utilized senior counsel delays, adjournments, and procedural challenges to postpone accountability.",
      systemicFailure: "Wealthy parties systematically using procedural delay as an attrition strategy against grieving citizens.",
      anavayaMitigation: "Anavaya incorporates a dedicated Power Imbalance & Delay Countermeasure engine that detects institutional resource asymmetry and prevents tactical adjournments.",
    },
  },
  {
    id: "case-jagjivan-yadav",
    tag: "Forgotten Undertrial",
    stat: "38 Years in Prison",
    title: "Jagjivan Yadav • Jailed for Scuffle",
    description: "Arrested in 1968 for a petty neighbor dispute. Lost in the judicial labyrinth until discovered and released in 2006 at the age of 70.",
    article: "Habeas Corpus",
    fullDossier: {
      victim: "Jagjivan Ram Yadav (Faizabad, Uttar Pradesh)",
      jurisdiction: "Faizabad Sessions Court",
      duration: "38 Years Incarceration (1968 – 2006)",
      outcome: "Released in 2006 after rights activists discovered him in Faizabad Jail. The trial court had misplaced his records in 1970.",
      constitutionalViolation: "Article 21 (Right to Life & Liberty)",
      narrative: "Arrested following a minor neighborhood scuffle in 1968, he was admitted to a psychiatric ward for assessment. His case records disappeared during transfers, and he remained locked up for nearly 40 years without an advocate.",
      systemicFailure: "Physical court record loss and lack of digital inter-institutional tracking between hospitals, prisons, and registries.",
      anavayaMitigation: "Anavaya maintains immutable case hashes and automated triage queues so no filing can disappear between court transfers.",
    },
  },
  {
    id: "case-bhopal-gas",
    tag: "Mass Tort Tragedy",
    stat: "40+ Years of Stagnation",
    title: "Bhopal Gas Leak • 25,000+ Deaths",
    description: "Over 500,000 toxic exposure victims. Generations spent decades fighting procedural curative petitions while critical medical relief was delayed.",
    article: "Mass Tort Justice",
    fullDossier: {
      victim: "500,000+ Toxic Gas Victims of Union Carbide",
      jurisdiction: "Supreme Court of India / Special Courts",
      duration: "40+ Years (1984 – Present)",
      outcome: "Tens of thousands of survivors died of respiratory and toxic illnesses before medical compensation claims were resolved.",
      constitutionalViolation: "Article 21 (Right to Health, Clean Environment & Timely Remedy)",
      narrative: "The world's worst industrial disaster became ensnared in endless jurisdictional appeals, corporate restructuring, settlement reviews, and curative petition delays spanning over 40 years.",
      systemicFailure: "Judicial procedures ill-equipped to triage mass catastrophic humanitarian emergencies above standard civil procedure.",
      anavayaMitigation: "Anavaya elevates mass casualty and toxic public health crises directly to Priority Tier 1 under the Parens Patriae and Precautionary doctrines.",
    },
  },
  {
    id: "case-hussainara-khatoon",
    tag: "Historic Benchmark",
    stat: "40,000 Lost Undertrials",
    title: "Hussainara Khatoon (1979) • Bihar Jails",
    description: "Landmark revelation of tens of thousands imprisoned beyond maximum statutory penalties. Prompted Supreme Court to establish Speedy Trial as an Art. 21 right.",
    article: "Speedy Trial Doctrine",
    fullDossier: {
      victim: "Thousands of Undertrials in Patna & Muzaffarpur Jails",
      jurisdiction: "Supreme Court of India (AIR 1979 SC 1360)",
      duration: "Many years exceeding maximum punishable sentences",
      outcome: "Landmark verdict by Justice P.N. Bhagwati mandating the release of thousands of undertrials across Bihar.",
      constitutionalViolation: "Article 21 (Speedy Trial as Fundamental Right)",
      narrative: "Advocate Pushpa Kapila Hingorani filed a habeas corpus writ based on investigative reports showing men, women, and children languishing for years awaiting trial without bail.",
      systemicFailure: "The absence of statutory time-limits and automatic triage in trial court registries.",
      anavayaMitigation: "Anavaya embeds the exact constitutional holding of Hussainara Khatoon directly into its decision rules, automating the triage of detention duration.",
    },
  },
  {
    id: "case-njdg-backlog",
    tag: "Systemic Paralysis",
    stat: "5.1 Crore Pending Cases",
    title: "National Backlog • Process is Punishment",
    description: "Average Indian civil appeal lasts 7.2 years. For millions of citizens, procedural process becomes the punishment, forcing unjust settlements.",
    article: "Access to Justice",
    fullDossier: {
      victim: "51 Million Litigants across India (National Judicial Data Grid)",
      jurisdiction: "Supreme Court, High Courts, and District Judiciary",
      duration: "Average case lifespan exceeds 5 to 15 years",
      outcome: "Diminished public confidence in the rule of law, economic stagnation, and prolonged mental anguish for families.",
      constitutionalViolation: "Article 14 (Equal Access to Courts) & Article 21",
      narrative: "With a judge-to-population ratio of only ~21 judges per million people, court dockets grow faster than they can be cleared by manual paper triage.",
      systemicFailure: "Court registries triaging dockets manually page-by-page without data-driven classification or risk assessment.",
      anavayaMitigation: "Anavaya classifies case dockets in under 2 seconds, surfacing urgent constitutional, personal liberty, and vulnerable matters to the bench instantly.",
    },
  },
];

export function ProblemBand() {
  const isMobile = useIsMobile({ includeTouch: true });
  const [selectedCase, setSelectedCase] = useState<HistoricDelayCase | null>(null);

  return (
    <section id="problem" className="snap-section-loose relative isolate px-6 py-14 md:px-10 md:py-20">
      <div className="relative mx-auto max-w-6xl border-y border-border py-16 text-center">
        {/* Center accent notch */}
        <span
          aria-hidden="true"
          className="absolute top-0 left-1/2 h-0.5 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/50 shadow-sm"
        />

        <Reveal>
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-1.5 text-xs font-semibold tracking-[0.22em] uppercase text-rose-500 shadow-xs">
            <AlertTriangle className="h-3.5 w-3.5" />
            Historic court delays
          </div>
        </Reveal>

        <Reveal delay={120}>
          <h2 className="heading-section mx-auto mt-6 max-w-4xl text-balance text-foreground">
            When a case waits
          </h2>
        </Reveal>

        <Reveal delay={200}>
          <p className="body-1 prose-justify mx-auto mt-4 max-w-xl text-muted-foreground">
            These cases show what can happen when an urgent filing goes years without review. Open a case to read its history and outcome.
          </p>
        </Reveal>

        {/* React Bits InfiniteSpiral 3D Helix of Delayed Justice Records */}
        <Reveal delay={280}>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 md:hidden pointer-coarse:grid" aria-label="Historic court delays">
            {delayedJusticeCases.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedCase(item)}
                  className="flex h-full w-full flex-col items-start gap-1 rounded-xl border border-border bg-card p-4 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="text-xs font-semibold text-rose-500">{item.stat}</span>
                  <span className="font-semibold text-foreground">{item.title}</span>
                </button>
              </li>
            ))}
          </ul>
          {!isMobile && (
            <div className="mt-12 hidden flex-col items-center justify-center md:flex pointer-coarse:hidden">
              <div className="relative h-[480px] sm:h-[520px] w-full max-w-4xl overflow-hidden rounded-2xl border border-border/80 bg-background/50 shadow-inner">
                <InfiniteSpiral
                  items={delayedJusticeCases}
                  speed={0.45}
                  direction="up"
                  animationMode="all"
                  radius={220}
                  cardWidth={270}
                  cardHeight={165}
                  verticalSpacing={85}
                  perspective={1200}
                  cardsPerTurn={8}
                  rotation={12}
                  cardTilt={0}
                  cardRadius={14}
                  centerScale={1.16}
                  edgeFade={0.28}
                  edgeBlur={5}
                  pauseOnHover={true}
                  className="w-full h-full"
                  onItemClick={(item) => setSelectedCase(item as HistoricDelayCase)}
                />

                {/* Helix Guidance Overlay */}
                <div className="pointer-events-none absolute bottom-4 inset-x-0 flex items-center justify-center">
                  <span className="rounded-full border border-primary/30 bg-background/90 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur-md flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                    Drag or scroll to browse cases. Select a card to read its history.
                  </span>
                </div>
              </div>
            </div>
          )}
        </Reveal>

        <span
          aria-hidden="true"
          className="absolute bottom-0 left-1/2 h-0.5 w-20 -translate-x-1/2 translate-y-1/2 rounded-full bg-primary/50 shadow-sm"
        />
      </div>

      {/* Historic Delay Case Detail Modal */}
      {selectedCase && (
        <LandingDialog titleId="modal-delay-case-title" onDismiss={() => setSelectedCase(null)}>
          <div
            className="relative w-full max-w-2xl rounded-2xl border border-rose-500/40 bg-surface p-6 sm:p-8 shadow-2xl transition-all animate-in zoom-in-95 duration-200"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedCase(null)}
              className="absolute top-5 right-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-background/80 text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              aria-label="Close dossier"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header: Tag & Years Lost */}
            <div className="flex flex-wrap items-center justify-between gap-2 pr-12">
              <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-rose-500">
                {selectedCase.tag}
              </span>
              <span className="font-display text-lg font-black text-rose-500">
                {selectedCase.stat}
              </span>
            </div>

            {/* Title & Victim Information */}
            <div className="mt-4">
              <h3 id="modal-delay-case-title" className="font-display text-xl sm:text-2xl font-bold text-foreground">
                {selectedCase.fullDossier.victim}
              </h3>
              <p className="text-xs font-semibold text-primary mt-1">
                {selectedCase.fullDossier.jurisdiction} • {selectedCase.fullDossier.duration}
              </p>
            </div>

            {/* Violation & Outcome Summary */}
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 text-xs">
              <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                <span className="font-bold text-foreground block">Constitutional Breach:</span>
                <span className="text-rose-500/90 font-medium">{selectedCase.fullDossier.constitutionalViolation}</span>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                <span className="font-bold text-foreground block">Ultimate Outcome:</span>
                <span className="text-muted-foreground">{selectedCase.fullDossier.outcome}</span>
              </div>
            </div>

            {/* Narrative Body */}
            <div className="mt-4 text-xs sm:text-sm space-y-3">
              <div className="border-l-2 border-rose-500/60 pl-3 py-0.5">
                <span className="font-bold text-foreground block text-xs uppercase tracking-wider text-rose-500 mb-1">
                  The Historic Record
                </span>
                <p className="prose-justify text-foreground/90 leading-relaxed italic">
                  &ldquo;{selectedCase.fullDossier.narrative}&rdquo;
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/40 p-3 text-xs">
                <span className="font-bold text-foreground block mb-0.5">Systemic Failure in Existing Setup:</span>
                <p className="text-muted-foreground">{selectedCase.fullDossier.systemicFailure}</p>
              </div>
            </div>

            {/* Anavaya Mitigation Footer */}
            <div className="mt-5 rounded-xl border border-primary/30 bg-primary/[0.06] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs">
                <span className="font-bold uppercase tracking-wider text-[0.65rem] text-primary block flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  How Anavaya Solves This
                </span>
                <p className="text-foreground/90 font-medium mt-1">
                  {selectedCase.fullDossier.anavayaMitigation}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCase(null)}
                className="inline-flex items-center justify-center rounded-lg bg-primary min-h-11 px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 cursor-pointer self-end sm:self-auto flex-shrink-0"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </LandingDialog>
      )}
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
              <p className="font-display tnum mt-5 text-4xl sm:text-5xl font-black tracking-[-0.05em] text-foreground transition-colors group-hover:text-primary">
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
