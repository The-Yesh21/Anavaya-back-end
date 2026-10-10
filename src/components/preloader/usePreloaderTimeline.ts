import { useEffect, useRef, type RefObject } from "react";
import gsap from "gsap";

/* ---------- Timings (seconds) ---------- */
export const T = {
  welcomeIn: 0.3, // "Welcome" "to" word by word
  welcomeOut: 1.45, // blur away
  brandIn: 1.95, // "Anvaya" arrives
  gavelIn: 2.35, // gavel + wood block beside it
  lift: 2.6,
  strike1: 3.15,
  rebound: 3.31,
  strike2: 3.6,
  settle: 3.74,
  fadeOut: 4.2,
  split: 4.6,
} as const;

export const ANGLE = { lift: -14, strike: 34, rebound: 14, settle: 26 } as const;

// Medallions per side rail. Preloader.tsx renders two rails of this length and
// pushes them into `railItems` flat (left rail first), which is how the rail and
// the stagger offset are derived below.
export const RAIL_ITEMS = 5;

/* ---------- Side-rail climb ----------
   Each medallion starts just below the fold, climbs clean off the top, and the
   tween then repeats for as long as the curtain is up — a continuous loop, not
   a single pass. The two rails run at DIFFERENT speeds (the right one is 1.5x the
   left), so they never read as one mirrored motion. */
const RAIL = {
  // A lap is just over a screen of travel, so these read as 0.57 and 0.85
  // screens per second — brisk enough that a second medallion comes round while
  // the curtain is still up, which is what makes the loop visible at all.
  durationLeft: 2.0,
  durationRight: 1.35,
  // How far past the top edge a medallion travels before its lap restarts. It is
  // what makes the loop seamless: the wrap happens while the medallion is off
  // screen, so nobody sees it jump back to the bottom.
  overshoot: 260,
} as const;

// Where a medallion enters its rail, as a fraction of that rail's OWN cycle: one
// fifth of the way in per item, so a full lap's worth of medallions is always in
// flight and the chain never gaps between the last one leaving and the next
// arriving.
export const railPhaseStep = (duration: number) => (duration / RAIL_ITEMS) as number;

export interface PreloaderRefs {
  root: RefObject<HTMLDivElement | null>;
  left: RefObject<HTMLDivElement | null>;
  right: RefObject<HTMLDivElement | null>;
  content: RefObject<HTMLDivElement | null>;
  welcome: RefObject<HTMLDivElement | null>;
  words: RefObject<HTMLSpanElement[]>;
  brandRow: RefObject<HTMLDivElement | null>;
  text3d: RefObject<HTMLDivElement | null>;
  brand: RefObject<HTMLSpanElement | null>;
  sheen: RefObject<HTMLSpanElement | null>;
  gavelWrap: RefObject<HTMLDivElement | null>;
  gavel: RefObject<SVGGElement | null>;
  block: RefObject<SVGGElement | null>;
  skipBtn: RefObject<HTMLButtonElement | null>;
  rails: RefObject<HTMLDivElement[]>;
}

type AudioRef = { current: AudioContext | null };

function getCtx(ref: AudioRef) {
  if (!ref.current) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ref.current = new AC();
  }
  return ref.current;
}

function playTok(ref: AudioRef) {
  try {
    const ctx = getCtx(ref);
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.14);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  } catch {
    /* fail silently */
  }
}

