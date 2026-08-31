# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Anavaya** — an AI-powered case priority / triage system for judicial authorities. It reads legal PDFs (FIRs, complaints, court pleadings, judgments), extracts structured facts via a local LLM, classifies each case as **High / Medium / Low priority** with a deterministic Decision Tree, and renders results in a FastAPI + D3.js web dashboard. Advanced modules: **Chakshu** (browser lie-detection / evidence fact-checking) and **Live Courtroom** (WebRTC multi-role mock trial with speech transcription).

**Founding invariant (do not break):** the LLM *extracts and summarizes only*; the **Decision Tree alone decides priority**. Priority decisions must stay deterministic, reproducible, and auditable. The constitutional analysis is rule-based too — never LLM-generated. Any change that lets the LLM influence the final High/Medium/Low violates this.

## Running everything

All commands run from the **repo root** (`F:\major_project`). Scripts use the `case_priority_system/` prefix; running from inside that folder breaks imports/paths.

```powershell
# Web dashboard (FastAPI) — the main entry point
python -m uvicorn case_priority_system.app:app --host 0.0.0.0 --port 8000 --ws-ping-interval 0
```

- Open http://127.0.0.1:8000. `--host 0.0.0.0` lets other devices on the LAN join the Live Courtroom (invite links use the machine's LAN IP). `--ws-ping-interval 0` is **required** — Uvicorn's default 20s ping + 20s pong timeout silently drops courtroom participants after ~40s of quiet.
- **GPU/LLM mode:** when an NVIDIA GPU is present and local Ollama (`http://localhost:11434`, model `qwen2.5:3b`) is reachable, uploads use LLM feature extraction (~10–60s). Otherwise the deterministic rule-based extractor runs (~2s). Force with `ANAVAYA_USE_LLM=1` / `0`. Verify GPU with `ollama ps` (should show `100% GPU`).

CLI entry points (all from repo root):
```powershell
python case_priority_system/scripts/inference_pipeline.py   # re-run PDF triage on root *.pdf → Excel + decision reports
python case_priority_system/scripts/train_model.py          # retrain the Decision Tree
python case_priority_system/scripts/predict.py              # standalone prediction demo
python case_priority_system/scripts/test_ollama.py          # Ollama connectivity check
```

### Tests / e2e checks

No unit-test framework. The end-to-end scripts at repo root boot the server and exercise the API (they snapshot/restore Excel + case index, then clean up created cases):
```powershell
python test_case_workflow_e2e.py     # Create-Case workflow: create → upload → analyze → sessions → fact-check → dossier
python test_courtroom_e2e.py         # Live Courtroom WebSocket signaling + rooms
```
`probe_ws.py`, `verify_ping_timeout.py`, `debug_e2e_repro.py` are WebSocket debugging utilities, not test suites.

## Dependencies

