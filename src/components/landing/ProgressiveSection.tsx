import { useEffect, useRef, useState, type ReactNode } from "react";
import { SectionLoadBalancer } from "@/lib/sectionLoadBalancer";
import { cn } from "@/lib/utils";

export interface ProgressiveSectionProps {
  id: string;
  priority: number;
  minHeight?: number | string;
  className?: string;
  children: ReactNode | (() => ReactNode);
  fallbackTitle?: string;
}

export function ProgressiveSection({
  id,
  priority,
  minHeight = 450,
  className,
  children,
  fallbackTitle,
}: ProgressiveSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(() => SectionLoadBalancer.isLoaded(id));

  useEffect(() => {
    // 1. Register section with the load balancer queue
    SectionLoadBalancer.register(id, priority);

    // 2. Subscribe to load balancer events for this section
    const unsubscribe = SectionLoadBalancer.subscribe(id, (loaded) => {
      if (loaded) setIsLoaded(true);
    });

    // 3. Intersection observer: if user scrolls near this section, prioritize immediately
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      return unsubscribe;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && (entry.isIntersecting || entry.boundingClientRect.top < window.innerHeight + 300)) {
          SectionLoadBalancer.prioritize(id);
        }
      },
      {
        rootMargin: "350px 0px 350px 0px",
        threshold: 0.01,
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      unsubscribe();
    };
  }, [id, priority]);

  return (
    <div
      ref={containerRef}
      id={id}
      data-section-id={id}
      data-loaded={isLoaded}
      style={{ minHeight: !isLoaded ? minHeight : undefined }}
      className={cn("progressive-section-wrapper relative transition-opacity duration-500", className, {
        "opacity-100": isLoaded,
        "opacity-85": !isLoaded,
      })}
    >
      {isLoaded ? (
        typeof children === "function" ? (children as () => ReactNode)() : children
      ) : (
        <div
          aria-hidden="true"
          className="mx-auto my-12 flex max-w-4xl flex-col items-center justify-center rounded-2xl border border-border/40 bg-card/20 p-12 text-center backdrop-blur-sm"
          style={{ minHeight: typeof minHeight === "number" ? `${minHeight - 40}px` : minHeight }}
        >
          <div className="relative mb-4 h-1 w-24 overflow-hidden rounded-full bg-border/60">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          </div>
          {fallbackTitle && (
            <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground/60">
              {fallbackTitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
