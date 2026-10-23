# Anavaya — Model Benchmark & Validation Report

## 1. Corpus Statistics
- **Total Training Instances**: 4,538 cases
- **Authentic Scraped Judgments**: 426 real Indian High Court judgments
- **Synthetic Legal Dossiers**: 2,500 balanced archetypes
- **Holdout Test Set**: 426 unseen cases

## 2. Evaluation Results
| Metric | Benchmark Score |
| :--- | :--- |
| **Out-of-Domain Holdout Accuracy** | **98.4%** |
| **High-Priority Recall** | **100.0%** (30/30 critical cases detected) |
| **5-Fold Stratified Cross-Validation Mean** | **99.8%** (StdDev: ±0.001) |
| **In-Distribution Test Accuracy** | **99.9%** |

## 3. Confusion Matrix (Holdout Evaluation)
- **High Priority**: True Positives: 30 / False Negatives: 0
- **Medium Priority**: True Positives: 140 / False Negatives: 2
- **Low Priority**: True Positives: 249 / False Negatives: 5
