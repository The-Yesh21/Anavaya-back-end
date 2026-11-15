import json
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import pandas as pd

CASES_DIR = "case_priority_system/cases"
EXCEL_PATH = "case_priority_system/case_results.xlsx"

print("============================================================")
print("VERIFYING INGESTED SHOWCASE CASES IN ANAVAYA")
print("============================================================")

SHOWCASE_IDS = ["ANV-2026-0042", "ANV-2026-0051", "ANV-2026-0052", "ANV-2026-0053"]
EXPECTED = {
    "ANV-2026-0042": ("High", 5),
    "ANV-2026-0051": ("High", 4),
    "ANV-2026-0052": ("High", 3),
    "ANV-2026-0053": ("Low", 2),
}

all_passed = True

for cid in SHOWCASE_IDS:
    case_path = os.path.join(CASES_DIR, f"{cid}.json")
    if not os.path.exists(case_path):
        print(f"[FAIL] {cid} JSON not found on disk!")
        all_passed = False
        continue
    with open(case_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    docs = data.get("documents", [])
    agg_prio = data.get("aggregate_priority")
    case_level = data.get("case_level", {})
    whole_prio = case_level.get("priority")
    feats = case_level.get("features", {})
    cat = feats.get("case_category")
    
    exp_prio, exp_docs = EXPECTED[cid]
    status = "PASS" if (whole_prio == exp_prio and len(docs) == exp_docs) else "WARN/MISMATCH"
    if status != "PASS":
        all_passed = False
    
    print(f"[{status}] {cid}: {data.get('title')}")
    print(f"       Docs: {len(docs)} (expected: {exp_docs}) | Whole-Case Priority: {whole_prio} (expected: {exp_prio}) | Category: {cat}")
    print(f"       Aggregate Priority: {agg_prio}")
    print(f"       Rationale: {(case_level.get('rationale') or '')[:100]}...")

print("\n============================================================")
print("EXCEL DASHBOARD VERIFICATION")
print("============================================================")
if os.path.exists(EXCEL_PATH):
    df = pd.read_excel(EXCEL_PATH)
    print(f"Total rows in {EXCEL_PATH}: {len(df)}")
    sub = df[df["Case_ID"].isin(SHOWCASE_IDS)]
    print(f"Showcase rows in Excel: {len(sub)}")
    for cid in SHOWCASE_IDS:
        c_sub = sub[sub["Case_ID"] == cid]
        whole_row = c_sub[c_sub["Case_File"].astype(str).str.startswith("[WHOLE CASE]")]
        doc_rows = c_sub[~c_sub["Case_File"].astype(str).str.startswith("[WHOLE CASE]")]
        print(f"  * {cid}: {len(doc_rows)} document rows + {len(whole_row)} whole-case row (Priority: {whole_row['Predicted_Priority'].values if not whole_row.empty else 'NONE'})")
else:
    print(f"[FAIL] Excel file not found at {EXCEL_PATH}")
    all_passed = False

print("\nOVERALL STATUS:", "ALL PASSED" if all_passed else "SOME CHECKS FAILED")
