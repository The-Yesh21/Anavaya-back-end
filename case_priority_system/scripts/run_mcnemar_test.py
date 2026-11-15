"""McNemar's Test: Comparing CART Decision Tree with Baseline Classifiers on 265 Held-Out Real Judgments.

Evaluates:
  1. CART Decision Tree (our explainable triage model)
  2. Logistic Regression (multinomial, balanced class weights)
  3. Random Forest Classifier (100 estimators, max_depth=8, balanced)
  4. Majority Class Baseline (DummyClassifier)

Constructs paired contingency tables (2x2) and computes McNemar's Chi-squared
statistic with continuity correction, plus exact binomial two-tailed p-values.

Usage (from repo root):
  python case_priority_system/scripts/run_mcnemar_test.py
"""
import os
import sys
import numpy as np
import pandas as pd
from scipy.stats import binom, chi2
from sklearn.preprocessing import OneHotEncoder, LabelEncoder
from sklearn.tree import DecisionTreeClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.dummy import DummyClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, classification_report, f1_score

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from train_model import (
    SYNTHETIC_DATA_PATH,
    REAL_TRAINING_DATA_PATH,
    enrich_synthetic_data,
    load_constitutional_training_data,
)

STRUCTURED_COLS = ["case_category", "crime_type", "severity", "vulnerability", "influence"]
CATEGORICAL_CATEGORIES = {
    "case_category": [
        "Company/Winding Up", "Constitutional/Writ", "Criminal/Violent",
        "Customs/Import-Export", "Excise/Tax", "General Civil",
        "Insolvency/Debt", "Property/Land"
    ],
    "crime_type": ["Financial", "Non-Violent", "Property", "Violent"],
    "severity": ["Fatal", "Major", "Minor", "No Injury"],
    "vulnerability": ["High", "Low", "Medium"],
    "influence": ["High", "Low"],
}


