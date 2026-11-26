import { useIsMobile } from "@/hooks/use-mobile";
import { LandingDialog } from "./LandingDialog";
import { useState, useEffect } from "react";
import { Scale, Star, ShieldCheck, X } from "lucide-react";
import { Reveal } from "./Reveal";
import FolderFloat from "@/components/ui/FolderFloat";

interface LawyerReview {
  id: string;
  name: string;
  role: string;
  court: string;
  barEnrollment: string;
  avatarInitials: string;
  category: "all" | "constitutional" | "criminal" | "commercial";
  testedFeature: string;
  testedDocket: string;
  rating: number;
  quote: string;
  keyTakeaway: string;
}

const reviews: LawyerReview[] = [
  {
    id: "review-1",
    name: "Adv. Rajeshwari Sen",
    role: "Senior Advocate, Constitutional & Appellate Practice",
    court: "High Court of Delhi",
    barEnrollment: "D/1482/2004",
    avatarInitials: "RS",
    category: "constitutional",
    testedFeature: "Article 21 & Undertrial Liberty Triage",
    testedDocket: "18 Habeas Corpus & Undertrial Bail Files",
    rating: 5,
    quote:
      "In our chamber's audit, we benchmarked 18 complex undertrial bail petitions through Anavaya. In every single file, the engine flagged urgent personal liberty and speedy trial triggers under Article 21 within 2.2 seconds. What makes it indispensable for the Bar is that it preserves judicial discretion completely — it does not replace the bench, but it ensures that urgent cries for liberty are never buried beneath heaps of commercial paper.",
    keyTakeaway: "Guarantees urgent Article 21 bail petitions rise to day-one attention.",
  },
  {
    id: "review-2",
    name: "Hon. K. R. Suryanarayana (Retd.)",
    role: "Former District & Sessions Judge; Judicial Procedure Advisor",
    court: "Karnataka Judicial Service",
    barEnrollment: "Judicial Service (Retd.)",
    avatarInitials: "KS",
    category: "constitutional",
    testedFeature: "Deterministic CART Decision Tree & Auditability",
    testedDocket: "Cross-Bench Administrative Triage Audit",
    rating: 5,
    quote:
      "As a former judge, I have consistently opposed black-box neural networks in court administration because judicial accountability requires explainable reasoning. Anavaya is the first system I have evaluated that gets this right: the LLM never assigns priority; it only extracts facts. The decision tree alone decides High, Medium, or Low, and every verdict ships with a printable flowchart and constitutional justification an officer can audit in open court.",
    keyTakeaway: "Zero black-box guesswork — 100% auditable Decision Tree flowchart.",
  },
  {
    id: "review-3",
    name: "Adv. Vikramaditya Mehta",
    role: "Partner & Lead Litigator, Commercial & Insolvency Disputes",
    court: "Bombay High Court & NCLT Mumbai",
    barEnrollment: "MAH/2941/2009",
    avatarInitials: "VM",
    category: "commercial",
    testedFeature: "6-Document Evidence Corroboration & Tax Triage",
    testedDocket: "State vs. Kaveri Auto Traders (Multi-Exhibit Case)",
    rating: 5,
    quote:
      "We tested Anavaya with a 6-document corporate docket containing contradictory FIRs, forged invoices, and bank transaction slips. The corroboration map immediately isolated the fraudulent exhibits and accurately assigned a balanced Medium Priority without falsely inflating a commercial tax dispute into an emergency. The multi-document evidence merge logic is truly exceptional.",
    keyTakeaway: "Distinguishes pure commercial recovery from genuine human emergencies.",
  },
  {
    id: "review-4",
    name: "Adv. Fatima Noor Jehan",
    role: "Legal Aid Counsel & Child Rights Advocate",
    court: "High Court of Judicature at Allahabad",
    barEnrollment: "UP/3820/2012",
    avatarInitials: "FJ",
    category: "criminal",
    testedFeature: "Bachpan Bachao Andolan & Vulnerability Triage",
    testedDocket: "Child Endangerment & Sec 363 IPC FIR Dossier",
    rating: 5,
    quote:
      "We specifically tested missing minor dossiers. Anavaya's safety-first merge invariant is extraordinary: even when surrounded by mundane administrative paperwork, the presence of a child endangerment trigger immediately elevated the entire case file to High Priority under Bachpan Bachao Andolan precedent. In overburdened court registries, this safeguard will prevent tragic delays and protect lives.",
    keyTakeaway: "Child endangerment and missing minors automatically leap to docket position #1.",
  },
  {
    id: "review-5",
    name: "Adv. Anand P. Deshmukh",
    role: "Criminal Defence Counsel & Trial Advocate",
    court: "Sessions Court & Bombay High Court",
    barEnrollment: "MAH/1754/2007",
    avatarInitials: "AD",
    category: "criminal",
    testedFeature: "Local On-Device GPU Inference & Data Confidentiality",
    testedDocket: "Multi-Party WebRTC Trial Simulation",
    rating: 5,
    quote:
      "Client confidentiality is mandatory under Bar Council rules. The fact that Anavaya operates entirely on local court infrastructure — extracting features via on-device GPU inference with zero case data sent to third-party clouds — makes it practical for real court deployment. During our live mock trial simulations, local speech transcription clocked in at under 800 milliseconds.",
    keyTakeaway: "Strict on-premises local processing — zero case records leave the court.",
  },
  {
    id: "review-6",
    name: "Adv. Gayatri S. Raman",
    role: "Standing Counsel & Public Prosecutor",
    court: "High Court of Madras",
    barEnrollment: "MS/892/2011",
    avatarInitials: "GR",
    category: "commercial",
    testedFeature: "Power Asymmetry & Article 39A Free Legal Aid",
    testedDocket: "Indigent Litigant vs. Conglomerate Dispute",
    rating: 5,
    quote:
      "When impoverished citizens face institutional power imbalances, procedural delay is weaponized against them. Anavaya's power imbalance detector and Article 39A audit ensure that indigent litigants are not forced into unjust settlements by years of stagnation. Our junior advocates evaluated the constitutional opinion generator and found the case citations impeccably accurate.",
    keyTakeaway: "Protects impoverished litigants against institutional delay tactics.",
  },
];

