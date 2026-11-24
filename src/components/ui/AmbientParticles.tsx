import { useEffect, useRef } from "react";
import particleModuleUrl from "../../../case_priority_system/static/assets/ambient-particles.js?url&no-inline";

export function AmbientParticles() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void import(/* @vite-ignore */ particleModuleUrl)
      .then((module: { mountParticles: (canvas: HTMLCanvasElement) => () => void }) => {
        if (!disposed) cleanup = module.mountParticles(element);
      })
      .catch(() => {
        // The decorative layer can be absent while the landing page remains usable.
      });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <canvas
      ref={canvas}
      data-ambient-particles="landing"
      className="pointer-events-none fixed inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
