import os
import sys
import json
import glob

sys.path.insert(0, os.path.abspath("."))

from case_priority_system.scripts.statutory_sections import (
    determine_statutory_sections,
    calculate_turnaround_time,
)

def enrich_all():
    patterns = [
        "case_priority_system/cases/ANV-2026-*.json",
        "public/dashboard/api/cases/ANV-2026-*.json",
    ]
    files = []
    for pat in patterns:
        files.extend(glob.glob(pat))

    unique_files = sorted(set(files))
    print(f"Enriching {len(unique_files)} case JSON files...")

    success = 0
    for path in unique_files:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            cl = data.get("case_level") or {}
            prio = cl.get("priority") or data.get("aggregate_priority") or "Medium"
            feats = cl.get("features") or {}
            cat = feats.get("case_category") or ""
            crime = feats.get("crime_type") or ""
            sev = feats.get("severity") or ""
            vuln = feats.get("vulnerability") or ""
            inf = feats.get("influence") or ""
            gist = cl.get("case_gist") or data.get("title") or ""
            summary = feats.get("plain_summary") or ""
            text = f"{data.get('title', '')} {gist} {summary}"

            doc_count = len(cl.get("per_document") or data.get("documents") or [1])

            statutory_sections = determine_statutory_sections(cat, crime, sev, vuln, inf, text)
            tat = calculate_turnaround_time(prio, cat, sev, vuln, doc_count)

            cl["statutory_sections"] = statutory_sections
            cl["turnaround_time"] = tat
            data["case_level"] = cl

            # Also enrich per-document analyses if present
            for doc in data.get("documents", []):
                doc_ana = doc.get("analysis") or {}
                if doc_ana:
                    doc_cat = doc_ana.get("case_category") or cat
                    doc_crime = doc_ana.get("crime_type") or crime
                    doc_sev = doc_ana.get("severity") or sev
                    doc_vuln = doc_ana.get("vulnerability") or vuln
                    doc_text = f"{doc.get('filename', '')} {doc_ana.get('plain_summary', '')} {doc_ana.get('text_excerpt', '')}"
                    doc_sections = determine_statutory_sections(doc_cat, doc_crime, doc_sev, doc_vuln, "", doc_text)
                    doc_tat = calculate_turnaround_time(doc.get("priority") or prio, doc_cat, doc_sev, doc_vuln, 1)
                    doc_ana["statutory_sections"] = doc_sections
                    doc_ana["turnaround_time"] = doc_tat
                    doc["analysis"] = doc_ana

            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            success += 1
        except Exception as e:
            print(f"Failed to process {path}: {e}")

    print(f"Successfully enriched {success} files with statutory sections and TAT.")

if __name__ == "__main__":
    enrich_all()
