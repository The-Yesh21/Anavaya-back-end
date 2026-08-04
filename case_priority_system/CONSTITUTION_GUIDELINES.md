# Constitutional & Legal Basis for Case Prioritization

This document outlines the expanded constitutional and legal framework used by the Case Priority Prediction System. The system now provides a comprehensive **State's Perspective** analysis — an unbiased, neutral assessment from the standpoint of the judiciary applying the Constitution of India.

## Enhanced Analysis Framework

The system now provides the following layers of constitutional analysis for every case:

### 1. Constitutional Rights Engagement
Each case is analyzed to identify which specific constitutional provisions are engaged. The system distinguishes between **primary rights** (directly implicated) and **secondary rights** (tangentially relevant), providing the full text and key principles of each article.

### 2. State's Duty Analysis  
For each case category, the system articulates the affirmative obligation of the State (judiciary) under the Constitution. This includes the court's duty to protect rights, ensure procedural fairness, and take proactive measures where necessary.

### 3. Severity & Right-to-Life Impact Analysis
The severity of harm is mapped to its constitutional significance:
- **Fatal** — Article 21 (right to life) has been violated irreversibly
- **Major** — Article 21 (right to bodily integrity and health) is seriously compromised
- **Minor** — Article 21 (freedom from physical harm) is engaged
- **No Injury** — Other constitutional rights (Articles 14, 19, 300A) apply

### 4. Vulnerability & Power Balance Assessment
The system identifies vulnerable groups entitled to special constitutional protection under Articles 14, 15, 15(3), 15(4), 39, 39A, and the Doctrine of Parens Patriae.

### 5. Rights Balancing & Proportionality Analysis
A nuanced analysis of competing constitutional interests is generated, explaining why the assigned priority is proportionate to the rights engaged.

### 6. Applicable Constitutional Doctrines
The system identifies and explains relevant legal doctrines such as:
- Doctrine of Proportionality
- Doctrine of Reasonable Classification
- Doctrine of Parens Patriae (State as guardian)
- Principle of Natural Justice (Audi Alteram Partem)
- Doctrine of Basic Structure
- Doctrine of Severability
- And others as applicable

### 7. State's Perspective Opinion
A comprehensive narrative opinion written from the perspective of an unbiased constitutional court, covering:
- Subject matter and extracted parameters
- Constitutional rights engaged
- Severity & urgency assessment
- State's duty under the Constitution
- Vulnerability & power balance assessment
- Applicable doctrines & principles
- Priority assessment & justification
- Final observation and recommendation

### 8. Priority Rules — Detailed Breakdown
Each priority determination is explained through specific rules, each referencing the constitutional basis and extracted case features.

---

## Core Constitutional Principles (Summary)

### 1. Right to Life and Liberty (Article 21)
**Rule:** Cases involving physical violence, threats to life, or illegal detention are assigned **High Priority**.
**Justification:** The Right to Life is the most fundamental right. Justice delayed in violent crimes is a violation of the state's duty to protect its citizens.

### 2. Equality Before Law (Article 14)
**Rule:** Cases with a significant power imbalance (e.g., influential accused vs. vulnerable victim) are assigned **High or Medium Priority**.
**Justification:** The system ensures that the "power of the opposition" does not lead to witness intimidation or denial of justice. Special protection is given to the weaker side to ensure a fair trial.

### 3. Protection Against Exploitation (Articles 23 & 24)
**Rule:** Cases involving sexual assault, human trafficking, or child labor are assigned **Critical/High Priority**.
**Justification:** These cases involve grave violations of human dignity and require immediate judicial intervention to prevent further trauma.

### 4. Right to Livelihood and Property (Article 300A)
**Rule:** Land disputes, property encroachments, and insolvency cases are generally assigned **Medium or Low Priority** unless they lead to violence.
**Justification:** While important, economic disputes are secondary to cases involving physical harm or threat to life.

### 5. Speedy Trial (Derived from Article 21)
**Rule:** All cases are prioritized based on the principle that "Justice delayed is justice denied."
**Justification:** By using AI to rank cases, the system helps the court manage backlogs while ensuring the most urgent human rights violations are heard first.

---

## Technical Implementation

The enhanced constitutional analysis is implemented in:
- `case_priority_system/scripts/constitutional_analysis.py` — Core analysis module
- Integrated into `inference_pipeline.py` and `app.py` for both CLI and API usage
- Displayed in the web dashboard via enhanced UI sections
- Output in Excel reports with new columns

The module is fully rule-based and deterministic. It does not use the LLM for constitutional reasoning — ensuring that all constitutional justifications are transparent, reproducible, and verifiable against the Constitution of India.
