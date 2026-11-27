import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import "./scroll-card-stack.css";

interface ScrollCard {
  icon: LucideIcon;
  title: string;
  text: string;
}

export function ScrollCardStack({ cards }: { cards: ScrollCard[] }) {
  return (
    <ul className="scroll-card-stack mt-8 grid max-w-3xl list-none gap-4">
      {cards.map(({ icon: Icon, title, text }, index) => (
        <li
          key={title}
          className="scroll-card-stack-item flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:gap-6 sm:p-8"
          style={{ "--card-index": index } as CSSProperties}
        >
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-surface text-primary sm:size-12">
            <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold text-foreground sm:text-xl">
              {title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {text}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
