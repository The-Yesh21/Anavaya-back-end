import { Eye, ShieldCheck, UserCheck } from "lucide-react";
import { Reveal } from "./Reveal";
import { DepthCarousel } from "./DepthCarousel";

const safeguards = [
  {
    icon: UserCheck,
    title: "Judicial oversight",
    text: "The workbench supports triage. The bench retains discretion over each case.",
  },
  {
    icon: Eye,
    title: "Reviewable decisions",
    text: "Each result includes the rules the Decision Tree applied and the constitutional analysis.",
  },
  {
    icon: ShieldCheck,
    title: "Local processing",
    text: "The live backend processes case evidence on the host machine.",
  },
];

export function WhyItMatters() {
  return (
    <section id="why" className="px-6 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2 className="heading-section text-foreground">Judicial oversight and privacy</h2>
          <p className="body-2 prose-justify mt-4 max-w-xl text-muted-foreground">
            Court staff can review how Anavaya reached a priority before acting on it. The case
            record brings together the underlying evidence, the decision path, and the report.
          </p>
        </Reveal>
        <DepthCarousel items={safeguards} label="Judicial oversight and privacy" />
      </div>
    </section>
  );
}
