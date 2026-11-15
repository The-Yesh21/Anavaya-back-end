# Anavaya — Exhibition Demonstration Runbook & Jury Presentation Guide
## *High-Impact Live Walkthrough for Evaluators, Judges, and Exhibition Attendees*

---

## 1. Quick Start & Demonstration Environment Setup

Before starting any live jury or exhibition demonstration, ensure the following local services are running from the repository root (`F:\major_project`):

```powershell
# Terminal 1: Launch FastAPI Backend & Judicial Dashboard (Port 8000)
cd F:\major_project
python -m uvicorn case_priority_system.app:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 (Optional Tunnel): Ngrok Public Tunnel (for external tablet / jury judge viewing)
ngrok http 8000
```

### Verification Checklist Before the Jury Approaches:
- [ ] Backend is running at `http://localhost:8000/`.
- [ ] Test endpoint `http://localhost:8000/api/cases` returns HTTP 200 with all 4 showcase cases:
  * `ANV-2026-0042` (Apollo Critical Care)
  * `ANV-2026-0051` (Connaught Place Hit & Run)
  * `ANV-2026-0052` (Yamuna Toxic Effluent)
  * `ANV-2026-0053` (Nhava Sheva Port Demurrage)
- [ ] Excel master records present at `case_priority_system/case_results.xlsx`.
- [ ] Generated forensic PDFs present in `showcase_cases/` subdirectories.

---

## 2. The Core Narrative: "Life vs. Ledger"

Judges and evaluators frequently ask: *"Why does the justice system need AI triage?"*  
The demonstrator should immediately frame the problem:

> *"In the current legal system, cases are heard in First-In, First-Out order. A corporate shipping conglomerate disputing ₹14.8 Crores in port container demurrage filed three months ago monopolizes days of courtroom argument. Meanwhile, an 8-year-old child in an ICU whose oxygen telemetry is being extorted, or 42 villagers poisoned by toxic industrial waste, are buried at Position #18,000 on the registry queue.*  
>  
> *Anavaya solves this with Autonomous Constitutional Triage: deterministically elevating Article 21 life-and-death cases to Position #1 while keeping corporate ledger disputes on the standard commercial roll."*

### The Master Comparative Triage Table

| Docket ID | Case Title | Nature of Matter | Severity & Vulnerability | Primary Constitutional Ground | Assigned Priority | Docket Position | Time-to-Hearing Contrast |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`ANV-2026-0042`** | *Apollo Critical Care Extortion* | Pediatric PICU Extortion & ECMO Threat | Fatal / High Vulnerability (8-yr-old) | **Article 21** (*Right to Life*) | **HIGH** | **#1** | **Instant (Under 4-hr window)** *(vs 3.8 yrs under FIFO)* |
| **`ANV-2026-0051`** | *Connaught Place Hit & Run* | Fatal Crash, GCS 6 Coma, Fabricated Alibi | Fatal / High Vulnerability (Pedestrian & Child) | **Article 21** & **Article 14** | **HIGH** | **#2** | **Immediate Bail/Custody Hearing** *(vs 2.1 yrs under FIFO)* |
| **`ANV-2026-0052`** | *Yamuna Toxic Effluent Disaster* | 42 Cyanosis Patients, Toxic Borewells | Major / High Vulnerability (Villagers) | **Article 21** & *Parens Patriae* | **HIGH** | **#3** | **Emergency Injunctive Injunction** *(vs 3.2 yrs under FIFO)* |
| **`ANV-2026-0053`** | *Nhava Sheva Port Demurrage* | ₹14.82 Cr Container Ground Rent Tariff | No Injury / Low Vulnerability (Conglomerate) | **Article 265** & **Article 300A** | **LOW** | **#14,200** | **Standard Commercial Roll** *(Zero human risk)* |

---

## 3. Demonstration Formats

### Format A: The 3-Minute Lightning Pitch (Judges on the Move)

