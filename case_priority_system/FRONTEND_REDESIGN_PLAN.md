# Anavaya Dashboard — Front-End Redesign Plan

> Status: **Implemented** (all 5 phases done; Playwright validation 20/20, zero console errors) ·
> Scope: Dashboard (`index.html` / `style.css` / `app.js`) only — the Live Courtroom page (`courtroom.*`) stayed untouched.
> Stack: **Vanilla HTML/CSS/JS, no build step** — Flask keeps serving `case_priority_system/static/`.
> No backend/API changes required (all endpoints already exist).

---

## 1. Direction

**Refine the existing wabi-sabi organic identity — don't throw it away.**

| Keep (the DNA) | Refine (the execution) |
|---|---|
| Rice-paper off-white background (`#FDFCF8`) | Add a consistent **spacing scale** (4/8/12/16/24/32/48) — today spacing is ad-hoc (`24px`, `14px`, `20px`, `22px`…) |
| Moss green `#5D7052` / terracotta `#C18C5D` / burnt sienna `#A85448` palette | Keep the palette but add **semantic tokens**: `--danger`, `--warning`, `--success` mapped to High/Medium/Low everywhere |
| Fraunces serif headings + Nunito body | Tighter **type scale**: one heading size per level, consistent `line-height: 1.6–1.7` for legal text blocks |
| Organic asymmetric border radii | **Reserve organic radii for hero/feature elements** (header pill, empty states, stat cards). Data-dense cards (case rows, param chips, rights cards) switch to **soft standard radii** (`12–16px`) so lists scan cleanly |
| Floating pill header, blob ambience | Keep, but add **focus rings, `prefers-reduced-motion` support**, and a quieter noise overlay |
| Elevation | Centralize into 2–3 shadow tokens (`--shadow-card`, `--shadow-float`, `--shadow-panel`) instead of per-component values |

Design principle for this pass: **"calm on the outside, rich on the inside."** Structure first; the organic personality lives in headers, hero, empty states, and micro-interactions — not in every card.

---

## 2. Layout restructuring

### 2.1 Header
- Keep the floating pill. Add:
  - Engine status → **live status chip** (System Active / Model loaded / Degraded) driven by a lightweight `/api/status`-style check from existing data (fallback: static as today).
  - **Keyboard shortcut hint** `⌘K / Ctrl+K` to focus the case search.
- Slightly reduce header height (44px logo, tighter padding) to give the content more room.

### 2.2 Stats row → "Triage summary" panel
Current: 4 flat stat cards.
New: one panel with:
- **Total handled** (large numeral, Fraunces) + **priority donut** (High/Medium/Low slices, animated on load) + a **category breakdown** (compact horizontal bars, top 6 categories).
- **Clicking a priority slice filters the case list** (reuses existing filter logic) — stats become controls, not decoration.
- Progress-count animations (count up) on first paint; respects `prefers-reduced-motion`.

### 2.3 Case sidebar — **the hover-expand problem**
Current problems (confirmed): skewed cards (`skewX(3deg)`) + cards that **expand 85px → 245px on hover** — jittery on trackpads, broken on touch, uneven list height.
New design:
- **Remove skew and hover-expand entirely.** Uniform fixed-height rows.
- Each row shows at all times: priority dot + badge, case title (1-line ellipsis), category pill, and a 2-line preview.
- **Selection happens on click** (not hover): selected row gets a moss-green left accent bar + tinted background; expanded metadata (summary, severity/vulnerability/influence chips, download button) reveal in a **dedicated detail card pinned below the list** or as an inline expand with chevron — one open at a time.
- Hover shows only a subtle lift + border tint (no layout shift).
- Keep search + priority/category filters in the sticky header of the sidebar; **debounce search** (150ms) and keep results stable while typing.
- **Skeleton rows** (shimmer) while `/api/cases` loads instead of "Loading cases…".

### 2.4 Case details panel — **the "too much content in tabs" problem**
Current: one long vertical scroll of 9 stacked sections inside a single tab.
New structure:

```
[Tab bar: Summary & Analysis | Decision Tree | Lie Detector | Courtroom]

Summary & Analysis tab:
┌────────────────────────────────────────────────┐
│ Hero: priority badge + urgency + category,      │
│       title, parties, Download PDF button       │
├───────────────────────┬────────────────────────┤
│ LEFT (facts, ~40%)    │ RIGHT (analysis, ~60%)  │
│ • Plain summary       │ • Constitutional rights │
│ • Param chips         │   (primary/secondary)   │
│   (severity,          │ • State's duty          │
│    vulnerability,     │ • Balancing/proport-    │
│    influence, model   │   ionality              │
│    category)          │ • Doctrines             │
│ • Decision path steps │ • Full opinion          │
│   (collapsible,       │ • Priority rules        │
│   "show trace")       │   (collapsible)         │
└───────────────────────┴────────────────────────┘
```

