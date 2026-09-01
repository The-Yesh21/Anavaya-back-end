# Anavaya: Judicial Case Priority System & Dashboard

An AI-powered advisory system designed to assist judicial authorities in prioritizing cases based on severity, vulnerability, and risk metrics. It extracts facts from raw court document PDFs, runs them through an interpretable Decision Tree model, and renders them in a highly interactive web-based dashboard.

---

## 🚀 Getting Started

To launch the full system — landing page + dashboard — run **three** processes in separate terminals:

### 1. Start Ollama (GPU-accelerated LLM)

```powershell
ollama serve
```
> Required for GPU-powered case analysis. The model `qwen2.5:3b` is pulled automatically
> on first use. Skip this step if you only need the rule-based (CPU) extraction.

### 2. Start the FastAPI Backend (Dashboard)

Run from the project root:

```powershell
python -m uvicorn case_priority_system.app:app --host 0.0.0.0 --port 8000 --ws-ping-interval 0
```

> **Why `--host 0.0.0.0`?** The Live Courtroom invite links are shared with other
> devices (phones/laptops) on the same network. Binding to `0.0.0.0` (instead of
> `127.0.0.1`) lets them reach this machine — the invite link is built with the
> machine's LAN IP automatically. If Windows Firewall prompts, allow Python on
> **private networks**, otherwise phones on the same Wi-Fi/hotspot get
> "This site can't be reached".
> **Why `--ws-ping-interval 0`?** The Live Courtroom uses WebSockets. Uvicorn's default 20s
> ping interval + 20s pong timeout silently kills any connection that doesn't answer a ping
> within 40s — which drops courtroom participants that go quiet for a moment. `0` disables
> pings so live-trial connections stay up.
> **NVIDIA GPU:** When an NVIDIA GPU is present (e.g. RTX 2050), the app auto-enables
> GPU-accelerated LLM feature extraction via local Ollama (`qwen2.5:3b`). Force off/on with
> `ANAVAYA_USE_LLM=0` / `1`. Verify the GPU is in use with `ollama ps` (should show `100% GPU`).

### 3. Start the Landing Page (React/Vite)

First-time setup:

```powershell
npm install
```

Then start the dev server:

```powershell
npm run dev
```

The landing page opens at [http://localhost:8081](http://localhost:8081). Click **"Try Anavaya Now →"** to navigate to the dashboard.

### Quick Start (all at once)

```powershell
# Terminal 1 — Ollama (GPU)
ollama serve

# Terminal 2 — Backend dashboard
python -m uvicorn case_priority_system.app:app --host 0.0.0.0 --port 8000 --ws-ping-interval 0

# Terminal 3 — Landing page
npm run dev
```

Open [http://localhost:8081](http://localhost:8081) for the landing page, or [http://127.0.0.1:8000](http://127.0.0.1:8000) for the dashboard directly.

**Dashboard features:**
- **Interactive Case Board:** Filter and search cases processed from the Excel sheet.
- **Dynamic Decision Tree Graph:** Inspect the global decision structure and highlight active decision paths in glowing neon.
- **Constitutional Trace:** Review case summaries and programmatic legal justifications based on the Constitution of India.

---

## 📂 Project Architecture

```
F:\major_project
│   README.md                        # Master repository documentation
│   *.PDF                            # Raw input case documents
│
├───src/                             # Landing page (React/Vite/Tailwind)
│   ├───components/landing/           # Hero, Stats, Features, CTA, etc.
│   ├───components/ui/               # shadcn/ui component library
│   ├───routes/                      # TanStack Start routes
│   └───styles.css                   # Gold-dark theme tokens
│
├───public/                          # Static assets (favicon, robots.txt)
│
└───case_priority_system
    │   app.py                       # FastAPI backend server
    │   case_results.xlsx            # Prioritized Excel dataset
    │   CLAUDE.md                    # developer setup guide
    │   CONSTITUTION_GUIDELINES.md   # Indian constitutional basis guidelines
    │   README.md                    # Core model/pipeline guide
    │
    ├───data
    │       real_report_training_cases.csv
    │       synthetic_cases.csv
    │
    ├───decision_graphs              # Markdown decision tree trace reports
    │
    ├───models                       # Serialized models and reports
    │       priority_classifier.pkl  # Trained decision tree bundle
    │       priority_dl_model.pth    # Optional PyTorch weights
    │       training_report.txt      # Model evaluation metrics & rules
    │
    ├───scripts                      # Training and inference pipeline
    │       generate_data.py
    │       inference_pipeline.py
    │       nlp_dl_model.py
    │       predict.py
    │       train_model.py
    │
    └───static                       # Dashboard web assets (HTML/CSS/JS)
            app.js
            index.html
            style.css
```

---

## 🛠️ CLI Operations

If you want to re-run parts of the pipeline:

- **Re-run the PDF Triage Pipeline (queries local Ollama + updates Excel/reports):**
  ```powershell
  python case_priority_system/scripts/inference_pipeline.py
  ```
- **Re-train the Decision Tree Model:**
  ```powershell
  python case_priority_system/scripts/train_model.py
  ```
- **Run Standalone Predictions Demo:**
  ```powershell
  python case_priority_system/scripts/predict.py
  ```

For more detailed technical details, see the subfolder [case_priority_system/README.md](file:///F:/major_project/case_priority_system/README.md).

---

## 🌐 Landing Page

The React landing page runs separately on Vite's dev server and provides:

- **Hero section** with animated SVG scales-of-justice visual
- **Impact stats** with count-up animations on scroll
- **How It Works** — 7-step pipeline walkthrough
- **Key Features** grid with hover glow effects
- **Tech Stack** marquee strip
- **"Try Anavaya Now"** button → navigates to the FastAPI dashboard at port 8000

Tech: TanStack Start, React 19, Tailwind CSS 4, Framer Motion, shadcn/ui.