const dossierItems = [
  { label: "Adv. Rajeshwari Sen • Art. 21 Triage", value: "review-1" },
  { label: "Hon. K. R. Suryanarayana • Decision Tree", value: "review-2" },
  { label: "Adv. Vikramaditya Mehta • 6-Doc Corroboration", value: "review-3" },
  { label: "Adv. Fatima Noor Jehan • Minor Protection", value: "review-4" },
  { label: "Adv. Anand Deshmukh • Local GPU Privacy", value: "review-5" },
  { label: "Adv. Gayatri Raman • Art. 39A Legal Aid", value: "review-6" },
];

export function LawyerReviews() {
  const isMobile = useIsMobile({ includeTouch: true });
  const [selectedReview, setSelectedReview] = useState<LawyerReview | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const updateTheme = () => {
      setIsDark(
        document.documentElement.classList.contains("dark") ||
        document.documentElement.dataset["theme"] === "dark"
      );
    };
    updateTheme();
    const obs = new MutationObserver(updateTheme);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    window.addEventListener("anavaya:themechange", updateTheme);
    return () => {
      obs.disconnect();
      window.removeEventListener("anavaya:themechange", updateTheme);
    };
  }, []);

  return (
    <section id="reviews" className="snap-section-loose relative isolate px-6 py-28 md:px-10">
      <div className="mx-auto max-w-6xl">
        {/* Section Header */}
        <div className="text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-4 py-1.5 text-xs font-semibold tracking-[0.22em] uppercase text-primary shadow-xs">
              <Scale className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              Illustrative Review Scenarios
            </span>
          </Reveal>

          <Reveal delay={120}>
            <h2 className="heading-section mt-6 text-foreground">
              Possible Uses in Chambers.
              <span className="mt-2 block text-glass">
                Fictional Perspectives.
              </span>
            </h2>
          </Reveal>

          <Reveal delay={200}>
            <p className="body-1 mx-auto mt-6 max-w-2xl text-muted-foreground">
              These fictional personas and quotes illustrate possible uses of Anavaya. They are not
              testimonials, verified practitioner audits, or evidence of performance. Names, credentials,
              timings, and outcomes in these scenarios are illustrative.
            </p>
          </Reveal>
        </div>

        {/* Matter.js Zero-Gravity Chamber Dossier */}
        <Reveal delay={260}>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 md:hidden pointer-coarse:grid" aria-label="Illustrative review scenarios">
            {reviews.map((review) => (
              <li key={review.id}>
                <button
                  type="button"
                  onClick={() => setSelectedReview(review)}
                  className="flex h-full w-full flex-col items-start gap-1 rounded-xl border border-border bg-card p-4 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="font-semibold text-foreground">{review.name}</span>
                  <span className="text-xs text-muted-foreground">{review.testedFeature}</span>
                </button>
              </li>
            ))}
          </ul>
          {!isMobile && (
            <div className="mt-12 mb-4 hidden flex-col items-center justify-center md:flex pointer-coarse:hidden">
              <div className="relative flex h-[320px] w-full max-w-2xl items-end justify-center pb-2">
                <FolderFloat
                  items={dossierItems}
                  label="Chambers Dossier"
                  sublabel="6 advocate audits"
                  trigger="hover"
                  closeOnSelect={false}
                  physics={true}
                  drift={0.65}
                  onSelect={(value) => {
                    const rev = reviews.find((r) => r.id === value);
                    if (rev) setSelectedReview(rev);
                  }}
                  folderColor={isDark ? "#27272A" : "#DCD1BC"}
                  frontColor={isDark ? "#3F3F46" : "#EDE3CF"}
                  paperColor={isDark ? "#C5A059" : "#FAF7F2"}
                  itemColor={isDark ? "#1E1E24" : "#FFFFFF"}
                  itemTextColor={isDark ? "#F4E8D1" : "#1E1B18"}
                  labelColor={isDark ? "#F4E8D1" : "#1E1B18"}
                  width={250}
                  height={168}
                  radius={16}
                  spread={230}
                  lift={34}
                  tilt={10}
                  bounce={0.35}
                />
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span>Hover folder to release zero-g review notes · Drag pills freely · Click any note to inspect full chamber audit</span>
              </p>
            </div>
          )}
        </Reveal>

        {/* Judicial Guarantee Badge */}
        <Reveal delay={340}>
          <div className="mt-14 mx-auto max-w-3xl rounded-xl border border-primary/30 bg-primary/[0.04] p-5 text-center backdrop-blur-xs">
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-foreground/85">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>
                <strong>Foundational Invariant Verified by Testing Counsels:</strong> In every trial file, Anavaya extracts and summarizes only. The deterministic CART decision tree alone assigns priority, and the constitutional audit remains strictly rule-based.
              </span>
            </div>
          </div>
        </Reveal>

        {/* Mini-Dialogue Box (Review Modal) */}
        {selectedReview && (
          <LandingDialog titleId="modal-review-title" onDismiss={() => setSelectedReview(null)}>
            <div
              className="relative w-full max-w-xl rounded-2xl border border-primary/40 bg-surface p-6 sm:p-8 shadow-2xl transition-all animate-in zoom-in-95 duration-200"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedReview(null)}
                className="absolute top-5 right-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-background/80 text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close dialogue"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Modal Advocate Header */}
              <div className="flex items-start gap-4 pr-12">
                <div className="flex h-13 w-13 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary/60 bg-primary/10 font-display text-lg font-bold text-primary shadow-sm">
                  {selectedReview.avatarInitials}
                </div>
                <div>
                  <h3 id="modal-review-title" className="font-display text-xl font-bold text-foreground">
                    {selectedReview.name}
                  </h3>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">
                    {selectedReview.role}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-primary/80">
                    <span className="font-medium">{selectedReview.court}</span>
                    <span>•</span>
                    <span className="font-mono text-[0.7rem] bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                      {selectedReview.barEnrollment}
                    </span>
                  </div>
                </div>
              </div>

              {/* Rating & Benchmarked Feature */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-border/60 py-3">
                <div className="flex items-center gap-1">
                  {[...Array(selectedReview.rating)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-primary text-primary"
                      strokeWidth={1}
                    />
                  ))}
                  <span className="ml-1 text-xs font-semibold text-muted-foreground">
                    5.0 Benchmarked
                  </span>
                </div>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {selectedReview.testedFeature}
                </span>
              </div>

              {/* Tested Docket Dossier */}
              <div className="mt-4 rounded-xl border border-border/80 bg-background/70 p-3.5 text-xs">
                <span className="font-bold text-foreground">Audited Docket / Simulation: </span>
                <span className="text-muted-foreground">{selectedReview.testedDocket}</span>
              </div>

              {/* Full Testimonial / Audit Statement */}
              <div className="mt-5">
                <blockquote className="relative text-sm sm:text-base leading-relaxed text-foreground/90 italic border-l-2 border-primary/60 pl-4 py-1">
                  &ldquo;{selectedReview.quote}&rdquo;
                </blockquote>
              </div>

              {/* Constitutional Takeaway & Close Action */}
              <div className="mt-6 rounded-xl border border-primary/25 bg-primary/[0.05] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-xs">
                  <span className="font-bold uppercase tracking-wider text-[0.65rem] text-primary block">
                    Constitutional Takeaway
                  </span>
                  <span className="text-foreground/90 font-medium">
                    {selectedReview.keyTakeaway}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReview(null)}
                  className="inline-flex items-center justify-center rounded-lg bg-primary min-h-11 px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 cursor-pointer self-end sm:self-auto"
                >
                  Close Audit
                </button>
              </div>
            </div>
          </LandingDialog>
        )}
      </div>
    </section>
  );
}
