import type { LucideIcon } from "lucide-react";

export interface LandingCardData {
  icon: LucideIcon;
  title: string;
  text: string;
  value?: string;
  badge?: string;
}

export function LandingCardContent({ icon: Icon, title, text, value, badge }: LandingCardData) {
  return (
    <>
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-surface text-primary sm:size-12">
        <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        {badge && (
          <p className="mb-2 text-xs font-semibold tracking-wide text-primary uppercase">{badge}</p>
        )}
        <h3 className="font-display text-lg font-semibold text-foreground sm:text-xl">{title}</h3>
        {value && (
          <p className="font-display tnum text-glass mt-2 text-3xl font-semibold sm:text-4xl">
            {value}
          </p>
        )}
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">{text}</p>
      </div>
    </>
  );
}
