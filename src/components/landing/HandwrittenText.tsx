import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useInView } from "./Reveal";
import { cn } from "@/lib/utils";

interface HandwrittenTextProps {
  text?: string;
  delay?: number;
  charSpeed?: number;
  className?: string;
  showNib?: boolean;
  showFlourish?: boolean;
}

export function HandwrittenText({
  text = "Anavaya sorts it.",
  delay = 280,
  charSpeed = 82,
  className,
  showNib = true,
  showFlourish = true,
}: HandwrittenTextProps) {
  const chars = useMemo(() => text.split(""), [text]);
  const { ref: containerRef, inView } = useInView<HTMLSpanElement>(0.2);

  const [visibleCount, setVisibleCount] = useState(0);
  const [isWriting, setIsWriting] = useState(false);
  const [isFlourishing, setIsFlourishing] = useState(false);
  const [flourishDone, setFlourishDone] = useState(false);
  const [nibPos, setNibPos] = useState({ x: 0, y: 0, visible: false });
  const [key, setKey] = useState(0); // For clean replays

  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  const replay = useCallback(() => {
    setVisibleCount(0);
    setIsWriting(false);
    setIsFlourishing(false);
    setFlourishDone(false);
    setNibPos({ x: 0, y: 0, visible: false });
    setKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!inView) return;

    // Honor prefers-reduced-motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisibleCount(chars.length);
      setFlourishDone(true);
      return;
    }

    let timeoutId: number | undefined;
    let intervalId: number | undefined;

    // Initial delay before pen touches the paper
    timeoutId = window.setTimeout(() => {
      setIsWriting(true);
      setNibPos({ x: 0, y: 0, visible: true });

      let current = 0;
      intervalId = window.setInterval(() => {
        current += 1;
        setVisibleCount(current);

        // Update nib position based on the character just written
        const charEl = charRefs.current[current - 1];
        const wrapEl = wrapRef.current;
        if (charEl && wrapEl) {
          const wrapRect = wrapEl.getBoundingClientRect();
          const charRect = charEl.getBoundingClientRect();
          const x = charRect.right - wrapRect.left;
          // Position tip at the letter's baseline with subtle writing oscillation
          const y = (charRect.bottom - wrapRect.top) - (charRect.height * 0.15) + (Math.sin(current * 1.8) * 1.5);
          setNibPos({ x, y, visible: true });
        }

        if (current >= chars.length) {
          window.clearInterval(intervalId);
          setIsWriting(false);

          // Begin flourish underline
          if (showFlourish) {
            window.setTimeout(() => {
              setIsFlourishing(true);

              // Glide nib along the flourish path
              const wrapEl = wrapRef.current;
              const totalWidth = wrapEl ? wrapEl.offsetWidth : 280;
              const totalHeight = wrapEl ? wrapEl.offsetHeight : 60;
              setNibPos({ x: totalWidth + 12, y: totalHeight + 10, visible: true });

              window.setTimeout(() => {
                setIsFlourishing(false);
                setFlourishDone(true);
                // Lift nib and fade out
                setNibPos((prev) => ({ ...prev, y: prev.y - 18, visible: false }));
              }, 620);
            }, 120);
          } else {
            setNibPos((prev) => ({ ...prev, visible: false }));
          }
        }
      }, charSpeed);
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [inView, chars.length, charSpeed, delay, key, showFlourish]);

  return (
    <span
      ref={containerRef}
      className={cn(
        "group/handwrite relative inline-block font-serif italic font-normal tracking-wide select-none",
        className,
      )}
    >
      {/* Screen reader full accessibility string */}
      <span className="sr-only">{text}</span>

      {/* Visual handwritten character stream */}
      <span
        ref={wrapRef}
        aria-hidden="true"
        className="relative inline-flex items-baseline whitespace-nowrap cursor-pointer"
        onClick={replay}
        title="Click to replay handwriting"
      >
        {chars.map((char, i) => {
          const isRevealed = i < visibleCount;
          const isJustPenned = i === visibleCount - 1 && isWriting;
          return (
            <span
              key={`${key}-${i}`}
              ref={(el) => {
                charRefs.current[i] = el;
              }}
              style={{
                opacity: isRevealed ? 1 : 0,
                transition: "opacity 90ms ease-out",
              }}
              className={cn(
                "inline-block",
                isJustPenned && "animate-ink-settle",
                char === " " && "w-[0.28em]",
              )}
            >
              {char === " " ? "\u00A0" : char}
            </span>
          );
        })}

        {/* Fountain Pen Nib */}
        {showNib && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-30 transition-all"
            style={{
              left: `${nibPos.x - 14}px`,
              top: `${nibPos.y - 41}px`,
              opacity: nibPos.visible ? 1 : 0,
              transformOrigin: "14px 41px",
              transform: `rotate(${isFlourishing ? "40deg" : "28deg"})`,
              transition: isFlourishing
                ? "left 600ms cubic-bezier(0.25, 1, 0.5, 1), top 600ms ease, opacity 250ms ease"
                : "left 75ms linear, top 75ms linear, opacity 200ms ease",
            }}
          >
            <div className={cn(isWriting && "animate-nib-bob")}>
              <svg
                viewBox="0 0 28 42"
                className="h-10 w-7 drop-shadow-[0_4px_12px_rgba(201,162,74,0.7)]"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="nibBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFF4BE" />
                    <stop offset="35%" stopColor="#E5B942" />
                    <stop offset="80%" stopColor="#9E7618" />
                    <stop offset="100%" stopColor="#5E4308" />
                  </linearGradient>
                  <linearGradient id="nibAccGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#FFE072" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Pen barrel collar */}
                <path d="M7 0 L21 0 L20 8 L8 8 Z" fill="#241D0E" stroke="#9E7618" strokeWidth="0.8" />
                {/* Nib shoulder & body */}
                <path
                  d="M8 8 C8 8, 5 15, 5 21 C5 26, 12 38, 14 41 C16 38, 23 26, 23 21 C23 15, 20 8, 20 8 Z"
                  fill="url(#nibBodyGrad)"
                  stroke="#3B2B06"
                  strokeWidth="0.75"
                />
                {/* Nib central spine highlight */}
                <path d="M14 9 L14 37" stroke="#3B2B06" strokeWidth="0.8" strokeLinecap="round" />
                {/* Breathing hole */}
                <circle cx="14" cy="22" r="1.6" fill="#1A1408" stroke="#FFE072" strokeWidth="0.6" />
                {/* Gold filigree engraving lines */}
                <path d="M9 17 C11 19, 17 19, 19 17" stroke="#FFF4BE" strokeWidth="0.6" strokeOpacity="0.85" fill="none" />
                <path d="M10 26 C12 28, 16 28, 18 26" stroke="#FFF4BE" strokeWidth="0.6" strokeOpacity="0.6" fill="none" />
                {/* Ink droplet glint at the nib tip */}
                <circle
                  cx="14"
                  cy="41"
                  r="1.8"
                  fill="#FFE072"
                  className={cn(isWriting && "animate-ping")}
                  style={{ animationDuration: "0.85s" }}
                />
                <circle cx="14" cy="41" r="1.2" fill="#FFFFFF" />
              </svg>
            </div>
          </div>
        )}

        {/* Calligraphic Flourish Underline */}
        {showFlourish && (
          <svg
            viewBox="0 0 320 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="pointer-events-none absolute -bottom-3.5 left-0 h-4 w-full overflow-visible"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="flourishGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
                <stop offset="20%" stopColor="var(--primary)" stopOpacity="0.95" />
                <stop offset="75%" stopColor="var(--accent)" stopOpacity="1" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.5" />
              </linearGradient>
            </defs>
            <path
              d="M 2 12 Q 75 22, 160 13 T 310 16 Q 318 17, 312 22"
              stroke="url(#flourishGrad)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeDasharray="400"
              strokeDashoffset={flourishDone ? 0 : isFlourishing ? 0 : 400}
              style={{
                transition: isFlourishing ? "stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
              }}
            />
          </svg>
        )}
      </span>
    </span>
  );
}
