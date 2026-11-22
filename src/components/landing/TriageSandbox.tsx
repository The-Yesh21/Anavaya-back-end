import { useState, useMemo } from "react";
import {
  ArrowRight,
  Clock,
  FileText,
  FileUp,
  Gavel,
  Scale,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Reveal } from "./Reveal";
import { APP_URL } from "./constants";
import { EvidenceUploadLoader } from "../ui/EvidenceUploadLoader";

export type SeverityType = "No Injury" | "Minor" | "Major / Fatal";
export type VulnerabilityType = "Standard / Corporate" | "Impoverished / Undertrial" | "Child / Exploited";
export type ImbalanceType = "Equal Standing" | "Severe Asymmetry";
export type CategoryType = "Criminal / Violent" | "Constitutional / Writ" | "Excise / Tax" | "Property / Land";

interface CasePreset {
  id: string;
  badge: string;
  statutoryTag: string;
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
    statutoryTag: "Sec 363/364A IPC",
    title: "9-Year-Old Child Missing from Public Park (Sec 363/364A IPC · Sec 137 BNS)",
    summary:
      "A minor was abducted from a community playground. CCTV footage shows an unknown individual leading the child away. Immediate investigative triage required before trail goes cold.",
    category: "Criminal / Violent",
    severity: "Major / Fatal",
    vulnerability: "Child / Exploited",
    imbalance: "Severe Asymmetry",
  },
  {
    id: "fatal-violent",
    badge: "Fatal Violent Crime",
    statutoryTag: "Sec 302 IPC / 103 BNS",
    title: "Armed Homicide & Fatal Assault (Sec 302 IPC / Sec 103 BNS)",
    summary:
      "Fatal violent altercation resulting in casualty. Eyewitness depositions recorded; fast-track sessions listing required under BNSS §251 to avert witness intimidation.",
    category: "Criminal / Violent",
    severity: "Major / Fatal",
    vulnerability: "Standard / Corporate",
    imbalance: "Severe Asymmetry",
  },
  {
    id: "pocso-child",
    badge: "POCSO Protection",
    statutoryTag: "Sec 4/6 POCSO",
    title: "Aggravated Minor Exploitation & Abuse (Sections 4 & 6 POCSO Act)",
    summary:
      "Child victim of sexual assault. Section 35 POCSO Act explicitly mandates recording deposition within 30 days and priority bench disposal within 1 year.",
    category: "Criminal / Violent",
    severity: "Major / Fatal",
    vulnerability: "Child / Exploited",
    imbalance: "Severe Asymmetry",
  },
  {
    id: "undertrial-bail",
    badge: "Article 21 Habeas / Bail",
    statutoryTag: "Sec 436A CrPC",
    title: "5 Years Incarceration Without Trial (Hussainara Mandate · Sec 436A CrPC)",
    summary:
      "Impoverished undertrial detained on unproven petty theft charges for 60 consecutive months without a single substantive hearing date.",
    category: "Constitutional / Writ",
    severity: "Major / Fatal",
    vulnerability: "Impoverished / Undertrial",
    imbalance: "Severe Asymmetry",
  },
  {
    id: "gst-commercial",
    badge: "Commercial Fraud & Tax",
    statutoryTag: "Sec 420 IPC / CCA",
    title: "Rs. 45 Lakh Input Tax Credit Discrepancy (Sec 420 IPC / Comm. Courts Act)",
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
    statutoryTag: "Order 39 CPC",
    title: "Agricultural Boundary Injunction Between Adjoining Farmlands (Order 39 CPC)",
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
  const [isEvidenceLoaderOpen, setIsEvidenceLoaderOpen] = useState(false);
  const [extraEvidenceCount, setExtraEvidenceCount] = useState(0);

  // Load a preset
  const handleSelectPreset = (p: CasePreset) => {
    setSelectedPresetId(p.id);
    setCategory(p.category);
    setSeverity(p.severity);
    setVulnerability(p.vulnerability);
    setImbalance(p.imbalance);
  };

  // Determine priority deterministically (mirrors CART decision tree logic & statutory engine)
  const triageResult = useMemo(() => {
    const isFatalOrMajor = severity === "Major / Fatal";
    const isChildOrUndertrial = vulnerability !== "Standard / Corporate";
    const isViolent = category === "Criminal / Violent";
    const isConstitutional = category === "Constitutional / Writ";

    // 1. Compute Priority Tier
    // High Priority Conditions (Articles 21, 23, 24)
    // Severe Power Imbalance acts as a constitutional multiplier under Article 14
    const isHigh =
      isFatalOrMajor ||
      isChildOrUndertrial ||
      isViolent ||
      (imbalance === "Severe Asymmetry" && severity === "Minor");

    const isMedium =
      !isHigh &&
      (severity === "Minor" ||
        isConstitutional ||
        category === "Excise / Tax" ||
        imbalance === "Severe Asymmetry");

    const tier: "High" | "Medium" | "Low" = isHigh
      ? "High"
      : isMedium
      ? "Medium"
      : "Low";

    // 2. Derive Statutory Sections
    let statutory = {
      primary: "Order 39 Rules 1 & 2 CPC · Specific Relief Act §38",
      statute: "Code of Civil Procedure, 1908 & Specific Relief Act, 1963",
      secondary: "Section 53A Transfer of Property Act 1882",
      tag: "Property / Land Injunction",
    };

    if (selectedPresetId === "child-missing") {
      statutory = {
        primary: "Section 363 / 364A IPC · Section 137(2) BNS",
        statute: "Indian Penal Code 1860 / Bharatiya Nyaya Sanhita 2023",
        secondary: "Bachpan Bachao Mandate & CrPC §154 Tracking",
        tag: "Kidnapping / Missing Person",
      };
    } else if (selectedPresetId === "fatal-violent") {
      statutory = {
        primary: "Section 302 IPC / Section 103 BNS",
        statute: "Indian Penal Code 1860 / Bharatiya Nyaya Sanhita 2023",
        secondary: "Code of Criminal Procedure §309 / BNSS §251",
        tag: "Homicide / Fatal Offense",
      };
    } else if (selectedPresetId === "pocso-child") {
      statutory = {
        primary: "Sections 4 & 6 POCSO Act 2012 · Section 376 IPC / Sec 64 BNS",
        statute: "Protection of Children from Sexual Offences Act, 2012",
        secondary: "Mandatory In-Camera Recording (POCSO §35)",
        tag: "Child Protection / Sexual Assault",
      };
    } else if (selectedPresetId === "undertrial-bail") {
      statutory = {
        primary: "Section 436A CrPC / Section 479 BNSS · Article 21",
        statute: "Code of Criminal Procedure 1973 / Bharatiya Nagarik Suraksha Sanhita 2023",
        secondary: "Hussainara Khatoon Directive on Undertrial Liberty",
        tag: "Unconstitutional Incarceration",
      };
    } else if (selectedPresetId === "gst-commercial") {
      statutory = {
        primary: "Section 420 IPC / Commercial Courts Act 2015",
        statute: "Indian Penal Code 1860 & Commercial Courts Act, 2015",
        secondary: "Sections 67 & 132 Central GST Act 2017",
        tag: "Commercial / Fiscal Discrepancy",
      };
    } else if (selectedPresetId === "land-boundary") {
      statutory = {
        primary: "Order 39 Rules 1 & 2 CPC · Specific Relief Act §38",
        statute: "Code of Civil Procedure, 1908 & Specific Relief Act, 1963",
        secondary: "Section 53A Transfer of Property Act 1882",
        tag: "Civil Property Injunction",
      };
    } else {
      // Dynamic computation based on active tactile controls
      if (category === "Criminal / Violent") {
        if (vulnerability === "Child / Exploited") {
          statutory = {
            primary: "Sections 4 & 6 POCSO Act 2012 · Section 363 IPC",
            statute: "Protection of Children from Sexual Offences Act, 2012",
            secondary: "Section 137(2) BNS · Special POCSO Jurisdiction",
            tag: "Child Protection / Bodily Safety",
          };
        } else if (severity === "Major / Fatal") {
          statutory = {
            primary: "Section 302 IPC / Section 103 BNS",
            statute: "Indian Penal Code 1860 / Bharatiya Nyaya Sanhita 2023",
            secondary: "Code of Criminal Procedure §309 / BNSS §251",
            tag: "Fatal / Grievous Violence",
          };
        } else {
          statutory = {
            primary: "Sections 324 & 326 IPC / Sections 117 & 118 BNS",
            statute: "Indian Penal Code 1860 / Bharatiya Nyaya Sanhita 2023",
            secondary: "Cognizable Offense · Bail Verification under CrPC §437",
            tag: "Grievous Hurt / Armed Assault",
          };
        }
      } else if (category === "Constitutional / Writ") {
        if (vulnerability === "Impoverished / Undertrial") {
          statutory = {
            primary: "Section 436A CrPC / Section 479 BNSS · Article 21",
            statute: "Code of Criminal Procedure 1973 / Bharatiya Nagarik Suraksha Sanhita 2023",
            secondary: "Habeas Corpus & Hussainara Speedy Trial Doctrine",
            tag: "Undertrial Personal Liberty",
          };
        } else {
          statutory = {
            primary: "Articles 226 & 227 of the Constitution of India",
            statute: "Constitution of India",
            secondary: "Supervisory High Court Writ Review",
            tag: "Constitutional Remedy",
          };
        }
      } else if (category === "Excise / Tax") {
        statutory = {
          primary: "Section 420 IPC / Commercial Courts Act 2015",
          statute: "Indian Penal Code 1860 & Commercial Courts Act, 2015",
          secondary: "Sections 67 & 132 Central GST Act 2017",
          tag: "Revenue / Commercial Adjudication",
        };
      } else {
        statutory = {
          primary: "Order 39 Rules 1 & 2 CPC · Specific Relief Act §38",
          statute: "Code of Civil Procedure, 1908 & Specific Relief Act, 1963",
          secondary: "Section 53A Transfer of Property Act 1882",
          tag: "Realty Injunction & Boundary Title",
        };
      }
    }

    // 3. Compute Turnaround Time (TAT) & Loss Mitigation Metric
    let tat = {
      summaryBadge: "Within 24-72 Hours · 94% Loss Aversion",
      hearingTarget: "Within 24 to 72 Hours",
      hearingWindow: "24–72 Hours",
      disposalTarget: "30–90 Days Disposal Target",
      lossMitigationRate: "94%",
      lossMitigationLabel: "Loss Aversion",
      riskLevel: "Critical / Irreversible Risk",
      benchmark: "Article 21 Speedy Trial Mandate & Emergency Liberty Bench",
    };

    if (tier === "Medium") {
      tat = {
        summaryBadge: "Within 7-14 Days · 78% Loss Aversion",
        hearingTarget: "Within 7 to 14 Days",
        hearingWindow: "7–14 Days",
        disposalTarget: "90–180 Days Disposal Target",
        lossMitigationRate: "78%",
        lossMitigationLabel: "Loss Aversion",
        riskLevel: "Elevated / Capital Attrition",
        benchmark: "Commercial Courts Act 2015 (§16 Case Management Hearing)",
      };
    } else if (tier === "Low") {
      tat = {
        summaryBadge: "Within 30-60 Days · 45% Loss Aversion",
        hearingTarget: "Within 30 to 60 Days",
        hearingWindow: "30–60 Days",
        disposalTarget: "180–365 Days Disposal Target",
        lossMitigationRate: "45%",
        lossMitigationLabel: "Loss Aversion",
        riskLevel: "Low / Routine Civil Queue",
        benchmark: "National Court Management System (NCMS) Routine Civil Docket",
      };
    }

    // 4. Return Full Verdict Details
    if (tier === "High") {
      const waitDays = category === "Criminal / Violent" ? "7.4 Years" : "5.8 Years";
      const legacyPosition = category === "Criminal / Violent" ? 18420 : 14190;
      return {
        tier,
        statutory,
        tat,
        color: "var(--priority-high)",
        bgTint: "color-mix(in srgb, var(--priority-high) 12%, transparent)",
        borderColor: "color-mix(in srgb, var(--priority-high) 35%, transparent)",
        badgeText: "High Priority · Tier 1",
        queueLeap: "Leaps to Position #1",
        legacyQueue: `#${legacyPosition.toLocaleString()} in line`,
        legacyWait: waitDays,
        docketPosition: 1,
        articleEngaged: isChildOrUndertrial
          ? "Articles 21 & 24 (Right to Life & Child Protection)"
          : imbalance === "Severe Asymmetry"
          ? "Articles 14 & 21 (Procedural Equality & Life Protection)"
          : "Article 21 (Personal Liberty & Speedy Trial Mandate)",
        rationale:
          imbalance === "Severe Asymmetry"
            ? "Severe structural asymmetry detected against an individual litigant. Under Articles 14 and 21, the court invokes Parens Patriae to prevent procedural attrition."
            : "Severe threat to personal liberty or bodily safety. Under the Constitution, the court cannot permit this matter to languish in a chronological paper queue.",
        action: "Scheduled for Immediate Hearing in Next Session",
      };
    }

    if (tier === "Medium") {
      return {
        tier,
        statutory,
        tat,
        color: "var(--priority-medium)",
        bgTint: "color-mix(in srgb, var(--priority-medium) 12%, transparent)",
        borderColor: "color-mix(in srgb, var(--priority-medium) 35%, transparent)",
        badgeText: "Medium Priority · Tier 2",
        queueLeap: "Fast-Track Commercial Calendar",
        legacyQueue: "#11,350 in line",
        legacyWait: "4.2 Years",
        docketPosition: 14,
        articleEngaged:
          imbalance === "Severe Asymmetry"
            ? "Article 14 & Doctrine of Parens Patriae (Equality Before Law)"
            : "Article 19(1)(g) & Article 265 (Trade & Lawful Revenue)",
        rationale:
          imbalance === "Severe Asymmetry"
            ? "Power disparity identified between powerful institutional actor and citizen. Accelerated on supervisory calendar to preserve legal equality."
            : "Economic dispute or non-violent compliance matter. Scheduled on deterministic commercial docket without displacing urgent liberty cases.",
        action: "Routed to Fast-Track Commercial Bench within 14 Days",
      };
    }

    // Low Priority
    return {
      tier,
      statutory,
      tat,
      color: "var(--priority-low)",
      bgTint: "color-mix(in srgb, var(--priority-low) 12%, transparent)",
      borderColor: "color-mix(in srgb, var(--priority-low) 35%, transparent)",
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
  }, [category, severity, vulnerability, imbalance, selectedPresetId]);

  return (
    <section id="triage-sandbox" className="snap-section-loose relative px-6 py-20 md:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal>
          <div className="text-center">
            <span className="eyebrow">Interactive Simulator</span>
            <h2 className="heading-section mx-auto mt-4 max-w-3xl text-foreground">
              Experience the Engine:{" "}
              <span className="text-glass">Watch the Docket Leap</span>
            </h2>
            <p className="body-2 mx-auto mt-4 max-w-2xl text-muted-foreground">
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
                className={`group inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all duration-200 ${
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
                <span>{p.badge}</span>
                <span className="hidden sm:inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[0.625rem] font-normal text-muted-foreground group-hover:text-foreground">
                  {p.statutoryTag}
                </span>
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
              <div className="flex items-center justify-between pb-1">
                <span className="font-semibold text-primary">Simulated Matter:</span>
                <span className="rounded bg-primary/15 px-2 py-0.5 text-[0.625rem] font-semibold text-primary">
                  {triageResult.statutory.primary.split(" · ")[0]}
                </span>
              </div>
              <p className="mt-1 text-foreground/80">
                {selectedPresetId
                  ? PRESETS.find((p) => p.id === selectedPresetId)?.summary
                  : `Matter in ${category} with ${severity.toLowerCase()} harm, ${vulnerability.toLowerCase()} parties, and ${imbalance.toLowerCase()}. Governed under ${triageResult.statutory.primary}.`}
              </p>
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

              {/* Statutory Provisions Card */}
              <div className="mt-5 rounded-xl border border-border/80 bg-background/85 p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    <span>Statutory Sections Engaged</span>
                  </div>
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[0.625rem] font-semibold text-primary uppercase">
                    {triageResult.statutory.tag}
                  </span>
                </div>
                <p className="font-display mt-2 text-sm font-bold text-foreground">
                  {triageResult.statutory.primary}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {triageResult.statutory.statute} · {triageResult.statutory.secondary}
                </p>
              </div>

              {/* Turnaround Time (TAT) & Loss Mitigation Metric */}
              <div className="mt-3 rounded-xl border border-border/80 bg-background/85 p-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    <span>Recommended Turnaround Time (TAT)</span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[0.6875rem] font-bold text-emerald-500">
                    <TrendingUp className="h-3 w-3" aria-hidden="true" />
                    {triageResult.tat.summaryBadge}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
                      Target Hearing Window
                    </span>
                    <p className="font-display text-sm font-bold text-foreground">
                      {triageResult.tat.hearingTarget}
                    </p>
                    <p className="text-[0.6875rem] text-muted-foreground">
                      {triageResult.tat.disposalTarget}
                    </p>
                  </div>

                  <div>
                    <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
                      Loss Mitigation Metric
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-display text-sm font-bold text-emerald-500">
                        {triageResult.tat.lossMitigationRate}
                      </span>
                      <span className="text-xs font-medium text-foreground">
                        {triageResult.tat.lossMitigationLabel}
                      </span>
                    </div>
                    <p className="text-[0.6875rem] text-muted-foreground">
                      {triageResult.tat.riskLevel}
                    </p>
                  </div>
                </div>
              </div>

              {/* Constitutional Article Badge */}
              <div className="mt-3 rounded-xl border border-border/80 bg-background/80 p-4">
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
                <div className="relative overflow-hidden rounded-xl border border-primary/40 bg-surface p-4 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-primary">
                    <span className="flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                      Anavaya Engine
                    </span>
                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[0.625rem] text-primary uppercase">
                      Instant Leap
                    </span>
                  </div>
                  <p className="font-display text-glass-gold mt-3 text-xl font-bold">
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

              {/* Bottom Quick Test Drive Button & Evidence Upload Loader Trigger */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEvidenceLoaderOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary transition-all hover:bg-primary/20 hover:border-primary active:scale-95 shadow-xs cursor-pointer"
                >
                  <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Upload More Evidence to Case</span>
                  {extraEvidenceCount > 0 && (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[0.625rem] text-primary-foreground font-mono font-bold">
                      +{extraEvidenceCount} Attached
                    </span>
                  )}
                </button>

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

      {/* Physics-Based Zero-G Evidence Upload Loader Modal */}
      <EvidenceUploadLoader
        isOpen={isEvidenceLoaderOpen}
        onClose={() => setIsEvidenceLoaderOpen(false)}
        caseTitle={PRESETS.find((p) => p.id === selectedPresetId)?.title || "Active Case Dossier"}
        onComplete={() => setExtraEvidenceCount((prev) => prev + 3)}
      />
    </section>
  );
}
