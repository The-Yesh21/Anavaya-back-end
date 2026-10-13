"""
Generate a polished PDF case report for a single legal case document.

Runs one case file through the full ANAVAYA production pipeline and renders
the result as a printable PDF report:

  1. Extract text from the case PDF (PyMuPDF).
  2. Extract structured features + plain-language summary with the local
     Ollama model (qwen2.5:3b, via langchain_summarizer) using the full
     ANAVAYA production prompt.
  3. Tune features with the deterministic rule-based classifier
     (inference_pipeline.tune_case_features).
  4. Predict High / Medium / Low priority with the local Decision Tree.
  5. Generate the constitutional analysis (rights engaged, state duty,
     legal rules, doctrines, balancing) via constitutional_analysis.
  6. Render a branded PDF report (HTML -> PDF via PyMuPDF Story).

Usage:
    python case_priority_system/scripts/generate_case_report.py [path/to/case.pdf]

If no path is given, it defaults to the repo's Fictional_Case_Report_Test.pdf.
Output is written to case_priority_system/reports/<case_basename>_report.pdf
"""

import html as html_mod
import os
import sys
from datetime import datetime

try:
    from case_priority_system.scripts.inference_pipeline import (
        call_ollama_api,
        extract_text_from_pdf,
        fallback_extract_features,
        load_model,
        predict_priority,
        tune_case_features,
    )
except ImportError:  # pragma: no cover - fallback for direct execution
    from inference_pipeline import (  # type: ignore
        call_ollama_api,
        extract_text_from_pdf,
        fallback_extract_features,
        load_model,
        predict_priority,
        tune_case_features,
    )

try:
    from case_priority_system.scripts.constitutional_analysis import (
        get_comprehensive_constitutional_analysis,
    )
except ImportError:  # pragma: no cover
    from constitutional_analysis import (  # type: ignore
        get_comprehensive_constitutional_analysis,
    )

try:
    from case_priority_system.scripts.delay_precedents import get_delay_precedents
except ImportError:
    from delay_precedents import get_delay_precedents

import fitz

REPORTS_DIR = os.path.join("case_priority_system", "reports")

PRIORITY_THEME = {
    "High": {"accent": "#B42318", "soft": "#FEF3F2", "text": "#7A271A", "label": "HIGH"},
    "Medium": {"accent": "#B54708", "soft": "#FFFAEB", "text": "#7A2E0E", "label": "MEDIUM"},
    "Low": {"accent": "#067647", "soft": "#ECFDF3", "text": "#054F31", "label": "LOW"},
}


# ---------------------------------------------------------------- helpers

def esc(value):
    """HTML-escape a value for safe rendering in the report."""
    return html_mod.escape(str(value))


def priority_badge(priority):
    theme = PRIORITY_THEME.get(priority, PRIORITY_THEME["Medium"])
    return (
        f'<span class="badge" style="background:{theme["accent"]};color:#fff;">'
        f"{esc(theme['label'])} PRIORITY</span>"
    )


def chip(label, value):
    return (
        f'<div class="chip">'
        f'<span class="chip-label">{esc(label)}</span>'
        f'<span class="chip-value">{esc(value)}</span>'
        f"</div>"
    )


def section(title, body, accent="#1B2A4A"):
    return (
        f'<div class="section">'
        f'<div class="section-title" style="border-left:6px solid {accent};">'
        f"{esc(title)}</div>"
        f'<div class="section-body">{body}</div>'
        f"</div>"
    )


def rights_block(rights):
    if not rights:
        return "<p>General application of Article 14 (equality before law).</p>"
    cards = []
    for r in rights:
        tag = "Primary" if r.get("primary") else "Secondary"
        cards.append(
            f'<div class="right-card">'
            f'<div class="right-article">{esc(r.get("article", ""))}'
            f'<span class="right-tag">{tag}</span></div>'
            f'<div class="right-title">{esc(r.get("title", ""))}</div>'
            f"</div>"
        )
    return "".join(cards)


def doctrines_block(doctrines):
    if not doctrines:
        return "<p>None specifically invoked.</p>"
    items = []
    for d in doctrines:
        name = d.get("name", "")
        desc = d.get("description", "")
        items.append(
            f'<div class="doctrine"><strong>{esc(name)}</strong>'
            f"{f' — {esc(desc)}' if desc else ''}</div>"
        )
    return "".join(items)


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


# ---------------------------------------------------------------- report

