"""Refresh the hosted Decision Tree from the model shipped with FastAPI.

Run from the repository root with python -m scripts.export_public_tree.
"""
import json
from pathlib import Path

from case_priority_system.app import get_tree


def main():
    target = Path(__file__).resolve().parents[1] / "public/dashboard/api/tree.json"
    tree = get_tree()
    target.write_text(
        json.dumps(tree, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
