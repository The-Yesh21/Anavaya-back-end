# Anavaya: Judicial Case Priority System & Dashboard

An AI-powered advisory system designed to assist judicial authorities in prioritizing cases based on severity, vulnerability, and risk metrics. It extracts facts from raw court document PDFs, runs them through an interpretable Decision Tree model, and renders them in a highly interactive web-based dashboard.

---

## 🚀 Getting Started

To launch the system and inspect the court priority classifications:

### 1. Start the FastAPI Web Dashboard
Run this command from the root directory:
```powershell
python -m uvicorn case_priority_system.app:app --host 127.0.0.1 --port 8000
```
Open [http://127.0.0.1:8000](http://127.0.0.1:8000) in your web browser to explore:
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

- **Re-run the PDF Triage Pipeline (queries Gemma + updates Excel/reports):**
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