* **0:00 – 0:45 | The "Life vs Ledger" Hook**:
  - Open `http://localhost:8000/`.
  - Contrast `ANV-2026-0042` (Apollo child ICU) with `ANV-2026-0053` (₹14.8 Cr Customs Demurrage).
  - Point to the Docket Queue: Show how Apollo leapt to Position #1, while Nhava Sheva was triaged to #14,200.
* **0:45 – 1:45 | Zero Black-Box Decision Tree**:
  - Click into `ANV-2026-0051` (Connaught Place Hit & Run).
  - Show the **Decision Tree Split**:
    * Node 0: `Broad case type: Violent == Yes`
    * Node 28: `Severity: No Injury == No`
    * Node 29: `Severity: Minor == No`
    * Leaf 30: **Outcome = High Priority**.
  - Emphasize to the jury: *"The LLM only extracts facts. It NEVER assigns priority. Scikit-learn's transparent Decision Tree alone decides."*
* **1:45 – 3:00 | Chakshu Live Lie Detection Climax**:
  - Open the Courtroom tab.
  - Deliver the alibi: *"I was 48 km away in Murthal eating dinner at 1:45 AM."*
  - Watch the UI flash **`[CONTRADICTION DETECTED: 1,051 km/h Required Speed]`**.
  - Point to the Chakshu Biometric HUD: Stress spikes to **92%**, Vocal Jitter **16.4 Hz**, Gaze Aversion active.

---

### Format B: The 5-Minute Standard Jury Walkthrough (Full Scorecard)

* **Minute 1: Problem Definition & Pipeline Architecture**:
  - Walk the jury through the 5-stage stepper:
    * `[1/5] Ingestion` $\to$ `[2/5] Extraction` $\to$ `[3/5] Tree Model` $\to$ `[4/5] Constitutional` $\to$ `[5/5] Synthesis`.
  - Show warm inference running in **~4.8 seconds**.
* **Minute 2: Comparative Ingestion (High vs Low)**:
  - Demonstrate `ANV-2026-0052` (Yamuna Effluent Disaster).
  - Show CPCB Chemical Report: Hexavalent Chromium at 34x limit, Lead at 18x limit.
  - Show that Anavaya invokes the constitutional Doctrine of *Parens Patriae* to protect unrepresented rural villagers.
  - Contrast with `ANV-2026-0053` (Nhava Sheva Port Demurrage): Show that despite ₹14.82 Crores at stake, Anavaya assigns Low Priority because there is zero physical harm.
* **Minute 3: Multi-Document Corroboration & Anomaly Detection**:
  - Show the Corroboration Map for `ANV-2026-0051`:
    * Police FIR, AIIMS Trauma MLC, and Speed Camera Log corroborate with 96% confidence.
    * Defence Fastag receipt is automatically isolated as an outlier.
* **Minute 4: Virtual Courtroom & Live Speech Stenographer**:
  - Demonstrate WebRTC 2x2 multi-party layout (Judge, Prosecutor, Defence, Witness).
  - Point out active speaker golden halo and live Whisper base speech-to-text.
* **Minute 5: Chakshu Biometric Deception Climax & Bench Orders**:
  - Witness speaks perjured statement.
  - Instant contradiction triggered on physical speed impossibility.
  - Judge issues automated binding order with constitutional citations.

---

### Format C: The 10-Minute Deep Technical Audit (Engineering / Faculty Review)

* **Architecture Deep Dive**:
  - Review `case_priority_system/scripts/case_manager.py` and `case_priority_system/decision_tree.py`.
  - Show how feature extraction handles legal entities, injury severities, and power imbalances without hallucination.
  - Inspect the serialized model files (`models/decision_tree_model.joblib`).
* **Constitutional Engine Audit**:
  - Open `case_priority_system/constitutional_analysis.py`.
  - Trace how statutory grounds (BNS § 105, 140, 308) map to fundamental rights (Articles 14, 20, 21, 22, 39A, 265, 300A).
* **Chakshu Computer Vision & Audio Engine**:
  - Review facial landmark tracking, gaze vector estimation, and micro-tremor FFT frequency analysis.
