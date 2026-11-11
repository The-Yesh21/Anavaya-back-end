import { useState } from "react";
import {
  FileText,
  BrainCircuit,
  SlidersHorizontal,
  GitBranch,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Code2,
  Scale,
  Binary,
  Layers,
  FileCode,
  Terminal,
  AlertCircle,
  HelpCircle,
  TrendingUp,
} from "lucide-react";
import { Reveal } from "./Reveal";

type CaseScenarioId = "child-missing" | "commercial-tax" | "civil-land";

interface CaseScenario {
  id: CaseScenarioId;
  tabLabel: string;
  badge: string;
  title: string;
  court: string;
  rawText: string;
  qwenExtraction: {
    main_parties: string;
    case_category: string;
    crime_type: string;
    severity: string;
    vulnerability: string;
    influence: string;
    plain_summary: string;
  };
  vectorEncoding: {
    feature: string;
    rawValue: string;
    encodedNum: number;
    description: string;
  }[];
  treeDecision: {
    rootSplit: string;
    rootPassed: boolean;
    subSplit: string;
    subPassed: boolean;
    finalSplit?: string;
    finalPassed?: boolean;
    leafPriority: "High" | "Medium" | "Low";
    leafColor: string;
    rationale: string;
    scheduledAction: string;
  };
}

