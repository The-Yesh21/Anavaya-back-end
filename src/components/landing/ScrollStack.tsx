import { useEffect, useRef, type CSSProperties } from "react";
import { LandingCardContent, type LandingCardData } from "./LandingCardContent";
import "./scroll-stack.css";

export function ScrollStack({ items, label }: { items: LandingCardData[]; label: string }) {
  const stackRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const stack = stackRef.current;
    if (!stack) return;

    const slots = Array.from(stack.children);
    const motion = window.matchMedia(
      "(prefers-reduced-motion: no-preference) and (min-height: 34rem)",
    );
    let frame = 0;

    function update() {
      frame = 0;
      if (!motion.matches) return;

      const bounds = slots.map((slot) => slot.getBoundingClientRect());
      let depth = 0;
      // The incoming card's overlap determines how much the earlier cards recede.
      for (let index = slots.length - 2; index >= 0; index--) {
        const current = bounds[index]!;
        const next = bounds[index + 1]!;
        const overlap = Math.max(
          0,
          Math.min(1, (current.bottom - next.top) / (current.height * 0.9)),
        );
        depth += overlap;
        slots[index]?.firstElementChild?.setAttribute(
          "style",
          `--stack-scale: ${Math.max(0.88, 1 - depth * 0.035).toFixed(3)}; --stack-dim: ${Math.min(0.2, depth * 0.065).toFixed(3)}`,
        );
      }
    }

    function schedule() {
      if (motion.matches && !frame) frame = window.requestAnimationFrame(update);
    }

    const observer = new ResizeObserver(schedule);
    observer.observe(stack);
    window.addEventListener("scroll", schedule, { passive: true });
    motion.addEventListener("change", schedule);
    schedule();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      motion.removeEventListener("change", schedule);
      window.cancelAnimationFrame(frame);
    };
  }, [items]);

  return (
    <ul
      ref={stackRef}
      aria-label={label}
      className="scroll-stack mt-8 grid max-w-3xl list-none gap-4"
    >
      {items.map((item, index) => (
        <li
          className="scroll-stack-slot"
          key={item.title}
          style={{ "--stack-index": index } as CSSProperties}
        >
          <div className="scroll-stack-card relative flex h-full items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:gap-6 sm:p-8">
            <LandingCardContent {...item} />
          </div>
        </li>
      ))}
    </ul>
  );
}
