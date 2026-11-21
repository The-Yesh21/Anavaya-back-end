"""Refresh the Vercel document feed from the local workbook before release."""
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
