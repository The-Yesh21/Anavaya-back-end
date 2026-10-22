import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/landing/Hero";
import { ProblemBand, StatsBar } from "@/components/landing/ProblemStats";
import { WhyItMatters } from "@/components/landing/WhyItMatters";
import { Features, TechStack } from "@/components/landing/Features";
import { ClosingCTA, SiteFooter } from "@/components/landing/Closing";
import { PriorityRoadmap } from "@/components/landing/PriorityRoadmap";
import { ModelAccuracy } from "@/components/landing/ModelAccuracy";
import { SiteHeader } from "@/components/landing/SiteHeader";

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
        <Hero />
        <ProblemBand />
        <StatsBar />
        <PriorityRoadmap />
        <ModelAccuracy />
        <WhyItMatters />
        <Features />
        <TechStack />
        <ClosingCTA />
        <SiteFooter />
      </main>
    </>
  );
}

