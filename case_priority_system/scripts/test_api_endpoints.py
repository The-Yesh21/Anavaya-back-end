import sys
import os
sys.path.insert(0, os.path.abspath("."))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from case_priority_system.app import get_cases, get_case_analysis, list_case_registry

print("============================================================")
print("TESTING FASTAPI BACKEND FUNCTIONS FOR SHOWCASE CASES")
print("============================================================")

SHOWCASE_IDS = ["ANV-2026-0042", "ANV-2026-0051", "ANV-2026-0052", "ANV-2026-0053"]

# 1. Test get_cases() -> corresponds to GET /api/cases
print("\n--- 1. Testing GET /api/cases (get_cases) ---")
cases_data = get_cases()
print(f"Total items in feed: {len(cases_data)}")
found_in_feed = set()
for item in cases_data:
    cid = item.get("Case_ID")
    if cid in SHOWCASE_IDS:
        found_in_feed.add(cid)

print(f"Showcase cases found in /api/cases: {sorted(list(found_in_feed))}")
assert len(found_in_feed) == 4, f"Missing showcase cases: {set(SHOWCASE_IDS) - found_in_feed}"
print("[PASS] All 4 showcase cases present in dashboard feed (/api/cases)")

# 2. Test get_case_analysis(case_id) -> corresponds to GET /api/cases/{case_id}/case-analysis
print("\n--- 2. Testing GET /api/cases/{case_id}/case-analysis ---")
for cid in SHOWCASE_IDS:
    cl = get_case_analysis(cid)
    prio = cl.get("priority")
    category = (cl.get("features") or {}).get("case_category")
    doc_count = len(cl.get("per_document", []))
    rationale = (cl.get("rationale") or "")[:80]
    print(f"[{'PASS' if prio else 'FAIL'}] {cid} -> Priority: {prio} | Category: {category} | Docs: {doc_count}")
    print(f"       Rationale: {rationale}...")
    assert prio in ["High", "Low"], f"Invalid priority: {prio}"
    assert doc_count > 0, "No documents analysed in whole-case analysis"

# 3. Test list_case_registry() -> corresponds to GET /api/case-registry
print("\n--- 3. Testing GET /api/case-registry (list_case_registry) ---")
registry = list_case_registry()
reg_ids = {c["case_id"] for c in registry}
print(f"Registry count: {len(registry)}, Showcase present: {set(SHOWCASE_IDS).issubset(reg_ids)}")
assert set(SHOWCASE_IDS).issubset(reg_ids), "Missing showcase cases in registry"
print("[PASS] All 4 showcase cases verified in case registry")

print("\n============================================================")
print("ALL BACKEND API VERIFICATIONS PASSED SUCCESSFULLY!")
print("============================================================")
