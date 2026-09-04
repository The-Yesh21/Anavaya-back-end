# Anavaya — Project Handoff & Current State

> **READ ME FIRST.** This file is the single source of truth for the *current* state of the
> project. Read this before exploring the code. When anything changes (feature added, file
> renamed, pipeline altered), **append an entry to the Update Log (§11)** so the next session
> starts from the latest reality instead of stale documentation.
>
> Last updated: **2026-08-13** · Companion docs: root `README.md` (getting started),
> `case_priority_system/README.md` (deep detail), `case_priority_system/PROJECT_CONTEXT.md`
> (mission + LLM contract), `case_priority_system/FRONTEND_REDESIGN_PLAN.md` (UI redesign record).

---

## 1. What the project is — one paragraph

**Anavaya** is an AI-powered **case priority / triage system for judicial authorities**.
It reads legal documents (FIRs, complaints, court pleadings, judgments — PDFs), extracts
structured facts, and classifies each case as **High / Medium / Low priority** so that
overburdened courts hear the most urgent matters first. Every verdict ships with a
plain-language summary, a **constitutional justification** (Constitution of India), an
explainable **decision path** (Mermaid/DOT flowchart), and a printable PDF report. It also
includes two advanced modules: **Chakshu**, a browser-based lie-detection/evidence
fact-checking workflow, and a **Live Courtroom**, a WebRTC multi-role mock trial room.

**Founding invariant (do not break):** the LLM *extracts and summarizes only*; the
**Decision Tree alone decides priority**. Priority decisions must stay deterministic,
reproducible, and auditable by a judge. The constitutional analysis is rule-based too —
never LLM-generated.

---

## 2. Architecture — hybrid LLM + Decision Tree

```
PDF text ──► [LLM: local Ollama qwen2.5:3b on NVIDIA GPU] ──► structured features + plain summary
                                          │
                                          ▼
                     [Decision Tree (scikit-learn CART)] ──► High / Medium / Low priority
                                          │
                                          ▼
          [Rule-based constitutional analysis] ──► rights engaged, state duty, opinion
                                          │
                                          ▼
     case_results.xlsx + decision_graphs/*.md + *.dot + reports/*_report.pdf + case registry
```

- **8 legal categories** (`case_category`): Excise/Tax · Customs/Import-Export ·
  Company/Winding Up · Insolvency/Debt · Constitutional/Writ · Property/Land ·
  Criminal/Violent · General Civil — mapped downstream to 4 broad model `crime_type` buckets.
- **Features extracted:** `main_parties`, `case_category`, `crime_type`, `severity`
  (Fatal/Major/Minor/No Injury), `vulnerability` (High/Med/Low), `influence` (High/Low),
  `plain_summary`. Priority signal strength: `crime_type`+`severity` > `vulnerability` >
  `influence` > summary text (TF-IDF).
- **Constitutional grounding:** Art. 21 (life/liberty), Art. 14 (equality), Art. 19(1)(g)
  (trade), Arts. 23–24 (exploitation), Art. 32/226 (writs), Art. 265 (no tax without law),
  Art. 300A (property) — full rules in `case_priority_system/CONSTITUTION_GUIDELINES.md`.

---

## 3. Feature map (what the system can do today)

| Module | What it does | Where |
|---|---|---|
| **Case Board / Dashboard** | List, search, filter cases; priority donut; category bars; skeleton loaders; keyboard nav | `static/index.html`, `app.js`, `style.css` |
| **Decision Tree viz** | D3 tree, pan/zoom, "active path only", breadcrumb, node inspector, leaf proportions | `static/app.js` + `/api/tree` |
| **Single PDF upload** | Upload → extract → predict → report → Excel row | `POST /api/upload` |
| **Case workflow** | Create New Case wizard (name or FIR or auto-ID `ANV-YYYY-NNNN`), multi-document evidence upload, analyze-all, **aggregate priority** (highest doc wins, safety-first) | `scripts/case_manager.py` + Case tab |
| **Chakshu** | Webcam physio analysis (arousal/deception gauge, MediaPipe), speech-to-text examiner/witness transcript, session save, **hybrid evidence fact-check** (contradicted / consistent / unverified + credibility index + LIE flags), dossier export (.md) | `scripts/fact_checker.py`, `case-workflow.js` |
| **Live Courtroom** | WebRTC video rooms, roles (Judge/Prosecution/Defense/Witness…), WS signaling relay, transcript, judge-controlled phases, transcript download, **automatic speech transcription** (speak → recorded → openai-whisper on GPU → grammar-corrected by Ollama → transcript with playable audio clip) | `scripts/courtroom_manager.py`, `courtroom_asr.py`, `courtroom.*` |
| **PDF case reports** | Polished printable per-case report (pipeline + constitutional analysis) | `scripts/generate_case_report.py`, `reports/` |
| **Constitutional analysis** | Deterministic "State's Perspective" — rights engaged, state duty, balancing/proportionality, doctrines (Parens Patriae, Proportionality, Natural Justice…), full opinion, priority rules | `scripts/constitutional_analysis.py` |
| **Model training** | Decision Tree trainer (synthetic + real PDF rows); optional PyTorch NN (not in pipeline) | `scripts/train_model.py`, `nlp_dl_model.py` |
| **LLM ops** | Ollama setup/pull, connectivity test, LoRA fine-tuning of Qwen2.5-3B (2 stages, see §8) | `scripts/setup_ollama.py`, `test_ollama.py`, `finetune_qwen_*.py` |

