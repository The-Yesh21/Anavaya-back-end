# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An AI-powered case priority prediction system for judicial authorities. It classifies legal cases (FIRs, complaints, testimonies) into High/Medium/Low priority using a hybrid NLP + Decision Tree approach. Outputs include an Excel report (`case_results.xlsx`), per-case Markdown decision reports with Mermaid flowcharts, and DOT graph files.

## Running Scripts

All scripts must be run from `D:\major_project\` (the parent directory), not from within `case_priority_system/`. Internal paths use the `case_priority_system/` prefix.

```powershell
# Full inference pipeline: PDF → LLM extraction → priority prediction → Excel + decision reports
python case_priority_system/scripts/inference_pipeline.py

# Generate synthetic training data
python case_priority_system/scripts/generate_data.py

# Train the Decision Tree model (loads synthetic data + real PDFs, saves to models/)
python case_priority_system/scripts/train_model.py

# Demo: predict priority for hardcoded examples
python case_priority_system/scripts/predict.py

# Train the optional PyTorch deep learning model
python case_priority_system/scripts/nlp_dl_model.py
```

## Dependencies

No `requirements.txt` exists. Key packages: `pandas`, `numpy`, `scikit-learn`, `torch`, `PyMuPDF` (fitz) or `pypdf`, `requests`, `tqdm`, `openpyxl`. The inference pipeline calls a locally installed Ollama server (default `http://localhost:11434`, model `qwen2.5:3b`) for LLM feature extraction and summarization. Override with the `OLLAMA_URL` / `OLLAMA_MODEL` env vars.

**GPU acceleration:** When an NVIDIA GPU is present (check `nvidia-smi`), the local Ollama LLM runs on it (`ollama ps` shows `100% GPU`) and the web app auto-enables LLM feature extraction via `inference_pipeline.llm_extraction_enabled()` (force on/off with `ANAVAYA_USE_LLM=1`/`0`). `qwen2.5:3b` (~2 GB) fits fully in 4 GB VRAM; larger models partially offload to CPU. The optional PyTorch model (`scripts/nlp_dl_model.py`) trains on CUDA automatically.

## Architecture

**Model layer (hybrid):**
- **Decision Tree** (`models/priority_classifier.pkl`) — the primary model. Trained on 5 categorical features (crime_type, severity, vulnerability, influence, case_category) + TF-IDF text features (max 220 features, unigram+bigram). Max depth 8, balanced class weights.
- **PyTorch NN** (`models/priority_dl_model.pth`) — optional 2-layer feedforward network trained on TF-IDF text features only. Not used in the inference pipeline.

**Inference pipeline** (`scripts/inference_pipeline.py`):
1. PDF text extraction via PyMuPDF or pypdf (first 6 pages)
2. Feature extraction via the local Ollama LLM (`qwen2.5:3b`, GPU-accelerated when an NVIDIA GPU is present) — returns structured JSON with parties, crime_type, severity, vulnerability, influence, and a 3-sentence summary
3. Fallback: `fallback_extract_features()` uses keyword matching when the LLM is unavailable
4. `tune_case_features()` normalizes LLM output against allowed label sets and applies legal-domain keyword classification (`classify_legal_category()`) to map cases to 8 legal categories, then to 4 broad model categories via `LEGAL_TO_MODEL_CATEGORY`
5. `predict_priority()` runs the local Decision Tree only — the LLM never decides priority
6. Output: Excel report + per-case Markdown decision reports with Mermaid flowcharts + DOT files

**Key architectural invariant:** The LLM (Ollama) only extracts factual features and summaries. The Decision Tree model alone assigns the final priority. This separation ensures priority decisions are deterministic and explainable.

## Data Flow

```
PDF files (root dir) → extract_text_from_pdf() → call_ollama_api()
  → normalize_llm_data() → tune_case_features() → predict_priority()
  → get_constitutional_justification() → build_decision_path_graph()
  → case_results.xlsx + decision_graphs/*.md + decision_graphs/*.dot
```

## Key Files

| File | Purpose |
|---|---|
| `scripts/train_model.py` | Trains Decision Tree on synthetic + real PDF data; saves model, TF-IDF vectorizer, and LabelEncoders as a pickle bundle |
| `scripts/inference_pipeline.py` | Main pipeline: PDF processing, Ollama integration, feature tuning, priority prediction, report generation |
| `scripts/generate_data.py` | Creates synthetic training cases (1000 rows by default) with rule-based priority labels |
| `scripts/nlp_dl_model.py` | Optional PyTorch classifier (not part of the main pipeline) |
| `scripts/predict.py` | Standalone demo using the saved Decision Tree model |
| `scripts/constitutional_analysis.py` | **NEW** Comprehensive constitutional analysis module providing an unbiased 'State's Perspective' on case priority based on the Constitution of India. Generates: rights engagement analysis, state duty analysis, balancing/proportionality analysis, applicable doctrines, full narrative opinion, and detailed priority rules. |
| `models/priority_classifier.pkl` | Pickle bundle: `{model, tfidf, encoders, feature_names}` |
| `data/synthetic_cases.csv` | 1000 synthetic training cases |
| `data/real_report_training_cases.csv` | Training rows extracted from real PDF reports |

## Constitutional Justification Rules

Priority is justified using Indian constitutional principles (defined in `CONSTITUTION_GUIDELINES.md`):
- **Article 21** (Right to Life): Violent/fatal cases → High priority
- **Article 14** (Equality): Power imbalance cases → Medium/High priority
- **Articles 23 & 24** (Exploitation): Sexual assault, trafficking, child labor → Critical/High
- **Article 300A** (Property): Economic disputes → Medium/Low unless violent

The `get_constitutional_justification()` function in `inference_pipeline.py` implements these rules programmatically based on extracted features.