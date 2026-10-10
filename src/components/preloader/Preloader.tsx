import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import {
  Fingerprint,
  Gavel,
  Landmark,
  Lock,
  Megaphone,
  Scale,
  ScrollText,
  Siren,
  UserX,
  Users,
} from "lucide-react";
import { RAIL_ITEMS, usePreloaderTimeline } from "./usePreloaderTimeline";

/* ---------- Theme: gold, brown, white ---------- */
const COLORS = {
  bg: "#FBF8F2", // warm white
  ink: "#3B2414", // deep brown
  muted: "#8A6A45", // soft brown
  gold: "#C9A24A",
  goldLight: "#E3C77E",
  seam: "rgba(201,162,74,0.45)",
  woodDark: "#5A3418",
  wood: "#7A4A24",
  woodLight: "#A06A38",
  grain: "rgba(59,36,20,0.35)",
} as const;
const FONT = "'Playfair Display', 'Cormorant Garamond', Georgia, serif";
const SESSION_KEY = "anvaya-preloader-seen";
const MAX_TILT = 4;
const BASE_TILT = { x: 8, y: -6 };

/* ---------- Side-rail medallions ----------
   The court's furniture, in circular borders, climbing the left and right screen
   edges while "Anvaya" lands beside the gavel. Lucide's own set, so nothing extra
   ships: the hammer, the scales, the accused, the arguing counsel, the bench, the
   custody lock, the record and the police siren. Keep both lists RAIL_ITEMS long
   — the timeline derives each medallion's rail and stagger from its flat index. */
const RAIL_LEFT = [Gavel, Scale, Siren, UserX, ScrollText] as const;
const RAIL_RIGHT = [Landmark, Megaphone, Users, Fingerprint, Lock] as const;
const RAIL_INSET = "clamp(10px, 3vw, 38px)";
const MEDALLION = "clamp(42px, 6.4vw, 66px)";

// Extruded 3D stack: deep brown -> gold, 1px further each step
const EXTRUDE = ["#4A2D17", "#5A381C", "#6B4422", "#7D5229", "#8F6232", "#A2743B", "#B48745", "#C9A24A"]
  .map((c, i) => `${i + 1}px ${i + 1}px 0 ${c}`)
  .concat("10px 16px 22px rgba(59,36,20,0.25)")
  .join(", ");

// Mirror effects: a bright sweep across the letters + a faded reflection below
const SHEEN =
  "linear-gradient(110deg, transparent 38%, rgba(255,248,225,0.15) 44%, rgba(255,252,240,0.95) 50%, rgba(227,199,126,0.6) 53%, transparent 60%)";
const REFLECT_MASK = "linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 65%)";

// Mirror finish on the letter edges: a bright rim traced along the top curves
// of each letter (light catching the crest) and a warmer gold under-rim, like
// polished metal bevels. Each layer is the same text, stroked and masked.
const EDGES = [
  {
    mask: "linear-gradient(to bottom, black 0%, black 46%, transparent 62%)",
    stroke: "rgba(255,252,240,0.85)",
    blur: 0.4,
  },
  {
    mask: "linear-gradient(to bottom, transparent 62%, black 78%)",
    stroke: "rgba(201,162,74,0.6)",
    blur: 0,
  },
] as const;