CSS = """
html { margin: 0; }
body { font-family: Georgia, 'Times New Roman', serif; font-size: 12px;
       color: #1F2937; line-height: 1.55; }
.page-header { background: #1B2A4A; color: #fff; padding: 26px 28px;
               border-bottom: 5px solid #C9A227; }
.page-header .kicker { font-family: Helvetica, Arial, sans-serif; font-size: 9px;
               letter-spacing: 3px; text-transform: uppercase; color: #C9A227; }
.page-header h1 { margin: 6px 0 4px; font-size: 22px; color: #FFFFFF; }
.page-header .sub { font-size: 11px; color: #C7D2E5; font-family: Helvetica, Arial, sans-serif; }
.meta-row { margin-top: 10px; font-family: Helvetica, Arial, sans-serif; font-size: 10px;
            color: #E5E9F3; }
.badge { display: inline-block; font-family: Helvetica, Arial, sans-serif;
         font-weight: 800; font-size: 11px; letter-spacing: 2px; padding: 6px 14px;
         border-radius: 4px; margin-top: 8px; }
.section { margin: 18px 26px; page-break-inside: avoid; }
.section-title { font-family: Helvetica, Arial, sans-serif; font-size: 12px;
         font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px;
         color: #1B2A4A; padding: 5px 0 5px 10px; margin-bottom: 10px;
         border-bottom: 1px solid #E5E7EB; }
.section-body { font-size: 12px; }
.chips { margin-top: 4px; }
.chip { display: inline-block; border: 1px solid #D1D5DB; border-radius: 6px;
        padding: 6px 10px; margin: 0 6px 6px 0; background: #F9FAFB;
        font-family: Helvetica, Arial, sans-serif; }
.chip-label { display: block; font-size: 8px; text-transform: uppercase;
        letter-spacing: 1px; color: #6B7280; }
.chip-value { font-size: 11px; font-weight: 700; color: #111827; }
.summary { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px;
        padding: 12px 14px; }
.right-card { border: 1px solid #E5E7EB; border-left: 4px solid #1B2A4A; border-radius: 5px;
        padding: 8px 12px; margin: 0 0 8px 0; background: #F8FAFC; }
.right-article { font-family: Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 800;
        color: #1B2A4A; }
.right-tag { display: inline-block; font-size: 8px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 1px; color: #6B7280; background: #EEF2F7; border-radius: 3px;
        padding: 2px 6px; margin-left: 8px; vertical-align: 2px; }
.right-title { font-size: 11px; color: #374151; margin-top: 3px; }
.td-tag { width: 16%; color: #6B7280; font-size: 9px; text-transform: uppercase; }
.doctrine { padding: 5px 0; border-bottom: 1px dashed #E5E7EB; }
.legal-note { background: #FFFBEB; border: 1px solid #FDE68A; border-left: 6px solid #C9A227;
        padding: 10px 14px; border-radius: 4px; font-size: 11px; color: #713F12; }
.page-footer { margin: 24px 26px; padding-top: 8px; border-top: 1px solid #E5E7EB;
        font-size: 9px; color: #9CA3AF; font-family: Helvetica, Arial, sans-serif; }
"""


