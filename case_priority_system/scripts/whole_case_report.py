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

try:
    from case_priority_system.scripts.delay_precedents import get_delay_precedents
except ImportError:
    from delay_precedents import get_delay_precedents

REPORTS_DIR = os.path.join("case_priority_system", "reports")

_NARRATIVE_KEYS = ("main_parties", "case_category", "crime_type",
                   "severity", "vulnerability", "influence", "plain_summary")


def delay_precedents_block(precedents):
    if not precedents:
        return "<p>No specific delay-cost precedents recorded.</p>"
    items = []
    for p in precedents:
        items.append(
            f'<div style="margin-bottom:12px;padding:10px 12px;background:#F9FAFB;border-left:4px solid #B45309;border-radius:3px;">'
            f'<div style="font-size:12px;font-weight:bold;color:#1F2937;">{esc(p.get("case_title", ""))} '
            f'<span style="font-size:10px;font-weight:normal;color:#6B7280;background:#E5E7EB;padding:1px 5px;border-radius:3px;">{esc(p.get("citation", ""))}</span></div>'
            f'<div style="font-size:11px;color:#92400E;font-weight:bold;margin:2px 0;">Cost of Delay: {esc(p.get("cost_category", ""))} · {esc(p.get("delay_period", ""))}</div>'
            f'<div style="font-size:11px;color:#374151;margin-top:3px;"><strong>Factual Delay:</strong> {esc(p.get("factual_delay", ""))}</div>'
            f'<div style="font-size:11px;color:#374151;margin-top:2px;"><strong>Toll / Consequence:</strong> {esc(p.get("human_or_economic_toll", ""))}</div>'
            f'<div style="font-size:11px;color:#1E3A8A;margin-top:2px;"><strong>Judicial Ruling:</strong> {esc(p.get("judicial_ruling", ""))}</div>'
            f'<div style="font-size:11px;color:#4B5563;font-style:italic;margin-top:3px;">{esc(p.get("priority_mandate", ""))}</div>'
            f'</div>'
        )
    return "".join(items)


def build_whole_case_report_html(case_id, title, features, priority, analysis,
                                 merge_info=None, corroboration=None,
                                 per_doc=None, computed_at="", case_gist="") -> str:
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
        f'<div class="kicker">REPUBLIC OF INDIA · JUDICIAL AUTOMATION &amp; TRIAGE SYSTEM</div>'
        f"<h1>Comprehensive Whole-Case Admissibility &amp; Priority Synthesis Dossier</h1>"
        f'<div class="sub">Unified case adjudication over all admitted evidentiary documents: deterministic cross-document '
        f"feature merge → CART Decision Tree verdict → Rule-based constitutional justification under the Constitution of India.</div>"
        f"<div class='meta-row'>Case Docket: <strong>{esc(case_id)}</strong> · "
        f"Admitted Evidence: <strong>{len(per_doc)} Document{'s' if len(per_doc) != 1 else ''}</strong> · Generated: {esc(now)}</div>"
        f"{priority_badge(priority)}"
        f"</div>",

        section(
            "I. Factual Dispute Synopsis (What the Dispute Is About)",
            f'<div class="summary">{esc(case_gist)}</div>' if case_gist
            else "<p>No per-document summaries were available to distil a case "
                 "description from.</p>",
            accent=theme["accent"],
        ),

        section(
            "II. Litigating Parties Across Whole Case",
            f'<p style="font-size:13px;color:#111827;"><strong>{esc(parties)}</strong></p>',
        ),

        section(
            "III. Comprehensive Whole-Case Factual Narrative",
            f'<div class="summary">{esc(summary)}</div>',
        ),

        section(
            "IV. Merged Classification &amp; Priority Tier (Combined Evidence)",
            '<div class="chips">'
            + chip("Legal Category", category)
            + chip("Case Type", crime_type)
            + chip("Injury Severity", severity)
            + chip("Vulnerability Tier", vulnerability)
            + chip("Influence Metric", influence)
            + chip("Whole-Case Priority", priority)
            + "</div>",
        ),

        section(
            "V. Evidentiary Corroboration &amp; Cross-Document Concordance Matrix",
            corr_html,
            accent=theme["accent"],
        ),

        section(
            "VI. Admitted Document Inventory &amp; Individual Priorities",
            "<table class='merge-table'><thead><tr>"
            "<th>Admitted Document</th><th>Evidence Type</th><th>Document Priority</th>"
            "</tr></thead><tbody>" + doc_rows + "</tbody></table>",
        ),

        section(
            "VII. Deterministic Merge Provenance (Auditable Feature Attribution)",
            "<table class='merge-table'><thead><tr>"
            "<th>Feature</th><th>Merged Value</th><th>Deterministic Rule</th><th>Driven By Evidence</th>"
            "</tr></thead><tbody>" + merge_rows + "</tbody></table>"
            + "<p style='color:#4B5563;'><em>Deterministic intake merge, executed prior to Decision Tree "
            "evaluation — the CART Decision Tree alone determined the case priority tier above.</em></p>",
        ),

        section(
            "VIII. Constitutional Provisions &amp; Fundamental Rights Engaged (Case Level)",
            rights_block(rights),
            accent=theme["accent"],
        ),

        section("IX. Statutory Duty &amp; Judicial Obligation Analysis", f"<p>{esc(state_duty)}</p>"),

        section(
            "X. Deterministic CART Decision Tree Rules Applied",
            f"<p>{esc(rules_applied)}</p>",
        ),

        section("XI. Sovereign State Perspective &amp; Public Interest Analysis", f"<p>{esc(opinion)}</p>"),

        section("XII. Fundamental Rights Balancing &amp; Proportionality Test", f"<p>{esc(balancing)}</p>"),

        section(
            "XIII. Landmark Precedents on Systemic Delay &amp; Human/Economic Toll",
            delay_precedents_block(get_delay_precedents(priority, category, crime_type, severity, case_title=title, case_text=case_gist)),
            accent="#B45309",
        ),

        '<div class="legal-note"><strong>STATUTORY DISCLAIMER &amp; JUDICIAL ADVISORY NOTICE:</strong> '
        "This document is an automated evidentiary intake and whole-case priority synthesis compiled by the "
        "<strong>Anavaya Judicial Intelligence System</strong> solely for court calendar scheduling and triage "
        "assistance under the Constitution of India. It does not constitute substantive legal advice, an interim "
        "injunction, or a final judicial decree. The sovereign authority to determine admissibility, trial sequence, "
        "and judicial relief resides exclusively with the Presiding Judge and the competent bench.</div>",

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
                           computed_at="", reports_dir=REPORTS_DIR,
                           case_gist="") -> str:
    """Render the whole-case PDF and return its path."""
    os.makedirs(reports_dir, exist_ok=True)
    out_path = os.path.join(reports_dir, f"{case_id}_whole_case_report.pdf")
    html = build_whole_case_report_html(
        case_id, title, features, priority, analysis,
        merge_info=merge_info, corroboration=corroboration,
        per_doc=per_doc, computed_at=computed_at, case_gist=case_gist,
    )
    return render_pdf(html, out_path, priority=priority)
