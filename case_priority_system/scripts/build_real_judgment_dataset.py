"""
Build a REAL-JUDGMENT training corpus from the public KanoonGPT/indian-case-laws
HuggingFace dataset (Indian High Court judgments; text sourced from the public
AWS Open Data mirror, CC-BY-4.0).

The dataset rows carry metadata only, but each exposes a public S3 `pdf_link`
with the actual judgment PDF. For every usable judgment we:

  1. download the PDF from the public AWS S3 bucket over plain HTTPS,
  2. extract text with PyMuPDF (same reader as the production pipeline),
  3. extract features with the SAME deterministic pipeline the production app
     uses (`fast_extract_features` + `tune_case_features` — no LLM needed),
  4. label priority with the SAME policy used for PDF-derived rows
     (`infer_priority_label`),
  5. append the row to `data/real_report_training_cases.csv` (merged with the
     existing PDF-derived rows, deduplicated on `source_file`).

This gives the Decision Tree real out-of-domain legal language to learn from
and lets us measure *honest* generalization on genuine judgments instead of
only synthetic templates.

Usage (from repo root):
    python case_priority_system/scripts/build_real_judgment_dataset.py \
        --scan 120 --max-rows 60 \
        --out case_priority_system/data/real_report_training_cases.csv
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
)
from case_priority_system.scripts.train_model import (
    infer_priority_label,
    LEGAL_CATEGORY_TO_TEXT,
    REAL_TRAINING_DATA_PATH,
)

try:
    import requests
except ImportError:
    requests = None

DEFAULT_OUT = REAL_TRAINING_DATA_PATH
HF_DATASET = "KanoonGPT/indian-case-laws"
S3_BASE = "https://indian-high-court-judgments.s3.ap-south-1.amazonaws.com"
# How much of the judgment text to store per row (matches the PDF-row builder
# which stores ~2500 chars).
STORE_CHARS = 2500
MIN_TEXT_CHARS = 1200


def usable_judgment(text: str) -> bool:
    if not text or len(text) < MIN_TEXT_CHARS:
        return False
    lowered = text.lower()
    judicial_markers = [
        "judgment", "judgement", "court", "petition", "appeal",
        "respondent", "petitioner", "allowed", "dismissed", "order",
        "held", "versus", "v.",
    ]
    hits = sum(1 for m in judicial_markers if m in lowered)
    return hits >= 4


def download_pdf(url: str, timeout: int = 40):
    """Returns PDF bytes, or None on failure."""
    if requests is None:
        return None
    try:
        resp = requests.get(url, timeout=timeout)
        if resp.status_code == 200 and resp.content[:4] == b"%PDF":
            return resp.content
    except Exception as e:
        print(f"  download failed: {e}")
    return None


def build_row_from_text(text: str, source: str, idx: int) -> dict | None:
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
    ap.add_argument("--scan", type=int, default=120,
                    help="how many dataset rows to scan before stopping")
    ap.add_argument("--max-rows", type=int, default=60,
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

    def persist(pending):
        """Merge + write accumulated rows so a long/interrupted run never loses work."""
        new_df = pd.DataFrame(pending)
        if new_df.empty:
            return
        existing = pd.DataFrame()
        if os.path.exists(args.out):
            existing = pd.read_csv(args.out)
        combined = pd.concat([existing, new_df], ignore_index=True)
        combined = combined.drop_duplicates(subset=["source_file"], keep="last")
        combined = combined.reset_index(drop=True)
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        combined.to_csv(args.out, index=False)

    pending = []
    for item in itertools.islice(iter(ds), args.scan):
        scanned += 1
        source = str(item.get("source_filename") or f"kno_{scanned:05d}.pdf")
        pdf_url = str(item.get("source_pdf_s3_url") or "").strip()
        if not pdf_url:
            continue

        pdf_bytes = download_pdf(pdf_url)
        if pdf_bytes is None:
            continue

        # extract text the same way the inference pipeline does
        import fitz
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            text = "".join(doc[i].get_text() for i in range(min(6, len(doc))))
            doc.close()
        except Exception as e:
            print(f"  extract failed for {source}: {e}")
            continue

        if not usable_judgment(text):
            print(f"  {source}: only {len(text)} chars — skipping (order/order fragment)")
            continue

        row = build_row_from_text(text, source, len(rows))
        if row is None:
            continue
        if source in seen_sources:
            continue
        seen_sources.add(source)
        rows.append(row)
        pending.append(row)
        print(f"  [{len(rows):3d}] {source} ({len(text)} chars) -> {row['priority']} | {row['case_category']}")
        if len(pending) >= 15:
            persist(pending)
            pending = []
        if args.max_rows and len(rows) >= args.max_rows:
            break

    persist(pending)
    print(f"Scanned {scanned} dataset rows -> {len(rows)} usable judgments.")

    combined = pd.DataFrame()
    if os.path.exists(args.out):
        combined = pd.read_csv(args.out)
    if combined.empty:
        print("No rows merged; output untouched.")
        return

    print(f"Final {args.out}: {len(combined)} total rows.")
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
