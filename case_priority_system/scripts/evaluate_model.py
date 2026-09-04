"""Evaluates the SHIPPED Decision Tree classifier and writes machine-readable metrics.

Unlike `train_model.py`, this script never refits or overwrites the saved model. It
loads `models/priority_classifier.pkl` as deployed, rebuilds the training corpus from
the CSVs on disk (no PDF re-parsing), and reports:

  1. Deployed-model accuracy on the full corpus + per-class precision/recall/F1
  2. Confusion matrix
  3. 5-fold stratified CV with a freshly built tree (generalization estimate)
  4. Out-of-domain holdout: train on synthetic/constitutional only, test on real judgments
  5. A majority-class baseline, so the headline number has something to beat

Output: models/evaluation_metrics.json (consumed by the landing page) + stdout summary.

Run from the repo root:
    python case_priority_system/scripts/evaluate_model.py
"""

import json
import os
import pickle
import sys
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.preprocessing import LabelEncoder
from sklearn.tree import DecisionTreeClassifier

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from train_model import (  # noqa: E402
    CONSTITUTIONAL_DATA_PATH,
    MODEL_PATH,
    REAL_TRAINING_DATA_PATH,
    SYNTHETIC_DATA_PATH,
    enrich_synthetic_data,
    load_constitutional_training_data,
    safe_encode,
)

METRICS_PATH = "case_priority_system/models/evaluation_metrics.json"
# Generated, site-facing copy consumed by the landing page
# (src/components/landing/ModelAccuracy.tsx). Emitted from the same run so the
# published numbers can never drift from the measured ones. TypeScript rather
# than JSON because the web tsconfig does not enable resolveJsonModule.
SITE_METRICS_PATH = "src/data/model-metrics.ts"

STRUCTURED_COLS = ["case_category", "crime_type", "severity", "vulnerability", "influence"]
ENC_KEYS = {
    "case_category": "category",
    "crime_type": "crime",
    "severity": "severity",
    "vulnerability": "vulnerability",
    "influence": "influence",
}


def build_tree():
    """Mirrors the estimator configuration used in train_model.build_tree()."""
    return DecisionTreeClassifier(
        max_depth=8, min_samples_leaf=3, class_weight="balanced", random_state=42
    )


def load_corpus():
    """Rebuilds the training corpus from CSVs only (no PDF parsing, so this is fast)."""
    df = pd.read_csv(SYNTHETIC_DATA_PATH)
    if "case_category" not in df.columns:
        df["case_category"] = "General Civil"
    df = enrich_synthetic_data(df)
    n_synthetic = len(df)

    real_df = pd.DataFrame()
    if os.path.exists(REAL_TRAINING_DATA_PATH):
        real_df = pd.read_csv(REAL_TRAINING_DATA_PATH)
        df = pd.concat([df, real_df], ignore_index=True)

    const_df = load_constitutional_training_data()
    if not const_df.empty:
        df = pd.concat([df, const_df], ignore_index=True)

    if "description" in df.columns:
        df["description"] = df["description"].fillna("").astype(str).str[:2500]

    return df, n_synthetic, len(real_df), len(const_df)


def encode_frame(data):
    """Encodes categoricals + TF-IDF text exactly as train_model does."""
    local = {}
    for col in STRUCTURED_COLS:
        le = LabelEncoder()
        data[col + "_enc"] = le.fit_transform(data[col])
        local[ENC_KEYS[col]] = le
    le_prio = LabelEncoder()
    data["priority_enc"] = le_prio.fit_transform(data["priority"])
    local["priority"] = le_prio

    tfidf = TfidfVectorizer(max_features=220, stop_words="english", ngram_range=(1, 2), min_df=1)
    text = tfidf.fit_transform(data["description"]).toarray()
    text_df = pd.DataFrame(text, columns=tfidf.get_feature_names_out())

    X = pd.concat([data[[c + "_enc" for c in STRUCTURED_COLS]], text_df], axis=1)
    return X, data["priority_enc"], local, tfidf


def project_onto(bundle_tfidf, encoders, frame, feature_names):
    """Builds a feature frame for `frame` using already-fitted transformers."""
    X = pd.DataFrame(index=frame.index)
    for col in STRUCTURED_COLS:
        X[col + "_enc"] = frame[col].apply(lambda v: safe_encode(encoders[ENC_KEYS[col]], v))
    text = bundle_tfidf.transform(frame["description"]).toarray()
    text_df = pd.DataFrame(text, columns=bundle_tfidf.get_feature_names_out(), index=frame.index)
    X = pd.concat([X, text_df], axis=1)
    for col in feature_names:
        if col not in X.columns:
            X[col] = 0
    return X[feature_names]


