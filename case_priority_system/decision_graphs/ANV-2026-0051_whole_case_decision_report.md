# Decision Tree Priority Report

<style>
.decision-hero {
  border: 1px solid #CBD5E1;
  border-left: 8px solid #DC2626;
  background: linear-gradient(135deg, #FEF2F2, #FFFFFF);
  border-radius: 14px;
  padding: 18px 20px;
  margin: 12px 0 18px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.10);
}
.priority-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 999px;
  background: #DC2626;
  color: white;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin-top: 14px;
}
.metric {
  background: rgba(255,255,255,0.78);
  border: 1px solid #E2E8F0;
  border-radius: 10px;
  padding: 10px 12px;
}
.metric span {
  display: block;
  color: #64748B;
  font-size: 12px;
}
.metric strong {
  color: #0F172A;
}
.timeline {
  position: relative;
  margin: 20px 0;
}
.step-card {
  display: flex;
  gap: 12px;
  align-items: stretch;
  border: 1px solid #DBEAFE;
  border-radius: 14px;
  background: #FFFFFF;
  padding: 12px;
  margin: 12px 0;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.09);
  animation: slideIn 480ms ease both;
}
.step-card:nth-child(2) { animation-delay: 80ms; }
.step-card:nth-child(3) { animation-delay: 160ms; }
.step-card:nth-child(4) { animation-delay: 240ms; }
.step-card:nth-child(5) { animation-delay: 320ms; }
.step-index {
  width: 34px;
  min-width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #DC2626;
  color: #FFFFFF;
  font-weight: 800;
}
.step-title {
  font-weight: 800;
  color: #0F172A;
  margin-bottom: 4px;
}
.step-condition {
  color: #334155;
  margin-bottom: 4px;
}
.step-meta {
  color: #475569;
  font-size: 13px;
}
@keyframes slideIn {
  from { transform: translateY(12px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
</style>

<div class="decision-hero">
  <div class="priority-badge">High Priority</div>
  <h2>ANV-2026-0051_whole_case</h2>
  <p>This case file brings together 4 documents (2 × Other, FIR, Police Report) and is assessed as a single matter of Criminal/Violent with fatal injury indicated, involving vulnerable parties. The evidence on record consists of “Exhibit_D01_Defence_Alibi_Murthal_Toll.pdf” (Other; General Civil; assessed Medium priority); “Exhibit_P01_FIR_214_2026_Connaught_Place.pdf” (FIR; Criminal/Violent; Fatal severity; assessed High priority); “Exhibit_P02_AIIMS_Trauma_Emergency_MLC.pdf” (Other; Criminal/Violent; Fatal severity; assessed High priority); “Exhibit_P03_Traffic_Police_Speed_Camera_Log.pdf” (Police Report; Property/Land; Major severity; assessed Medium priority). Cross-comparison finds 6 corroborating links between the documents (shared dates, places or parties), which strengthens the consistency of the record. For example, “Exhibit_D01_Defence_Alibi_Murthal_Toll.pdf” and “Exhibit_P01_FIR_214_2026_Connaught_Place.pdf” share places and parties.</p>
  <div class="metric-grid">
    <div class="metric"><span>Legal Category</span><strong>Criminal/Violent</strong></div>
    <div class="metric"><span>Model Category</span><strong>Violent</strong></div>
    <div class="metric"><span>Severity</span><strong>Fatal</strong></div>
    <div class="metric"><span>Vulnerability</span><strong>High</strong></div>
    <div class="metric"><span>Influence</span><strong>High</strong></div>
  </div>
</div>

## Flow View

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontFamily': 'Inter, Arial', 'primaryColor': '#F8FAFC', 'primaryTextColor': '#0F172A', 'primaryBorderColor': '#64748B', 'lineColor': '#64748B'}} }%%
flowchart TD
  N0["Step 1: Broad case type: Violent<br/>Broad case type is 'Violent'<br/>Case: Yes<br/>Answer: Yes"]:::decision
  N1["Step 2: Severity: No Injury<br/>Severity is 'No Injury'<br/>Case: No<br/>Answer: No"]:::decision
  N0 --> N1
  N2["Step 3: Severity: Minor<br/>Severity is 'Minor'<br/>Case: No<br/>Answer: No"]:::decision
  N1 --> N2
  N3["Final Priority: High<br/>1 training samples reached this leaf"]:::leaf
  N2 --> N3
  classDef decision fill:#EFF6FF,stroke:#2563EB,stroke-width:2px,color:#0F172A;
  classDef leaf fill:#FEE2E2,stroke:#DC2626,stroke-width:3px,color:#7F1D1D;
```

## Animated Step View

<div class="timeline">
<div class="step-card">
  <div class="step-index">1</div>
  <div class="step-body">
    <div class="step-title">Step 1: Broad case type: Violent</div>
    <div class="step-condition">Broad case type is 'Violent'</div>
    <div class="step-meta">Case value: <strong>Yes</strong> | Result: <strong>Yes</strong></div>
  </div>
</div>
<div class="step-card">
  <div class="step-index">2</div>
  <div class="step-body">
    <div class="step-title">Step 2: Severity: No Injury</div>
    <div class="step-condition">Severity is 'No Injury'</div>
    <div class="step-meta">Case value: <strong>No</strong> | Result: <strong>No</strong></div>
  </div>
</div>
<div class="step-card">
  <div class="step-index">3</div>
  <div class="step-body">
    <div class="step-title">Step 3: Severity: Minor</div>
    <div class="step-condition">Severity is 'Minor'</div>
    <div class="step-meta">Case value: <strong>No</strong> | Result: <strong>No</strong></div>
  </div>
</div>
<div class="step-card">
  <div class="step-index">4</div>
  <div class="step-body">
    <div class="step-title">Final Priority: High</div>
    <div class="step-condition">The case reached this Decision Tree leaf.</div>
    <div class="step-meta">Case value: <strong>1 training samples reached this leaf</strong> | Result: <strong>High</strong></div>
  </div>
</div>
</div>

## Decision Trace

Node 0: Broad case type is 'Violent'; case value = Yes; result = Yes -> Node 28: Severity is 'No Injury'; case value = No; result = No -> Node 29: Severity is 'Minor'; case value = No; result = No -> Leaf node 30 => Predicted Priority = High

## Raw Graph

Raw DOT file: `case_priority_system/decision_graphs\ANV-2026-0051_whole_case_decision_path.dot`
