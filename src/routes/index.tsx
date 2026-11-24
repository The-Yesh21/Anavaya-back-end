import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/landing/Hero";
import { CaseFlow } from "@/components/landing/CaseFlow";
import { ProblemBand, StatsBar } from "@/components/landing/ProblemStats";
import { TriageSandbox } from "@/components/landing/TriageSandbox";
import { WhyItMatters } from "@/components/landing/WhyItMatters";
import { LawyerReviews } from "@/components/landing/LawyerReviews";
import { Features, TechStack } from "@/components/landing/Features";
import { TechWordmarkShowcase } from "@/components/landing/TechWordmarkShowcase";
import { ClosingCTA, SiteFooter } from "@/components/landing/Closing";
import { PriorityRoadmap } from "@/components/landing/PriorityRoadmap";
import { HowPriorityIsGiven } from "@/components/landing/HowPriorityIsGiven";
import { ModelAccuracy } from "@/components/landing/ModelAccuracy";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { ProgressiveSection } from "@/components/landing/ProgressiveSection";
import { LoadBalancerHud } from "@/components/landing/LoadBalancerHud";

const title = "Anavaya — AI-Powered Judicial Case Priority System";
const description =
  "Behind every case file is a human life on hold. Anavaya ensures that urgent cries for liberty, protection, and justice are never buried in judicial backlogs — triaging cases in seconds, grounded in the Constitution of India.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="relative z-10">
        {/* Above-the-fold Hero loads immediately */}
        <Hero />

        {/* Below-the-fold sections staged sequentially via Load Balancer */}
        <ProgressiveSection id="case-flow" priority={1} minHeight={450} fallbackTitle="Case Flow Analysis">
          <CaseFlow />
        </ProgressiveSection>

        <ProgressiveSection id="problem-band" priority={2} minHeight={400} fallbackTitle="The Judicial Backlog">
          <ProblemBand />
        </ProgressiveSection>

        <ProgressiveSection id="triage-sandbox" priority={3} minHeight={600} fallbackTitle="Interactive Triage Sandbox">
          <TriageSandbox />
        </ProgressiveSection>

        <ProgressiveSection id="stats-bar" priority={4} minHeight={200} fallbackTitle="Constitutional Metrics">
          <StatsBar />
        </ProgressiveSection>

        <ProgressiveSection id="priority-roadmap" priority={5} minHeight={500} fallbackTitle="Triage Lifecycle">
          <PriorityRoadmap />
        </ProgressiveSection>

        <ProgressiveSection id="how-priority-is-given" priority={7} minHeight={500} fallbackTitle="Priority Decision Logic">
          <HowPriorityIsGiven />
        </ProgressiveSection>

        <ProgressiveSection id="model-accuracy" priority={8} minHeight={450} fallbackTitle="Extraction Accuracy">
          <ModelAccuracy />
        </ProgressiveSection>

        <ProgressiveSection id="why-it-matters" priority={9} minHeight={450} fallbackTitle="Why It Matters">
          <WhyItMatters />
        </ProgressiveSection>

        <ProgressiveSection id="lawyer-reviews" priority={10} minHeight={450} fallbackTitle="Bench & Bar Field Audits">
          <LawyerReviews />
        </ProgressiveSection>

        <ProgressiveSection id="features" priority={11} minHeight={500} fallbackTitle="Platform Capabilities">
          <Features />
        </ProgressiveSection>

        <ProgressiveSection id="tech-wordmark" priority={12} minHeight={350} fallbackTitle="Engine Anatomy">
          <TechWordmarkShowcase />
        </ProgressiveSection>

        <ProgressiveSection id="tech-stack" priority={13} minHeight={300} fallbackTitle="Technology Stack">
          <TechStack />
        </ProgressiveSection>

        <ProgressiveSection id="closing-cta" priority={14} minHeight={350} fallbackTitle="Case File Audit">
          <ClosingCTA />
        </ProgressiveSection>

        <ProgressiveSection id="site-footer" priority={15} minHeight={200} fallbackTitle="Anavaya Court Systems">
          <SiteFooter />
        </ProgressiveSection>
      </main>

      {/* Discreet Load Balancer Diagnostics & Telemetry HUD */}
      <LoadBalancerHud />
    </>
  );
}