SITE_METRICS_HEADER = """\
// GENERATED FILE - DO NOT EDIT BY HAND.
// Written by case_priority_system/scripts/evaluate_model.py from the shipped
// models/priority_classifier.pkl. Re-run that script to refresh:
//     python case_priority_system/scripts/evaluate_model.py
// Every figure the landing page publishes comes from here, so the site can
// never quote an accuracy the model did not actually score.

export type ClassMetric = {
  label: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
};

export type ModelMetrics = {
  generatedAt: string;
  model: {
    type: string;
    max_depth: number | null;
    actual_depth: number;
    leaves: number;
    n_features: number;
    classes: string[];
  };
  corpus: {
    total_rows: number;
    synthetic_and_templates: number;
    real_judgments: number;
    constitutional: number;
    class_distribution: Record<string, number>;
  };
  headline: {
    holdoutAccuracy: number;
    holdoutRows: number;
    holdoutMacroF1: number;
    cvMeanAccuracy: number;
    cvStd: number;
    cvFolds: number;
    policyFidelity: number;
    policyMacroF1: number;
    baselineAccuracy: number;
    baselineClass: string;
  };
  confusionMatrix: { labels: string[]; matrix: number[][] };
  perClass: ClassMetric[];
  holdoutPerClass: ClassMetric[];
  cvPerFold: number[];
  caveat: string;
};

export const MODEL_METRICS: ModelMetrics = """