- **Two-column layout ≥ 1100px**; single column with an **in-page sticky mini-nav** (Summary / Analysis / Path) + scroll-spy below that.
- Long-form sections (Full opinion, Balancing, Priority rules) become **collapsible `<details>`-style** with the first ~3 lines always visible; **Summary and Param chips always open**.
- Parameter "cards" (4 boxes) become **one compact chips row** — same data, 1/4 the height.
- **Decision Path Trace Steps move into the Decision Tree tab** (it's tree data — belongs with the tree) and live as a **textual breadcrumb** (see §3).

### 2.5 Tabs
- Keep the 4 tabs but relabel for clarity: **"Analysis"**, **"Decision Tree"**, **"Chakshu (Lie Detector)"**, **"Courtroom"**.
- Tab pills get `role="tablist"` semantics + keyboard arrows; active tab keeps moss fill.

---

## 3. Decision Tree viz — **usability problem**

Current: one giant D3 tree with pan/zoom, hover tooltips, dimmed non-path nodes. Users report it's hard to navigate.

New:
1. **Control bar** above the canvas (replaces the static label):
   - Zoom in / zoom out / **fit-to-view** buttons
   - Toggle: **"Active case path only"** — collapses everything off the selected case's path (explainability-first view)
   - Toggle: **"Show leaf proportions"** — leaf nodes display sample counts (already in data)
2. **Click a node → side panel** (right, 280px) with the full decision text:
   - Condition, case value, threshold, matched/unmatched, and "why" in plain English (reuse `describe_condition` data from `/api/tree`)
   - Click leaf → priority verdict + link back to Analysis tab
3. **Textual breadcrumb** above the canvas for the active case:
   `Root → severity > 2.5 → influence > 0.5 → … → Leaf 7 (High)` — a judge can read the whole path in one line.
4. **Better visuals:** larger node text (12–13px), **color-blind-safe leaf fills**, dashed inactive links, smooth `transition` on zoom changes.
5. Node search: type a feature name (e.g., "severity") to highlight all nodes splitting on it.

---

## 4. Micro-interactions & polish (the "refine" layer)

- **Skeleton loaders** for cases list, details, tree, rights grid (replaces text loaders).
- **Empty states** upgraded: illustrated icon + short copy + primary action (e.g., "Upload a case PDF").
- **Upload flow:** drag-and-drop zone on the upload button; show real progress (current overlay book-loader is charming — keep, but add progress % and stage text from the response timing).
- **Reduced motion:** global `@media (prefers-reduced-motion: reduce)` killing blob drift, card float, count-up.
- **Focus & keyboard:** visible 3px focus rings (`--focus-ring`), case list arrow-key navigation, tab arrows.
- **Toast/notify** component for upload errors/success (replaces alert-style messages, if any).

---

## 5. Responsive behavior

| Breakpoint | Behavior |
|---|---|
| ≥ 1200px | Two-column details, full stats panel |
| 900–1199px | Details single column + sticky mini-nav; stats stack 2×2 |
| < 900px | Sidebar becomes a **case drawer** (slide-over, hamburger); details full width; tree gets larger zoom-out default |
| < 480px | Chips wrap; header condenses to logo + status dot |

---

## 6. File-level implementation plan (for the build phase)

The redesign is **structure + CSS tokens + JS interaction changes** — no new dependencies.

| File | Changes |
|---|---|
| `static/style.css` (2635 ln) | Reorganize into labeled sections; introduce token scales (§1); rewrite case-item, stats, details-layout, tree-controls components; add skeletons, focus, reduced-motion, responsive rules. **No visual style change to courtroom.css.** |
| `static/index.html` (380 ln) | Restructure stats section, sidebar rows, details two-column layout, tabs labels/ARIA, breadcrumb container, drag-drop upload zone. |
| `static/app.js` (1287 ln) | Case-list rendering (rows + click-select, no hover-expand), debounced search, stats donut + click-to-filter, details renderer (two-column/collapsible), tree control bar + breadcrumb + node side panel, skeletons. |

**Ordered phases — all ✅ completed:**
1. **Foundation** — CSS tokens, spacing/radius scales, focus + reduced-motion, skeleton primitives. *(No visual regression if done as tokens first.)*
2. **Sidebar & stats** — row rework + donut panel (biggest visible change).
3. **Details restructure** — two-column, collapsible sections, chips row.
4. **Tree upgrades** — controls, path-only toggle, breadcrumb, node side panel.
5. **Polish pass** — empty states, drag-drop, toast, keyboard nav, responsive drawer.

**Validation (each phase):**
- Manual browser pass via Playwright/browser-use: upload → analyze → details → tree → courtroom lobby link, at 1440px / 1024px / 768px.
- Keyboard-only pass (Tab + arrows) and forced `prefers-reduced-motion`.
- Console error check on every tab switch.
- No backend changes → existing `test_courtroom_e2e.py` and API flows must remain green.

---

## 7. Explicit non-goals (this pass)

- No changes to `courtroom.html/css/js` (Live Courtroom) — separate phase.
- No backend/API changes.
- No build tooling, no framework, no new CDN libs (keep D3, MediaPipe, Lucide as-is).
- No dark mode (can layer on later via the same tokens).
- No data-schema changes to `/api/cases` payloads.
