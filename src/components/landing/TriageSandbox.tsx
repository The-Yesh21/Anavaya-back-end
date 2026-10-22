import { useState, useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Gavel,
  Layers,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserX,
  Zap,
} from "lucide-react";
import { Reveal } from "./Reveal";
import { APP_URL } from "./constants";

export type SeverityType = "No Injury" | "Minor" | "Major / Fatal";
export type VulnerabilityType = "Standard / Corporate" | "Impoverished / Undertrial" | "Child / Exploited";
export type ImbalanceType = "Equal Standing" | "Severe Asymmetry";
export type CategoryType = "Criminal / Violent" | "Constitutional / Writ" | "Excise / Tax" | "Property / Land";

interface CasePreset {
  id: string;
  badge: string;
  title: string;
  summary: string;
  category: CategoryType;
  severity: SeverityType;
  vulnerability: VulnerabilityType;
  imbalance: ImbalanceType;
}

const PRESETS: CasePreset[] = [
  {
    id: "child-missing",
    badge: "Child Endangerment",
    title: "9-Year-Old Child Missing from Public Park (Sec 363 IPC)",
    summary:
      "A minor was abducted from a community playground. CCTV footage shows an unknown individual leading the child away. Immediate investigative triage required before trail goes cold.",
    category: "Criminal / Violent",
    severity: "Major / Fatal",
    vulnerability: "Child / Exploited",
    imbalance: "Severe Asymmetry",
  },
  {
    id: "undertrial-bail",
    badge: "Article 21 Habeas / Bail",
    title: "5 Years Incarceration Without Trial (Hussainara Mandate)",
    summary:
      "Impoverished undertrial detained on unproven petty theft charges for 60 consecutive months without a single substantive hearing date.",
    category: "Constitutional / Writ",
    severity: "Major / Fatal",
    vulnerability: "Impoverished / Undertrial",
    imbalance: "Severe Asymmetry",
  },
  {
    id: "gst-commercial",
    badge: "Commercial Tax Dispute",
    title: "Rs. 45 Lakh Input Tax Credit Discrepancy Between Vendors",
    summary:
      "Disputed supplier invoices and GST filing reconciliation between two solvent manufacturing firms. Pure contractual accounting dispute with zero bodily harm.",
    category: "Excise / Tax",
    severity: "No Injury",
    vulnerability: "Standard / Corporate",
    imbalance: "Equal Standing",
  },
  {
    id: "land-boundary",
    badge: "Civil Property Dispute",
    title: "Agricultural Boundary Injunction Between Adjoining Farmlands",
    summary:
      "Survey boundary demarcation discrepancy over 0.25 acres between private titleholders. Title documents on record with no threat to physical occupancy.",
    category: "Property / Land",
    severity: "No Injury",
    vulnerability: "Standard / Corporate",
    imbalance: "Equal Standing",
  },
];

