# Anavaya Front-End Design Plan — "White & Gold" · Smooth · Adaptable for All

> Status: **PLAN — awaiting approval** (do not implement until approved).
> Scope: **all front-end pages** — Dashboard (`index.html`/`app.js`/`style.css`), Case
> Workflow (`case-workflow.css/js`), Live Courtroom (`courtroom.html/css/js`).
> No backend/API changes, no build step, no new CDN libraries, no dark mode.
>
> Companion docs: `case_priority_system/FRONTEND_REDESIGN_PLAN.md` (previous visual redesign,
> completed), `PROJECT_HANDOFF.md` (§9 gotchas).

---

## 1. Direction

Replace the current moss-green/terracotta wabi-sabi palette with a **sovereign White & Gold
light theme** — crisp white surfaces, warm ivory paper, metallic-gold accents, deep warm-charcoal
text. The personality stays organic (Fraunces serif headings, asymmetric hero shapes) but the
execution becomes **calm, formal, and courtly**:

| Current | New |
|---|---|
| Rice-paper `#FDFCF8` background | **Pure white `#FFFFFF`** / warm ivory `#FBF8F1` | 
| Moss green `#5D7052` primary | **Gold `#C9A24B`** (accent) + deep bronze `#8A6A1F` (text-safe gold) |
| Terracotta secondary `#C18C5D` | Amber `#D97706` (Medium priority only) |
| Burnt sienna High `#A85448` | Deep crimson `#B3402E` (High priority only) |
| Organic radii everywhere | Organic radii **reserved for header/hero/empty states**; data cards use 12–16px soft radii |
| Skewed, hover-expanding case rows | Fixed-height rows, click-to-select, no layout shift |
| 3 unaligned breakpoint sets (1024/900/768, 980/860, 900) | **One unified responsive system** (≥1200 / 900–1199 / 600–899 / <600) |
| Blob float + backdrop blur everywhere | Motion & blur behind `prefers-reduced-motion` / low-end fallbacks |

**Design principle — "White marble, gold inlay."** Structure and clarity first (white space,
grid, hierarchy); gold is the ornament — headers, active states, focus, accents — never the
background flood. Priority colors stay **semantically mapped** (High/Medium/Low) so the court
reads urgency at a glance, and are accompanied by icons/patterns for color-blind users.

---

## 2. Design tokens — single shared source (`static/tokens.css`)

All three stylesheets currently define their own colors. Extract one `tokens.css` (imported by
`style.css`, `courtroom.css`, `case-workflow.css`) so the theme is consistent everywhere:

```css
:root {
  /* Surfaces — white & ivory */
  --bg-app:        #FBF8F1;   /* warm ivory page */
  --bg-card:       #FFFFFF;   /* pure white cards */
  --bg-card-hover: #FDF9EF;   /* soft gold-tinted hover */
  --bg-well:       #F6F1E6;   /* recessed areas (sidebar header, tree canvas) */
  --border-color:        rgba(160, 140, 90, 0.28);
  --border-color-strong: rgba(160, 140, 90, 0.5);

  /* Gold scale */
  --gold-50:  #FBF6EA;
  --gold-100: #F7EFDC;
  --gold-300: #E3C877;
  --gold-500: #C9A24B;   /* primary accent */
  --gold-600: #A87E2F;   /* hover */
  --gold-700: #8A6A1F;   /* TEXT-SAFE gold (contrast ≥ 4.5:1 on white) */
  --gold-800: #6B5016;

  /* Text */
  --text-primary:   #23211C;   /* warm charcoal */
  --text-secondary: #55503F;
  --text-muted:     #8B8471;

  /* Priority semantics (keep recognizable; always paired with icons) */
  --prio-high:     #B3402E;  --prio-high-bg:     rgba(179, 64, 46, 0.09);
  --prio-medium:   #D97706;  --prio-medium-bg:   rgba(217, 119, 6, 0.10);
  --prio-low:      #4E7A66;  --prio-low-bg:      rgba(78, 122, 102, 0.10);

  /* Elevation — gold-tinted, restrained */
  --shadow-card:  0 1px 3px rgba(80, 60, 20, 0.08), 0 4px 14px rgba(80, 60, 20, 0.06);
  --shadow-float: 0 12px 32px -8px rgba(120, 90, 30, 0.18);
  --shadow-gold:  0 0 0 4px rgba(201, 162, 75, 0.22);   /* focus ring */

  /* Type — fluid scale */
  --font-heading: 'Fraunces', serif;
  --font-body:    'Nunito', sans-serif;
  --text-base:    clamp(14px, 0.6vw + 12px, 16px);      /* fluid body */
  --text-h1:      clamp(22px, 2vw + 12px, 30px);
  --text-h2:      clamp(18px, 1.4vw + 12px, 24px);

  /* Radii */
  --radius-card: 14px;
  --radius-pill: 999px;
  --radius-hero: 28px;            /* organic only on hero/empty-state elements */

  /* Spacing scale (4/8/12/16/24/32/48) */
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-6: 24px; --sp-8: 32px; --sp-12: 48px;

  /* Motion */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-fast: 150ms; --dur-med: 260ms; --dur-slow: 420ms;
}
```

