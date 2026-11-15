# Decision Tree Priority Report

<style>
.decision-hero {
  border: 1px solid #CBD5E1;
  border-left: 8px solid #D97706;
  background: linear-gradient(135deg, #FFFBEB, #FFFFFF);
  border-radius: 14px;
  padding: 18px 20px;
  margin: 12px 0 18px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.10);
}
.priority-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 999px;
  background: #D97706;
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
  background: #D97706;
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
  <div class="priority-badge">Medium Priority</div>
  <h2>Exhibit_D01_Defence_Alibi_Murthal_Toll.pdf</h2>
  <p>Kunal Singhania, represented by Adv. R. K. Mittal & Associates, claims he was at a toll plaza 48.2 km away from the scene of a crash when he was allegedly involved. The defense presents an electronic toll collection record and argues that the prosecution's evidence is flawed due to an impossible speed. The case raises questions about the right to live with dignity (Article 21) and the state's duty to protect vulnerable individuals (Parens Patriae).</p>
  <div class="metric-grid">
    <div class="metric"><span>Legal Category</span><strong>General Civil</strong></div>
    <div class="metric"><span>Model Category</span><strong>Non-Violent</strong></div>
    <div class="metric"><span>Severity</span><strong>No Injury</strong></div>
    <div class="metric"><span>Vulnerability</span><strong>Low</strong></div>
    <div class="metric"><span>Influence</span><strong>High</strong></div>
  </div>
</div>

## Flow View

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontFamily': 'Inter, Arial', 'primaryColor': '#F8FAFC', 'primaryTextColor': '#0F172A', 'primaryBorderColor': '#64748B', 'lineColor': '#64748B'}} }%%
flowchart TD
  N0["Step 1: Broad case type: Violent<br/>Broad case type is 'Violent'<br/>Case: No<br/>Answer: No"]:::decision
  N1["Step 2: Influence / power imbalance: High<br/>Influence / power imbalance is 'High'<br/>Case: Yes<br/>Answer: Yes"]:::decision
  N0 --> N1
  N2["Step 3: Fatal<br/>Fatal score <= 0.0324<br/>Case: 0.0000<br/>Answer: Yes"]:::decision
  N1 --> N2
  N3["Step 4: Jurisdiction<br/>Jurisdiction score <= 0.0087<br/>Case: 0.0000<br/>Answer: Yes"]:::decision
  N2 --> N3
  N4["Final Priority: Medium<br/>1 training samples reached this leaf"]:::leaf
  N3 --> N4
  classDef decision fill:#EFF6FF,stroke:#2563EB,stroke-width:2px,color:#0F172A;
  classDef leaf fill:#FEF3C7,stroke:#D97706,stroke-width:3px,color:#78350F;
```

## Animated Step View

<div class="timeline">
<div class="step-card">
  <div class="step-index">1</div>
  <div class="step-body">
    <div class="step-title">Step 1: Broad case type: Violent</div>
    <div class="step-condition">Broad case type is 'Violent'</div>
    <div class="step-meta">Case value: <strong>No</strong> | Result: <strong>No</strong></div>
  </div>
</div>
<div class="step-card">
  <div class="step-index">2</div>
  <div class="step-body">
    <div class="step-title">Step 2: Influence / power imbalance: High</div>
    <div class="step-condition">Influence / power imbalance is 'High'</div>
    <div class="step-meta">Case value: <strong>Yes</strong> | Result: <strong>Yes</strong></div>
  </div>
</div>
<div class="step-card">
  <div class="step-index">3</div>
  <div class="step-body">
    <div class="step-title">Step 3: Fatal</div>
    <div class="step-condition">Fatal score <= 0.0324</div>
    <div class="step-meta">Case value: <strong>0.0000</strong> | Result: <strong>Yes</strong></div>
  </div>
</div>
<div class="step-card">
  <div class="step-index">4</div>
  <div class="step-body">
    <div class="step-title">Step 4: Jurisdiction</div>
    <div class="step-condition">Jurisdiction score <= 0.0087</div>
    <div class="step-meta">Case value: <strong>0.0000</strong> | Result: <strong>Yes</strong></div>
  </div>
</div>
<div class="step-card">
  <div class="step-index">5</div>
  <div class="step-body">
    <div class="step-title">Final Priority: Medium</div>
    <div class="step-condition">The case reached this Decision Tree leaf.</div>
    <div class="step-meta">Case value: <strong>1 training samples reached this leaf</strong> | Result: <strong>Medium</strong></div>
  </div>
</div>
</div>

## Decision Trace

Node 0: Broad case type is 'Violent'; case value = No; result = No -> Node 1: Influence / power imbalance is 'High'; case value = Yes; result = Yes -> Node 21: Fatal score <= 0.0324; case value = 0.0000; result = Yes -> Node 22: Jurisdiction score <= 0.0087; case value = 0.0000; result = Yes -> Leaf node 23 => Predicted Priority = Medium

## Raw Graph

Raw DOT file: `case_priority_system/decision_graphs\Exhibit_D01_Defence_Alibi_Murthal_Toll_decision_path.dot`