def build_report_html(case_file, features, priority, analysis):
    now = datetime.now().strftime("%d %B %Y, %H:%M")
    theme = PRIORITY_THEME.get(priority, PRIORITY_THEME["Medium"])

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
    rationale = analysis.get("priority_rationale", "")

    body = "".join([
        f'<div class="page-header">'
        f'<div class="kicker">REPUBLIC OF INDIA · JUDICIAL AUTOMATION &amp; TRIAGE SYSTEM</div>'
        f"<h1>Official Case Intake &amp; Priority Assessment Dossier</h1>"
        f'<div class="sub">Autonomous multi-factor triage analysis: LLM feature extraction → '
        f'CART Decision Tree priority classification → Constitutional justification under the Constitution of India.</div>'
        f'<div class="meta-row">Case Document: <strong>{esc(case_file)}</strong> · Generated: {esc(now)}</div>'
        f"{priority_badge(priority)}"
        f"</div>",

        section(
            "I. Litigating Parties in the Dispute",
            f'<p style="font-size:13px;color:#111827;"><strong>{esc(parties)}</strong></p>',
        ),

        section(
            "II. Factual Synopsis &amp; Plain-Language Summary",
            f'<div class="summary">{esc(summary)}</div>',
        ),

        section(
            "III. Case Classification &amp; Deterministic Feature Vector",
            '<div class="chips">'
            + chip("Legal Category", category)
            + chip("Case Type", crime_type)
            + chip("Injury Severity", severity)
            + chip("Vulnerability Tier", vulnerability)
            + chip("Influence Metric", influence)
            + chip("Assessed Priority", priority)
            + "</div>",
        ),

        section(
            "IV. Constitutional Articles Applied &amp; Fundamental Rights Engaged",
            rights_block(rights),
            accent=theme["accent"],
        ),

        section(
            "V. Legal Summary &amp; Statutory Obligation Analysis",
            f"<p>{esc(state_duty)}</p>",
        ),

        section(
            "VI. Priority Rules Applied (Deterministic Decision Tree)",
            f"<p>{esc(rules_applied)}</p>"
            + (f"<p style='color:#4B5563;'><em>{esc(rationale)}</em></p>" if rationale else ""),
        ),

        section(
            "VII. State's Perspective &amp; Public Interest Analysis",
            f"<p>{esc(opinion)}</p>",
        ),

        section(
            "VIII. Doctrines Engaged &amp; Constitutional Jurisprudence",
            doctrines_block(doctrines),
        ),

        section(
            "IX. Rights Balancing Analysis &amp; Proportionality Test",
            f"<p>{esc(balancing)}</p>",
        ),

        section(
            "X. Landmark Precedents on Systemic Delay &amp; Human/Economic Toll",
            delay_precedents_block(get_delay_precedents(priority, category, crime_type, severity, case_title=case_file, case_text=summary)),
            accent="#B45309",
        ),

        '<div class="legal-note"><strong>STATUTORY DISCLAIMER &amp; JUDICIAL ADVISORY NOTICE:</strong> '
        "This document is an automated evidentiary intake and priority evaluation compiled by the "
        "<strong>Anavaya Judicial Intelligence System</strong> solely for court calendar scheduling and "
        "triage assistance under the Constitution of India. It does not constitute substantive legal advice, "
        "an interim injunction, or a final judicial decree. The sovereign authority to determine admissibility, "
        "trial sequence, and judicial relief resides exclusively with the Presiding Judge and the competent bench.</div>",
    ])

    return (
        "<html><head><meta charset='utf-8'></head>"
        f"<body>{body}</body></html>"
    )


# Space reserved at margins for pinned running headers and footers.
_HEADER_BAND = 40
_FOOTER_BAND = 48


def render_pdf(html, out_path, priority="Medium", doc_title=""):
    """Renders HTML to a multi-page A4 PDF using PyMuPDF's Story engine.

    Layout reserves clear header and footer bands so the flowing content never
    collides with or strands footers. After initial pagination, any accidental
    empty trailing page (caused by trailing margin tokens) is automatically
    pruned, and crisp running headers and dynamic 'Page X of Y' footers are stamped.
    """
    import tempfile

    fd_raw, raw_path = tempfile.mkstemp(suffix=".pdf", prefix="report_raw_")
    os.close(fd_raw)
    fd_final, final_path = tempfile.mkstemp(suffix=".pdf", prefix="report_stamped_")
    os.close(fd_final)

    page_rect = fitz.paper_rect("a4")
    margin_x = 32
    top_margin = 42
    bottom_margin = 48
    body_rect = fitz.Rect(
        margin_x, top_margin, page_rect.width - margin_x, page_rect.height - bottom_margin
    )

    story = fitz.Story(html=html, user_css=CSS, em=11)
    writer = fitz.DocumentWriter(raw_path)
    more = 1
    while more:
        dev = writer.begin_page(page_rect)
        more, filled = story.place(body_rect)
        story.draw(dev)
        writer.end_page()
    writer.close()

    now_str = datetime.now().strftime("%d %B %Y, %H:%M")
    title_display = doc_title or os.path.basename(out_path).replace(".pdf", "").replace("_report", "").replace("_", " ")

    doc = fitz.open(raw_path)
    # Prune any accidental trailing empty page
    if len(doc) > 1 and len(doc[-1].get_text().strip()) <= 15:
        doc.delete_page(len(doc) - 1)

    total_pages = len(doc)
    for idx, page in enumerate(doc):
        r = page.rect
        # Bottom footer line
        page.draw_line(fitz.Point(margin_x, r.height - 34), fitz.Point(r.width - margin_x, r.height - 34), color=(0.82, 0.85, 0.90), width=0.6)
        page.insert_text(fitz.Point(margin_x, r.height - 22), "ANAVAYA · CASE PRIORITY & ADMISSIBILITY ASSESSMENT · OFFICIAL RECORD", fontsize=7.2, color=(0.42, 0.46, 0.52), fontname="helv")
        p_str = f"Page {idx + 1} of {total_pages}"
        page.insert_text(fitz.Point(r.width - margin_x - len(p_str) * 5.4, r.height - 22), p_str, fontsize=7.2, color=(0.42, 0.46, 0.52), fontname="helv")

        # Running top header on Page 2+
        if idx > 0:
            page.draw_line(fitz.Point(margin_x, 30), fitz.Point(r.width - margin_x, 30), color=(0.82, 0.85, 0.90), width=0.6)
            h_left = f"ANAVAYA CASE REPORT · {str(title_display)[:50]}"
            page.insert_text(fitz.Point(margin_x, 23), h_left, fontsize=7.2, color=(0.42, 0.46, 0.52), fontname="helv")
            h_right = f"PRIORITY TIER: {str(priority).upper()}"
            page.insert_text(fitz.Point(r.width - margin_x - len(h_right) * 5.1, 23), h_right, fontsize=7.2, color=(0.55, 0.58, 0.62), fontname="helv")

    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    doc.save(final_path, garbage=4, deflate=True)
    doc.close()

    try:
        os.remove(raw_path)
    except Exception:
        pass

    try:
        if os.path.exists(out_path):
            os.remove(out_path)
        os.replace(final_path, out_path)
    except Exception:
        import shutil
        shutil.copy2(final_path, out_path)
        try:
            os.remove(final_path)
        except Exception:
            pass

    return out_path