export function Preloader() {
  const [show, setShow] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const rails = useRef<HTMLDivElement[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const left = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const welcome = useRef<HTMLDivElement>(null);
  const words = useRef<HTMLSpanElement[]>([]);
  const brandRow = useRef<HTMLDivElement>(null);
  const text3d = useRef<HTMLDivElement>(null);
  const brand = useRef<HTMLSpanElement>(null);
  const sheen = useRef<HTMLSpanElement>(null);
  const gavelWrap = useRef<HTMLDivElement>(null);
  const gavel = useRef<SVGGElement>(null);
  const block = useRef<SVGGElement>(null);
  const skipBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Take the curtain over from the first-paint guard (PRELOADER_BOOT in
    // src/routes/__root.tsx). This effect runs after the commit, so the React
    // curtain is already painted when the guard's stylesheet comes off — same
    // paper colour, so the swap is invisible. A returning visitor never had one.
    // Clearing the boot flag also disarms its fail-open timer, so the guard can't
    // strip the curtain mid-animation.
    const boot = window as unknown as {
      __anavayaPreloaderBoot?: boolean;
      __anavayaPreloaderTimer?: number;
    };
    boot.__anavayaPreloaderBoot = false;
    window.clearTimeout(boot.__anavayaPreloaderTimer);
    document.getElementById("anavaya-preloader-curtain")?.remove();

    let seen = false;
    try { seen = sessionStorage.getItem(SESSION_KEY) === "1"; } catch { /* ignore */ }
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (!seen) setShow(true);
    else window.dispatchEvent(new CustomEvent("anvaya:preloader-done"));
  }, []);

  useEffect(() => {
    if (!show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [show]);

  const onDone = () => {
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  };

  const { skip } = usePreloaderTimeline(
    { root, left, right, content, welcome, words, brandRow, text3d, brand, sheen, gavelWrap, gavel, block, skipBtn, rails },
    { active: show, reducedMotion, onDone },
  );

  // Mouse-follow tilt (non-touch, once "Anvaya" is up)
  useEffect(() => {
    if (!show || reducedMotion) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const el = text3d.current;
    if (!el) return;
    let enabled = false;
    const t = window.setTimeout(() => { enabled = true; }, 2800);
    const move = (e: MouseEvent) => {
      if (!enabled) return;
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      gsap.to(el, {
        rotationY: BASE_TILT.y + nx * 2 * MAX_TILT,
        rotationX: BASE_TILT.x - ny * 2 * MAX_TILT,
        duration: 0.8,
        ease: "power2.out",
        overwrite: "auto",
      });
    };
    window.addEventListener("mousemove", move);
    return () => { window.clearTimeout(t); window.removeEventListener("mousemove", move); };
  }, [show, reducedMotion]);

  if (!show) return null;

  const panel: React.CSSProperties = {
    position: "absolute", top: 0, bottom: 0, width: "50%", background: COLORS.bg, willChange: "transform",
  };
  const layer: React.CSSProperties = {
    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 1rem",
  };

  return (
    <div ref={root} aria-label="Loading Anvaya" role="status" style={{ position: "fixed", inset: 0, zIndex: 9999, overflow: "hidden" }}>
      <div ref={left} style={{ ...panel, left: 0, borderRight: `1px solid ${COLORS.seam}` }} />
      <div ref={right} style={{ ...panel, right: 0 }} />

      <div ref={content} style={{ position: "absolute", inset: 0, pointerEvents: "none", fontFamily: FONT, fontStyle: "italic" }}>
        {/* Step 1: Welcome to */}
        <div ref={welcome} style={{ ...layer, gap: "0.35em", fontSize: "clamp(1.8rem, 6vw, 3.6rem)" }}>
          {["Welcome", "to"].map((w, i) => (
            <span
              key={w}
              ref={(el) => { if (el) words.current[i] = el; }}
              style={{ color: COLORS.muted, fontWeight: 400, display: "inline-block", opacity: 0 }}
            >
              {w}
            </span>
          ))}
        </div>

        {/* Step 2: Anvaya + gavel */}
        <div ref={brandRow} style={{ ...layer, gap: "clamp(0.75rem, 3vw, 2rem)", flexWrap: "wrap", visibility: "hidden" }}>
          <div style={{ perspective: "900px" }}>
            <div
              ref={text3d}
              style={{
                transform: reducedMotion ? "none" : `rotateX(${BASE_TILT.x}deg) rotateY(${BASE_TILT.y}deg)`,
                transformStyle: "preserve-3d",
              }}
            >
              <span
                ref={brand}
                style={{
                  color: COLORS.ink, fontWeight: 700, display: "inline-block", textShadow: EXTRUDE,
                  fontSize: "clamp(2.8rem, 10vw, 6rem)", lineHeight: 1.1, paddingRight: "0.12em",
                  position: "relative",
                }}
              >
                Anvaya
                {/* Mirror finish on the letter edges: bright top rim + gold under-rim */}
                {EDGES.map((edge, i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    style={{
                      position: "absolute", inset: 0, paddingRight: "0.12em",
                      color: "transparent", WebkitTextStroke: `1px ${edge.stroke}`,
                      textShadow: "none", pointerEvents: "none",
                      WebkitMaskImage: edge.mask, maskImage: edge.mask,
                      filter: edge.blur ? `blur(${edge.blur}px)` : undefined,
                    }}
                  >
                    Anvaya
                  </span>
                ))}
                {/* Mirror sheen that glides along the letter curves */}
                <span
                  ref={sheen}
                  aria-hidden="true"
                  style={{
                    position: "absolute", inset: 0, paddingRight: "0.12em", textShadow: "none",
                    color: "transparent", backgroundImage: SHEEN, backgroundSize: "300% 100%",
                    backgroundPosition: "150% 0", backgroundRepeat: "no-repeat",
                    WebkitBackgroundClip: "text", backgroundClip: "text", pointerEvents: "none",
                  }}
                >
                  Anvaya
                </span>
                {/* Mirror reflection below, fading out */}
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute", left: 0, top: "100%", marginTop: "-0.28em", paddingRight: "0.12em",
                    transform: "scaleY(-1)", transformOrigin: "center", opacity: 0.4, pointerEvents: "none",
                    WebkitMaskImage: REFLECT_MASK, maskImage: REFLECT_MASK,
                  }}
                >
                  Anvaya
                </span>
              </span>
            </div>
          </div>

          <div ref={gavelWrap} style={{ width: "clamp(110px, 22vw, 150px)" }} aria-hidden="true">
            <svg viewBox="0 0 140 146" width="100%" style={{ overflow: "visible", display: "block" }}>
              <defs>
                <linearGradient id="pl-wood" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor={COLORS.woodLight} />
                  <stop offset="1" stopColor={COLORS.wood} />
                </linearGradient>
                <linearGradient id="pl-head" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0" stopColor={COLORS.woodDark} />
                  <stop offset="0.5" stopColor={COLORS.wood} />
                  <stop offset="1" stopColor={COLORS.woodDark} />
                </linearGradient>
                <linearGradient id="pl-gold" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor={COLORS.goldLight} />
                  <stop offset="1" stopColor={COLORS.gold} />
                </linearGradient>
              </defs>

              {/* Wooden sound block — top surface at y=126 where the head lands */}
              <g ref={block}>
                <ellipse cx="102" cy="142" rx="30" ry="3" fill="rgba(59,36,20,0.18)" />
                <rect x="74" y="126" width="56" height="14" rx="3" fill="url(#pl-wood)" />
                <rect x="74" y="126" width="56" height="3" rx="1.5" fill={COLORS.goldLight} opacity="0.55" />
                <path d="M80 132 Q95 130 110 133 T126 132" stroke={COLORS.grain} strokeWidth="0.8" fill="none" />
                <path d="M78 136 Q92 134.5 104 137 T127 136" stroke={COLORS.grain} strokeWidth="0.8" fill="none" />
              </g>

              {/* Gavel drawn in contact pose, pre-rotated -34deg about handle end (14,104) */}
              <g transform="rotate(-34 14 104)">
                <g ref={gavel}>
                  <rect x="8" y="100.5" width="86" height="7" rx="3.5" fill="url(#pl-wood)" />
                  <rect x="8" y="100.5" width="10" height="7" rx="3.5" fill={COLORS.woodDark} />
                  <rect x="88" y="88" width="24" height="34" rx="5" fill="url(#pl-head)" />
                  <rect x="88" y="86" width="24" height="5" rx="2" fill="url(#pl-gold)" />
                  <rect x="88" y="121" width="24" height="5" rx="2" fill="url(#pl-gold)" />
                  <rect x="88" y="102" width="24" height="3" fill="url(#pl-gold)" opacity="0.8" />
                </g>
              </g>
            </svg>
          </div>
        </div>

        {/* Side rails: the judicial medallions stream bottom→up along both screen
            edges, timed to arrive as "Anvaya" lands and looping from then on —
            the right rail climbs at 1.5x the left, so the two edges never look
            like one mirrored motion. They live inside the content layer, so they
            blur and fade out with the rest of the curtain. */}
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {[RAIL_LEFT, RAIL_RIGHT].map((rail, ri) => {
            const railStyle: React.CSSProperties = {
              position: "absolute",
              top: 0,
              bottom: 0,
              width: MEDALLION,
            };
            if (ri === 0) railStyle.left = RAIL_INSET;
            else railStyle.right = RAIL_INSET;
            return (
              <div key={ri} style={railStyle}>
                {rail.map((Icon, ci) => (
                  <div
                    key={ci}
                    data-medallion={ri === 0 ? "left" : "right"}
                    data-rail-index={ci}
                    ref={(el) => { if (el) rails.current[ri * RAIL_ITEMS + ci] = el; }}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      width: "100%",
                      opacity: 0,
                      willChange: "transform, opacity",
                    }}
                  >
                    <span
                      style={{
                        display: "grid",
                        placeItems: "center",
                        width: "100%",
                        aspectRatio: "1 / 1",
                        borderRadius: 999,
                        border: `1.5px solid ${COLORS.seam}`,
                        background: "rgba(255,252,245,0.78)",
                        boxShadow: "0 8px 20px -12px rgba(59,36,20,0.5)",
                      }}
                    >
                      <Icon style={{ width: "52%", height: "52%" }} strokeWidth={1.5} color={COLORS.muted} />
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <button
        ref={skipBtn}
        type="button"
        onClick={skip}
        style={{
          position: "absolute", right: 20, bottom: 20, fontFamily: FONT, fontStyle: "italic", fontSize: 14,
          color: COLORS.muted, background: "transparent", border: `1px solid ${COLORS.seam}`,
          borderRadius: 999, padding: "6px 16px", cursor: "pointer",
        }}
      >
        Skip
      </button>
    </div>
  );
}

export default Preloader;
