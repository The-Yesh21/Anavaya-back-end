"""Case-level PDF report for the whole-case analysis.

Renders one printable PDF per CASE (ANV-YYYY-NNNN) summarising the analysis
over ALL evidence: merged features, the deterministic merge rules with their
provenance, the corroboration map, per-document priorities, and the case-level
constitutional opinion. Reuses the styling helpers from generate_case_report.

Everything rendered here is deterministic output from the pipeline — the LLM
extracted per-document features upstream only; the merge, the Decision Tree
priority and the constitutional analysis are rule-based.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime

_scripts_dir = os.path.dirname(os.path.abspath(__file__))
if _scripts_dir not in sys.path:
    sys.path.insert(0, _scripts_dir)
if os.path.abspath(os.path.join(_scripts_dir, "..", "..")) not in sys.path:
    sys.path.insert(0, os.path.abspath(os.path.join(_scripts_dir, "..", "..")))

from generate_case_report import (  # noqa: E402
    CSS,
    PRIORITY_THEME,
    chip,
    doctrines_block,
    esc,
    priority_badge,
    render_pdf,
    rights_block,
    section,
)

REPORTS_DIR = os.path.join("case_priority_system", "reports")

_NARRATIVE_KEYS = ("main_parties", "case_category", "crime_type",
                   "severity", "vulnerability", "influence", "plain_summary")


def build_whole_case_report_html(case_id, title, features, priority, analysis,
                                 merge_info=None, corroboration=None,
                                 per_doc=None, computed_at="") -> str:
    """Full HTML for the whole-case report (same look as per-document reports)."""
    now = computed_at or datetime.now().strftime("%d %B %Y, %H:%M")
    theme = PRIORITY_THEME.get(priority, PRIORITY_THEME["Medium"])

    merge_info = merge_info or {}
    corroboration = corroboration or {}
    per_doc = per_doc or []

    # Only the model-facing keys are merged features; anything else in the
    # dict (corroboration blobs etc.) is dropped from the chips row.
    features = {k: v for k, v in (features or {}).items() if k in _NARRATIVE_KEYS}

    parties = features.get("main_parties", "Unknown")
    summary = features.get("plain_summary", "Summary unavailable.")
    category = features.get("case_category", "N/A")
    crime_type = features.get("crime_type", "N/A")
    severity = features.get("severity", "N/A")
    vulnerability = features.get("vulnerability", "N/A")
    influence = features.get("influence", "N/A")

    rights = analysis.get("constitutional_rights_engaged", [])
    state_duty = analysis.get("state_duty_analysis", "N/A")
    rules_applied = analysis.get("priority_rules_detailed", "N/A")
    opinion = analysis.get("state_perspective_opinion", "N/A")
    balancing = analysis.get("balancing_analysis", "N/A")
    doctrines = analysis.get("applicable_doctrines", [])

    # ---- per-document breakdown table ---------------------------------
    doc_rows = "".join(
        f"<tr>"
        f"<td>{esc(d.get('filename', ''))}</td>"
        f"<td>{esc(d.get('doc_type', ''))}</td>"
        f"<td><strong>{esc(d.get('priority') or 'Not analysed')}</strong></td>"
        f"</tr>"
        for d in per_doc
    ) or "<tr><td colspan='3'>No analysed documents.</td></tr>"

    # ---- merge rules table ---------------------------------------------
    merge_rows = ""
    for field_name in ("case_category", "crime_type", "severity",
                       "vulnerability", "influence"):
        info = merge_info.get(field_name)
        if not info:
            continue
        sources = ", ".join(info.get("sources", [])[:3]) or "—"
        merge_rows += (
            f"<tr>"
            f"<td>{esc(field_name.replace('_', ' ').title())}</td>"
            f"<td><strong>{esc(str(info.get('value', '')))}</strong></td>"
            f"<td>{esc(info.get('rule', ''))}</td>"
            f"<td>{esc(sources)}</td>"
            f"</tr>"
        )
    if not merge_rows:
        merge_rows = "<tr><td colspan='4'>Merge provenance unavailable.</td></tr>"

    # ---- corroboration map ---------------------------------------------
    corr_lines: list[str] = []
    for pair in corroboration.get("pairs", []):
        corr_lines.append(
            f"<li><strong>{esc(pair.get('a', ''))}</strong> ↔ "
            f"<strong>{esc(pair.get('b', ''))}</strong> — shared "
            f"{esc(', '.join(pair.get('shared', [])))}."
            + (f" Dates: {esc(', '.join(pair.get('shared_dates', [])))}." if pair.get("shared_dates") else "")
            + (f" Places: {esc(', '.join(pair.get('shared_places', [])))}." if pair.get("shared_places") else "")
            + (f" Parties: {esc(', '.join(pair.get('shared_parties', [])))}." if pair.get("shared_parties") else "")
            + "</li>"
        )
    for s in corroboration.get("standalone", []):
        corr_lines.append(
            f"<li><strong>{esc(s.get('filename', ''))}</strong> "
            f"({esc(s.get('doc_type', ''))}) stands alone — no shared date, "
            "place or party with any other document on record.</li>"
        )
    corr_html = (
        "<ul>" + "".join(corr_lines) + "</ul>"
        if corr_lines
        else "<p>Not enough analysed documents to cross-compare yet.</p>"
    )

    body = "".join([
        f'<div class="page-header">'
        f'<div class="kicker">Anavaya · Whole-Case Analysis Report</div>'
        f"<h1>{esc(title or case_id)}</h1>"
        f'<div class="sub">One verdict for the whole case: every document\'s extracted facts '
        f"were merged deterministically, and the Decision Tree was run ONCE on the combined "
        f"evidence — followed by the rule-based constitutional analysis.</div>"
        f"<div class='meta-row'>Case {esc(case_id)} · Generated {esc(now)} · "
        f"{len(per_doc)} document{'s' if len(per_doc) != 1 else ''} considered</div>"
        f"{priority_badge(priority)}"
        f"</div>",

        section(
            "Parties Across the Whole Case",
            f'<p style="font-size:14px;"><strong>{esc(parties)}</strong></p>',
        ),

        section(
            "Whole-Case Narrative",
            f'<div class="summary">{esc(summary)}</div>',
        ),

        section(
            "Case Classification (merged from all evidence)",
            '<div class="chips">'
            + chip("Legal Category", category)
            + chip("Case Type", crime_type)
            + chip("Severity", severity)
            + chip("Vulnerability", vulnerability)
            + chip("Influence", influence)
            + chip("Whole-Case Priority", priority)
            + "</div>",
        ),

        section(
            "How the Evidence Fits Together (corroboration map)",
            corr_html,
            accent=theme["accent"],
        ),

        section(
            "Evidence Considered",
            "<table class='merge-table'><thead><tr>"
            "<th>Document</th><th>Type</th><th>Document Priority</th>"
            "</tr></thead><tbody>" + doc_rows + "</tbody></table>",
        ),

        section(
            "Merge Rules Applied (auditable provenance)",
            "<table class='merge-table'><thead><tr>"
            "<th>Feature</th><th>Case Value</th><th>Rule</th><th>Driven By</th>"
            "</tr></thead><tbody>" + merge_rows + "</tbody></table>"
            + "<p style='color:#4B5563;'><em>Deterministic merge, applied before the "
            "Decision Tree — the tree alone decided the priority above.</em></p>",
        ),

        section(
            "Constitutional Articles Applied (case level)",
            rights_block(rights),
            accent=theme["accent"],
        ),

        section("Legal Summary", f"<p>{esc(state_duty)}</p>"),

        section(
            "Priority Rules Applied",
            f"<p>{esc(rules_applied)}</p>",
        ),

        section("State's Perspective", f"<p>{esc(opinion)}</p>"),

        section("Doctrines Engaged", doctrines_block(doctrines)),

        section("Rights Balancing Analysis", f"<p>{esc(balancing)}</p>"),

        '<div class="legal-note"><strong>Disclaimer:</strong> This report is generated '
        "automatically by software for triage assistance only. It does not constitute legal "
        "advice or a judicial determination. Final priority and legal interpretation rest with "
        "the court.</div>",

        f'<div class="page-footer">Anavaya — AI-Powered Case Priority System · '
        f"Whole-case report {esc(case_id)} · Generated {esc(now)}</div>",
    ])

    return (
        "<html><head><meta charset='utf-8'></head>"
        f"<body>{body}"
        "<style>.merge-table{width:100%;border-collapse:collapse;font-size:11px;"
        "margin:8px 0;}"
        ".merge-table th{background:#1B2A4A;color:#fff;text-align:left;"
        "padding:6px 8px;}"
        ".merge-table td{border-bottom:1px solid #E2E8F0;padding:6px 8px;"
        "vertical-align:top;}</style>"
        "</body></html>"
    )


def save_whole_case_report(case_id, title, features, priority, analysis,
                           merge_info=None, corroboration=None, per_doc=None,
                           computed_at="", reports_dir=REPORTS_DIR) -> str:
    """Render the whole-case PDF and return its path."""
    os.makedirs(reports_dir, exist_ok=True)
    out_path = os.path.join(reports_dir, f"{case_id}_whole_case_report.pdf")
    html = build_whole_case_report_html(
        case_id, title, features, priority, analysis,
        merge_info=merge_info, corroboration=corroboration,
        per_doc=per_doc, computed_at=computed_at,
    )
    return render_pdf(html, out_path)