---

## 4. How to run

```powershell
# From the repo ROOT (F:\major_project) — all scripts assume the case_priority_system/ prefix
python -m uvicorn case_priority_system.app:app --host 127.0.0.1 --port 8000 --ws-ping-interval 0
```

- Open **http://127.0.0.1:8000**.
- **`--ws-ping-interval 0` is required** — the Live Courtroom WebSocket dies under
  Uvicorn's default 20s ping + 20s pong timeout (40s window kills quiet participants).
- **GPU/LLM mode:** if an NVIDIA GPU is present and local Ollama (`http://localhost:11434`,
  model `qwen2.5:3b`) is reachable, uploads use LLM feature extraction (~10–60s). Otherwise the
  deterministic rule-based extractor runs (~2s). Force with `ANAVAYA_USE_LLM=1` / `0`.
  Verify GPU usage with `ollama ps` (should show `100% GPU`).

CLI entry points (all from repo root):
```powershell
python case_priority_system/scripts/inference_pipeline.py   # re-run PDF triage on root *.pdf files
python case_priority_system/scripts/train_model.py          # retrain decision tree
python case_priority_system/scripts/predict.py              # standalone prediction demo
python case_priority_system/scripts/test_ollama.py          # Ollama connectivity check
```

No `requirements.txt` exists. Key deps: `pandas`, `numpy`, `scikit-learn`, `torch`,
`PyMuPDF` (fitz), `fastapi`, `uvicorn`, `openpyxl`, `requests`, `tqdm`.

---

## 5. Key files (current layout)

```
F:\major_project
│   PROJECT_HANDOFF.md              # ← this file
│   README.md                       # master getting-started
│   *.PDF                           # raw input case documents (triage source)
│   Anavaya_Presentation.pptx       # project deck (build_ppt.py regenerates it)
│
└───case_priority_system
    │   app.py                      # FastAPI backend (all API + WebSocket routes)
    │   case_results.xlsx           # primary output dataset (Excel)
    │   CLAUDE.md · PROJECT_CONTEXT.md · CONSTITUTION_GUIDELINES.md · README.md
    ├───scripts/                    # pipeline + support scripts (see §3 table)
    ├───static/                     # index.html · app.js · style.css · case-workflow.js/css ·
    │                               # courtroom.html/js/css
    ├───data/                       # synthetic_cases.csv · real_report_training_cases.csv ·
    │                               # constitutional_training_cases.csv (stage-2 FT)
    ├───models/                     # priority_classifier.pkl (decision tree bundle) ·
    │                               # priority_dl_model.pth (optional NN) · training_report.txt
    ├───reports/                    # generated *_report.pdf case reports
    ├───decision_graphs/            # per-case *_decision_report.md (Mermaid) + *.dot
    ├───cases/                      # case registry (ANV-*.json + _index.json)
    └───courtrooms/                 # persisted trial rooms (room_id.json)
```

---

## 6. REST API surface (backend `app.py`)

