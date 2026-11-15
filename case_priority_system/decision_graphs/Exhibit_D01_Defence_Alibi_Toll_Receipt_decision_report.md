# Decision Tree Priority Report

<style>
.decision-hero {
  border: 1px solid #CBD5E1;
  border-left: 8px solid #059669;
  background: linear-gradient(135deg, #ECFDF5, #FFFFFF);
  border-radius: 14px;
  padding: 18px 20px;
  margin: 12px 0 18px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.10);
}
.priority-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 999px;
  background: #059669;
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
  background: #059669;
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
  <div class="priority-badge">Low Priority</div>
  <h2>Exhibit_D01_Defence_Alibi_Toll_Receipt.pdf</h2>
  <p>Kabir Singhania, Defence Counsel Claimed Alibi Location: Electronic City Toll Plaza Claimed Transit Time: 14-OCT-2026 21:00:00 IST Vehicle Number: MH-02-AZ-4410 1. DEFENCE SUBMISSION & PRAYER The Defence prays for immediate quashing of coercive warrants against Rohan Verma on grounds of an iron-clad alibi. This is a major-severity matter. This falls under General Civil as it involves civil disputes, contracts, consumer matters, or family law. Primary constitutional articles engaged: Article 14, Article 21.</p>
  <div class="metric-grid">
    <div class="metric"><span>Legal Category</span><strong>Constitutional/Writ</strong></div>
    <div class="metric"><span>Model Category</span><strong>Non-Violent</strong></div>
    <div class="metric"><span>Severity</span><strong>No Injury</strong></div>
    <div class="metric"><span>Vulnerability</span><strong>Low</strong></div>
    <div class="metric"><span>Influence</span><strong>Low</strong></div>
  </div>
</div>

## Flow View

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontFamily': 'Inter, Arial', 'primaryColor': '#F8FAFC', 'primaryTextColor': '#0F172A', 'primaryBorderColor': '#64748B', 'lineColor': '#64748B'}} }%%
flowchart TD
  N0["Step 1: Broad case type: Violent<br/>Broad case type is 'Violent'<br/>Case: No<br/>Answer: No"]:::decision
  N1["Step 2: Influence / power imbalance: High<br/>Influence / power imbalance is 'High'<br/>Case: No<br/>Answer: No"]:::decision
  N0 --> N1
  N2["Step 3: Severity: No Injury<br/>Severity is 'No Injury'<br/>Case: Yes<br/>Answer: Yes"]:::decision
  N1 --> N2
  N3["Step 4: Vulnerability: High<br/>Vulnerability is 'High'<br/>Case: No<br/>Answer: No"]:::decision
  N2 --> N3
  N4["Step 5: Legal category: Property/Land<br/>Legal category is 'Property/Land'<br/>Case: No<br/>Answer: No"]:::decision
  N3 --> N4
  N5["Step 6: Legal category: Insolvency/Debt<br/>Legal category is 'Insolvency/Debt'<br/>Case: No<br/>Answer: No"]:::decision
  N4 --> N5
  N6["Step 7: Dispute Concerning<br/>Dispute Concerning score <= 0.2118<br/>Case: 0.0000<br/>Answer: Yes"]:::decision
  N5 --> N6
  N7["Final Priority: Low<br/>1 training samples reached this leaf"]:::leaf
  N6 --> N7
  classDef decision fill:#EFF6FF,stroke:#2563EB,stroke-width:2px,color:#0F172A;
  classDef leaf fill:#D1FAE5,stroke:#059669,stroke-width:3px,color:#064E3B;
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
    <div class="step-meta">Case value: <strong>No</strong> | Result: <strong>No</strong></div>
  </div>
</div>
<div class="step-card">
  <div class="step-index">3</div>
  <div class="step-body">
    <div class="step-title">Step 3: Severity: No Injury</div>
    <div class="step-condition">Severity is 'No Injury'</div>
    <div class="step-meta">Case value: <strong>Yes</strong> | Result: <strong>Yes</strong></div>
  </div>
</div>
<div class="step-card">
  <div class="step-index">4</div>
  <div class="step-body">
    <div class="step-title">Step 4: Vulnerability: High</div>
    <div class="step-condition">Vulnerability is 'High'</div>
    <div class="step-meta">Case value: <strong>No</strong> | Result: <strong>No</strong></div>
  </div>
</div>
<div class="step-card">
  <div class="step-index">5</div>
  <div class="step-body">
    <div class="step-title">Step 5: Legal category: Property/Land</div>
    <div class="step-condition">Legal category is 'Property/Land'</div>
    <div class="step-meta">Case value: <strong>No</strong> | Result: <strong>No</strong></div>
  </div>
</div>
<div class="step-card">
  <div class="step-index">6</div>
  <div class="step-body">
    <div class="step-title">Step 6: Legal category: Insolvency/Debt</div>
    <div class="step-condition">Legal category is 'Insolvency/Debt'</div>
    <div class="step-meta">Case value: <strong>No</strong> | Result: <strong>No</strong></div>
  </div>
</div>
<div class="step-card">
  <div class="step-index">7</div>
  <div class="step-body">
    <div class="step-title">Step 7: Dispute Concerning</div>
    <div class="step-condition">Dispute Concerning score <= 0.2118</div>
    <div class="step-meta">Case value: <strong>0.0000</strong> | Result: <strong>Yes</strong></div>
  </div>
</div>
<div class="step-card">
  <div class="step-index">8</div>
  <div class="step-body">
    <div class="step-title">Final Priority: Low</div>
    <div class="step-condition">The case reached this Decision Tree leaf.</div>
    <div class="step-meta">Case value: <strong>1 training samples reached this leaf</strong> | Result: <strong>Low</strong></div>
  </div>
</div>
</div>

## Decision Trace

Node 0: Broad case type is 'Violent'; case value = No; result = No -> Node 1: Influence / power imbalance is 'High'; case value = No; result = No -> Node 2: Severity is 'No Injury'; case value = Yes; result = Yes -> Node 4: Vulnerability is 'High'; case value = No; result = No -> Node 5: Legal category is 'Property/Land'; case value = No; result = No -> Node 6: Legal category is 'Insolvency/Debt'; case value = No; result = No -> Node 7: Dispute Concerning score <= 0.2118; case value = 0.0000; result = Yes -> Leaf node 8 => Predicted Priority = Low

## Raw Graph

Raw DOT file: `case_priority_system/decision_graphs\Exhibit_D01_Defence_Alibi_Toll_Receipt_decision_path.dot`
