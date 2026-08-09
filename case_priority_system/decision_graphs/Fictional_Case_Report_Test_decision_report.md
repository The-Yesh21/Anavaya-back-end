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
  <h2>Fictional_Case_Report_Test.pdf</h2>
  <p>The parties, Fictional Case Report Test, are involved in a legal dispute. The document indicates assault, weapon, victim, robbery. This case is classified as Criminal/Violent because the record matches assault, weapon, victim, robbery. Under the Constitution of India, the primary rights engaged are Article 21, Article 22, Article 20.</p>
  <div class="metric-grid">
    <div class="metric"><span>Legal Category</span><strong>Criminal/Violent</strong></div>
    <div class="metric"><span>Model Category</span><strong>Violent</strong></div>
    <div class="metric"><span>Severity</span><strong>Major</strong></div>
    <div class="metric"><span>Vulnerability</span><strong>High</strong></div>
    <div class="metric"><span>Influence</span><strong>Low</strong></div>
  </div>
</div>

## Flow View

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontFamily': 'Inter, Arial', 'primaryColor': '#F8FAFC', 'primaryTextColor': '#0F172A', 'primaryBorderColor': '#64748B', 'lineColor': '#64748B'}} }%%
flowchart TD
  N0["Step 1: Victim<br/>Victim score <= 0.0258<br/>Case: 0.2503<br/>Answer: No"]:::decision
  N1["Final Priority: High<br/>430 training samples reached this leaf"]:::leaf
  N0 --> N1
  classDef decision fill:#EFF6FF,stroke:#2563EB,stroke-width:2px,color:#0F172A;
  classDef leaf fill:#FEE2E2,stroke:#DC2626,stroke-width:3px,color:#7F1D1D;
```

## Animated Step View

<div class="timeline">
<div class="step-card">
  <div class="step-index">1</div>
  <div class="step-body">
    <div class="step-title">Step 1: Victim</div>
    <div class="step-condition">Victim score <= 0.0258</div>
    <div class="step-meta">Case value: <strong>0.2503</strong> | Result: <strong>No</strong></div>
  </div>
</div>
<div class="step-card">
  <div class="step-index">2</div>
  <div class="step-body">
    <div class="step-title">Final Priority: High</div>
    <div class="step-condition">The case reached this Decision Tree leaf.</div>
    <div class="step-meta">Case value: <strong>430 training samples reached this leaf</strong> | Result: <strong>High</strong></div>
  </div>
</div>
</div>

## Decision Trace

Node 0: Victim score <= 0.0258; case value = 0.2503; result = No -> Leaf node 12 => Predicted Priority = High

## Raw Graph

Raw DOT file: `case_priority_system/decision_graphs\Fictional_Case_Report_Test_decision_path.dot`
