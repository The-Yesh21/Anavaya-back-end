"""Verify a generated Anavaya case-report PDF: section coverage + text dump."""
import sys

import fitz

path = sys.argv[1] if len(sys.argv) > 1 else (
    "case_priority_system/reports/Fictional_Case_Report_Test_report.pdf"
)

doc = fitz.open(path)
full = ""
for i, page in enumerate(doc):
    t = page.get_text()
    full += t
    print(f"--- PAGE {i + 1} ({len(t)} chars) ---")

print()
required = [
    "Parties in the Dispute",
    "Plain-Language Summary",
    "Case Classification",
    "Constitutional Articles Applied",
    "Legal Summary",
    "Priority Rules Applied",
    "State's Perspective",
    "Doctrines Engaged",
    "Rights Balancing Analysis",
    "Emma Carter",
]
for r in required:
    print(("OK  " if r.lower() in full.lower() else "MISS"), r)

print()
print("=== FULL TEXT (first 3500 chars) ===")
print(full[:3500])
doc.close()
