import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/landing/Hero";
import { ProblemBand, StatsBar } from "@/components/landing/ProblemStats";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { WhyItMatters } from "@/components/landing/WhyItMatters";
import { Features, TechStack } from "@/components/landing/Features";
import { ClosingCTA, SiteFooter } from "@/components/landing/Closing";
import { PriorityRoadmap } from "@/components/landing/PriorityRoadmap";
import { ThemeToggle } from "@/components/landing/ThemeToggle";


const title = "Anavaya — AI-Powered Judicial Case Priority System";
const description =
  "Anavaya triages FIRs, complaints, and court documents into High, Medium, and Low priority in seconds — deterministic, auditable, and grounded in the Constitution of India.";

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
      <ThemeToggle />
      <main className="relative z-10">
        <Hero />
        <ProblemBand />
        <StatsBar />
        <HowItWorks />
        <PriorityRoadmap />
        <WhyItMatters />
        <Features />
        <TechStack />
        <ClosingCTA />
        <SiteFooter />
      </main>
    </>
  );
}