const SCENARIOS: CaseScenario[] = [
  {
    id: "child-missing",
    tabLabel: "1. Child Missing (Sec 363 IPC)",
    badge: "Urgent Criminal & Liberty",
    title: "State v. Unknown (9-Year-Old Minor Abduction)",
    court: "Special POCSO / Sessions Court",
    rawText:
      "FIR No. 412/2026 registered under Section 363 IPC at 19:40 hrs. Complainant states his 9-year-old daughter was abducted from the community playground. Eyewitness CCTV reveals an unidentified adult leading the minor toward a non-registered vehicle. No ransom call received. Immediate tracing and search mandate sought.",
    qwenExtraction: {
      main_parties: "State of Maharashtra vs. Unknown Accused (Victim: 9yo Minor)",
      case_category: "Criminal / Violent",
      crime_type: "Kidnapping / Child Endangerment",
      severity: "Major",
      vulnerability: "High (Minor / Endangered Child)",
      influence: "Low (Indigent Family vs. Unknown Fugitive)",
      plain_summary:
        "Nine-year-old child abducted from a public playground by an unknown individual. Immediate police search operation and judicial surveillance mandate required.",
    },
    vectorEncoding: [
      { feature: "severity_enc", rawValue: "Major", encodedNum: 2, description: "Physical peril / risk to human life" },
      { feature: "vulnerability_enc", rawValue: "High", encodedNum: 2, description: "Minor child under Bachpan Bachao mandate" },
      { feature: "influence_enc", rawValue: "Low", encodedNum: 0, description: "Private victim without state institutional power" },
      { feature: "case_category_enc", rawValue: "Criminal / Violent", encodedNum: 6, description: "Cognizable violent / personal offense" },
      { feature: "crime_type_enc", rawValue: "Violent Offense", encodedNum: 1, description: "Offense against human body & liberty" },
    ],
    treeDecision: {
      rootSplit: "Is Injury Severity > 0.5 (Bodily Peril / Life at Stake)?",
      rootPassed: true,
      subSplit: "Is Vulnerability > 1.5 (Child / Indigent / Exploited Subject)?",
      subPassed: true,
      leafPriority: "High",
      leafColor: "var(--priority-high)",
      rationale:
        "Split matched: Severity = Major (2 > 0.5) and Vulnerability = High (2 > 1.5). Under the Bachpan Bachao Andolan doctrine, every hour of delay multiplies fatal risk.",
      scheduledAction: "Emergency Day-1 Docketing — Scheduled Ahead of 18,400+ Routine Civil Matters",
    },
  },
  {
    id: "commercial-tax",
    tabLabel: "2. Commercial Tax Dispute",
    badge: "Revenue & Commercial",
    title: "Kaveri Auto Traders v. Commissioner of State Taxes",
    court: "Commercial Appellate Division",
    rawText:
      "Writ Petition under Article 226 challenging statutory assessment order dated 14.02.2026 imposing Rs. 45,20,000/- penalty for alleged mismatch in Input Tax Credit (ITC) under Section 16(2) of State GST Act. Petitioner contends reconciliation filings were rejected without personal hearing.",
    qwenExtraction: {
      main_parties: "M/s Kaveri Auto Traders v. Commissioner of State Taxes",
      case_category: "Excise / Tax",
      crime_type: "Financial / Revenue",
      severity: "No Injury",
      vulnerability: "Low (Commercial Entity)",
      influence: "Medium (Tax Authority vs Enterprise)",
      plain_summary:
        "Commercial dispute over Rs. 45.2 Lakh GST input tax credit penalty imposed without adequate personal hearing under Section 16(2).",
    },
    vectorEncoding: [
      { feature: "severity_enc", rawValue: "No Injury", encodedNum: 0, description: "Purely financial / monetary claim without bodily peril" },
      { feature: "vulnerability_enc", rawValue: "Low", encodedNum: 0, description: "Corporate trader with professional legal representation" },
      { feature: "influence_enc", rawValue: "Medium", encodedNum: 1, description: "State tax assessment agency enforcement" },
      { feature: "case_category_enc", rawValue: "Excise / Tax", encodedNum: 0, description: "Statutory revenue and tax assessment" },
      { feature: "crime_type_enc", rawValue: "Non-Violent", encodedNum: 0, description: "Commercial statutory compliance" },
    ],
    treeDecision: {
      rootSplit: "Is Injury Severity > 0.5 (Bodily Peril / Life at Stake)?",
      rootPassed: false,
      subSplit: "Is Vulnerability > 0.5 (Disadvantaged / Undertrial Citizen)?",
      subPassed: false,
      finalSplit: "Is Matter Financial / Tax Authority Imbalance (Influence > 0)?",
      finalPassed: true,
      leafPriority: "Medium",
      leafColor: "var(--priority-medium)",
      rationale:
        "Severity = No Injury (0 <= 0.5) and Vulnerability = Low (0 <= 0.5). However, significant revenue penalty with regulatory state action warrants accelerated revenue bench hearing.",
      scheduledAction: "Expedited Commercial Bench — Scheduled in 14-day hearing block",
    },
  },
  {
    id: "civil-land",
    tabLabel: "3. Civil Boundary Injunction",
    badge: "Routine Civil Dispute",
    title: "Ramappa v. Somanna & Ors. (Survey No. 42/B Injunction)",
    court: "Junior Civil Court / Munsiff",
    rawText:
      "Original Civil Suit for permanent prohibitory injunction restraining defendants from erecting a stone boundary wall across agricultural partition pathway in Survey No. 42/B measuring 1.2 acres. No interim violence reported; peaceful status-quo maintained by village panchayat.",
    qwenExtraction: {
      main_parties: "Ramappa s/o Hanumantappa v. Somanna & Ors.",
      case_category: "Property / Land",
      crime_type: "Civil Property",
      severity: "No Injury",
      vulnerability: "Low (Equally Landed Private Parties)",
      influence: "Low (Private Neighbor Dispute)",
      plain_summary:
        "Civil partition suit seeking permanent injunction to prevent boundary fence construction along 1.2-acre agricultural land pathway.",
    },
    vectorEncoding: [
      { feature: "severity_enc", rawValue: "No Injury", encodedNum: 0, description: "Zero physical harm, threat, or criminal element" },
      { feature: "vulnerability_enc", rawValue: "Low", encodedNum: 0, description: "Private landowners with agricultural holdings" },
      { feature: "influence_enc", rawValue: "Low", encodedNum: 0, description: "Equal standing between private civil litigants" },
      { feature: "case_category_enc", rawValue: "Property / Land", encodedNum: 5, description: "Private civil immovable property partition" },
      { feature: "crime_type_enc", rawValue: "Non-Violent", encodedNum: 0, description: "Routine non-violent civil adjudication" },
    ],
    treeDecision: {
      rootSplit: "Is Injury Severity > 0.5 (Bodily Peril / Life at Stake)?",
      rootPassed: false,
      subSplit: "Is Vulnerability > 0.5 (Disadvantaged / Undertrial Citizen)?",
      subPassed: false,
      finalSplit: "Is Matter Financial / Tax Authority Imbalance (Influence > 0)?",
      finalPassed: false,
      leafPriority: "Low",
      leafColor: "var(--priority-low)",
      rationale:
        "Severity = No Injury (0 <= 0.5), Vulnerability = Low (0 <= 0.5), and Influence = Equal (0 <= 0). No liberty, constitutional violation, or bodily threat exists.",
      scheduledAction: "Standard Civil Calendar — Scheduled for regular framing of issues",
    },
  },
];