No `requirements.txt`. Key packages: `pandas`, `numpy`, `scikit-learn`, `torch`, `PyMuPDF` (fitz) / `pypdf`, `fastapi`, `uvicorn`, `openpyxl`, `requests`, `tqdm`. Courtroom ASR needs `openai-whisper` (model `small`, override `WHISPER_MODEL`; downloads to `~/.cache/whisper` on first use; runs on the NVIDIA GPU via torch; WAV decoded with stdlib `wave`, so ffmpeg isn't required). Frontend uses Tailwind via Play CDN + D3.js + MediaPipe (lazy-loaded) + Lucide icons.

## Architecture

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

**Model layer (hybrid):**
- **Decision Tree** (`models/priority_classifier.pkl`) — primary model. Pickle bundle `{model, tfidf, encoders, feature_names}`. Trained on 5 categorical features (crime_type, severity, vulnerability, influence, case_category) + TF-IDF text features (unigram+bigram, max 220). Max depth 8, balanced class weights.
- **PyTorch NN** (`models/priority_dl_model.pth`) — optional 2-layer feedforward on TF-IDF text only; **not** used in the inference pipeline.

**Inference pipeline** (`scripts/inference_pipeline.py`):
1. PDF text extraction (PyMuPDF or pypdf, first 6 pages)
2. LLM feature extraction via Ollama → structured JSON (parties, crime_type, severity, vulnerability, influence, 3-sentence summary); `fallback_extract_features()` does keyword matching when the LLM is unavailable
3. `tune_case_features()` normalizes LLM output against allowed label sets and maps 8 legal categories → 4 broad model `crime_type` buckets via `LEGAL_TO_MODEL_CATEGORY`
4. `predict_priority()` runs the Decision Tree only
5. Output: Excel row + per-case Markdown decision report (Mermaid flowchart) + DOT file + PDF report

**8 legal categories** (`case_category`): Excise/Tax · Customs/Import-Export · Company/Winding Up · Insolvency/Debt · Constitutional/Writ · Property/Land · Criminal/Violent · General Civil. Priority signal strength: `crime_type`+`severity` > `vulnerability` > `influence` > summary text (TF-IDF).

**Constitutional grounding** (rules in `case_priority_system/CONSTITUTION_GUIDELINES.md`): Art. 21 (life/liberty → violent/fatal = High), Art. 14 (equality → power imbalance = Med/High), Arts. 23–24 (exploitation → sexual assault/trafficking/child labor = Critical/High), Art. 19(1)(g) (trade), Art. 32/226 (writs), Art. 265 (no tax without law), Art. 300A (property → economic = Med/Low unless violent).

## Backend (`case_priority_system/app.py`)

Single FastAPI module with all REST + WebSocket routes. **Do not reorder routes:** case-workflow and courtroom endpoints must be declared *before* the catch-all `app.mount("/", StaticFiles(...))` at the bottom, or they get shadowed. Imports use a try/except dual-path pattern (`case_priority_system.scripts.X` then `scripts.X`) so the module loads whether run as a package or a script.

Key endpoints: `POST /api/upload` (single PDF → pipeline → Excel + registry), `GET /api/cases` (dashboard feed from Excel), `GET /api/tree` (serialized tree for D3), `GET /api/cases/{file}/report.pdf` (on-demand PDF report), `GET /api/gpu-status`, case CRUD (`POST /api/cases`, `POST /api/cases/{id}/documents`, `POST /api/cases/{id}/analyze` — aggregate priority = highest doc wins, safety-first), Chakshu sessions + fact-check, courtroom CRUD + `POST /api/court/transcribe` (WAV → whisper → Ollama grammar-correct → transcript + broadcast; `503 asr_unavailable` if engine missing), `WS /ws/court/{room_id}` (WebRTC signaling + transcript/roster broadcast), `GET /court/{room_id}` (trial page).

## Frontend (`case_priority_system/static/`)

Vanilla JS + CSS (no build step). `index.html` is the dashboard; `courtroom.html` is served at `/court/{room_id}` (room id read client-side). `tokens.css` is the **single shared token source** — `@import`ed by `style.css`, `case-workflow.css`, `courtroom.css`; change colors/spacing there, not in the consumers. A no-FOUC theme boot script in `index.html` sets `data-theme` from localStorage/OS before paint; `applyTheme()` is shared. Tailwind (Play CDN, Preflight off, `tw-` prefix, theme mirrors `tokens.css` via `tailwind-init.js`) is a complementary utility layer over the hand-written CSS.

## State on disk (survives restarts)

- `case_priority_system/cases/` — case registry (`ANV-YYYY-NNNN.json` + `_index.json`)
- `case_priority_system/courtrooms/` — persisted trial rooms (`room_id.json`); audio under `courtrooms/audio/{room_id}/`
- `case_priority_system/case_results.xlsx` — the dashboard's data source; corrupt/delete it and the board is empty. List cells round-trip as string reprs (`_parse_list_cell`).
- `case_priority_system/decision_graphs/` — per-case `*_decision_report.md` (Mermaid) + `*.dot`
- `case_priority_system/reports/` — generated `*_report.pdf`

## Gotchas

- **Run from repo root**, never from inside `case_priority_system/.
- **`case_priority_system/case_priority_system/`** is a legacy nested copy — the live app reads from `case_priority_system/`; don't confuse the two.
- **Upload safety:** filenames validated (`[A-Za-z0-9 _\-().]+\.pdf`) and stored in the OS temp dir, never the repo root — keep it that way.
- **LLM never decides priority.** The flag `ANAVAYA_USE_LLM` gates *feature extraction* only; the evidence fact-checker always uses Ollama for semantic verdicts.
- **No auth** — single-user local tool. Dashboard is the only read layer over Excel (a real DB would remove the Excel round-trip).
- LoRA fine-tuning adapters (`qwen2.5-3b-legal-lora[-v2]`) are scripts-ready, checkpoints-not-committed; re-run `finetune_qwen_*` + `smoke_test_stage2` to restore.

## Companion docs

- `PROJECT_HANDOFF.md` (root) — the single source of truth for current state; **append to its Update Log (§11)** when anything changes. Read this first.
- `case_priority_system/CLAUDE.md` — deeper model/pipeline detail.
- `case_priority_system/README.md` — full feature/pipeline reference.
- `case_priority_system/CONSTITUTION_GUIDELINES.md` — constitutional priority rules.
- `FRONTEND_DESIGN_PLAN.md` (root) — UI redesign record (White & Gold theme, implemented).
