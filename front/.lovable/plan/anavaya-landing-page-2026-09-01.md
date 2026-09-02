# Anavaya — Landing Page

A single-page, dark-and-gold landing site for Anavaya, the AI case priority system for the Indian judiciary. Built exactly to the supplied spec: premium, courtly, serif headings, gold accents on near-black, with a different layout for every section.

## Design system

- Background `#0D0D0D` with a faint warm grain overlay; gold `#C9A22B`, amber `#D4A843`, off-white `#F5F0E8` body text.
- Priority colors: crimson `#B3402E`, amber `#D97706`, emerald `#059669`.
- Glass panels: white 4% fill, 20px blur, gold-tinted borders.
- Fonts: Playfair Display (headings) + Inter (body), loaded via a Google Fonts `<link>` in the root route head.
- All values registered as semantic tokens in `src/styles.css` (oklch), used through Tailwind classes — no hardcoded colors in components.

## Sections (each a distinct layout)

1. **Hero** — split: left text (gold pill badge, "Every Case Matters." / "Anavaya sorts it.", subtitle, a one-line "Built for judges, registrars, and court staff" audience line, gold-fill "Try Anavaya Now →" to `http://127.0.0.1:8000`, outline "View Architecture" smooth-scroll). Right: animated SVG/CSS composition of translucent gold hexagons, scales-of-justice silhouette and document glyphs, slow rotation plus mouse-parallax.
2. **The problem** — short framing band before the stats: India's pending case backlog and average disposal times, so the numbers that follow land with context rather than cold.
3. **Impact stats bar** — 4-across row with gold dividers, icons, count-up numbers triggered on scroll.
4. **How It Works** — horizontal scroll-snapping pipeline of the 7 steps joined by a glowing gold dotted line; becomes a vertical stepper on mobile. Gold-bordered "Founding Invariant" callout placed between steps 3 and 5, written in plain language: the AI only reads and summarizes the document; a fixed decision tree — not the AI — assigns the priority, so the same document always produces the same result and every decision can be traced.
5. **Why It Matters** — asymmetric two-column: large serif statement left, three left-gold-bordered benefit cards right, followed by a **Trust & human oversight** band: Anavaya assists judicial discretion and never replaces it, no black-box scoring (every priority is traceable to features and constitutional articles), and all processing runs locally with no data leaving the machine.
6. **Key Features** — 2×3 grid, gold icon top-left, hover glow, 200ms staggered entrance.
7. **Tech stack** — horizontal marquee strip of pills (Python, FastAPI, scikit-learn, PyTorch, Ollama, D3.js, WebRTC, Whisper ASR, EasyOCR, Tailwind, PyMuPDF, MediaPipe).
8. **Closing CTA** — centered panel with gold gradient top border, both CTA buttons (Try Now, GitHub repo link).
9. **Footer** — minimal, copyright left, gold links right.

## Motion

Framer Motion for scroll reveals (fade-up, stagger), count-up hooks for stats, CSS keyframes for the hero shapes and gold shimmer on hover. Respects `prefers-reduced-motion`.

## Technical notes

- All content lives in `src/routes/index.tsx` (replacing the placeholder), composed from section components under `src/components/landing/`.
- Route `head()` gets an Anavaya-specific title, description, og/twitter tags.
- Fully responsive at 1440 / 768 / 375; WCAG AA contrast on all text.
- No backend, no images — pure CSS/SVG.
