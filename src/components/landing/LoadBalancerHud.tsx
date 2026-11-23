import { useEffect, useState } from "react";
import { SectionLoadBalancer, type LoadBalancerTelemetry } from "@/lib/sectionLoadBalancer";
import { Cpu, CheckCircle2, Loader2, Minimize2, Sparkles } from "lucide-react";

export function LoadBalancerHud() {
  const [telemetry, setTelemetry] = useState<LoadBalancerTelemetry>(() => SectionLoadBalancer.getTelemetry());
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    return SectionLoadBalancer.subscribeTelemetry(setTelemetry);
  }, []);

  const allLoaded = telemetry.loadedCount >= telemetry.totalRegistered && telemetry.totalRegistered > 0;

  return (
    <aside
      aria-label="Load Balancer Telemetry"
      className="fixed bottom-4 left-4 z-40 select-none font-mono text-[11px]"
    >
      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="group flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 shadow-lg backdrop-blur-md transition-all hover:border-primary/50 hover:bg-card/90"
        >
          <span className="relative flex h-2 w-2">
            {!allLoaded ? (
              <>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </>
            ) : (
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            )}
          </span>
          <span className="font-semibold text-foreground/80 group-hover:text-foreground">
            Load Balancer: {telemetry.loadedCount}/{telemetry.totalRegistered}
          </span>
          <Cpu className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
        </button>
      ) : (
        <div className="w-72 rounded-xl border border-border/80 bg-background/95 p-3.5 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <div className="flex items-center gap-1.5 font-sans font-semibold text-xs text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Section Load Balancer</span>
            </div>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="text-muted-foreground transition hover:text-foreground"
            >
              <Minimize2 className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-2.5 space-y-2 text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Preloader Lock:</span>
              <span
                className={`font-semibold ${
                  telemetry.isPreloaderActive ? "text-amber-400" : "text-emerald-400"
                }`}
              >
                {telemetry.isPreloaderActive ? "Holding" : "Released"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>Loaded Progress:</span>
              <span className="font-semibold text-foreground">
                {telemetry.loadedCount} / {telemetry.totalRegistered}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>Active Hydration:</span>
              <span className="max-w-[130px] truncate text-primary font-semibold">
                {telemetry.activeLoadingId ?? (allLoaded ? "All Complete" : "Yielding CPU")}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                style={{
                  width: `${
                    telemetry.totalRegistered > 0
                      ? (telemetry.loadedCount / telemetry.totalRegistered) * 100
                      : 0
                  }%`,
                }}
              />
            </div>

            {/* Status List preview */}
            <div className="max-h-28 overflow-y-auto pt-1 space-y-1 text-[10px]">
              {Object.entries(telemetry.sections).map(([id, status]) => (
                <div key={id} className="flex items-center justify-between text-muted-foreground/80">
                  <span className="truncate max-w-[170px]">{id}</span>
                  <span className="flex items-center gap-1">
                    {status === "loaded" ? (
                      <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                    ) : status === "loading" ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin text-amber-500" />
                    ) : (
                      <span className="text-muted-foreground/40">queued</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