| Method & path | Purpose |
|---|---|
| `POST /api/upload` | Single PDF → full pipeline → Excel row + registry case |
| `GET /api/cases` | All rows from `case_results.xlsx` (dashboard feed) |
| `GET /api/cases/{file}/report.pdf` | Serve / rebuild on-demand PDF report |
| `GET /api/cases/{file}/decision-path` | Exact decision-tree trace for one case |
| `GET /api/tree` | Serialized global decision tree (D3) |
| `GET /api/gpu-status` | GPU + LLM-mode badge data (cached CUDA probe) |
| `POST /api/cases` | Create case (title and/or FIR) |
| `POST /api/cases/{id}/documents` | Attach evidence PDF (FIR/Police Report/Medical/Statement/Other) |
| `POST /api/cases/{id}/analyze` | Analyze all unanalysed docs; refresh aggregate |
| `GET /api/cases/{id}` · `GET /api/case-registry` | Case detail / registry summaries |
| `GET /api/cases/{id}/documents/{doc}/download` | Serve stored document PDF |
| `POST /api/cases/{id}/sessions` | Save Chakshu session (physio + transcript) |
| `POST|GET /api/cases/{id}/fact-check` | Run / fetch hybrid fact-check report |
| `GET /api/cases/{id}/dossier` | Full case export as Markdown |
| `POST|GET /api/court/rooms` · `GET /api/court/rooms/{id}` | Courtroom CRUD / state |
| `POST /api/court/transcribe` | Recorded speech segment (WAV) → openai-whisper (GPU) → grammar-corrected by Ollama → transcript entry + broadcast (`503 asr_unavailable` when ASR engine missing) |
| `GET /api/court/rooms/{id}/audio/{file}` | Serve/download a recorded speech clip |
| `GET /api/court/rooms/{id}/transcript` | Transcript Markdown download |
| `WS /ws/court/{room_id}` | WebRTC signaling + transcript/roster broadcast |
| `GET /court/{room_id}` | Trial page (room id read client-side) |
| `GET /` + static mount | Dashboard `index.html` (mount must stay last) |

---

## 7. Recent updates — what changed since the last handoff

Timeline from git history (commits are terse — "Adding"); the notable milestones:

- **2026-08-12 (HEAD):** final "Adding" commits — current working tree is **clean**.
- **2026-08-09 — Instant priority pipeline, expanded constitutional knowledge, PDF case reports:**
  - **Instant/rule-based pipeline:** `fast_extract_features()` + `tune_case_features()` give a
    ~2s deterministic upload path when the GPU LLM is unavailable (no Ollama needed).
  - **Expanded constitutional knowledge:** full "State's Perspective" module
    (`constitutional_analysis.py`) — rights engagement, state duty, proportionality, doctrines,
    full opinion, detailed priority rules; wired into `app.py` uploads, Excel, and dashboard.
  - **PDF case reports:** `generate_case_report.py` produces printable reports in `reports/`,
    downloadable from the dashboard (`/api/cases/{file}/report.pdf`).
- **2026-07-27 — "Adding the langchain":** `langchain_summarizer.py` (Ollama single-call
  structured extraction + summary).
- **2026-06-12 — first commit.**

Frontend redesign (see `case_priority_system/FRONTEND_REDESIGN_PLAN.md`): **all 5 phases
implemented** — token scales (spacing/radius/shadows), triage-summary panel with priority donut
(click-to-filter), fixed-height case rows (no hover-expand), two-column details with
collapsible sections, tree control bar + breadcrumb + node inspector, skeletons, drag-drop
upload, toast, keyboard nav, `prefers-reduced-motion`. Validated **20/20 via Playwright,
zero console errors**. Courtroom UI intentionally untouched.

---

## 8. Work-in-progress / optional paths

- **Qwen2.5-3B LoRA fine-tuning (not part of the live pipeline):**
  - Stage 1 — `finetune_qwen_lora.py`: teach extraction JSON format
    (`Qwen/Qwen2.5-3B-Instruct`, 4-bit, → `models/qwen2.5-3b-legal-lora`).
  - Stage 2 — `finetune_qwen_stage2.py`: category-reasoning on
    `data/constitutional_training_cases.csv` (→ `models/qwen2.5-3b-legal-lora-v2`).
  - Support: `generate_constitutional_data.py` (builds stage-2 data),
    `smoke_test_stage2.py` (verifies adapter loads).
  - **Note:** the LoRA adapter directories are **not present in the committed `models/`**
    (only `.pkl`/`.pth`/`.txt`). Treat fine-tuning as scripts-ready, checkpoints-not-committed.
- **Real-judgment dataset builder:** `build_real_judgment_dataset.py` downloads Indian High
  Court judgment PDFs (KanoonGPT/indian-case-laws on HuggingFace → public AWS S3), runs the
  production deterministic extractor, and adds labeled rows to `real_report_training_cases.csv`.
- **PyTorch NN** (`nlp_dl_model.py`): optional; not used by the inference pipeline.

---

## 9. Gotchas & operational notes

- **Run everything from `F:\major_project` (repo root)** — scripts use the
  `case_priority_system/` prefix; running from inside the folder breaks imports/paths.
