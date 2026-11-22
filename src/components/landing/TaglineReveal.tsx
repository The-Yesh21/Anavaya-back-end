import { useEffect, useRef, useState } from "react";

const TAGLINE =
  "When judicial delay puts liberty on hold, Anavaya restores speed, auditability, and constitutional certainty to every case on the docket.";

export function TaglineReveal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const words = TAGLINE.split(" ");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      setProgress(1);
      return;
    }

    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        // Start activating when top enters 75% of viewport, reach 100% when center is at 45%
        const start = windowHeight * 0.75;
        const end = windowHeight * 0.35;
        const raw = (start - rect.top) / (start - end);
        const clamped = Math.max(0, Math.min(1, raw));
        setProgress(clamped);
        rafId = null;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <section
      ref={containerRef}
      className="snap-section relative px-6 py-28 md:px-10"
      aria-label="Core Benefit Statement"
    >
      <div className="mx-auto max-w-4xl text-center">
        <p className="eyebrow mb-6">Constitutional Mandate</p>
        <h2 className="heading-hero leading-[0.92] max-w-[780px] mx-auto text-balance">
          {words.map((word, idx) => {
            const wordThreshold = idx / words.length;
            const isActive = progress >= wordThreshold;
            return (
              <span
                key={`${word}-${idx}`}
                className="inline-block mr-[0.28em] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  color: isActive ? "var(--foreground)" : "var(--foreground)",
                  opacity: isActive ? 1 : 0.28,
                  transform: isActive ? "translateY(0)" : "translateY(4px)",
                }}
              >
                {word}
              </span>
            );
          })}
        </h2>
        <p className="mt-8 text-sm font-medium text-muted-foreground tracking-wide">
          Articles 21 &amp; 14 · Rule-Based Constitutional Engine · Zero Black-Box Guesswork
        </p>
      </div>
    </section>
  );
}
