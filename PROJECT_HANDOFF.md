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
| — | *(add the next entry here)* |