- **Do not reorder `app.py` routes:** case-workflow and courtroom endpoints must be declared
  *before* the catch-all `app.mount("/", StaticFiles(...))` at the bottom.
- **Uvicorn ping:** forget `--ws-ping-interval 0` → courtroom participants silently drop
  after ~40s of quiet.
- **Automatic speech transcription** (courtroom) uses the `openai-whisper` package
  (`pip install openai-whisper`; model `small`, override with `WHISPER_MODEL`). It runs on
  the NVIDIA GPU via the already-installed torch; the ~460 MB model downloads once into
  `~/.cache/whisper` on first use. Segments are WAV (16 kHz mono) and decoded with the
  stdlib `wave` module, so ffmpeg isn't required. If the engine is missing the client
  falls back to the browser's own speech recognition for the local speaker only (one-time
  toast explains this).
- **LLM never decides priority.** Any change that lets the LLM influence the final
  High/Medium/Low violates the core invariant (§1).
- **`case_priority_system/case_priority_system/`** is a legacy nested copy — the live app reads
  from `case_priority_system/`; don't confuse the two.
- **Upload safety:** filenames are validated (`[A-Za-z0-9 _\-().]+\.pdf`) and stored in the OS
  temp dir, never the repo root — keep it that way.
- **Test scripts:** `test_case_workflow_e2e.py`, `test_courtroom_e2e.py` (root) exercise the
  workflow + courtroom; `probe_ws.py`, `verify_ping_timeout.py`, `debug_e2e_repro.py` are
  WebSocket debugging utilities.
- **State on disk:** case registry → `case_priority_system/cases/`; trial rooms →
  `case_priority_system/courtrooms/` (both survive restarts). Excel `case_results.xlsx` is the
  dashboard's data source — corrupt/delete it and the board is empty.

---

## 10. Known limitations / natural next steps

- No authentication (single-user local tool) — fine for demo, needs work before any deployment.
- Dashboard is the only read layer over Excel; a real DB would remove the Excel round-trip
  (list cells currently round-trip as string reprs — see `_parse_list_cell`).
- LLM feature extraction depends on a local GPU + Ollama; the rule-based fallback is the
  portable path.
- Fine-tuned Qwen adapters are not committed; re-run `finetune_qwen_*` + `smoke_test_stage2`
  to restore if needed.
- Dark mode, auth, and database-backed storage are explicitly deferred.

---

## 11. Update Log

When anything in this project changes, append an entry here (date · what changed · why).