def save_case_report(case_file, features, priority, analysis, reports_dir=REPORTS_DIR):
    """Render a PDF report for an already-analysed case and return its path.

    Used by the web app after the fast (rule-based) priority path so uploads
    get an immediate priority AND a downloadable PDF without an LLM call.
    """
    os.makedirs(reports_dir, exist_ok=True)
    base_name = os.path.splitext(case_file)[0]
    out_path = os.path.join(reports_dir, f"{base_name}_report.pdf")
    html = build_report_html(case_file, features, priority, analysis)
    render_pdf(html, out_path, priority=priority)
    return out_path


# ---------------------------------------------------------------- main

def main():
    if len(sys.argv) > 1:
        case_path = sys.argv[1]
    else:
        case_path = "Fictional_Case_Report_Test.pdf"

    if not os.path.exists(case_path):
        print(f"ERROR: case file not found: {case_path}")
        sys.exit(1)

    case_file = os.path.basename(case_path)
    base_name = os.path.splitext(case_file)[0]
    os.makedirs(REPORTS_DIR, exist_ok=True)
    out_path = os.path.join(REPORTS_DIR, f"{base_name}_report.pdf")

    print(f"Processing: {case_file}")

    # 1. Extract text from the case PDF
    text = extract_text_from_pdf(case_path)
    if not text.strip():
        print("ERROR: no text could be extracted from the PDF.")
        sys.exit(1)
    print(f"Extracted {len(text)} chars of text.")

    # 2. LLM feature extraction (Ollama, qwen2.5:3b)
    features = call_ollama_api(text)
    if not features:
        print("Ollama extraction unavailable; using local fallback extraction.")
        features = fallback_extract_features(text, case_file)
    features = tune_case_features(features, text)
    print(f"Parties: {features.get('main_parties', 'Unknown')}")
    print(f"Category: {features.get('case_category', 'N/A')} | "
          f"Crime: {features.get('crime_type', 'N/A')} | "
          f"Severity: {features.get('severity', 'N/A')}")

    # 3. Decision tree priority
    try:
        model_data = load_model()
    except Exception as e:
        print(f"ERROR loading priority model: {e}")
        sys.exit(1)
    model_text = f"{features.get('plain_summary', '')} {features.get('main_parties', '')}"
    priority = predict_priority(model_data, features, model_text)
    print(f"Predicted priority: {priority}")

    # 4. Constitutional analysis
    analysis = get_comprehensive_constitutional_analysis(features, priority)

    # 5. Render the PDF report
    html = build_report_html(case_file, features, priority, analysis)
    render_pdf(html, out_path, priority=priority)

    print(f"\nReport saved: {out_path}")
    doc = fitz.open(out_path)
    print(f"Pages: {len(doc)}")
    doc.close()


if __name__ == "__main__":
    main()