def run_mcnemar_suite():
    print("=" * 70)
    print(" McNEMAR'S TEST: DECISION TREE VS BASELINE CLASSIFIERS (265 REAL JUDGMENTS)")
    print("=" * 70)

    # 1. Assemble deduplicated corpus
    df = pd.read_csv(SYNTHETIC_DATA_PATH)
    if "case_category" not in df.columns:
        df["case_category"] = "General Civil"
    df = enrich_synthetic_data(df)

    real_df = pd.read_csv(REAL_TRAINING_DATA_PATH)
    const_df = load_constitutional_training_data()
    combined = pd.concat([df, real_df, const_df], ignore_index=True)
    combined["description"] = combined["description"].fillna("").astype(str).str[:2500]

    # Deduplicate across features + description
    dedup = combined.drop_duplicates(
        subset=["case_category", "crime_type", "severity", "vulnerability", "influence", "description"]
    ).reset_index(drop=True)

    is_real = dedup["source_file"].notna()
    train_df = dedup[~is_real].copy().reset_index(drop=True)
    test_df = dedup[is_real].copy().reset_index(drop=True)[:265]

    print(f"Training set: {len(train_df)} rows (synthetic, legal templates, constitutional)")
    print(f"Held-out real judgments test set: {len(test_df)} rows\n")

    # 2. Vectorization & Encoding
    ohe = OneHotEncoder(
        categories=[CATEGORICAL_CATEGORIES[c] for c in STRUCTURED_COLS],
        handle_unknown="ignore",
        sparse_output=False,
    )
    ohe.fit(dedup[STRUCTURED_COLS])
    ohe_cols = list(ohe.get_feature_names_out(STRUCTURED_COLS))

    tfidf = TfidfVectorizer(max_features=220, stop_words="english", ngram_range=(1, 2), min_df=1)
    train_text = tfidf.fit_transform(train_df["description"]).toarray()
    train_text_df = pd.DataFrame(train_text, columns=tfidf.get_feature_names_out())
    train_ohe = pd.DataFrame(ohe.transform(train_df[STRUCTURED_COLS]), columns=ohe_cols)
    X_train = pd.concat([train_ohe, train_text_df], axis=1)

    le = LabelEncoder()
    le.fit(["High", "Low", "Medium"])
    priority_map = {"High": 0, "Low": 1, "Medium": 2}
    y_train = train_df["priority"].map(priority_map).fillna(1).astype(int).to_numpy()

    test_text = tfidf.transform(test_df["description"]).toarray()
    test_text_df = pd.DataFrame(test_text, columns=tfidf.get_feature_names_out())
    test_ohe = pd.DataFrame(ohe.transform(test_df[STRUCTURED_COLS]), columns=ohe_cols)
    X_test = pd.concat([test_ohe, test_text_df], axis=1)
    # Align columns
    for col in X_train.columns:
        if col not in X_test.columns:
            X_test[col] = 0
    X_test = X_test[X_train.columns]
    y_test = test_df["priority"].map(priority_map).fillna(1).astype(int).to_numpy()

    # 3. Fit models
    models = {
        "CART Decision Tree": DecisionTreeClassifier(
            max_depth=8, min_samples_leaf=3, class_weight="balanced", random_state=42
        ),
        "Logistic Regression": LogisticRegression(
            max_iter=1000, class_weight="balanced", random_state=42
        ),
        "Random Forest (100 trees)": RandomForestClassifier(
            n_estimators=100, max_depth=8, class_weight="balanced", random_state=42
        ),
        "Majority Baseline": DummyClassifier(strategy="most_frequent"),
    }

    preds = {}
    metrics = {}
    for name, clf in models.items():
        clf.fit(X_train, y_train)
        y_pred = clf.predict(X_test)
        preds[name] = y_pred
        acc = accuracy_score(y_test, y_pred)
        mf1 = f1_score(y_test, y_pred, average="macro", zero_division=0)
        metrics[name] = {"accuracy": acc, "macro_f1": mf1}
        print(f"Model: {name:<26} | Accuracy: {acc*100:.2f}% | Macro F1: {mf1:.4f}")

    print("\n" + "=" * 70)
    print(" PAIRWISE MCNEMAR TESTS (vs CART Decision Tree)")
    print("=" * 70)

    results = []
    y_dt = preds["CART Decision Tree"]
    dt_correct = (y_dt == y_test)

    for baseline_name in ["Majority Baseline", "Logistic Regression", "Random Forest (100 trees)"]:
        y_b = preds[baseline_name]
        b_correct = (y_b == y_test)

        a = int(np.sum(dt_correct & b_correct))        # Both correct
        b = int(np.sum(dt_correct & ~b_correct))       # DT correct, Baseline wrong
        c = int(np.sum(~dt_correct & b_correct))       # DT wrong, Baseline correct
        d = int(np.sum(~dt_correct & ~b_correct))      # Both wrong

        # Edwards continuity-corrected Chi2 statistic: (|b - c| - 1)^2 / (b + c)
        if b + c > 0:
            chi2_stat = float(((abs(b - c) - 1.0) ** 2) / (b + c)) if abs(b - c) > 0 else 0.0
            p_val_chi2 = float(1.0 - chi2.cdf(chi2_stat, 1))
        else:
            chi2_stat = 0.0
            p_val_chi2 = 1.0

        # Exact two-tailed binomial p-value
        k = min(b, c)
        n_discordant = b + c
        exact_p = float(min(1.0, 2.0 * binom.cdf(k, n_discordant, 0.5))) if n_discordant > 0 else 1.0

        print(f"\n--- Decision Tree vs. {baseline_name} ---")
        print(f"Contingency Table (2x2):")
        print(f"  Both Correct (a)          : {a:>4}")
        print(f"  DT Correct, Other Wrong (b): {b:>4}")
        print(f"  DT Wrong, Other Correct (c): {c:>4}")
        print(f"  Both Wrong (d)            : {d:>4}")
        print(f"Discordant pairs (b + c)    : {n_discordant}")
        print(f"McNemar Chi-sq (corr)       : {chi2_stat:.4f} (df=1)")
        print(f"Asymptotic p-value          : {p_val_chi2:.4e}")
        print(f"Exact Binomial p-value      : {exact_p:.4e}")

        significant = exact_p < 0.05
        conclusion = (
            "Statistically Significant difference (p < 0.05)"
            if significant
            else "No statistically significant difference (p >= 0.05; performance parity)"
        )
        print(f"Conclusion                  : {conclusion}")

        results.append({
            "baseline": baseline_name,
            "table": {"a": a, "b": b, "c": c, "d": d},
            "discordant": n_discordant,
            "chi2_stat": chi2_stat,
            "asymptotic_p": p_val_chi2,
            "exact_p": exact_p,
            "significant": significant,
        })

    return metrics, results


if __name__ == "__main__":
    run_mcnemar_suite()
