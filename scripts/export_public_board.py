"""Refresh the public dashboard after adding an approved demo case to public_case_ids.json.

Run this from the repository root, then run node scripts/sync_dashboard.cjs.
Commit the allowlist, board, registry, and generated public case detail together.
"""
import json
from pathlib import Path

import pandas as pd

root = Path(__file__).resolve().parents[1]
public_ids = json.loads((root / "scripts/public_case_ids.json").read_text())
rows = pd.read_excel(root / "case_priority_system/case_results.xlsx")
rows = rows.loc[rows["Case_ID"].isin(public_ids)]
target = root / "public/dashboard/api/cases.json"
target.write_text(rows.to_json(orient="records", indent=2, force_ascii=False) + "\n", encoding="utf-8")
print(f"Exported {len(rows)} public document rows")