export function TriageSandbox() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>("child-missing");
  const [category, setCategory] = useState<CategoryType>("Criminal / Violent");
  const [severity, setSeverity] = useState<SeverityType>("Major / Fatal");
  const [vulnerability, setVulnerability] = useState<VulnerabilityType>("Child / Exploited");
  const [imbalance, setImbalance] = useState<ImbalanceType>("Severe Asymmetry");

  // Load a preset
  const handleSelectPreset = (p: CasePreset) => {
    setSelectedPresetId(p.id);
    setCategory(p.category);
    setSeverity(p.severity);
    setVulnerability(p.vulnerability);
    setImbalance(p.imbalance);
  };

  // Determine priority deterministically (mirrors CART decision tree logic)
  const triageResult = useMemo(() => {
    const isFatalOrMajor = severity === "Major / Fatal";
    const isChildOrUndertrial = vulnerability !== "Standard / Corporate";
    const isViolent = category === "Criminal / Violent";
    const isConstitutional = category === "Constitutional / Writ";

    // High Priority Conditions (Articles 21, 23, 24)
    if (isFatalOrMajor || isChildOrUndertrial || isViolent) {
      const waitDays = category === "Criminal / Violent" ? "7.4 Years" : "5.8 Years";
      const legacyPosition = category === "Criminal / Violent" ? 18420 : 14190;
      return {
        tier: "High" as const,
        color: "var(--priority-high)",
        bgTint: "rgba(232, 93, 74, 0.12)",
        borderColor: "rgba(232, 93, 74, 0.35)",
        badgeText: "High Priority · Tier 1",
        queueLeap: "Leaps to Position #1",
        legacyQueue: `#${legacyPosition.toLocaleString()} in line`,
        legacyWait: waitDays,
        docketPosition: 1,
        articleEngaged: isChildOrUndertrial
          ? "Articles 21 & 24 (Right to Life & Child Protection)"
          : "Article 21 (Personal Liberty & Speedy Trial Mandate)",
        rationale:
          "Severe threat to personal liberty or bodily safety. Under the Constitution, the court cannot permit this matter to languish in a chronological paper queue.",
        action: "Scheduled for Immediate Hearing in Next Session",
      };
    }

    // Medium Priority Conditions
    if (severity === "Minor" || isConstitutional || category === "Excise / Tax") {
      return {
        tier: "Medium" as const,
        color: "var(--priority-medium)",
        bgTint: "rgba(217, 163, 67, 0.12)",
        borderColor: "rgba(217, 163, 67, 0.35)",
        badgeText: "Medium Priority · Tier 2",
        queueLeap: "Fast-Track Commercial Calendar",
        legacyQueue: "#11,350 in line",
        legacyWait: "4.2 Years",
        docketPosition: 14,
        articleEngaged: "Article 19(1)(g) & Article 265 (Trade & Lawful Revenue)",
        rationale:
          "Economic dispute or non-violent compliance matter. Scheduled on deterministic commercial docket without displacing urgent liberty cases.",
        action: "Routed to Fast-Track Commercial Bench within 14 Days",
      };
    }

    // Low Priority (Routine Civil)
    return {
      tier: "Low" as const,
      color: "var(--priority-low)",
      bgTint: "rgba(102, 178, 122, 0.12)",
      borderColor: "rgba(102, 178, 122, 0.35)",
      badgeText: "Low Priority · Tier 3",
      queueLeap: "Routine Civil Listing",
      legacyQueue: "#22,600 in line",
      legacyWait: "8.5 Years",
      docketPosition: 140,
      articleEngaged: "Article 300A (Right to Property)",
      rationale:
        "Standard property title adjudication. No immediate threat of dispossession, violence, or irreparable constitutional harm.",
      action: "Scheduled on Standard Civil Calendar",
    };
  }, [category, severity, vulnerability, imbalance]);

  return (
    <section id="triage-sandbox" className="snap-section-loose relative px-6 py-20 md:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal>
          <div className="text-center">
            <span className="eyebrow">Interactive Simulator</span>
            <h2 className="font-display mx-auto mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Experience the Engine:{" "}
              <span className="text-gradient-gold">Watch the Docket Leap</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-[1rem] leading-[1.7] text-muted-foreground">
              Select a scenario or adjust the legal facts below to see how Anavaya's deterministic Decision Tree
              instantly rescues urgent cases from years of static filing backlogs.
            </p>
          </div>
        </Reveal>

        {/* 1-Click Archetype Presets */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
          {PRESETS.map((p) => {
            const isSelected = selectedPresetId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className={`group inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-all duration-200 ${
                  isSelected
                    ? "border-primary bg-primary/15 text-primary shadow-[0_0_20px_-4px_color-mix(in_oklab,var(--primary)_35%,transparent)]"
                    : "border-border/80 bg-surface/60 text-muted-foreground hover:border-primary/50 hover:bg-surface/90 hover:text-foreground"
                }`}
              >
                <Sparkles
                  className={`h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110 ${
                    isSelected ? "text-primary" : "text-muted-foreground"
                  }`}
                  aria-hidden="true"
                />
                {p.badge}
              </button>
            );
          })}
        </div>

        {/* Sandbox Core Stage */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left Column: Interactive Parameters & Fact Controls */}
          <div className="glass-panel flex flex-col justify-between rounded-2xl border border-border/80 p-6 shadow-sm sm:p-8">
            <div>
              <div className="flex items-center justify-between border-b border-border/70 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/[0.08] text-primary">
                    <Gavel className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h3 className="font-display text-base font-semibold text-foreground">
                    Case Facts &amp; Legal Parameters
                  </h3>
                </div>
                <span className="text-[0.6875rem] font-medium tracking-wider text-muted-foreground uppercase">
                  Tactile Controls
                </span>
              </div>

              {/* Legal Category Segment */}
              <div className="mt-6">
                <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  1. Matter Category
                </label>
                <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    ["Criminal / Violent", "Constitutional / Writ", "Excise / Tax", "Property / Land"] as CategoryType[]
                  ).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setSelectedPresetId("");
                        setCategory(cat);
                      }}
                      className={`rounded-lg border px-2.5 py-2 text-center text-xs font-medium transition-all ${
                        category === cat
                          ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                          : "border-border/80 bg-surface/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {cat.split(" / ")[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Harm Severity Segment */}
              <div className="mt-6">
                <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  2. Severity of Harm or Injury
                </label>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {(["No Injury", "Minor", "Major / Fatal"] as SeverityType[]).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => {
                        setSelectedPresetId("");
                        setSeverity(sev);
                      }}
                      className={`rounded-lg border px-2.5 py-2 text-center text-xs font-medium transition-all ${
                        severity === sev
                          ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                          : "border-border/80 bg-surface/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vulnerability Segment */}
              <div className="mt-6">
                <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  3. Party Vulnerability Status
                </label>
                <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(
                    ["Standard / Corporate", "Impoverished / Undertrial", "Child / Exploited"] as VulnerabilityType[]
                  ).map((vuln) => (
                    <button
                      key={vuln}
                      type="button"
                      onClick={() => {
                        setSelectedPresetId("");
                        setVulnerability(vuln);
                      }}
                      className={`rounded-lg border px-2.5 py-2 text-center text-xs font-medium transition-all ${
                        vulnerability === vuln
                          ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                          : "border-border/80 bg-surface/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {vuln.split(" / ")[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Power Imbalance Segment */}
              <div className="mt-6">
                <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  4. Power Imbalance
                </label>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {(["Equal Standing", "Severe Asymmetry"] as ImbalanceType[]).map((imb) => (
                    <button
                      key={imb}
                      type="button"
                      onClick={() => {
                        setSelectedPresetId("");
                        setImbalance(imb);
                      }}
                      className={`rounded-lg border px-2.5 py-2 text-center text-xs font-medium transition-all ${
                        imbalance === imb
                          ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                          : "border-border/80 bg-surface/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {imb}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Active Case Narrative Note */}
            <div className="mt-8 rounded-xl border border-primary/20 bg-primary/[0.04] p-4 text-xs leading-relaxed text-foreground/85">
              <span className="font-semibold text-primary">Simulated Matter: </span>
              {selectedPresetId
                ? PRESETS.find((p) => p.id === selectedPresetId)?.summary
                : `Matter in ${category} with ${severity.toLowerCase()} harm, ${vulnerability.toLowerCase()} parties, and ${imbalance.toLowerCase()}.`}
            </div>
          </div>

          {/* Right Column: Live Decision Outcome & Queue Leap Visualizer */}
          <div className="flex flex-col gap-6">
            {/* The Priority Verdict Card */}
            <div
              className="glass-panel overflow-hidden rounded-2xl border p-6 shadow-md transition-all duration-300 sm:p-8"
              style={{
                borderColor: triageResult.borderColor,
                backgroundColor: triageResult.bgTint,
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase"
                  style={{
                    color: triageResult.color,
                    backgroundColor: "var(--background)",
                    border: `1px solid ${triageResult.borderColor}`,
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full animate-ping"
                    style={{ backgroundColor: triageResult.color }}
                  />
                  {triageResult.badgeText}
                </span>
                <span className="text-[0.6875rem] font-medium tracking-wider text-muted-foreground uppercase">
                  Decision Tree Output
                </span>
              </div>

              <div className="mt-6">
                <h4 className="font-display text-2xl font-bold text-foreground">
                  {triageResult.tier} Priority Triage
                </h4>
                <p className="mt-2 text-sm leading-[1.65] text-foreground/80">
                  {triageResult.rationale}
                </p>
              </div>

              {/* Constitutional Article Badge */}
              <div className="mt-6 rounded-xl border border-border/80 bg-background/80 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <Scale className="h-4 w-4" aria-hidden="true" />
                  <span>Constitutional Conscience Engaged</span>
                </div>
                <p className="mt-1 text-xs font-medium text-foreground/90">
                  {triageResult.articleEngaged}
                </p>
              </div>
            </div>

            {/* Side-by-side Docket Queue Leap Comparison */}
            <div className="glass-panel rounded-2xl border border-border/80 p-6 shadow-xs sm:p-8">
              <div className="flex items-center justify-between border-b border-border/70 pb-3">
                <h4 className="font-display text-sm font-semibold text-foreground">
                  Docket Placement Comparison
                </h4>
                <span className="text-[0.6875rem] font-medium tracking-wider text-primary uppercase">
                  Real-World Trajectory
                </span>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Legacy FIFO Queue */}
                <div className="rounded-xl border border-destructive/25 bg-destructive/[0.04] p-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-destructive">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      Legacy Court FIFO
                    </span>
                    <span>Stagnant</span>
                  </div>
                  <p className="font-display mt-3 text-xl font-bold text-foreground/90">
                    {triageResult.legacyQueue}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Estimated Wait:{" "}
                    <span className="font-semibold text-destructive">{triageResult.legacyWait}</span>
                  </p>
                  <div className="mt-3 text-[0.6875rem] text-muted-foreground/80 leading-normal">
                    Suffocated under 4 crore chronological paper filings without urgency audit.
                  </div>
                </div>

                {/* Anavaya Dynamic Priority */}
                <div className="relative overflow-hidden rounded-xl border border-primary/40 bg-primary/[0.08] p-4 shadow-[0_0_20px_-6px_color-mix(in_oklab,var(--primary)_25%,transparent)]">
                  <div className="flex items-center justify-between text-xs font-semibold text-primary">
                    <span className="flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                      Anavaya Engine
                    </span>
                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[0.625rem] text-primary uppercase">
                      Instant Leap
                    </span>
                  </div>
                  <p className="font-display text-gradient-gold mt-3 text-xl font-bold">
                    Position #{triageResult.docketPosition}
                  </p>
                  <p className="mt-1 text-xs font-medium text-foreground">
                    {triageResult.action}
                  </p>
                  <div className="mt-3 text-[0.6875rem] text-primary/90 leading-normal">
                    Escalated directly to the Presiding Bench based on constitutional urgency.
                  </div>
                </div>
              </div>

              {/* Bottom Quick Test Drive Button */}
              <div className="mt-6 flex items-center justify-between border-t border-border/70 pt-4">
                <span className="text-xs text-muted-foreground">
                  Want to test real FIRs and evidence files?
                </span>
                <a
                  href={APP_URL}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-transform hover:translate-x-0.5 hover:text-primary/90"
                >
                  Open Live Dashboard
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
