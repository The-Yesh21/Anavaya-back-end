"""
Build a REAL-JUDGMENT training corpus from the public KanoonGPT/indian-case-laws
dataset (Indian High Court judgments; text sourced from the public AWS Open Data
mirror, CC-BY-4.0).

Streams judgment records directly via the HuggingFace Datasets Server HTTP API
(or `datasets` library if installed), downloads judgment PDFs from AWS S3,
extracts text with PyMuPDF, extracts features with Anavaya's deterministic
pipeline (`fast_extract_features` + `tune_case_features`), labels priority via
`infer_priority_label`, and appends the rows to `data/real_report_training_cases.csv`.

Usage (from repo root):
    python case_priority_system/scripts/build_real_judgment_dataset.py --scan 200 --max-rows 100 --offset 150
"""
import argparse
import itertools
import json
import os
import re
import sys
import time
import urllib.request

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

import pandas as pd
import fitz

from case_priority_system.scripts.inference_pipeline import (
    fast_extract_features,
    tune_case_features,
)
from case_priority_system.scripts.train_model import (
    infer_priority_label,
    LEGAL_CATEGORY_TO_TEXT,
    REAL_TRAINING_DATA_PATH,
)

DEFAULT_OUT = REAL_TRAINING_DATA_PATH
HF_DATASET = "KanoonGPT/indian-case-laws"
STORE_CHARS = 2500
MIN_TEXT_CHARS = 1000


def usable_judgment(text: str) -> bool:
    if not text or len(text) < MIN_TEXT_CHARS:
        return False
    lowered = text.lower()
    judicial_markers = [
        "judgment", "judgement", "court", "petition", "appeal",
        "respondent", "petitioner", "allowed", "dismissed", "order",
        "held", "versus", "v.", "fir", "act",
    ]
    hits = sum(1 for m in judicial_markers if m in lowered)
    return hits >= 3


def download_pdf(url: str, timeout: int = 25):
    """Returns PDF bytes, or None on failure."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "AnavayaScraper/2.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            content = resp.read()
            if content[:4] == b"%PDF":
                return content
    except Exception:
        pass
    return None


def build_row_from_text(text: str, source: str, idx: int) -> dict | None:
    """One training row from a real judgment, mirroring the PDF-row builder."""
    try:
        features = tune_case_features(
            fast_extract_features(text, os.path.basename(source)), text
        )
    except Exception as e:
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


def stream_hf_records(offset: int = 0, limit: int = 150):
    """Streams dataset records from HuggingFace Datasets Server HTTP API with pagination."""
    batch_size = 100
    current_offset = offset
    remaining = limit

    while remaining > 0:
        fetch_count = min(batch_size, remaining)
        url = (
            f"https://datasets-server.huggingface.co/rows?"
            f"dataset={HF_DATASET}&config=default&split=train&"
            f"offset={current_offset}&limit={fetch_count}"
        )
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "AnavayaScraper/2.0"})
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                rows = data.get("rows", [])
                if not rows:
                    break
                for item in rows:
                    yield item.get("row", {})
                current_offset += len(rows)
                remaining -= len(rows)
                if len(rows) < fetch_count:
                    break
        except Exception as e:
            print(f"HTTP stream error at offset {current_offset}: {e}")
            break


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scan", type=int, default=150,
                    help="how many dataset rows to scan before stopping")
    ap.add_argument("--max-rows", type=int, default=80,
                    help="hard cap on usable rows kept")
    ap.add_argument("--offset", type=int, default=200,
                    help="dataset offset index to start scanning from")
    ap.add_argument("--out", default=DEFAULT_OUT, help="output CSV path")
    args = ap.parse_args()

    print(f"Streaming {HF_DATASET} from offset {args.offset} (target: {args.max_rows} usable cases) ...")

    existing_sources = set()
    if os.path.exists(args.out):
        try:
            prev = pd.read_csv(args.out)
            if "source_file" in prev.columns:
                existing_sources = set(prev["source_file"].dropna().astype(str))
            print(f"Existing corpus has {len(prev)} rows ({len(existing_sources)} unique sources).")
        except Exception:
            pass

    rows = []
    pending = []
    scanned = 0

    def persist(new_rows):
        if not new_rows:
            return
        new_df = pd.DataFrame(new_rows)
        existing = pd.DataFrame()
        if os.path.exists(args.out):
            existing = pd.read_csv(args.out)
        combined = pd.concat([existing, new_df], ignore_index=True)
        combined = combined.drop_duplicates(subset=["source_file"], keep="last")
        combined = combined.reset_index(drop=True)
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        combined.to_csv(args.out, index=False)
        print(f"  [Auto-saved] Total corpus now: {len(combined)} cases")

    for item in stream_hf_records(offset=args.offset, limit=args.scan):
        scanned += 1
        source = str(item.get("source_filename") or f"kno_{scanned:05d}.pdf")
        if source in existing_sources:
            continue

        pdf_url = str(item.get("source_pdf_s3_url") or "").strip()
        if not pdf_url:
            continue

        pdf_bytes = download_pdf(pdf_url)
        if pdf_bytes is None:
            continue

        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            text = "".join(doc[i].get_text() for i in range(min(6, len(doc))))
            doc.close()
        except Exception as e:
            continue

        if not usable_judgment(text):
            continue

        row = build_row_from_text(text, source, len(existing_sources) + len(rows))
        if row is None:
            continue

        existing_sources.add(source)
        rows.append(row)
        pending.append(row)
        print(f"  + [{len(rows):3d}] {source} ({len(text)} ch) -> {row['priority']} | {row['case_category']}")

        if len(pending) >= 15:
            persist(pending)
            pending = []

        if args.max_rows and len(rows) >= args.max_rows:
            break

    persist(pending)
    print(f"\nScanned {scanned} candidate cases -> added {len(rows)} new usable judgments.")

    if os.path.exists(args.out):
        final_df = pd.read_csv(args.out)
        print(f"\nUpdated {args.out}: {len(final_df)} total real judgment cases.")
        print("\nPriority distribution:")
        print(final_df["priority"].value_counts().to_string())
        print("\nCategory distribution:")
        print(final_df["case_category"].value_counts().to_string())


if __name__ == "__main__":
    main()