def write_site_metrics(metrics):
    """Emits the trimmed subset the landing page renders, as a typed TS module.

    Only the figures actually shown on the site are exported, in the shape the
    React component expects, so the published numbers stay traceable to this run.
    """
    dep = metrics["deployed_model"]
    hold = metrics["out_of_domain_holdout"]
    cv = metrics["cross_validation"]

    def per_class(report):
        return [
            {
                "label": label,
                "precision": report[label]["precision"],
                "recall": report[label]["recall"],
                "f1": report[label]["f1-score"],
                "support": int(report[label]["support"]),
            }
            for label in metrics["model"]["classes"]
        ]

    site = {
        "generatedAt": metrics["generated_at"],
        "model": metrics["model"],
        "corpus": metrics["corpus"],
        "headline": {
            "holdoutAccuracy": hold.get("accuracy"),
            "holdoutRows": hold.get("rows"),
            "holdoutMacroF1": hold.get("macro_f1"),
            "cvMeanAccuracy": cv["mean_accuracy"],
            "cvStd": cv["std"],
            "cvFolds": cv["folds"],
            "policyFidelity": dep["accuracy"],
            "policyMacroF1": dep["macro_f1"],
            "baselineAccuracy": metrics["baseline"]["accuracy"],
            "baselineClass": metrics["baseline"]["majority_class"],
        },
        "confusionMatrix": dep["confusion_matrix"],
        "perClass": per_class(dep["per_class"]),
        "holdoutPerClass": per_class(hold["per_class"]) if hold.get("available") else [],
        "cvPerFold": cv["per_fold"],
        "caveat": metrics["caveat"],
    }

    os.makedirs(os.path.dirname(SITE_METRICS_PATH), exist_ok=True)
    with open(SITE_METRICS_PATH, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(SITE_METRICS_HEADER)
        fh.write(json.dumps(site, indent=2))
        fh.write(";\n")
    print(f"Site metrics written to {SITE_METRICS_PATH}")


def main():
    if not os.path.exists(MODEL_PATH):
        raise SystemExit(f"Model not found at {MODEL_PATH}. Run train_model.py first.")

    print("Loading corpus...")
    df, n_synthetic, n_real, n_const = load_corpus()
    print(f"  corpus: {len(df)} rows "
          f"(synthetic+templates {n_synthetic}, real judgments {n_real}, constitutional {n_const})")

    with open(MODEL_PATH, "rb") as fh:
        bundle = pickle.load(fh)
    clf = bundle["model"]
    tfidf = bundle["tfidf"]
    encoders = bundle["encoders"]
    feature_names = bundle["feature_names"]
    classes = list(encoders["priority"].classes_)

    # ---- 1. Deployed model on the full corpus ----
    print("Evaluating the deployed model on the full corpus...")
    X_all = project_onto(tfidf, encoders, df, feature_names)
    y_true = df["priority"].apply(lambda v: safe_encode(encoders["priority"], v)).to_numpy()
    y_pred = clf.predict(X_all)

    deployed_acc = float(accuracy_score(y_true, y_pred))
    deployed_macro_f1 = float(f1_score(y_true, y_pred, average="macro", zero_division=0))
    report = classification_report(
        y_true, y_pred, target_names=classes, zero_division=0, output_dict=True
    )
    cm = confusion_matrix(y_true, y_pred).tolist()

    print(f"  deployed accuracy: {deployed_acc:.4f} | macro F1: {deployed_macro_f1:.4f}")
    print(classification_report(y_true, y_pred, target_names=classes, zero_division=0))

    # ---- 2. Majority-class baseline ----
    majority = df["priority"].value_counts(normalize=True)
    baseline_acc = float(majority.iloc[0])
    print(f"  majority-class baseline ({majority.index[0]}): {baseline_acc:.4f}")

    # ---- 3. 5-fold stratified CV with a fresh tree ----
    print("Running 5-fold stratified CV...")
    X_cv, y_cv, _, _ = encode_frame(df.copy())
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv = cross_val_score(build_tree(), X_cv, y_cv, cv=skf, scoring="accuracy")
    cv_mean, cv_std = float(np.mean(cv)), float(np.std(cv))
    print(f"  CV mean accuracy: {cv_mean:.4f} (+/- {cv_std:.4f})")

    # ---- 4. Out-of-domain holdout: real judgments unseen during fit ----
    holdout = {"available": False}
    is_real = df["source_file"].notna() if "source_file" in df.columns else pd.Series(
        False, index=df.index
    )
    if int(is_real.sum()) > 0:
        print("Running out-of-domain real-judgment holdout...")
        train_df = df[~is_real].copy().reset_index(drop=True)
        test_df = df[is_real].copy().reset_index(drop=True)

        X_tr, y_tr, enc_h, tfidf_h = encode_frame(train_df)
        tree_h = build_tree()
        tree_h.fit(X_tr, y_tr)

        X_te = project_onto(tfidf_h, enc_h, test_df, list(X_tr.columns))
        y_te = test_df["priority"].apply(lambda v: safe_encode(enc_h["priority"], v)).to_numpy()
        y_hat = tree_h.predict(X_te)

        holdout = {
            "available": True,
            "rows": int(len(test_df)),
            "accuracy": float(accuracy_score(y_te, y_hat)),
            "macro_f1": float(f1_score(y_te, y_hat, average="macro", zero_division=0)),
            "per_class": classification_report(
                y_te, y_hat, target_names=list(enc_h["priority"].classes_),
                zero_division=0, output_dict=True,
            ),
        }
        print(f"  holdout accuracy on {holdout['rows']} real judgments: {holdout['accuracy']:.4f}")

    metrics = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "model": {
            "type": "DecisionTreeClassifier (CART)",
            "max_depth": int(clf.max_depth) if clf.max_depth else None,
            "actual_depth": int(clf.get_depth()),
            "leaves": int(clf.get_n_leaves()),
            "n_features": int(len(feature_names)),
            "classes": classes,
        },
        "corpus": {
            "total_rows": int(len(df)),
            "synthetic_and_templates": int(n_synthetic),
            "real_judgments": int(n_real),
            "constitutional": int(n_const),
            "class_distribution": {k: int(v) for k, v in df["priority"].value_counts().items()},
        },
        "deployed_model": {
            "accuracy": deployed_acc,
            "macro_f1": deployed_macro_f1,
            "per_class": report,
            "confusion_matrix": {"labels": classes, "matrix": cm},
        },
        "cross_validation": {
            "folds": 5,
            "per_fold": [float(s) for s in cv],
            "mean_accuracy": cv_mean,
            "std": cv_std,
        },
        "out_of_domain_holdout": holdout,
        "baseline": {"strategy": "majority_class",
                     "majority_class": str(majority.index[0]),
                     "accuracy": baseline_acc},
        "caveat": (
            "Ground-truth labels are produced by infer_priority_label(), a codified "
            "court-priority policy derived from CONSTITUTION_GUIDELINES.md - not by human "
            "judicial annotation. These scores therefore measure how faithfully the tree "
            "reproduces that written policy, which is exactly the auditability property the "
            "system is designed for. They are not a claim about agreement with judges."
        ),
    }

    os.makedirs(os.path.dirname(METRICS_PATH), exist_ok=True)
    with open(METRICS_PATH, "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)
    print(f"\nMetrics written to {METRICS_PATH}")

    write_site_metrics(metrics)


if __name__ == "__main__":
    main()