const STEPS = [
  {
    num: "01",
    icon: FileText,
    name: "Legal Dossier Ingestion",
    engine: "PyMuPDF High-Res Parser",
    summary:
      "Raw legal PDF documents (police FIRs, charge sheets, commercial petitions, bail motions) are ingested and decomposed into structured text layers, preserving section citations, dates, and party designations.",
    highlight: "100% On-Premise · Clean Text Extraction · Strips Formatting Artifacts",
  },
  {
    num: "02",
    icon: BrainCircuit,
    name: "Semantic Fact Extraction",
    engine: "Local Ollama · Qwen 2.5 (3B)",
    summary:
      "A locally-hosted, offline LLM reads the legal narrative as a judicial clerk. It extracts 5 discrete legal attributes: Injury Severity, Party Vulnerability, Influence Imbalance, Category, and Plain Summary.",
    highlight: "Strict Invariant: The LLM NEVER predicts priority — it outputs structured JSON only.",
  },
  {
    num: "03",
    icon: SlidersHorizontal,
    name: "Keyword Normalization & Tuning",
    engine: "Deterministic Rule Classifier",
    summary:
      "Extracted parameters are tuned by deterministic keyword normalization rules (checking POCSO, Article 21, IPC sections, financial thresholds). Categorical terms are encoded into numeric feature vectors.",
    highlight: "tune_case_features() · Scikit-Learn LabelEncoders · Discrete Vectorization",
  },
  {
    num: "04",
    icon: GitBranch,
    name: "CART Decision Tree Triage",
    engine: "White-Box Scikit-Learn CART",
    summary:
      "The numeric vector navigates the trained CART Decision Tree. Binary branch splits evaluate legal thresholds, terminating at an auditable leaf node that assigns High, Medium, or Low priority.",
    highlight: "100% Deterministic · Mathematically Explainable · Generates Audit Graph",
  },
];

