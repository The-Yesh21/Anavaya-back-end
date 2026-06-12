# Case Priority Prediction System

An AI-powered system designed to assist judicial authorities in prioritizing cases based on severity, vulnerability, and risk.

## 1. System Architecture
The system follows a hybrid approach combining **Natural Language Processing (NLP)** for unstructured text analysis and **Decision Tree Models** for interpretable classification.

### Workflow:
1.  **Input:** FIR reports, complaints, testimonies (PDF or Text).
2.  **Preprocessing:**
    *   Text cleaning and normalization.
    *   Named Entity Recognition (NER) for extracting key actors.
    *   Keyword extraction for identifying violent/non-violent indicators.
3.  **Feature Extraction:**
    *   **Crime Type:** Categorized as Violent, Financial, etc.
    *   **Severity:** Fatal, Major, Minor, or No Injury.
    *   **Victim Vulnerability:** Based on demographics and incident context.
    *   **Influence Level:** Power imbalance detection.
4.  **Model Layer:**
    *   **Decision Tree:** Primary model for final priority assignment (High, Medium, Low).
    *   **Deep Learning (Optional):** PyTorch-based neural network for complex pattern recognition in testimonies.
5.  **Output:** Priority level with an explainable decision path.

## 2. Model Performance
Based on synthetic testing:
- **Decision Tree Accuracy:** 99-100% (interpretable rules).
- **Recall for High Priority:** 100% (Ensures no critical cases are missed).

## 3. Key Features
- **Interpretability:** The Decision Tree provides clear rules (e.g., `if severity == Fatal then Priority = High`).
- **Scalability:** Can process thousands of FIRs in seconds.
- **Hybrid NLP:** Combines traditional TF-IDF with modern Deep Learning capabilities.

## 4. Ethical Considerations
- **Fairness:** Regular audits required to ensure no bias against specific groups.
- **Transparency:** All decisions are backed by a "Reasoning Path".
- **Judicial Sovereignty:** The system is an advisory tool; the final decision remains with the court.

## 5. Implementation Guide
- `scripts/generate_data.py`: Creates synthetic training data.
- `scripts/train_model.py`: Trains the interpretable Decision Tree using synthetic cases, legal-domain templates, and real PDF report examples.
- `scripts/nlp_dl_model.py`: Implements a PyTorch-based NLP classifier.
- `scripts/predict.py`: Demonstrates real-time case prioritization.

## 7. Inference Pipeline & Real Case Processing
The system includes an automated pipeline (`scripts/inference_pipeline.py`) to process real-world legal documents.

### Key Capabilities:
- **Batch Processing:** Reads all PDF files from the root directory.
- **Gemma-based Summarization:** Uses NVIDIA Integrate with `google/gemma-4-31b-it` to generate simple 3-sentence case summaries.
- **Tuned Legal Categorization:** Classifies cases into legal domains such as `Excise/Tax`, `Customs/Import-Export`, `Company/Winding Up`, and `Insolvency/Debt`, then maps them to broad model categories.
- **Gemma-based Feature Extraction:** Extracts parties, broad crime type, severity, vulnerability, and influence as normalized structured labels.
- **Local Priority Prediction:** Applies the trained Decision Tree model to assign the final priority level. The LLM does not decide the priority.
- **Decision Path Reports:** Generates one polished Markdown report per case with a Mermaid flowchart, colored priority badge, animated step cards, and the exact Decision Tree conditions that led to the priority.
- **Constitutional Justification:** Explains each priority using extracted factors, legal category, constitutional basis, and applied prioritization rules.
- **Structured Output:** Generates an Excel report (`case_results.xlsx`) containing:
    - File Name
    - Summary
    - Legal Case Category
    - Broad Model Category
    - Violence Presence
    - Severity
    - Victim Vulnerability
    - Accused Power/Influence
    - Predicted Priority
    - Constitutional Justification
    - Priority Rules Applied
    - Decision Report Path
    - Decision Path

### Usage:
```powershell
python case_priority_system/scripts/inference_pipeline.py
```

## 8. Final Deliverables
- **`case_results.xlsx`**: The primary output containing prioritized real-world cases.
- **`decision_graphs/*_decision_report.md`**: Per-case visual Decision Tree reports.
- **`decision_graphs/*.dot`**: Raw per-case Decision Tree path graphs for debugging.
- **`data/real_report_training_cases.csv`**: Real PDF reports converted into training rows.
- **Modular Scripts**: For data generation, model training, and inference.
- **Pickle Artifacts**: Saved model and encoders for easy deployment.
