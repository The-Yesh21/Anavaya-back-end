"""
Build a REAL-JUDGMENT training corpus from the public KanoonGPT/indian-case-laws
HuggingFace dataset (Indian High Court judgments, CC-BY-4.0 licensed, sourced
from the AWS Open Data mirror).

For every usable judgment we:
  1. take the `indexable_text` (full judgment text),
  2. extract features with the SAME deterministic pipeline the production app
     uses (`fast_extract_features` + `tune_case_features` — no LLM needed),
  3. label priority with the SAME policy used for PDF-derived rows
     (`infer_priority_label`),
  4. append the row to `data/real_report_training_cases.csv` (merged with the
     existing PDF-derived rows, deduplicated on `source_file`).

This gives the Decision Tree real out-of-domain legal language to learn from
and lets us measure *honest* generalization on genuine judgments instead of
only synthetic templates.

Usage (from repo root):
    python case_priority_system/scripts/build_real_judgment_dataset.py \
        --scan 600 --out case_priority_system/data/real_report_training_cases.csv
"""
import argparse
import itertools
import os
import re
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

import pandas as pd

from case_priority_system.scripts.inference_pipeline import (
    fast_extract_features,
    tune_case_features,
    classify_legal_category,
    LEGAL_CATEGORIES,
)
from case_priority_system.scripts.train_model import (
    infer_priority_label,
    LEGAL_CATEGORY_TO_TEXT,
    REAL_TRAINING_DATA_PATH,
)

DEFAULT_OUT = REAL_TRAINING_DATA_PATH
HF_DATASET = "KanoonGPT/indian-case-laws"

# A judgment needs enough prose to be worth a training row. Orders/short
# registrations (a big fraction of the HC corpus) are skipped.
MIN_TEXT_CHARS = 1500
# Truncate the text stored per row so TF-IDF stays fast while keeping the
# essential facts (matching how PDF rows store ~2500 chars).
STORE_CHARS = 2500


def usable_judgment(text: str) -> bool:
    if not text or len(text) < MIN_TEXT_CHARS:
        return False
    # Require a fragment of actual judicial language (not just a docket line).
    lowered = text.lower()
    judicial_markers = [
        "judgment", "judgement", "court", "petition", "appeal", "the state",
        "versus", "v.", "respondent", "petitioner", "allowed", "dismissed",
        "order", "held", "observed",
    ]
    hits = sum(1 for m in judicial_markers if m in lowered)
    return hits >= 3


def build_row(text: str, source: str, idx: int) -> dict | None:
    """One training row from a real judgment, mirroring the PDF-row builder."""
    try:
        features = tune_case_features(
            fast_extract_features(text, os.path.basename(source)), text
        )
    except Exception as e:  # keep the batch robust to odd inputs
        print(f"  skip {source}: feature extraction failed ({e})")
        return None

    category = features.get("case_category", "General Civil")
    category_text = LEGAL_CATEGORY_TO_TEXT.get(category, "")
    description = " ".join([
        features.get("plain_summary", ""),
        category_text,
        re.sub(r"\s+", " ", text[:STORE_CHARS]),
    ]).strip()

    priority = infer_priority_label(features)
    return {
        "case_id": f"REALHF_{idx:05d}",
        "description": description,
        "case_category": category,
        "crime_type": features.get("crime_type", "Non-Violent"),
        "severity": features.get("severity", "No Injury"),
        "vulnerability": features.get("vulnerability", "Low"),
        "influence": features.get("influence", "Low"),
        "priority": priority,
        "source_file": source,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scan", type=int, default=600,
                    help="how many dataset rows to scan before stopping")
    ap.add_argument("--max-rows", type=int, default=0,
                    help="hard cap on usable rows kept (0 = unlimited)")
    ap.add_argument("--out", default=DEFAULT_OUT, help="output CSV path")
    args = ap.parse_args()

    print(f"Streaming {HF_DATASET} ...")
    try:
        from datasets import load_dataset
    except ImportError as e:
        sys.exit("pip install datasets first — " + str(e))

    ds = load_dataset(HF_DATASET, split="train", streaming=True)

    rows, seen_sources = [], set()
    scanned = 0
    for item in itertools.islice(iter(ds), args.scan):
        scanned += 1
        text = str(item.get("indexable_text") or "").strip()
        source = str(item.get("source_filename") or f"kno_{scanned:05d}.json")
        if not usable_judgment(text):
            continue
        row = build_row(text, source, len(rows))
        if row is None:
            continue
        if source in seen_sources:
            continue
        seen_sources.add(source)
        rows.append(row)
        if args.max_rows and len(rows) >= args.max_rows:
            break

    print(f"Scanned {scanned} dataset rows -> {len(rows)} usable judgments.")

    new_df = pd.DataFrame(rows)
    if new_df.empty:
        print("Nothing to merge; existing file left untouched.")
        return

    # Merge with existing rows (PDF-derived + any previous run), dedupe by source.
    existing = pd.DataFrame()
    if os.path.exists(args.out):
        existing = pd.read_csv(args.out)
    combined = pd.concat([existing, new_df], ignore_index=True)
    combined = combined.drop_duplicates(subset=["source_file"], keep="last")
    combined = combined.reset_index(drop=True)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    combined.to_csv(args.out, index=False)

    print(f"Merged into {args.out}: {len(existing)} existing + {len(new_df)} new "
          f"= {len(combined)} total rows.")
    print("\nPriority distribution:")
    print(combined["priority"].value_counts().to_string())
    print("\nCategory distribution:")
    print(combined["case_category"].value_counts().to_string())
    print("\nSource mix:")
    print(combined["source_file"].apply(
        lambda s: "PDF" if s.lower().endswith(".pdf") else "HF"
    ).value_counts().to_string())


if __name__ == "__main__":
    main()