export function HowPriorityIsGiven() {
  const [activeScenarioId, setActiveScenarioId] = useState<CaseScenarioId>("child-missing");
  const [activeStepTab, setActiveStepTab] = useState<number>(0);

  const scenario: CaseScenario =
    SCENARIOS.find((s) => s.id === activeScenarioId) ?? (SCENARIOS[0] as CaseScenario);

  return (
    <section id="how-priority-is-given" className="snap-section relative px-6 py-24 md:px-10">
      <div className="mx-auto w-full max-w-6xl">
        {/* Section Header */}
        <Reveal>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="eyebrow">Triage Mechanism</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.08] px-3 py-0.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Two-Engine Architecture
            </span>
          </div>
          <h2 className="font-display mt-4 max-w-3xl text-4xl sm:text-5xl font-bold tracking-tight">
            How the priority is given by the <em className="emphasis">model</em>
          </h2>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground leading-relaxed">
            Courts cannot afford black-box AI guessing people's liberties. Anavaya pairs the natural-language comprehension of a local LLM with the 100% deterministic, auditable rules of a CART Decision Tree.
          </p>
        </Reveal>

        {/* Founding Invariant Banner */}
        <Reveal delay={100} className="mt-8">
          <div className="glass-panel relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-gradient-to-r from-primary/[0.08] via-surface to-primary/[0.04] p-5 sm:p-6 shadow-[0_8px_30px_-10px_color-mix(in_oklab,var(--primary)_20%,transparent)]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <span className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-primary/50 bg-primary/15 text-primary shadow-xs">
                <Scale className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-base font-bold text-foreground">
                    The Founding Judicial Invariant
                  </span>
                  <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[0.7rem] font-bold tracking-wider uppercase text-primary">
                    Non-Negotiable Rule
                  </span>
                </div>
                <p className="mt-1 text-sm sm:text-[0.9375rem] text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">The LLM never decides priority.</strong> Local Ollama (Qwen 2.5) extracts and summarizes legal facts only. The <strong className="text-foreground">CART Decision Tree alone</strong> evaluates the mathematical feature splits to assign High, Medium, or Low priority. Every verdict is 100% deterministic, repeatable, and auditable by a judge under the Indian Evidence Act.
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 4-Stage Architectural Pipeline */}
        <div className="mt-14">
          <Reveal delay={150}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Pipeline Walkthrough</p>
                <h3 className="font-display mt-1 text-2xl font-bold">The 4-Step Journey from Case PDF to Calendar Verdict</h3>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Layers className="h-3.5 w-3.5 text-primary" /> Step-by-step verified
              </span>
            </div>
          </Reveal>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <Reveal key={step.num} delay={200 + idx * 75}>
                  <div className="glass-panel group relative flex h-full flex-col justify-between rounded-xl border border-border/80 bg-surface/60 p-5 transition-all duration-300 hover:border-primary/60 hover:bg-surface hover:shadow-lg">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-primary/80">STEP {step.num}</span>
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/[0.08] text-primary transition-transform duration-300 group-hover:scale-110">
                          <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                        </span>
                      </div>
                      <h4 className="font-display mt-3 text-lg font-bold text-foreground">{step.name}</h4>
                      <p className="mt-0.5 font-mono text-[0.75rem] font-semibold text-primary/90">{step.engine}</p>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{step.summary}</p>
                    </div>
                    <div className="mt-4 border-t border-border/50 pt-3">
                      <span className="text-[0.7rem] font-medium text-foreground/80">{step.highlight}</span>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>

        {/* Interactive "Trace a Case" Real Inspection Terminal */}
        <div className="mt-16">
          <Reveal delay={250}>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Interactive Inspection</p>
                <h3 className="font-display mt-1 text-2xl sm:text-3xl font-bold">
                  Live Case Trace: Watch the Model Assign Priority
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Select a legal dispute scenario below to trace how raw text converts into Ollama features, vectorized numbers, and the final Decision Tree branch.
                </p>
              </div>

              {/* Scenario Switcher Tabs */}
              <div className="inline-flex rounded-xl border border-border bg-surface-strong/50 p-1">
                {SCENARIOS.map((sc) => {
                  const active = sc.id === activeScenarioId;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setActiveScenarioId(sc.id)}
                      className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                        active
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {sc.badge}
                    </button>
                  );
                })}
              </div>
            </div>
          </Reveal>

          {/* Interactive Inspection Workspace Card */}
          <div className="glass-panel mt-6 overflow-hidden rounded-2xl border border-border/80 bg-surface/80 shadow-xl">
            {/* Case Header Meta */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-surface-strong/30 px-6 py-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[0.75rem] font-bold text-primary">
                  {scenario.court}
                </span>
                <h4 className="font-display mt-1 text-lg font-bold text-foreground">{scenario.title}</h4>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Computed Priority:</span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-xs"
                  style={{
                    backgroundColor: `color-mix(in oklab, ${scenario.treeDecision.leafColor} 18%, transparent)`,
                    color: scenario.treeDecision.leafColor,
                    borderColor: scenario.treeDecision.leafColor,
                    borderWidth: "1px",
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: scenario.treeDecision.leafColor }}
                  />
                  {scenario.treeDecision.leafPriority} Priority
                </span>
              </div>
            </div>

            {/* Stepper Stage Tabs */}
            <div className="border-b border-border/60 bg-surface/50 px-6 pt-3">
              <div className="flex gap-2 overflow-x-auto pb-3">
                {[
                  { idx: 0, label: "1. Raw Case Brief", icon: FileText },
                  { idx: 1, label: "2. Ollama Qwen Extraction", icon: BrainCircuit },
                  { idx: 2, label: "3. Vector Normalization", icon: Binary },
                  { idx: 3, label: "4. Decision Tree Verdict", icon: GitBranch },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = activeStepTab === tab.idx;
                  return (
                    <button
                      key={tab.idx}
                      type="button"
                      onClick={() => setActiveStepTab(tab.idx)}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                        active
                          ? "border-primary bg-primary/15 text-primary shadow-xs"
                          : "border-border/60 bg-surface hover:border-border hover:text-foreground text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stage Body Details */}
            <div className="p-6">
              {/* Tab 0: Raw Case Text */}
              {activeStepTab === 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-primary" /> INGESTION LAYER · TEXT EXTRACT
                    </span>
                    <span>Preserved Legal Syntax</span>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/60 p-4 font-mono text-xs sm:text-[0.8125rem] leading-relaxed text-foreground/90">
                    <p>{scenario.rawText}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground pt-2">
                    <span>Cleaned via PyMuPDF · Whitespace &amp; punctuation normalized</span>
                    <button
                      type="button"
                      onClick={() => setActiveStepTab(1)}
                      className="inline-flex cursor-pointer items-center gap-1 text-primary font-semibold hover:underline"
                    >
                      Next: See Qwen 2.5 Extraction <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 1: Ollama Qwen Structured JSON */}
              {activeStepTab === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono flex items-center gap-1.5">
                      <Code2 className="h-3.5 w-3.5 text-primary" /> LOCAL OLLAMA INFERENCE · JSON OUTPUT
                    </span>
                    <span className="text-primary font-semibold">Strict Rule: Zero Priority Output</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-border/70 bg-background/80 p-4 font-mono text-xs text-foreground/90">
                    <pre className="whitespace-pre-wrap">
{`{
  "main_parties": "${scenario.qwenExtraction.main_parties}",
  "case_category": "${scenario.qwenExtraction.case_category}",
  "crime_type": "${scenario.qwenExtraction.crime_type}",
  "severity": "${scenario.qwenExtraction.severity}",
  "vulnerability": "${scenario.qwenExtraction.vulnerability}",
  "influence": "${scenario.qwenExtraction.influence}",
  "plain_summary": "${scenario.qwenExtraction.plain_summary}"
}`}
                    </pre>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground pt-2">
                    <span>Prompt-constrained JSON schema · Executed on GPU in ~1.2 seconds</span>
                    <button
                      type="button"
                      onClick={() => setActiveStepTab(2)}
                      className="inline-flex cursor-pointer items-center gap-1 text-primary font-semibold hover:underline"
                    >
                      Next: See Vector Normalization <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 2: Vector Normalization */}
              {activeStepTab === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono flex items-center gap-1.5">
                      <Binary className="h-3.5 w-3.5 text-primary" /> tune_case_features() · DISCRETE ENCODING
                    </span>
                    <span>Ready for CART Matrix Input</span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border/70">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border/70 bg-surface-strong/40 font-mono text-muted-foreground">
                        <tr>
                          <th className="p-3">Feature Name</th>
                          <th className="p-3">Extracted Label</th>
                          <th className="p-3">Discrete Vector (x_i)</th>
                          <th className="p-3 hidden sm:table-cell">Statutory Normalization Rule</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 bg-background/50 font-mono">
                        {scenario.vectorEncoding.map((v) => (
                          <tr key={v.feature} className="hover:bg-surface/50">
                            <td className="p-3 font-semibold text-primary">{v.feature}</td>
                            <td className="p-3 text-foreground">{v.rawValue}</td>
                            <td className="p-3">
                              <span className="inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 font-bold text-primary">
                                {v.encodedNum}
                              </span>
                            </td>
                            <td className="p-3 text-muted-foreground hidden sm:table-cell font-sans">
                              {v.description}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground pt-2">
                    <span>Mathematical input vector $X = [{scenario.vectorEncoding.map((v) => v.encodedNum).join(", ")}]$</span>
                    <button
                      type="button"
                      onClick={() => setActiveStepTab(3)}
                      className="inline-flex cursor-pointer items-center gap-1 text-primary font-semibold hover:underline"
                    >
                      Next: See Decision Tree Branching <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 3: CART Decision Tree Verdict */}
              {activeStepTab === 3 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono flex items-center gap-1.5">
                      <GitBranch className="h-3.5 w-3.5 text-primary" /> CART DECISION TREE · EXPLAINABLE TRAVERSAL
                    </span>
                    <span>Model: priority_classifier.pkl</span>
                  </div>

                  {/* Flowchart Steps */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    {/* Node 1 */}
                    <div
                      className={`rounded-xl border p-4 transition-all duration-300 ${
                        scenario.treeDecision.rootPassed
                          ? "border-primary/60 bg-primary/[0.08]"
                          : "border-border/80 bg-surface/50"
                      }`}
                    >
                      <span className="font-mono text-[0.7rem] uppercase text-muted-foreground">Decision Node 0</span>
                      <p className="font-display mt-1 text-sm font-bold text-foreground">
                        {scenario.treeDecision.rootSplit}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                            scenario.treeDecision.rootPassed
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {scenario.treeDecision.rootPassed ? "Branch Taken: YES (True)" : "Branch Taken: NO (False)"}
                        </span>
                      </div>
                    </div>

                    {/* Node 2 */}
                    <div
                      className={`rounded-xl border p-4 transition-all duration-300 ${
                        scenario.treeDecision.subPassed
                          ? "border-primary/60 bg-primary/[0.08]"
                          : "border-border/80 bg-surface/50"
                      }`}
                    >
                      <span className="font-mono text-[0.7rem] uppercase text-muted-foreground">Decision Node 1</span>
                      <p className="font-display mt-1 text-sm font-bold text-foreground">
                        {scenario.treeDecision.subSplit}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                            scenario.treeDecision.subPassed
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {scenario.treeDecision.subPassed ? "Branch Taken: YES (True)" : "Branch Taken: NO (False)"}
                        </span>
                      </div>
                    </div>

                    {/* Leaf Node */}
                    <div
                      className="rounded-xl border p-4 shadow-sm"
                      style={{
                        borderColor: scenario.treeDecision.leafColor,
                        backgroundColor: `color-mix(in oklab, ${scenario.treeDecision.leafColor} 12%, transparent)`,
                      }}
                    >
                      <span className="font-mono text-[0.7rem] uppercase font-bold text-foreground/80">
                        Final Leaf Node
                      </span>
                      <p className="font-display mt-1 text-lg font-bold" style={{ color: scenario.treeDecision.leafColor }}>
                        {scenario.treeDecision.leafPriority} Priority
                      </p>
                      <div className="mt-2 text-xs text-foreground/90 font-medium">
                        {scenario.treeDecision.scheduledAction}
                      </div>
                    </div>
                  </div>

                  {/* Judicial Rationale Box */}
                  <div className="rounded-xl border border-border/80 bg-surface-strong/30 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                      <ShieldCheck className="h-4 w-4" /> Constitutional &amp; Mathematical Rationale
                    </div>
                    <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {scenario.treeDecision.rationale}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Why Hybrid Architecture Wins: 3-Way Comparison Matrix */}
        <div className="mt-16">
          <Reveal delay={300}>
            <div className="text-center">
              <p className="eyebrow">Architectural Comparison</p>
              <h3 className="font-display mt-2 text-2xl sm:text-3xl font-bold">
                Why Hybrid AI + Decision Tree Beats Pure LLM
              </h3>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
                Judicial priority is a matter of constitutional law and human rights. Here is why Anavaya’s architecture was deliberately chosen over raw generative AI.
              </p>
            </div>
          </Reveal>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {/* Flawed Way: Pure LLM */}
            <Reveal delay={350}>
              <div className="glass-panel flex h-full flex-col justify-between rounded-xl border border-destructive/30 bg-destructive/[0.03] p-6">
                <div>
                  <div className="inline-flex rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive">
                    Pure Generative LLM
                  </div>
                  <h4 className="font-display mt-3 text-lg font-bold text-foreground">Stochastic &amp; Opaque</h4>
                  <ul className="mt-4 space-y-2.5 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-destructive font-bold">✕</span>
                      <span><strong>Hallucination risk:</strong> Can invent non-existent precedents or misinterpret urgency.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive font-bold">✕</span>
                      <span><strong>Non-deterministic:</strong> Identical case file can yield "High" on Monday and "Low" on Wednesday.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive font-bold">✕</span>
                      <span><strong>Inadmissible in court:</strong> Black-box neural activations cannot be mathematically audited under the Evidence Act.</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-6 border-t border-destructive/20 pt-3 text-[0.7rem] text-destructive font-semibold">
                  Unsuitable for sovereign judicial scheduling
                </div>
              </div>
            </Reveal>

            {/* Brittle Way: Pure Regex / Rule Engine */}
            <Reveal delay={400}>
              <div className="glass-panel flex h-full flex-col justify-between rounded-xl border border-border/80 bg-surface/50 p-6">
                <div>
                  <div className="inline-flex rounded-lg border border-border bg-surface-strong px-2.5 py-1 text-xs font-bold text-muted-foreground">
                    Pure Regex / Keyword Engine
                  </div>
                  <h4 className="font-display mt-3 text-lg font-bold text-foreground">Rigid &amp; Fragile</h4>
                  <ul className="mt-4 space-y-2.5 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 font-bold">!</span>
                      <span><strong>Blind to phrasing:</strong> Fails when legal complaints use regional dialects or colloquial police shorthand.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 font-bold">!</span>
                      <span><strong>Negation blind:</strong> Triggers false alarms on phrases like <em>"no grievous injury occurred"</em>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 font-bold">!</span>
                      <span><strong>Zero narrative synthesis:</strong> Cannot discern whether an indigent person is the victim or the claimant.</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-6 border-t border-border/60 pt-3 text-[0.7rem] text-muted-foreground font-semibold">
                  Fails on real-world messy courtroom binders
                </div>
              </div>
            </Reveal>

            {/* Anavaya Way: Hybrid Architecture */}
            <Reveal delay={450}>
              <div className="glass-panel relative flex h-full flex-col justify-between rounded-xl border-2 border-primary/50 bg-gradient-to-b from-primary/[0.08] to-surface p-6 shadow-md">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">
                    <ShieldCheck className="h-3.5 w-3.5" /> Anavaya Hybrid Pipeline
                  </div>
                  <h4 className="font-display mt-3 text-lg font-bold text-foreground">LLM Reader + CART Verifier</h4>
                  <ul className="mt-4 space-y-2.5 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span><strong className="text-foreground">Rich semantic reading:</strong> Local Ollama extracts nuanced facts from complex FIRs and petitions.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span><strong className="text-foreground">100% Deterministic:</strong> The CART Decision Tree guarantees identical cases always walk the exact same path.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span><strong className="text-foreground">Auditable in court:</strong> Generates a full mathematical DOT/Mermaid decision path for the Presiding Judge.</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-6 border-t border-primary/30 pt-3 text-[0.7rem] text-primary font-bold">
                  Certified for judicial accountability &amp; Article 21
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