| Date | Change |
|---|---|
| 2026-08-16 | **Automatic courtroom speech transcription:** every participant's client voice-activity-detects their own mic, records each speech segment (MediaRecorder → 16 kHz mono WAV), and POSTs it to the new `/api/court/transcribe` endpoint. The server stores the clip under `courtrooms/audio/{room_id}/`, transcribes it with **openai-whisper** on the NVIDIA GPU (model `small`; the Ollama whisper models were removed from Ollama's library, so `pip install openai-whisper` is the ASR path), grammar-corrects it with `qwen2.5:3b`, appends it to the transcript as that speaker's statement with the clip attached (new `audio_file` field on `TranscriptEntry`, playable/downloadable in the UI and echoed in the Markdown export), and broadcasts it live to the room. New `courtroom_asr.py` helper module; `correct_transcript` refactored to share its LLM prompt. Graceful degradation: if the ASR engine is missing the endpoint returns `503 asr_unavailable` and the client falls back to auto-submitting the browser's own speech recognition for the local speaker (one-time toast + status line). New Auto toggle in the courtroom action bar. |
| 2026-08-15 | **Implemented the White & Gold front-end redesign** (`FRONTEND_DESIGN_PLAN.md`): `tokens.css` is now the single shared token source (`@import`ed by `style.css`, `case-workflow.css`, `courtroom.css`); all moss-green/terracotta/rice-paper literals replaced with gold/ivory/crimson/amber/sage palette (CSS + JS tree colors, Chakshu mesh overlay, courtroom role colors); legacy skew + 85→245px hover-expand case rows removed; responsive unified to 4 tiers (≥1200 / 900–1199 / 600–899 / <600) with tablet drawer + horizontally-scrolling tabs; added skip-link, tablist `aria-selected`/arrow-key nav, `aria-live` regions, courtroom dialog semantics. Also fixed a **pre-existing bug**: `courtroom.html` referenced `courtroom.css`/`courtroom.js` relatively, so on `/court/{room_id}` the browser fetched HTML instead of the assets — now absolute paths, page loads clean. Validated: workflow e2e passes, dashboard + courtroom load with zero console errors at 1440/1024/768/375px. |
| 2026-08-13 | Created `FRONTEND_DESIGN_PLAN.md` (root): approved direction = **White & Gold light theme** across all pages, smoothness (no-layout-shift motion, perf guards) + adaptability (WCAG 2.2 AA, unified 4-tier responsive). **PLAN ONLY — implementation pending user approval.** |
| 2026-08-13 | Created this handoff doc from current codebase state (post-frontend-redesign, post-instant-pipeline, post-PDF-reports, case workflow + Chakshu + Courtroom live). |
| 2026-09-01 | **Image OCR WebP/BMP/TIFF support + analysis error visibility:** Added Pillow-based format conversion in `image_ocr.py` so EasyOCR can process WebP, BMP, and TIFF images (EasyOCR's imageio backend doesn't natively support these). Corrupt files fail gracefully. Updated `case-workflow.js` to surface per-document `analysis_errors` from the Analyze All endpoint — previously these were silently swallowed, leaving documents stuck at "Analysis pending" with no explanation. |
| 2026-09-03 | **Live Courtroom face & expression analysis (nervousness cues):** new "Face & Expression" panel in the courtroom left column (every role, self-camera) powered by lazy-loaded MediaPipe FaceMesh (same pattern as Chakshu). Detects **lip movement / expression cues** — lip pressing (inner-lip compression vs. neutral baseline), lip trembling (rolling jitter of mouth opening), frowning (mouth-corner sag), furrowed/raised brows, rapid blinking (EAR z-score, bpm), gaze avoidance (iris ratio) — after a ~4 s neutral calibration. Combines the z-scores + active-cue count into a live 0–100 nervousness gauge; auto-logs observations to the official transcript as new `kind='behavior'` entries (WS message `behavior` → `record_behavior` in `courtroom_manager.py` → broadcast `transcript_entry`, persisted to room JSON, rendered distinctly in the UI, Markdown export (`⚠ [ts] Role (Name):` line), and the transcript PDF (amber `.entry-behavior` block). Rate-limited logging (12 s) with a final session summary on Stop; camera/analysis cleanly torn down on Disable/leave. Verified: `py_compile` + `node --check`, WS behavior broadcast + disk persistence, PDF export with behavior entries, Playwright join-flow check (panel renders, zero console errors). Note: the running server on :8000 needs a restart to pick up the new code. |
| 2026-09-03 | **Live Courtroom WebRTC video mesh + remote face analysis:** every participant now shares **audio + video** (`ensureLocalStream` requests both with an audio-only fallback when the camera is denied; `createPeerConnection` uses `addTransceiver` for audio+video receive and `ontrack` routes video to persistent muted per-tile `<video>` elements while audio keeps flowing through the hidden `<audio>` element). Newcomers only offer once their stream is ready (`drainPendingOffers` + `upgradePeerWithTracks` renegotiation fix a pre-existing race where offers were sent before tracks existed — audio had the same latent bug). Roster tiles got a live video preview slot (avatar = fallback) + a self video on/off toggle next to the mic toggle; join note mentions video. The **Face & Expression analyzer now has an "Analyze" source dropdown** (My camera or any remote participant by role — e.g. the Judge watches the Witness's feed); `#face-video` mirrors whichever feed is selected (`face-video-wrap.mirror` only for self) and `enableFaceCamera` reuses the mesh stream when possible, only asking the browser for a dedicated stream on audio-only joins; never stops shared streams on disable. Also **migrated the analyzer from the deprecated `@mediapipe/face_mesh` solution bundle to `@mediapipe/tasks-vision@1.0.1` FaceLandmarker** (the legacy bundle throws `Cannot read properties of undefined (reading '…packed_assets.data')` when frames are sent before its model finishes loading): `createFromOptions` resolves only when ready (race gone), GPU delegate with CPU fallback, 478 landmarks so all existing indices incl. iris 468/473 hold, frames driven by a rAF loop instead of the mediapipe Camera helper (which would grab its own camera when the monitor has no stream yet). Validated headless with two fake-camera clients: video flows both ways (readyState 4), roster previews render, remote feed analyzable, zero console errors; the dashboard's Chakshu still uses the legacy bundle and can be migrated the same way if it ever shows the same error. |
| 2026-09-03 | **Hold to Talk mic access fix:** push-to-talk previously reused the single mic stream captured at join time; if that request failed (blocked/dismissed permission prompt, camera bundled into the same prompt, room opened over plain-http LAN where `getUserMedia` doesn't exist), the button failed silently with a vague "Microphone unavailable" toast. `courtroom.js` now requests a dedicated audio-only stream when the shared stream has no audio tracks (re-triggering the browser permission prompt on press), and every failure surfaces an actionable reason — blocked permission (with how to allow it), no mic found, mic busy in another app, or insecure connection — in the toast, ASR status line, and Hold to Talk button tooltip. Rooms opened over plain http on a network address show a join-card warning banner that mic/video need https or localhost, with the exact `http://localhost:8000/court/{room}` URL to use instead. Verified headless (Chromium, fake devices): granted mic → recording starts; blocked → actionable guidance; insecure context → banner + message. Static-only change (no server restart needed). In PR #15 (`feature/courtroom-video-and-face-analysis`). |
| 2026-09-03 | **Courtroom End Session button + Hold to Talk ASR fallback + HTTPS serving:** (1) *End Session* — the Presiding Judge gets an "End Session" button (header, Judge-only, server-enforced) that adjourns the trial: the room is marked `status="ended"` (`end_room` in `courtroom_manager.py`), the phase is set to Concluded, an adjournment entry is appended to the official record, new joins are refused, and every socket is closed; clients land on a "concluded" join card with the transcript Export (.md)/Download PDF links. End-of-socket cleanup skips "left the court" noise for ended rooms so the record closes cleanly. (2) *Hold to Talk produced nothing in the record* — root cause: `openai-whisper` wasn't installed, so every `/api/court/transcribe` upload returned `503 asr_unavailable` and the client dropped the audio (the browser-SR fallback was only wired to the legacy auto-transcribe no-ops). Fix: new `GET /api/court/asr-status` probe; when whisper is missing, Hold to Talk switches to the browser's SpeechRecognition (hold → speak → release → Ollama grammar-correction → statement added via WS), and a 503 mid-session flips the mode for the next press. (3) *Mic blocked on phone over hotspot* — getUserMedia needs a secure context, so plain-http LAN invites can never use audio; added self-signed TLS support (certs in `case_priority_system/certs/`, gitignored; served with `--ssl-keyfile`/`--ssl-certfile`) and invite URLs now derive scheme/port from the request (`_lan_invite_url`), so HTTPS rooms invite with https. Verified headless: end-session E2E (both roles land on concluded card, record preserved with statement + adjournment, late join refused, zero console errors), PTT fallback enter/listen/release, HTTPS smoke + https invite URL. **NOTE: whisper reinstalled (`pip install openai-whisper`; model `small` already cached) and the server now runs HTTPS on :8000 — open https://127.0.0.1:8000 (accept the self-signed warning once); phone uses https://10.83.187.37:8000.** |
| 2026-09-03 | **Courtroom room cleanup + dashboard Delete button:** new `DELETE /api/court/rooms/{room_id}` (manager `delete_room`: memory + disk JSON + `audio/{room_id}` clips) and a red **Delete** button on each session card in the dashboard Courtroom tab (confirm dialog → DELETE → list refresh). Also fixed a **pre-existing bug**: the dashboard lobby list always showed "Failed to load trial sessions" because `renderCourtrooms` called `escapeHtml()` which only existed in `courtroom.js` — added the helper to `app.js`. Purged all 29 historical empty test sessions (probe/debug/duplicate trials, incl. 6 with audio clips) — the courtroom data dir is now empty and the lobby starts clean. |
| 2026-09-04 | **React landing page redesign completed** (per `.lovable/plan/anavaya-landing-page-2026-09-01.md` spec): the TanStack Start app in `src/` now ships the full single-page dark-and-gold site — split hero with animated SVG composition + mouse parallax, problem band, 4-stat count-up bar (accuracy pulled live from `src/data/model-metrics.ts`, generated by `scripts/evaluate_model.py`, so the page can never quote a number the shipped model didn't score), 7-step How It Works with Founding Invariant callout, animated PriorityRoadmap, full ModelAccuracy section (confusion matrix + per-tier tables + honest framing), Why It Matters + Trust band, 2×3 features grid, pausable tech marquee, closing CTA, footer; sticky `SiteHeader` with mobile menu + theme toggle (dark/light, no-FOUC init script), skip link, anchor nav, `prefers-reduced-motion` support. Verified: typecheck + build clean, zero console errors, zero horizontal overflow at 1440/768/375/320 (fixed the accuracy tables blowing the page 115px wide on mobile — `min-w-0` grid items + `overflow-x-clip` on the table figures), mobile menu opens, all nav anchors resolve. "View Architecture" hero button now points at the `#architecture` section. |
| 2026-09-04 | **Landing-page redesign completed + remote demo setup (live state below).** Four commits on `feature/courtroom-video-and-face-analysis` (pushed; PR compare: `main...feature/courtroom-video-and-face-analysis`): `967a1c4` finished the landing page (mobile-overflow fix in the accuracy tables, Hero anchor, docs) and committed the uncommitted courtroom WIP; `88c5f2b` added README nginx/tunnel docs + `deploy/nginx-anavaya.conf` and made the landing CTA target env-driven (`VITE_APP_URL`); `7d565a5` added sub-path serving (`VITE_BASE`, default `/`) so the landing page runs at `/landing/` while FastAPI keeps the root; `1defa28` disables vite HMR in `/landing/` mode (tunnel console noise). **Full remote-demo state (2026-09-04 evening):** the machine (BSNL dual-stack, IPv4 `106.192.227.10`, LAN `10.83.187.37`, **phone-hotspot uplink = no inbound, so port-forwarding is impossible**) runs the whole stack through **one stable ngrok URL `https://overreach-headrest-gosling.ngrok-free.dev`** (free dev domain, authtoken configured). Topology: ngrok → nginx :8083 (installed `C:\nginx`, config `deploy/nginx-anavaya.conf`; `/landing/` → vite dev :8084 with `VITE_BASE=/landing/`, everything else → FastAPI :8000 https with repo self-signed certs, `proxy_ssl_verify off`). **One-click restart: double-click `C:\nginx\Anavaya-Remote.exe`** (ps2exe of `C:\nginx\start-anavaya.ps1`, template in `deploy/`) — starts backend + nginx + ngrok + landing, prints links, opens browser; re-running is idempotent. DuckDNS `anavaya-court.duckdns.org` (A + AAAA) kept alive by scheduled task **"DuckDNS Update"** (every 5 min, `C:\nginx\duckdns-update.ps1`) — was the IPv6 experiment path; **ngrok is the live path**, DuckDNS is superseded but harmless. **TURN relay for remote media (CGNAT/mobile-data audio+video):** configured Metered **Open Relay** (`case_priority_system/courtroom_turn.json`, gitignored — backend reads at startup, served via `/api/court/rtc-config`, verified local + public). Before a real hearing swap in Metered managed or Cloudflare Realtime TURN credentials in that file + restart backend. Verified end-to-end: landing `/landing/` → CTA click → dashboard, zero console errors; courtroom WS handshake 101; rtc-config includes TURN. **Caveats:** ngrok free tier shows a one-time "Visit Site" interstitial per browser (7-day cookie), ~1 GB/mo out + 20k req (WebRTC media is P2P and does NOT count — only page/API/WS traffic does); everything dies on PC reboot/sleep (run the exe again). Working tree has only `server.log` (tracked noise) + `.mcp.json` uncommitted — nothing pending. |
| 2026-09-04 | **GPU forced on for the remote/ngrok stack:** `deploy/start-anavaya.ps1` now sets `ANAVAYA_USE_LLM=1` before launching uvicorn (the env is inherited by the backend child process), so uploads through the stable ngrok URL always use Ollama `qwen2.5:3b` on the NVIDIA GPU instead of relying on auto-detect (which can lag while Ollama warms up). Verified live: tunnel `https://overreach-headrest-gosling.ngrok-free.dev` → nginx :8083 → FastAPI https :8000; dashboard `/` and landing `/landing/` return 200; `/api/gpu-status` reports `llm_mode=enabled` on RTX 2050 (4096 MiB); `ollama ps` shows qwen2.5:3b loaded 2.16 GB fully in VRAM after a daemon crash was fixed by restarting `ollama serve` (the daemon had died, leaving only the tray app — restarted and pre-warmed via `preload_ollama_model`). **Note:** the live copy `C:\nginx\start-anavaya.ps1` and the packaged `Anavaya-Remote.exe` still contain the pre-GPU version — re-sync/re-package them to make the one-click launcher force the GPU too. |
| 2026-09-04 | **GPU/LLM badge now visible on mobile:** removed the `@media (max-width: 899px) { .gpu-badge { display: none } }` hide in `case-workflow.css`, so phones/tablets show the same GPU inference badge as desktop ("RTX 2050 · qwen2.5:3b · GPU inference"). Added `flex-wrap: wrap; row-gap: 8px` to `.app-header` in the ≤599px media query in `style.css` so the badge never overflows the header on narrow screens. Static-only change (served from disk — no backend restart needed; hard-refresh the browser to bypass CSS cache). |
| 2026-09-04 | **Mobile GPU badge verified + horizontal-overflow fix:** Playwright at 375/390/768px against the live ngrok URL confirms the GPU badge now renders on mobile ("RTX 2050 · qwen2.5:3b · GPU inference", in-viewport, header wraps without overflow). Found and fixed a pre-existing mobile bug during verification: the decorative `organic-blob` absolute divs (blur + float animation) pushed the document to ~515px wide on ≤599px screens, causing horizontal page scroll. Added `html { overflow-x: hidden }` in `style.css` (body already had it, but only clipping the root reliably stops the viewport from scrolling). No console errors from the app itself (the font CORS errors seen headless were an artifact of the test's `ngrok-skip-browser-warning` header being sent cross-origin, not a real-user issue). |
| 2026-09-04 | **Courtroom fixes from the live phone demo:** (1) **Hold to Talk now gates the live WebRTC audio** — previously the mic track stayed enabled from join, so every participant was continuously audible (the phone counsel heard the room without anyone holding the button). `courtroom.js` now starts with the mic CLOSED (`state.micEnabled=false`) and a new `applyMicGate()` keeps `track.enabled = micEnabled || ptt.recording`, so others hear you only while you hold Hold to Talk (or explicitly keep the tile mic toggle on); the gate opens on hold, closes on release (both whisper and browser-ASR hold paths), and is re-applied when a stream is acquired. Roster mic button + join-card copy updated to explain the semantics. Verified headless with fake devices: track disabled after join → enabled while held → disabled on release. (2) **Transcript entry rendering:** server stores friendly role labels (`Presiding Judge`, `Defence Counsel`…), and `roleKeyFromDisplay` split on the first word, so every Judge statement/behavior rendered with the gray *system* avatar color and an unstyled role label while counsel got their accent colors — it now maps `Presiding Judge`→`Judge` (etc.), so Judge entries are gold like the roster. Also hardened `.entry-meta` (wrap + nowrap role/time + `overflow-wrap:anywhere` on names) so no row overflows or overlaps at phone widths; 18/18 Playwright layout/color checks pass at desktop + 390px. (3) **Transcription accuracy ('Judge' heard as 'George'):** whisper now gets a courtroom-vocabulary `initial_prompt` (`COURT_ASR_PROMPT` in `courtroom_asr.py`) biasing the decoder toward court terms, and the Ollama correction prompt now restores clear mishearings of court terms (e.g. `George`→`Judge`, `cross animation`→`cross-examination`). (4) **Silent Hold-to-Talk no longer errors:** whisper returning no text used to raise a 500 "Speech recognition failed" (visible as a scary toast); a no-speech segment is now a quiet 200 `{entry:null, note:'no_speech'}` no-op with the clip removed. Verified: courtroom e2e (all 14 steps) passes against a temp http instance, live https stack restarted on :8000 with `ANAVAYA_USE_LLM=1`. **Note found while testing: this machine's Python torch is the CPU build (`torch 2.13.0+cpu`), so whisper always loads on CPU (`Whisper model 'small' loaded on cpu.`) — GPU ASR needs a CUDA torch install; LLM feature extraction is unaffected (Ollama is a separate GPU binary).** |
| 2026-09-04 | **Courtroom whisper now runs on the NVIDIA GPU:** replaced the CPU-only torch build with the CUDA wheel (`pip install torch==2.9.1 --index-url https://download.pytorch.org/whl/cu128`, driver 592.82 supports CUDA 12.8; Python 3.12). `torch.cuda.is_available()` is now True on the RTX 2050 and whisper logs `Whisper model 'small' loaded on cuda.` (fp16). **VRAM management added** (`_make_room_for_asr` in `courtroom_asr.py`): on a 4 GiB GPU, qwen2.5:3b resident (~2.16 GiB) + whisper + torch CUDA context (~1.7 GiB) leaves only ~150 MiB free — enough for silence but a real 30 s segment could OOM and *silently drop the statement*. So before every whisper transcription the function checks Ollama `/api/ps` and, when qwen is resident, unloads it (`keep_alive=0`), giving whisper a deterministic ~2.1 GiB; the grammar-correction step that follows reloads qwen on demand (verified: corrected output `llm:true` after reload, second statement cycle unloads again). Verified via silence-probe against the live https server: whisper on cuda, both cycles clean, `/api/court/asr-status` available, tunnel 200. Note: replacing torch 2.13.0+cpu → 2.9.1+cu128 is a minor version downgrade (PyPI's 2.13 CPU wheel is newer than the newest cu128 wheel on the official index); the app's other torch consumers are unaffected (whisper only). |
| — | *(add the next entry here)* |