Rules of use:
- **Gold text** on white must use `--gold-700` (`#8A6A1F`, 4.5:1+) — never `--gold-500` for body text.
- **Gold fill** (buttons, active tab) uses `--gold-500` with **white text** or `--gold-800` text;
  verify each pairing in the contrast table (§7).
- All component colors in all 3 stylesheets reference tokens — no scattered hex literals.

---

## 3. Layout — unified responsive system

Replace the three inconsistent breakpoint sets with **four tiers**, applied identically in
`style.css`, `courtroom.css`, and `case-workflow.css`:

| Tier | Width | Behavior |
|---|---|---|
| **Desktop** | ≥ 1200px | Full 3-zone layout: sidebar 360px + details; stats row 3-col; two-column Analysis details |
| **Laptop** | 900–1199px | Stats 2×2 or 3 stacked; Analysis single-column + sticky mini-nav; tree panel side-by-side smaller |
| **Tablet** | 600–899px | Sidebar becomes a **slide-over drawer** (hamburger + backdrop); tabs scroll horizontally; video + analytics stack |
| **Phone** | < 600px | Sticky compact header (logo + status dot); stats stacked 1-col; touch targets ≥ 44px; tree default zoomed-out; courtroom video grid 1-col |

Key changes per area:
- **Header** — white glass pill, gold circular logo mark (scale icon), status chip; condenses to
  logo + status dot + search icon below 480px.
- **Stats row** — white cards, gold numerals, gold-tinted shadows; donut slices animate in with
  count-up; each priority slice stays a click-to-filter control.
- **Case rows (sidebar)** — **remove `skewX(3deg)` and the 85px→245px hover-expand** (this is
  the single biggest smoothness win: no layout thrash, works on touch, even list height).
  Fixed-height rows: priority dot + badge, title (ellipsis), category pill, 2-line preview.
  Selection on **click** — gold left accent bar + tinted background; expanded details in the
  existing pinned detail card.
- **Analysis details** — two columns ≥ 1100px; below that single column with sticky mini-nav
  (Summary / Analysis / Path) + scroll-spy; long sections stay collapsible.
- **Chakshu** — video panel + analytics stack under 900px; metrics grid 2×2 on tablet, 1-col on
  phone; camera placeholder centers; keep the dark video well (contrast for the face mesh) but
  frame it in gold.
- **Courtroom** — video tiles `repeat(auto-fit, minmax(240px, 1fr))`; control bars wrap;
  roster/transcript panels stack on tablet; full-screen mode keeps controls accessible.
- **Modals & overlays** — white cards, gold border-top accent; `max-height: 90dvh` with inner
  scroll so they fit short/phone viewports; close button ≥ 44px.

---

## 4. Smoothness — motion & performance discipline

1. **No-layout-shift policy:** animate only `transform` + `opacity` (+ `stroke-dashoffset` for
   gauges/donuts). Remove all hover rules that change `height`, `padding`, or `font-size`.
2. **Easing:** one spring-like `--ease-out cubic-bezier(0.16, 1, 0.3, 1)` everywhere;
   durations from the motion tokens. No `all 0.4s` transitions (they animate non-visual props).