* **Database & Excel Synchronisation**:
  - Open `case_priority_system/case_results.xlsx` live in Excel to show seamless data persistence across document and case levels.

---

## 4. Chakshu Demonstration Scenarios & Script Lines

### Scenario 1: Connaught Place Hit & Run (`ANV-2026-0051`)
* **Context**: Accused Kunal Singhania claims he was eating dinner at Amrik Sukhdev Dhaba, Murthal, 48.2 km away at 01:45:00 IST, submitting an electronic Fastag toll slip.
* **Presenter Prompt**: *"Now we test the alibi against authenticated digital evidence."*
* **Actor (Accused) Line**:  
  > *"Your Honour, I was nowhere near Connaught Place at 1:42 AM. I was already at the Murthal Toll Plaza having refreshments with friends at quarter to two. Here is my Fastag voucher."*
* **System Climax (What to Point Out on Screen)**:
  1. **Red Alert Banner**: `[CONTRADICTION DETECTED]`
  2. **Mathematical Proof**: Connaught Place Speed Camera at 01:42:15 to Murthal Toll at 01:45:00 = 48.2 km in 165 seconds $\implies$ **1,051 km/h**.
  3. **Chakshu Telemetry**:
     - Stress Index: **92% (Extreme Danger)**
     - Gaze Vector: Deflects **34° Left** (saccadic aversion)
     - Facial Action Units: AU4 (Brow Knot) + AU7 (Lid Squeeze) + Vocal Jitter (16.4 Hz).
  4. **Forensic Resolution**: Fastag RFID cloned on accomplice vehicle; seized Porsche found concealed in farmhouse.

---

### Scenario 2: Yamuna Toxic Effluent Disaster (`ANV-2026-0052`)
* **Context**: Factory Managing Director files a sworn affidavit claiming 100% Zero Liquid Discharge (ZLD) operational round the clock.
* **Presenter Prompt**: *"Let us observe how Anavaya handles environmental corporate perjury."*
* **Actor (Factory MD) Line**:  
  > *"Our industrial plant has operated with strict Zero Liquid Discharge since 2021. Not a single drop of untreated wastewater ever leaves our ETP facility."*
* **System Climax (What to Point Out on Screen)**:
  1. **Red Alert Banner**: `[CONTRADICTION DETECTED: Chemical Spectrometry & Power Telemetry Conflict]`
  2. **Forensic Contradiction**:
     - CPCB test confirms Hexavalent Chromium at **34x permissible limit** in village canal, matching exclusive proprietary catalysts.
     - Smart meter power audit proves ETP was powered off every night from **22:00 to 05:00**, while clandestine 75 HP bypass pump operated.
  3. **Chakshu Telemetry**:
     - Blink Velocity: Spikes to **72 blinks/min**
     - Autonomic Flush: Nasal/forehead vasomotor heat expansion
     - Micro-Tremor: 15.8 Hz tension in lower facial muscles.

---

## 5. Contingency & Troubleshooting Guidelines

| Potential Issue | Immediate Fix |
| :--- | :--- |
| **Local Ollama LLM is slow or cold** | Warm inference is pre-computed. All 4 showcase cases have full JSON analyses and pre-rendered PDFs cached in `case_priority_system/cases/` and `case_priority_system/reports/`. Open the pre-computed reports directly. |
| **Webcam / Video Feed fails in Courtroom** | Use the built-in **Synthetic Video Simulation Mode** in the Courtroom view, which replays pre-recorded video frames with live Chakshu HUD overlays. |
| **Port 8000 already in use** | Run `python -m uvicorn case_priority_system.app:app --host 0.0.0.0 --port 8083` and open `http://localhost:8083/`. |
| **Excel file locked by Windows** | The application uses atomic write buffers with automatic retry. Close any open Excel windows before running fresh batch ingestion scripts. |

---
*Runbook maintained and verified by Showcase Curator, Anavaya Core Engineering Team.*
