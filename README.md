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
python case_priority_system/app.py
```

The dashboard serves over **https** automatically whenever the self-signed certs
(`case_priority_system/certs/cert.pem` + `key.pem`) exist — the courtroom mic/video
features need a secure context on phones, so https is required for cross-device
courtrooms. Without the certs it falls back to plain http. Equivalent uvicorn command:

```powershell
python -m uvicorn case_priority_system.app:app --host 0.0.0.0 --port 8000 --ws-ping-interval 0 --ssl-certfile case_priority_system/certs/cert.pem --ssl-keyfile case_priority_system/certs/key.pem
```

> **Why `--host 0.0.0.0`?** The Live Courtroom invite links are shared with other
> devices (phones/laptops) on the same network. Binding to `0.0.0.0` (instead of
> `127.0.0.1`) lets them reach this machine — the invite link is built with the
> machine's LAN IP automatically. If Windows Firewall prompts, allow Python on
> **private networks**, otherwise phones on the same Wi-Fi/hotspot get
> "This site can't be reached".
> **Why https?** Browsers only grant microphone/video access on secure contexts
> (`https` or `localhost`). A phone opening `http://<LAN-IP>:8000` gets no mic;
> `https://<LAN-IP>:8000/court/<room>` does (after accepting the self-signed cert).
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

# Terminal 2 — Backend dashboard (serves https when case_priority_system/certs/ exists)
python case_priority_system/app.py

# Terminal 3 — Landing page
npm run dev
```

Open [http://localhost:8081](http://localhost:8081) for the landing page, or [https://127.0.0.1:8000](https://127.0.0.1:8000) for the dashboard directly (https when the certs are present, http otherwise).

**Dashboard features:**
- **Interactive Case Board:** Filter and search cases processed from the Excel sheet.
- **Dynamic Decision Tree Graph:** Inspect the global decision structure and highlight active decision paths in glowing neon.
- **Constitutional Trace:** Review case summaries and programmatic legal justifications based on the Constitution of India.

---

## 🌍 Remote Participants (anywhere in the world)

The dashboard serves over https on the LAN, but remote counsel/witnesses on other
networks (or mobile data) cannot reach a private IP — and browsers on phone data
networks are almost always behind **symmetric NAT (CGNAT)**, which plain STUN
hole-punching cannot traverse. Two small additions make the courtroom work for
them:

1. **A tunnel** exposes this machine's FastAPI server with a real public `https`
   URL (mic/video work on any phone — no self-signed-cert dance).
2. **A TURN relay** lets WebRTC media fall back to relaying through a public
   server when direct peer-to-peer fails (required for mobile-data callers).

### Step 1 — give the courtroom a TURN relay (one-time)

The server advertises ICE config at `GET /api/court/rtc-config`. It always ships
the STUN defaults and appends any TURN servers from the `COURTROOM_TURN_SERVERS`
environment variable (JSON array of `{urls, username, credential}` objects) that
must be set **before** starting the backend — or, to keep them across restarts,
copy `case_priority_system/courtroom_turn.example.json` to
`case_priority_system/courtroom_turn.json` (gitignored) and fill in your real
credentials: the backend reads that file automatically on startup.

Cloudflare Realtime TURN (recommended — ~1 TB/month free): create a TURN app in
the Cloudflare dashboard, grab its static username/credential, then start the
server with:

```powershell
$env:COURTROOM_TURN_SERVERS = '[{"urls": ["turn:turn.cloudflare.com:3478?transport=udp", "turn:turn.cloudflare.com:3478?transport=tcp", "turns:turn.cloudflare.com:5349?transport=tcp"], "username": "<TURN_USERNAME>", "credential": "<TURN_CREDENTIAL>"}]'
python case_priority_system/app.py
```

Quick public test relay (Metered Open Relay, no sign-up — fine for demos only):

```powershell
$env:COURTROOM_TURN_SERVERS = '[{"urls": ["turn:openrelay.metered.ca:80"], "username": "openrelayproject", "credential": "openrelayproject"}]'
python case_priority_system/app.py
```

Verify it is served: `curl https://127.0.0.1:8000/api/court/rtc-config` should
list the STUN servers **plus** your TURN entry.

### Step 2 — expose the server with a tunnel

Download `cloudflared` (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
and run a quick tunnel from a terminal next to the backend. The origin cert is
self-signed, so pass `--no-tls-verify`:

```bash
cloudflared tunnel --url https://localhost:8000 --no-tls-verify
```

It prints a public URL like `https://<random>.trycloudflare.com`. Remote
participants open **`<that URL>/court/<room_id>`** (create the room from the
dashboard first, as usual). Invite links built in the app already use the page's
origin, so they become public automatically when the page is reached through the
tunnel.

> **Limits & notes**
> - The hearing runs while this laptop stays on and online — the tunnel dies
>   with the machine.
> - No code change needed to switch STUN-only → TURN: the client fetches
>   `/api/court/rtc-config` on load and merges the relays into every peer
>   connection.
> - Room ids are short and a public URL makes them guessable — for real use,
>   share the room id privately and expect a join-PIN feature soon.

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