3. **Page/state transitions:** tab switches get a 120ms fade + 8px slide (`opacity`/`transform`
   only); donut + count-up animate on first paint via `requestAnimationFrame`.
4. **Skeleton shimmer** on cases list, details, rights grid, tree — replace text loaders that
   pop; shimmer respects `prefers-reduced-motion` (static pulse-less placeholder).
5. **Performance guards:**
   - `content-visibility: auto` + `contain-intrinsic-size` on below-fold sections (Analysis
     long-form, transcript) to skip off-screen rendering.
   - `backdrop-filter` limited to header + modals; flat fallback background behind it so
     low-end devices don't blur the whole page.
   - Blob ambience: GPU-friendly `transform` animation only, opacity 0.06, and **disabled
     entirely under `prefers-reduced-motion`**.
   - Scripts: D3, MediaPipe, Lucide already loaded at the bottom — keep `defer`; lazy-load the
     tree + webcam modules only when their tab opens (via dynamic `import`/script injection).
   - Tree SVG: debounce `ResizeObserver` + zoom handlers (rAF throttle); don't re-render the
     whole tree on every selection — toggle classes on nodes.
6. **Micro-interactions:**
   - Buttons: press `scale(0.98)`, gold glow on hover (`--shadow-gold`), focus ring 3px.
   - Upload drag-over: gold border + soft gold wash + icon pulse.
   - Toasts slide up + fade; copy-invite button shows a check state for 1.5s.
   - Priority pills: tiny gold/amber/sage dot that eases in on selection.

---

## 5. Adaptable for all — accessibility (WCAG 2.2 AA)

- **Focus:** visible 3px focus ring (`--shadow-gold`) on every interactive element via
  `:focus-visible`; `:focus` ring suppressed for mouse clicks only.
- **Keyboard:** case list arrow-key navigation, tablist arrow keys (exists — keep + verify),
  drawer/modal focus trap + `Escape` close + return focus, skip-to-content link at top.
- **Semantics & SR:** landmark `<header>/<main>/<nav>`; `aria-live="polite"` on upload status,
  toasts, transcript, fact-check results; `aria-expanded` on collapsibles (already present —
  verify); `role="tablist/tab/tabpanel"` + `aria-selected` (verify); icon-only buttons get
  `aria-label`; donut gets `aria-label` + a visually-hidden numeric legend.
- **Contrast (verified pairs on white):**

| Use | Pair | Ratio |
|---|---|---|
| Body text | `#23211C` on `#FFFFFF` | 15.9:1 ✅ |
| Secondary text | `#55503F` on `#FFFFFF` | 8.9:1 ✅ |
| Gold text (labels) | `#8A6A1F` on `#FFFFFF` | 5.6:1 ✅ |
| Gold button (white text) | `#FFFFFF` on `#A87E2F` | 4.6:1 ✅ (use gold-600 for fills w/ white text) |
| High pill | `#B3402E` on white / white on `#B3402E` | 5.5:1 / 6.4:1 ✅ |
| Medium pill | `#D97706` on white | 3.9:1 ⚠️ → use `#C25606` for text-on-white, fill w/ white text OK |

- **Not-color-alone:** High/Medium/Low badges also carry an icon (▲/●/▼ or Lucide glyph) and
  optional text label — never color alone.
- **Reduced motion:** global `@media (prefers-reduced-motion: reduce)` — kill blob drift,
  count-up, card float, shimmer; keep 0.1s opacity fades only. JS checks the same media query
  before starting the rAF loops.
- **Zoom & text:** no fixed heights on cards/rows (min-height + auto); everything reflows at
  200% zoom and 125% text scale; inputs `font-size ≥ 16px` to prevent iOS zoom-on-focus.
- **Touch:** all tappable targets ≥ 44×44px; case drawer drag-handle; safe-area insets
  (`env(safe-area-inset-*)`) for notched phones; Chakshu camera warns when permission denied.

---

## 6. White & Gold visual pass (page by page)

- **Logo/header:** gold gradient disc (scale icon, white stroke) on white pill; "Anavaya" in
  Fraunces 800 charcoal; tagline in `--gold-700` caps.
- **Stats:** white cards, `--radius-card`, gold numerals for Total; donut slices High
  crimson / Medium amber / Low sage with white ring gap; category bars gold.
