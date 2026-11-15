"""
Anavaya Exhibition Showcase Case Ingestion & Triage Pipeline.

Ingests and analyzes all exhibition showcase cases:
1. ANV-2026-0042: State of Maharashtra v. Vikram Malhotra & Anr. — Apollo Pediatric Extortion
2. ANV-2026-0051: State of NCT of Delhi v. Kunal Singhania & Anr. (Connaught Place Fatal Hit & Run)
3. ANV-2026-0052: Gram Panchayat Chhatarpur & Ors. v. Apex Dyechem Industries Ltd. (Yamuna Toxic Effluent Discharge)
4. ANV-2026-0053: Global Container Lines Ltd. v. Commissioner of Customs (Nhava Sheva) (Customs Demurrage Dispute)

Must be executed from repo root (F:\\major_project).
"""

from __future__ import annotations

import os
import sys
import glob
import pandas as pd
from typing import Optional

# Ensure repo root is on sys.path
sys.path.insert(0, os.path.abspath("."))

from case_priority_system.scripts.case_manager import CaseManager, Case
from case_priority_system.app import _append_case_documents_to_excel, EXCEL_PATH

SHOWCASE_DIR = os.path.abspath("showcase_cases")

CASE_SPECS = [
    {
        "case_id": "ANV-2026-0042",
        "title": "State of Maharashtra v. Vikram Malhotra & Anr. — Apollo Pediatric Extortion",
        "created_by": "Special Investigation Team (Cyber Crime)",
        "source": "FIR_UPLOADED",
        "match_keywords": ["apollo", "0042", "critical_care"],
        "folder_candidates": ["apollo_critical_care"],
        "expected_priority": "High",
        "constitutional_focus": "Article 21 (Right to Health and Emergency Medical Care)",
    },
    {
        "case_id": "ANV-2026-0051",
        "title": "State of NCT of Delhi v. Kunal Singhania & Anr.",
        "created_by": "Traffic Police / Special Investigation Unit",
        "source": "FIR_UPLOADED",
        "match_keywords": ["singhania", "0051", "hit_and_run", "connaught", "delhi"],
        "folder_candidates": ["delhi_hit_and_run", "connaught_place_hit_and_run"],
        "expected_priority": "High",
        "constitutional_focus": "Article 21 (Deprivation of Life through Reckless Negligence)",
    },
    {
        "case_id": "ANV-2026-0052",
        "title": "Gram Panchayat Chhatarpur & Ors. v. Apex Dyechem Industries Ltd.",
        "created_by": "Sub-Divisional Magistrate / Writ Petitioner",
        "source": "FIR_UPLOADED",
        "match_keywords": ["apex", "dyechem", "0052", "yamuna", "effluent", "chhatarpur", "toxic"],
        "folder_candidates": ["chhatarpur_toxic_discharge", "yamuna_toxic_effluent", "toxic_effluent_yamuna"],
        "expected_priority": "High",
        "constitutional_focus": "Article 21 (Clean Water & Environment) & Parens Patriae Doctrine",
    },
    {
        "case_id": "ANV-2026-0053",
        "title": "Global Container Lines Ltd. v. Commissioner of Customs (Nhava Sheva)",
        "created_by": "Customs Appellate Authority",
        "source": "AUTO_ID",
        "match_keywords": ["customs", "nhava", "0053", "container", "demurrage"],
        "folder_candidates": ["customs_demurrage_dispute", "nhava_sheva_customs", "global_container"],
        "expected_priority": "Low",
        "constitutional_focus": "Article 265 (Taxes Authority of Law) & Article 300A (Property Rights)",
    },
]


def guess_doc_type(filename: str) -> str:
    """Classify document into one of CaseManager.DOC_TYPES."""
    fn = filename.lower()
    if "fir" in fn:
        return "FIR"
    elif any(k in fn for k in ["medical", "icu", "clinical", "status", "autopsy", "chemical", "hospital", "toxic", "cpcb", "analysis"]):
        return "Medical"
    elif any(k in fn for k in ["deposition", "witness", "statement"]):
        return "Statement"
    elif any(k in fn for k in ["police", "panchnama", "cctv", "inspection", "investigation", "telemetry", "crash", "log"]):
        return "Police Report"
    else:
        return "Other"


def locate_case_folder(spec: dict) -> Optional[str]:
    """Find the directory containing the case's PDF exhibits."""
    # Check explicit candidates first
    for candidate in spec.get("folder_candidates", []):
        p = os.path.join(SHOWCASE_DIR, candidate)
        if os.path.isdir(p):
            return p

    # Check all subdirectories in showcase_cases
    if os.path.isdir(SHOWCASE_DIR):
        for entry in os.listdir(SHOWCASE_DIR):
            entry_path = os.path.join(SHOWCASE_DIR, entry)
            if not os.path.isdir(entry_path):
                continue
            entry_lower = entry.lower()
            for kw in spec.get("match_keywords", []):
                if kw in entry_lower:
                    return entry_path

    return None


