import { useEffect, useState, type CSSProperties } from "react";
import { useInView } from "./Reveal";
import "./case-flow.css";

const groups = [
  { title: "Criminal", x: 16, y: 88 },
  { title: "Property / Land", x: 268, y: 88 },
  { title: "General Civil", x: 16, y: 214 },
  { title: "Insolvency / Debt", x: 268, y: 214 },
] as const;
const files = [
  { label: "Land title dispute", group: 1, slot: 0 },
  { label: "Robbery complaint", group: 0, slot: 0 },
  { label: "Contract dispute", group: 2, slot: 0 },
  { label: "Homicide report", group: 0, slot: 1 },
  { label: "Bank insolvency petition", group: 3, slot: 0 },
  { label: "Boundary dispute", group: 1, slot: 1 },
] as const;
type Scene = "waiting" | "sorting" | "filed";

export function CaseFlow() {
  const { ref, inView } = useInView<HTMLDivElement>(0.25);
  const [scene, setScene] = useState<Scene>("waiting");
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timers: number[] = [];
    const play = () => {
      timers.forEach(window.clearTimeout);
      timers.length = 0;
      setScene(motion.matches ? "filed" : "waiting");
      if (!motion.matches) {
        timers.push(window.setTimeout(() => setScene("sorting"), 3800));
        timers.push(window.setTimeout(() => setScene("filed"), 6500));
      }
    };
    play();
    motion.addEventListener("change", play);
    return () => { timers.forEach(window.clearTimeout); motion.removeEventListener("change", play); };
  }, [inView, run]);

  return (
    <section aria-labelledby="case-flow-heading" className="border-y border-border bg-secondary/40 px-5 py-16 md:px-10 md:py-24">
      <div ref={ref} className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <h2 id="case-flow-heading" className="heading-section text-foreground">One queue. Different cases.</h2>
          <p className="prose-justify mt-4 max-w-md leading-relaxed text-muted-foreground">Watch six filings arrive in order, then see how Anavaya groups them by legal category.</p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">The Decision Tree weighs category alongside facts such as severity and vulnerability.</p>
        </div>
        <figure className="rounded-xl border border-border bg-card p-3 text-card-foreground sm:p-5">
          <div className="flex items-center justify-between gap-3 border-b border-border px-2 pb-3">
            <figcaption className="font-semibold">{scene === "waiting" ? "1 · Arrival-order queue" : "2 · Anavaya sorts the files"}</figcaption>
            <button type="button" onClick={() => setRun(n => n + 1)} className="case-replay min-h-11 rounded px-2 py-1 text-sm text-primary underline underline-offset-4">Replay</button>
          </div>
          <svg key={run} className="case-flow-board" data-scene={scene} data-started={inView} viewBox="0 0 520 328" role="img" aria-label="Six sample files accumulate in a queue, then move into criminal, property and land, general civil, and insolvency and debt groups.">
            <g className="flow-destinations">
              {groups.map(g => <g key={g.title} transform={`translate(${g.x} ${g.y - 48})`}>
                <rect width="236" height="114" rx="8" fill="var(--secondary)" stroke="var(--border)" />
                <text x="12" y="25" fill="var(--foreground)" fontSize="16" fontWeight="600">{g.title}</text>
              </g>)}
            </g>
            {files.map((file, i) => {
              const group = groups[file.group];
              return <g key={file.label} className="flow-file" style={{
                "--i": i, "--queue-x": (94 + i * 17) + "px", "--queue-y": (36 + i * 34) + "px",
                "--file-x": (group.x + 12) + "px", "--file-y": (group.y - 12 + file.slot * 36) + "px",
              } as CSSProperties}>
                <g className="flow-arrival">
                  <path d="M0 5 Q0 1 4 1 H39 L46 5 H205 Q211 5 211 11 V29 Q211 33 206 33 H5 Q0 33 0 28Z" fill="var(--card)" stroke="var(--primary)" />
                  <text x="10" y="23" fill="var(--muted-foreground)" fontSize="11">{String(i + 1).padStart(2, "0")}</text>
                  <text x="34" y="23" fill="var(--foreground)" fontSize="14">{file.label}</text>
                </g>
              </g>;
            })}
          </svg>
        </figure>
      </div>
    </section>
  );
}
