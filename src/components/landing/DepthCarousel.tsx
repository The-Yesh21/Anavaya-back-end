import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LandingCardContent, type LandingCardData } from "./LandingCardContent";
import "./depth-carousel.css";

export function DepthCarousel({ items, label }: { items: LandingCardData[]; label: string }) {
  const [active, setActive] = useState(0);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const count = items.length;

  function move(step: number) {
    setActive((index) => (index + step + count) % count);
  }

  function finishSwipe(event: PointerEvent<HTMLDivElement>) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;

    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    if (Math.abs(x) > 40 && Math.abs(x) > Math.abs(y) * 1.5) {
      move(x < 0 ? 1 : -1);
    }
  }

  if (!count) return null;

  const controlClass =
    "grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border border-border bg-card text-foreground hover:border-primary focus-visible:outline-2 focus-visible:outline-ring";

  return (
    <div
      className="depth-carousel mt-8 max-w-3xl"
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      onKeyDown={(event) => {
        if (count < 2 || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
        event.preventDefault();
        move(event.key === "ArrowLeft" ? -1 : 1);
      }}
    >
      <div
        className="depth-carousel-stage"
        aria-live="polite"
        onPointerDown={(event) => {
          if (count > 1 && event.isPrimary && event.pointerType !== "mouse") {
            swipeStart.current = { x: event.clientX, y: event.clientY };
          }
        }}
        onPointerUp={finishSwipe}
        onPointerCancel={() => {
          swipeStart.current = null;
        }}
      >
        {items.map((item, index) => {
          const depth = (index - active + count) % count;
          return (
            <div
              key={item.title}
              className="depth-carousel-card flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:gap-6 sm:p-8"
              style={{ "--depth": depth, "--layer": count - depth } as CSSProperties}
              data-depth={depth}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${count}`}
              aria-hidden={depth !== 0}
            >
              <LandingCardContent {...item} />
            </div>
          );
        })}
      </div>

      {count > 1 && (
        <div className="mt-7 flex flex-wrap items-center justify-center sm:gap-x-2">
          <button
            type="button"
            aria-label="Previous card"
            className={controlClass}
            onClick={() => move(-1)}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          {items.map(({ title }, index) => (
            <button
              key={title}
              type="button"
              className="group grid size-8 cursor-pointer place-items-center rounded-full text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-ring aria-[current=true]:text-primary sm:size-9"
              aria-label={`Show ${title}`}
              aria-current={active === index ? true : undefined}
              onClick={() => setActive(index)}
            >
              <span
                className="size-2 rounded-full bg-current group-aria-[current=true]:w-4"
                aria-hidden="true"
              />
            </button>
          ))}
          <button
            type="button"
            aria-label="Next card"
            className={controlClass}
            onClick={() => move(1)}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