def clean_excel_rows(case_id: str) -> None:
    """Remove existing rows for case_id from case_results.xlsx."""
    if not os.path.exists(EXCEL_PATH):
        return
    try:
        df = pd.read_excel(EXCEL_PATH)
        if "Case_ID" in df.columns:
            before_len = len(df)
            df = df[df["Case_ID"] != case_id]
            if len(df) != before_len:
                df.to_excel(EXCEL_PATH, index=False)
                print(f"Cleaned {before_len - len(df)} pre-existing rows for {case_id} in Excel.")
    except Exception as e:
        print(f"Warning cleaning Excel for {case_id}: {e}")


def ingest_single_case(spec: dict, folder_path: str, cm: CaseManager) -> dict:
    case_id = spec["case_id"]
    title = spec["title"]
    created_by = spec["created_by"]
    source = spec.get("source", "AUTO_ID")

    print(f"\n========================================================")
    print(f"Ingesting {case_id}: {title}")
    print(f"Folder: {folder_path}")
    print(f"========================================================")

    # Clean previous case registry and Excel
    clean_excel_rows(case_id)
    existing = cm.get_case(case_id)
    if existing:
        print(f"Deleting pre-existing case registry {case_id}...")
        try:
            cm.delete_case(case_id)
        except Exception as e:
            print(f"Warning during delete_case: {e}")

    # Create case
    case = cm.create_case(title=title, created_by=created_by, source=source, case_id=case_id)
    print(f"Created Case record: {case.case_id} - '{case.title}'")

    # Find PDFs
    pdf_files = sorted([f for f in os.listdir(folder_path) if f.lower().endswith(".pdf")])
    if not pdf_files:
        raise ValueError(f"No PDF files found in {folder_path}")

    print(f"Attaching {len(pdf_files)} PDF exhibits...")
    for pdf_name in pdf_files:
        pdf_path = os.path.join(folder_path, pdf_name)
        doc_type = guess_doc_type(pdf_name)
        with open(pdf_path, "rb") as f:
            doc = cm.add_document(case_id, f, doc_type=doc_type, filename=pdf_name)
            print(f"  [+] {pdf_name} ({os.path.getsize(pdf_path):,} bytes) -> {doc_type} (id: {doc.doc_id})")

    # Run analysis
    print(f"Analyzing all documents and generating whole-case analysis for {case_id}...")
    analyzed_case = cm.analyze_case(case_id)

    # Append to Excel for dashboard feed
    _append_case_documents_to_excel(analyzed_case, case_id)
    print(f"Persisted to {EXCEL_PATH}")

    actual_priority = analyzed_case.aggregate_priority
    case_level_prio = (analyzed_case.case_level or {}).get("priority")
    expected_priority = spec["expected_priority"]

    print(f"Result for {case_id}:")
    print(f"  - Aggregate Priority: {actual_priority}")
    print(f"  - Whole-Case Priority: {case_level_prio}")
    print(f"  - Expected Priority: {expected_priority}")
    print(f"  - Documents Analysed: {len(analyzed_case.documents)}")

    return {
        "case_id": case_id,
        "title": title,
        "docs_count": len(analyzed_case.documents),
        "actual_priority": actual_priority,
        "case_level_priority": case_level_prio,
        "expected_priority": expected_priority,
        "matched": actual_priority == expected_priority,
    }


def main():
    cm = CaseManager()
    results = []
    missing_folders = []

    print(f"Checking showcase directories in {SHOWCASE_DIR}...")
    for spec in CASE_SPECS:
        folder = locate_case_folder(spec)
        if not folder:
            print(f"[-] Directory for {spec['case_id']} not found yet.")
            missing_folders.append(spec["case_id"])
            continue

        res = ingest_single_case(spec, folder, cm)
        results.append(res)

    print("\n" + "=" * 60)
    print("SHOWCASE INGESTION SUMMARY")
    print("=" * 60)
    for r in results:
        status_flag = "[PASS]" if r["matched"] else "[FAIL/MISMATCH]"
        print(f"{status_flag} {r['case_id']}: {r['actual_priority']} (Expected: {r['expected_priority']}) | Docs: {r['docs_count']} | {r['title']}")

    if missing_folders:
        print(f"\nPending generation from case-drafter: {missing_folders}")
        return False
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