- **Tabs:** white pill rail on `--bg-well`; active tab = gold fill, white text, soft shadow;
  hover = gold-100 wash.
- **Priority pills:** High = crimson fill/white text + ▲ icon; Medium = amber (darkened
  `#B45309` fill/white text) + ● icon; Low = sage fill/white text + ▼ icon.
- **Analysis boxes:** white cards with gold left rule (6px `--gold-500`) for opinion/duty;
  rights cards gold tags; verdict chips keep red/amber/sage semantics.
- **Tree viz:** canvas on `--bg-well`; decision nodes white with gold border; leaf fills =
  priority colors (color-blind-safe); active path = gold glow; node panel white with gold accent.
- **Chakshu:** gauge ring gold when calm → amber → crimson as arousal rises; metrics cards white;
  webcam frame = 2px gold.
- **Courtroom:** lobby cards white/gold; participant tiles dark video wells with gold name tags;
  Judge badge gold; phase bar gold.
- **Case workflow:** registry rows white, gold hover accent; wizard modal white with gold
  header rule; dropzone gold dashed border on drag.
- **Loaders:** keep the book-loader charm but re-skin cover to gold; spinner bars gold.

---

## 7. File-level implementation plan

| File | Changes |
|---|---|
| `static/tokens.css` **(new)** | All tokens from §2; imported first by the 3 stylesheets |
| `static/style.css` | Delete local `:root` duplicates → reference tokens; re-skin to white/gold; **remove skew + hover-expand on `.case-item`**; unify radii; fluid type; new 4-tier breakpoints; focus rings; reduced-motion block; performance guards (§4) |
| `static/index.html` | Skip link, landmark roles, sr-only donut legend, `aria-live` regions, minimal structural hooks (no layout overhaul) |
| `static/app.js` | Reduced-motion-aware count-up/donut; tab-fade; drawer + modal focus management; debounce tree handlers; `aria-expanded` sync |
| `static/case-workflow.css` | Reference tokens; white/gold re-skin; unify breakpoints; focus rings; 44px targets |
| `static/case-workflow.js` | `aria-live` on upload status + fact-check; escape HTML audit (already present) |
| `static/courtroom.css` | Reference tokens; white/gold re-skin; responsive video grid + stacked panels |
| `static/courtroom.html` | Landmark roles, `aria-label`s on icon buttons, `aria-live` transcript |
| `static/courtroom.js` | Focus management on join; reduced-motion guard for any intro animations |

No backend/API changes. No new libraries. Fonts stay Fraunces + Nunito.

---

## 8. Phases (each independently shippable)

1. **P1 — Token foundation + theme re-skin (Dashboard).** Create `tokens.css`; swap style.css +
   index.html to white/gold; verify all 5 tabs. *(Biggest visible change.)*
2. **P2 — Smoothness & responsive unification (Dashboard).** Remove skew/hover-expand;
   4-tier breakpoints; drawer on tablet; tab fades; skeleton/paint perf guards.
3. **P3 — Case workflow + Courtroom.** Re-skin both to tokens/white-gold; responsive grids;
   focus rings.
4. **P4 — Accessibility & validation.** Focus management, `aria-live`, contrast fixes,
   reduced-motion, then full validation pass.

**Validation (each phase, in browser via Chrome DevTools/Playwright):**
- 1440px / 1024px / 768px / 375px screenshots — upload → analyze → details → tree → Chakshu →
  courtroom lobby.
- Keyboard-only pass (Tab + arrows + Enter/Escape); forced `prefers-reduced-motion`.
- **axe/Lighthouse** accessibility scan (target: 0 critical/serious).
- 200% browser zoom + 125% text-scale reflow check.
- Console error check on every tab switch; WebSocket stability unchanged.
- Existing backend e2e scripts (`test_case_workflow_e2e.py`, `test_courtroom_e2e.py`) must stay green.

---

## 9. Non-goals (this pass)

- No dark mode (light white & gold only, per request — tokens make a future dark theme trivial).
- No i18n/Hindi (can be layered on later via a dictionary + `lang` handling).
- No build step, no frameworks, no new CDN dependencies.
- No backend/API/data-schema changes.
- No redesign of page structure — this is a theme + smoothness + adaptability pass.
