# Anavaya — Exhibition Demonstration Runbook

## 1. Exhibition Live Walkthrough Outline (3-5 Minutes)

### Phase 1: Problem Statement & Triage Sandbox (Landing Page)
1. Open `http://localhost:8084/landing/`.
2. Scroll to the **Interactive Triage Sandbox**.
3. Select Scenario 1 (Child Endangerment) vs Scenario 3 (Commercial Tax Dispute).
4. Demonstrate how legacy courts place the minor's case behind 18,000 corporate cases, whereas Anavaya's Decision Tree immediately leaps it to **Position #1 on the Judicial Docket**.

### Phase 2: Live Document Ingestion & Pipeline Stepper (Dashboard)
1. Navigate to the Judicial Dashboard (`http://localhost:8083`).
2. Drag and drop a case PDF into the upload zone.
3. Observe the new **Judicial Inference Pipeline Stepper**:
   - `[1/5] Ingestion` -> `[2/5] Extraction` -> `[3/5] Tree Model` -> `[4/5] Constitutional` -> `[5/5] Synthesis`.
   - Point out the real-time elapsed timer (`~6.8s` warm inference).
4. Review the generated **Decision Path Flowchart** and **Constitutional Justification**.

### Phase 3: Virtual Courtroom & Google Meet Layout
1. Click the **Courtroom** tab.
2. Join as **Presiding Judge**.
3. Demonstrate the responsive 2x2 multi-party grid, active speaker golden aura, and on-tile **Chakshu AI Face Analysis HUD**.