export function usePreloaderTimeline(
  refs: PreloaderRefs,
  opts: { active: boolean; reducedMotion: boolean; onDone: () => void },
) {
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  // The rail climb loops for as long as the curtain is up, so those tweens are
  // kept out of the main timeline (an infinite child would stop it completing)
  // and killed explicitly when the curtain finishes, is skipped, or unmounts.
  const railTweens = useRef<gsap.core.Tween[]>([]);
  const { active, reducedMotion, onDone } = opts;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const page = document.getElementById("page-root");

    const stopRails = () => {
      railTweens.current.forEach((t) => t.kill());
      railTweens.current = [];
    };

    const finish = () => {
      stopRails();
      if (page) gsap.set(page, { clearProps: "transform" });
      window.dispatchEvent(new CustomEvent("anvaya:preloader-done"));
      onDone();
    };

    const unlock = () => {
      try {
        getCtx(audioRef)?.resume().catch(() => {});
      } catch {
        /* ignore */
      }
    };
    const evts = ["pointerdown", "keydown", "touchstart"] as const;
    evts.forEach((e) => window.addEventListener(e, unlock, { once: true, passive: true }));

    const start = () => {
      if (cancelled) return;
      const r = refs;
      const tl = gsap.timeline({ onComplete: finish, defaults: { ease: "power2.out" } });
      tlRef.current = tl;

      if (reducedMotion) {
        tl.to(r.root.current, { opacity: 0, duration: 0.4, ease: "none" });
        return;
      }

      // Judicial medallions climbing both screen edges, alongside the arriving
      // "Anvaya". Started a touch early so they are already rising as it lands.
      const startRails = () => {
        const items = r.rails.current ?? [];
        const travel = window.innerHeight + RAIL.overshoot;
        items.forEach((el, i) => {
          if (!el) return;
          const onRightRail = i >= RAIL_ITEMS;
          const duration = onRightRail ? RAIL.durationRight : RAIL.durationLeft;
          const step = (onRightRail ? i - RAIL_ITEMS : i) * railPhaseStep(duration);
          // `repeat: -1` keeps the medallion coming round for the whole curtain;
          // the tween is still kept OUT of the main timeline and killed on
          // finish/skip/unmount (see railTweens).
          railTweens.current.push(
            gsap.fromTo(
              el,
              { y: 0, opacity: 1 },
              {
                y: -travel,
                opacity: 1,
                duration,
                ease: "none",
                repeat: -1,
                delay: step,
              },
            ),
          );
        });
      };

      const words = r.words.current ?? [];
      gsap.set(words, { opacity: 0, y: 10, filter: "blur(8px)" });
      gsap.set(r.brandRow.current, { autoAlpha: 1 });
      gsap.set(r.brand.current, { opacity: 0, y: 6, filter: "blur(12px)" });
      gsap.set(r.gavelWrap.current, { opacity: 0, x: 14, filter: "blur(6px)" });
      gsap.set(r.gavel.current, { rotation: 0, svgOrigin: "14 104" });
      if (page) gsap.set(page, { scale: 1.06 });

      const impact = (at: number) => {
        tl.call(() => playTok(audioRef), [], at);
        tl.fromTo(r.block.current, { y: 0 }, { y: 1.5, duration: 0.05, yoyo: true, repeat: 1, ease: "power1.out" }, at);
        tl.fromTo(r.brandRow.current, { y: 0 }, { y: 3, duration: 0.06, yoyo: true, repeat: 1 }, at);
        tl.to(r.text3d.current, { z: -12, duration: 0.07 }, at);
        tl.to(r.text3d.current, { z: 0, duration: 0.6, ease: "elastic.out(1, 0.45)" }, at + 0.07);
      };

      // 1. "Welcome to"
      tl.to(words, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, stagger: 0.2 }, T.welcomeIn)
        // 2. blur away
        .to(words, { opacity: 0, y: -6, filter: "blur(10px)", duration: 0.55, stagger: 0.06, ease: "power2.in" }, T.welcomeOut)
        // 3. "Anvaya" + gavel beside it
        .to(r.brand.current, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.9, ease: "power3.out" }, T.brandIn)
        .to(r.gavelWrap.current, { opacity: 1, x: 0, filter: "blur(0px)", duration: 0.5 }, T.gavelIn)
        .to(r.gavel.current, { rotation: ANGLE.lift, duration: 0.5, ease: "sine.inOut" }, T.lift)
        .to(r.gavel.current, { rotation: ANGLE.strike, duration: 0.14, ease: "power3.in" }, T.strike1 - 0.14)
        .to(r.gavel.current, { rotation: ANGLE.rebound, duration: 0.22 }, T.rebound)
        .to(r.gavel.current, { rotation: ANGLE.strike, duration: 0.14, ease: "power3.in" }, T.strike2 - 0.14)
        .to(r.gavel.current, { rotation: ANGLE.settle, duration: 0.3, ease: "sine.out" }, T.settle);
      const sweep = (at: number, d = 1.1) =>
        tl.fromTo(r.sheen.current, { backgroundPosition: "150% 0" }, { backgroundPosition: "-50% 0", duration: d, ease: "sine.inOut" }, at);
      sweep(T.brandIn + 0.45);
      sweep(T.settle, 0.9);
      impact(T.strike1);
      impact(T.strike2);
      // A touch earlier than "Anvaya" lands, so the first lap of each rail is
      // already complete before the curtain starts fading (T.fadeOut).
      tl.call(startRails, [], T.brandIn - 0.35);

      // 4. fade + open
      tl.to(r.skipBtn.current, { opacity: 0, duration: 0.3 }, T.fadeOut)
        .to(r.content.current, { opacity: 0, filter: "blur(8px)", scale: 0.98, duration: 0.5, ease: "power2.in" }, T.fadeOut)
        .to(r.left.current, { xPercent: -100, duration: 1.2, ease: "power4.inOut" }, T.split)
        .to(r.right.current, { xPercent: 100, duration: 1.2, ease: "power4.inOut" }, T.split);
      if (page) tl.to(page, { scale: 1, duration: 1.2, ease: "power4.inOut" }, T.split);
    };

    const ready = document.fonts?.ready ?? Promise.resolve();
    ready.then(start, start);

    return () => {
      cancelled = true;
      evts.forEach((e) => window.removeEventListener(e, unlock));
      stopRails();
      tlRef.current?.kill();
      if (page) gsap.set(page, { clearProps: "transform" });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reducedMotion]);

  const skip = () => {
    const tl = tlRef.current;
    if (tl) tl.progress(1);
    else onDone();
  };

  return { skip };
}
