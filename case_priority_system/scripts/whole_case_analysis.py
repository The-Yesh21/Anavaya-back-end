"""Whole-case analysis: one verdict for the case built from ALL evidence.

Why this exists
---------------
Until now, "Analyze All Documents" ran the pipeline once per document and the
case "aggregate" was simply the highest single-document priority ("highest doc
wins"). The officer got N separate analyses instead of one analysis of the case
as a whole. This module adds the missing layer:

1. ``merge_case_features``      — deterministically fuses the per-document
   extracted features into ONE case-level feature set (worst severity wins,
   highest vulnerability wins, majority category with safety-first tie-break,
   a summary that narrates the whole evidence set).
2. ``build_corroboration_map``  — a cross-evidence view: which documents
   corroborate each other (shared parties / dates / places, using the same
   deterministic extractors as the Chakshu fact-checker) and which stand
   alone as unsupported evidence.
3. ``generate_case_narrative``  — a plain-language whole-case story from the
   merged features and the corroboration map (deterministic text, no LLM).
4. ``analyze_case_whole``       — runs the Decision Tree ONCE on the merged
   features, produces the case-level constitutional analysis and the
   case-level PDF report.

Founding invariant (do not break)
---------------------------------
The LLM extracts and summarizes only. Feature extraction already happened per
document (LLM or deterministic fallback). Everything in this module is
deterministic: merging is rule-based, the Decision Tree alone decides the case
priority, and the constitutional analysis is rule-based. No LLM is called here.

The result is persisted on the Case as ``case_level`` (see case_manager.Case),
rendered in the case workspace, downloadable as a PDF, and included in the
dossier export.
"""

from __future__ import annotations

import os
import re
from collections import Counter
from typing import Optional

REPORTS_DIR = "case_priority_system/reports"

# Highest-wins orderings (kept in sync with case_manager.PRIORITY_RANK).
PRIORITY_RANK = {"High": 3, "Medium": 2, "Low": 1}
SEVERITY_RANK = {"Fatal": 3, "Major": 2, "Minor": 1, "No Injury": 0}
VULN_RANK = {"High": 3, "Med": 2, "Medium": 2, "Low": 1}
INFLUENCE_RANK = {"High": 2, "Low": 1}

# Legal categories ordered most → least serious; used to break majority
# ties in the category vote (safety-first).
_CATEGORY_SERIOUSNESS = [
    "Criminal/Violent",
    "Constitutional/Writ",
    "Insolvency/Debt",
    "Excise/Tax",
    "Customs/Import-Export",
    "Company/Winding Up",
    "Property/Land",
    "General Civil",
]

# Model crime_type buckets ordered most → least serious for tie-breaks.
_CRIME_SERIOUSNESS = ["Violent", "Financial", "Property", "Non-Violent"]

_VALID_CATEGORY = set(_CATEGORY_SERIOUSNESS)
_VALID_CRIME = set(_CRIME_SERIOUSNESS)


def _mode(values: list[str], seriousness: Optional[list[str]] = None) -> str:
    """Most common value; ties broken by the seriousness order given."""
    counts = Counter(v for v in values if v)
    if not counts:
        return ""
    max_count = max(counts.values())
    candidates = [v for v, c in counts.items() if c == max_count]
    if seriousness and len(candidates) > 1:
        candidates.sort(key=lambda v: seriousness.index(v) if v in seriousness else 99)
    return candidates[0]


# ----------------------------------------------------------------------
# 1. Feature merge
# ----------------------------------------------------------------------

def merge_case_features(case) -> tuple[dict, dict]:
    """Fuse the per-document features into ONE case-level feature set.

    Deterministic, safety-first merge rules:
    - severity: worst value across documents wins (Fatal > Major > Minor > None)
    - vulnerability: highest value wins (High > Medium > Low)
    - influence: highest value wins (High > Low)
    - case_category: majority vote, ties toward the more serious category
    - crime_type: majority vote of the document crime_types, same tie-break
    - main_parties: deduplicated union across documents
    - plain_summary: whole-case narrative naming every document

    Returns ``(merged_features, merge_info)``. ``merge_info`` records which
    documents drove each decision so the UI (and a judge) can audit the merge.
    """
    docs = [d for d in case.documents if d.analysis]
    if not docs:
        return {}, {}

    def val(doc, key):
        return (doc.analysis.get(key) or "").strip()

    def worst(key: str, rank: dict) -> tuple[str, list[str]]:
        vals = [val(d, key) for d in docs]
        valid = [v for v in vals if v in rank]
        if not valid:
            return "", []
        best = max(set(valid), key=lambda v: rank[v])
        return best, [d.filename for d in docs if val(d, key) == best]

    severity, severity_src = worst("severity", SEVERITY_RANK)
    if not severity:
        severity, severity_src = "No Injury", []
    vulnerability, vuln_src = worst("vulnerability", VULN_RANK)
    if not vulnerability:
        vulnerability, vuln_src = "Low", []
    influence, infl_src = worst("influence", INFLUENCE_RANK)
    if not influence:
        influence, infl_src = "Low", []

    cat_vals = [val(d, "case_category") for d in docs]
    case_category = _mode([v for v in cat_vals if v in _VALID_CATEGORY],
                          seriousness=_CATEGORY_SERIOUSNESS) or "General Civil"
    cat_sources = [d.filename for d in docs if val(d, "case_category") == case_category]

    crime_vals = [val(d, "crime_type") for d in docs]
    crime_type = _mode([v for v in crime_vals if v in _VALID_CRIME],
                       seriousness=_CRIME_SERIOUSNESS) or "Non-Violent"
    crime_sources = [d.filename for d in docs if val(d, "crime_type") == crime_type]

    # Parties: deduplicated union across every document (order-preserving).
    parties: list[str] = []
    seen_lower: set[str] = set()
    for d in docs:
        raw = d.analysis.get("main_parties") or []
        if isinstance(raw, str):
            raw = [p.strip() for p in re.split(r"[;,]| and ", raw) if p.strip()]
        for p in raw:
            p = str(p).strip()
            if p and p.lower() not in seen_lower:
                seen_lower.add(p.lower())
                parties.append(p)
    parties = parties[:15] or ["Unknown"]

    # Corroboration map + whole-case narrative (deterministic).
    corroboration = build_corroboration_map(case)
    summary = generate_case_narrative(case, docs, case_category, severity,
                                      vulnerability, corroboration)

    merged_gist = build_case_gist(case, case_category, crime_type, parties)

    merged = {
        "case_gist": merged_gist,
        "main_parties": ", ".join(parties),
        "case_category": case_category,
        "crime_type": crime_type,
        "severity": severity,
        "vulnerability": vulnerability,
        "influence": influence,
        "plain_summary": summary,
    }

    merge_info = {
        "severity": {"value": severity, "rule": "worst value wins", "sources": severity_src},
        "vulnerability": {"value": vulnerability, "rule": "highest value wins", "sources": vuln_src},
        "influence": {"value": influence, "rule": "highest value wins", "sources": infl_src},
        "case_category": {"value": case_category, "rule": "majority vote (ties → more serious)",
                          "sources": cat_sources[:3]},
        "crime_type": {"value": crime_type, "rule": "majority vote (ties → more serious)",
                       "sources": crime_sources[:3]},
        "document_count": len(docs),
    }
    return merged, merge_info


# ----------------------------------------------------------------------
# 2. Corroboration map (deterministic, same extractors as the fact-checker)
# ----------------------------------------------------------------------

def build_corroboration_map(case) -> dict:
    """Which documents corroborate each other, and which stand alone.

    Uses the deterministic date/location extractors from the fact-checker plus
    the extracted parties — exactly what ``build_case_context`` uses for the
    courtroom — so the definition of "shared fact" is identical everywhere.
    """
    try:
        from case_priority_system.scripts.fact_checker import (
            extract_dates,
            _extract_locations,
        )
    except ImportError:
        from scripts.fact_checker import (  # type: ignore
            extract_dates,
            _extract_locations,
        )

    docs = [d for d in case.documents if d.analysis]
    facts: dict[str, dict] = {}
    for doc in docs:
        text = (doc.analysis or {}).get("text_excerpt", "") or ""
        parties = doc.analysis.get("main_parties") or []
        if isinstance(parties, str):
            parties = [p.strip() for p in re.split(r"[;,]| and ", parties) if p.strip()]
        facts[doc.doc_id] = {
            "filename": doc.filename,
            "doc_type": doc.doc_type,
            "dates": {norm for norm, _ in extract_dates(text)},
            "locs": {loc.lower() for loc in _extract_locations(text)},
            "parties": {str(p).strip().lower() for p in parties if str(p).strip()},
        }

    pairs: list[dict] = []
    shared_count: Counter = Counter()
    for i, a in enumerate(docs):
        for b in docs[i + 1:]:
            fa, fb = facts.get(a.doc_id), facts.get(b.doc_id)
            if not fa or not fb:
                continue
            shared: list[str] = []
            shared_dates = sorted(fa["dates"] & fb["dates"])
            shared_locs = sorted(fa["locs"] & fb["locs"])
            shared_parties = sorted(fa["parties"] & fb["parties"])
            if shared_dates:
                shared.append("dates")
            if shared_locs:
                shared.append("places")
            if shared_parties:
                shared.append("parties")
            if shared:
                pairs.append({
                    "a": fa["filename"],
                    "b": fb["filename"],
                    "shared": shared,
                    "shared_dates": shared_dates[:5],
                    "shared_places": shared_locs[:5],
                    "shared_parties": [p.title() for p in shared_parties[:5]],
                })
                for doc_id in (a.doc_id, b.doc_id):
                    shared_count[doc_id] += 1

    standalone = [
        {"doc_id": d.doc_id, "filename": facts[d.doc_id]["filename"],
         "doc_type": facts[d.doc_id]["doc_type"]}
        for d in docs if shared_count[d.doc_id] == 0
    ]

    return {
        "pairs": pairs,
        "standalone": standalone,
        "total_links": len(pairs),
    }


def corroboration_to_text(corroboration: dict) -> str:
    """Human-readable lines for the report / dossier from the map."""
    lines: list[str] = []
    for pair in corroboration.get("pairs", []):
        detail = []
        if pair.get("shared_dates"):
            detail.append("date(s) " + ", ".join(pair["shared_dates"]))
        if pair.get("shared_places"):
            detail.append("place(s) " + ", ".join(pair["shared_places"]))
        if pair.get("shared_parties"):
            detail.append("party/parties " + ", ".join(pair["shared_parties"]))
        lines.append(
            f"- **{pair['a']}** and **{pair['b']}** corroborate each other: "
            f"shared {'; '.join(detail)}."
        )
    for s in corroboration.get("standalone", []):
        lines.append(
            f"- **{s['filename']}** ({s['doc_type']}) currently stands alone — "
            "no other document on record shares a date, place or party with it."
        )
    return "\n".join(lines) if lines else "- Not enough analysed documents to cross-compare yet."


# ----------------------------------------------------------------------
# 2b. Case gist — "what is this case actually about" (deterministic)
# ----------------------------------------------------------------------

# Subject keywords that mark a summary sentence as an ALLEGATION (what the
# case is accused of / about) rather than background detail.
_ALLEGATION_HINTS = re.compile(
    r"accus|alleg|charg|complain|dispute|fraud|fabricat|forg|misus|misappropri"
    r"|unauthor|embezzl|breach|violat|offenc|offense|certifi|assessment|claim",
    re.IGNORECASE,
)
_MONEY_RE = re.compile(
    r"(?:rs\.?|inr|₹)\s*[0-9][0-9,]*(?:\.[0-9]+)?(?:\s*(?:lakh|crore|k))?"
    r"|[0-9][0-9,]*(?:\.[0-9]+)?\s*(?:lakh|crore)",
    re.IGNORECASE,
)


# Abbreviations whose final period is NOT a sentence boundary — merging back
# the next fragment keeps e.g. "… totaling Rs." + "45,00,000 between …" whole.
_FALSE_BOUNDARY_RE = re.compile(
    r"(?:Rs|INR|No|Nos|vs|viz|cf|Mr|Mrs|Ms|Dr|St|Co|Ltd|Inc|Pvt|Govt|Dist|approx|Art|W\.P)\.$",
    re.IGNORECASE,
)


def _split_sentences(text: str) -> list[str]:
    """Naive but robust sentence split on .!? followed by space/end.

    Re-joins fragments whose previous chunk ended in a known abbreviation
    ("Rs.", "No.", "vs.", …) so amounts like "Rs. 45,00,000" stay intact.
    """
    rough = re.split(r"(?<=[.!?])\s+", (text or "").strip())
    merged: list[str] = []
    for frag in rough:
        frag = frag.strip()
        if not frag:
            continue
        if merged and _FALSE_BOUNDARY_RE.search(merged[-1]):
            merged[-1] = merged[-1] + " " + frag
            continue
        merged.append(frag)
    return [p for p in merged if len(p) >= 20]


def _doc_display_name(filename: str, max_len: int = 44) -> str:
    """Shorten a filename for quoting inside the gist sentence."""
    stem = os.path.splitext(filename or "")[0].replace("_", " ").strip()
    return stem if len(stem) <= max_len else stem[: max_len - 1].rstrip() + "…"


def build_case_gist(case, case_category: str, crime_type: str, parties) -> str:
    """Deterministic "About this case" paragraph distilled from the documents.

    Answers the reader's first question — *what is this case about, who is
    accused of what* — before the audit-style narrative explains the merge.
    Assembled purely from the per-document ``plain_summary`` fields that the
    extraction pipeline already produced; no LLM is called here.

    Selection strategy (deterministic, document order = upload order):
      1. allegation-bearing sentences first (keyword-scored), one per document
         at most, capped at 4;
      2. the largest money figure found anywhere, as the amount in dispute;
      3. a closing line naming the merged classification and the parties.
    """
    docs = [d for d in case.documents if d.analysis]
    if not docs:
        return ""

    # One best sentence per document (deduplicated, case-insensitive).
    scored: list[tuple[int, int, str]] = []  # (score, doc_index, sentence)
    seen: set[str] = set()
    for idx, d in enumerate(docs):
        summary = (d.analysis or {}).get("plain_summary") or ""
        best_s, best_score = "", 0
        for s in _split_sentences(summary):
            key = s.lower()
            if key in seen:
                continue
            score = 2 * len(_ALLEGATION_HINTS.findall(s))
            if _MONEY_RE.search(s):
                score += 2
            # What the proceeding seeks ("The relief sought is…",
            # "STATE … seeks to hold X liable") — answers the reader's
            # "what is happening overall" question, so it outranks a
            # plain classification sentence.
            if re.search(r"relief sought|seeks? to|prayer for", s, re.IGNORECASE):
                score += 3
            # Generic meta-sentences ("The case involves …") describe the
            # classification, not the dispute — prefer concrete allegations.
            if re.match(r"the case (involves|raises|concerns|falls)", s.lower()):
                score -= 3
            if score > best_score:
                best_s, best_score = s, score
        if best_s:
            seen.add(best_s.lower())
            scored.append((best_score, idx, best_s))

    # Allegation-bearing sentences first, then the rest (deterministic order).
    scored.sort(key=lambda t: (t[0] > 0, -t[0], t[1]))
    picked = [s for _, _, s in scored[:4]]

    gist_parts: list[str] = []
    if picked:
        lead = " ".join(picked)
        gist_parts.append(lead[0].upper() + lead[1:] if lead else lead)

    # Amount in dispute: the largest money figure across ALL summaries.
    amounts: list[tuple[float, str]] = []
    for d in docs:
        for m in _MONEY_RE.finditer((d.analysis or {}).get("plain_summary") or ""):
            raw = m.group(0)
            digits = re.sub(r"[^0-9.]", "", raw.split("₹")[-1])
            try:
                value = float(digits)
            except ValueError:
                continue
            if re.search(r"crore", raw, re.IGNORECASE):
                value *= 1e7
            elif re.search(r"lakh", raw, re.IGNORECASE):
                value *= 1e5
            elif re.search(r"\d\s*k\b", raw, re.IGNORECASE):
                value *= 1e3
            amounts.append((value, raw.strip()))
    if amounts:
        amounts.sort(reverse=True)
        top_amount = amounts[0][1]
        # Skip the standalone amount line when the picked sentences already
        # state the figure (e.g. "transfers totaling Rs. 45,00,000").
        already = top_amount.lower() in gist_parts[0].lower() if gist_parts else False
        if not already:
            gist_parts.append(
                f"The amount in dispute mentioned on record is {top_amount}."
            )

    # Closing line: merged classification + who is on record.
    party_bits = ", ".join(str(p).strip() for p in parties[:4] if str(p).strip())
    closing = f"On the merged evidence the matter is classified as {case_category}"
    if crime_type:
        closing += f" ({crime_type.lower()} case type)"
    closing += "."
    if party_bits:
        closing += f" Names appearing across the documents: {party_bits}."
    gist_parts.append(closing)

    gist = " ".join(gist_parts)
    # Cosmetic smoothing of a real extraction artifact ("The accused is
    # accused of misusing funds…") — deterministic word substitution only,
    # no re-interpretation of the extracted facts.
    gist = re.sub(
        r"(\bthe accused) is accused of\b",
        r"\1 is allegedly",
        gist,
        flags=re.IGNORECASE,
    )
    return gist


# ----------------------------------------------------------------------
# 3. Whole-case narrative (deterministic)
# ----------------------------------------------------------------------

def generate_case_narrative(case, docs, case_category: str, severity: str,
                            vulnerability: str, corroboration: dict) -> str:
    """Plain-language story of the whole case across all documents.

    Deterministic template text assembled from the merged features and the
    corroboration map — no LLM anywhere.
    """
    n = len(docs)
    if n == 0:
        return "No documents analysed yet."
    type_counts = Counter(
        (d.doc_type or "Other") for d in docs
    )
    type_bits = ", ".join(f"{c} × {t}" if c > 1 else t for t, c in type_counts.items())

    opening = (
        f"This case file brings together {n} document{'s' if n != 1 else ''} "
        f"({type_bits}) and is assessed as a single matter of {case_category} "
        f"with {severity.lower() if severity != 'No Injury' else 'no'} injury "
        f"indicated"
    )
    if vulnerability == "High":
        opening += ", involving vulnerable parties"
    opening += "."

    parts = [opening]

    # Evidence inventory: one clause per document. Every piece of evidence is
    # named explicitly (with its own assessed priority) so the summary always
    # accounts for the documents that were actually added to the case.
    inv: list[str] = []
    for d in docs:
        f = d.analysis or {}
        cat = f.get("case_category", "")
        sev = f.get("severity", "")
        bit = f"“{d.filename}” ({d.doc_type}"
        if cat:
            bit += f"; {cat}"
        if sev and sev != "No Injury":
            bit += f"; {sev} severity"
        if d.priority:
            bit += f"; assessed {d.priority} priority"
        bit += ")"
        inv.append(bit)
    parts.append("The evidence on record consists of " + "; ".join(inv) + ".")

    # Corroboration story.
    links = corroboration.get("pairs", [])
    standalone = corroboration.get("standalone", [])
    if links:
        parts.append(
            f"Cross-comparison finds {len(links)} corroborating link"
            f"{'s' if len(links) != 1 else ''} between the documents (shared dates, "
            "places or parties), which strengthens the consistency of the record."
        )
        first = links[0]
        parts.append(
            f"For example, “{first['a']}” and “{first['b']}” share "
            f"{' and '.join(first['shared'])}."
        )
    if standalone:
        names = ", ".join(f"“{s['filename']}”" for s in standalone[:3])
        parts.append(
            f"{names} currently stand{'s' if len(standalone) == 1 else ''} alone — "
            "no other document shares a date, place or party with "
            f"{'it' if len(standalone) == 1 else 'them'}, so further supporting "
            "evidence would strengthen the case."
        )

    return " ".join(parts)


# ----------------------------------------------------------------------
# 4. Whole-case pipeline: Decision Tree once on the merged features
# ----------------------------------------------------------------------

def build_priority_justification(tuned: dict, priority: str,
                                 merge_info: dict, doc_count: int) -> str:
    """Plain-language, deterministic justification for the case priority.

    Ties the merged signal values (and the documents that drove them) to the
    Decision Tree's verdict, so the UI can say *why* the priority is what it
    is instead of only showing a bare badge. No LLM is involved.
    """
    def sources(key: str) -> str:
        info = (merge_info or {}).get(key) or {}
        srcs = [s for s in (info.get("sources") or []) if s]
        return f" (driven by {', '.join(srcs[:3])})" if srcs else ""

    severity = tuned.get("severity") or "No Injury"
    vulnerability = tuned.get("vulnerability") or "Low"
    influence = tuned.get("influence") or "Low"
    category = tuned.get("case_category") or "General Civil"
    crime_type = tuned.get("crime_type") or "Non-Violent"

    sentences = [
        f"The Decision Tree assigns {priority} priority from the worst facts "
        f"across all {doc_count} analysed document(s), not from any single one.",
        f"Worst injury on record: {severity}{sources('severity')}.",
        f"Vulnerability of the parties: {vulnerability}{sources('vulnerability')}.",
        f"Power imbalance (influence): {influence}{sources('influence')}.",
        f"Case category: {category} — the majority classification, mapped to the "
        f"model's “{crime_type}” case type{sources('case_category')}.",
    ]
    return " ".join(sentences)


def analyze_case_whole(case, model_data=None) -> dict:
    """Run the case-level analysis over ALL analysed documents.

    Steps (mirrors the per-document pipeline, applied to the merged features):
    merged features → tune → Decision Tree priority → decision-path graph →
    rule-based constitutional analysis → case PDF report.

    The LLM is NOT called. Returns the ``case_level`` dict persisted on the
    Case. Raises nothing — failures degrade to a partial result where the
    invariant-critical parts (priority) simply stay absent.
    """
    merged, merge_info = merge_case_features(case)
    if not merged:
        return {}

    from case_priority_system.scripts.inference_pipeline import (
        tune_case_features,
        predict_priority,
        build_decision_path_graph,
        load_model,
        trace_decision_steps,
    )
    from case_priority_system.scripts.constitutional_analysis import (
        get_comprehensive_constitutional_analysis,
    )

    try:
        tuned = tune_case_features(dict(merged), merged["plain_summary"])
    except Exception as e:
        print(f"whole-case: feature tuning failed (non-fatal): {e}")
        tuned = dict(merged)

    # The Decision Tree alone decides the case-level priority.
    if model_data is None:
        model_data = load_model()
    model_text = f"{tuned.get('plain_summary', '')} {tuned.get('main_parties', '')}"
    priority = predict_priority(model_data, tuned, model_text)

    decision_report = ""
    try:
        graph_name = f"{case.case_id}_whole_case"
        decision_report, _ = build_decision_path_graph(
            model_data, tuned, model_text, graph_name, priority
        )
    except Exception as e:
        print(f"whole-case: decision graph failed (non-fatal): {e}")

    # Auditable tree trace for the dashboard: which split raised the priority,
    # which lowered it, and the exact signal values that fed the tree.
    path_steps = []
    try:
        path_steps = trace_decision_steps(model_data, tuned, model_text)
    except Exception as e:
        print(f"whole-case: decision trace failed (non-fatal): {e}")

    # Rule-based constitutional analysis at the case level.
    analysis = {}
    try:
        analysis = get_comprehensive_constitutional_analysis(tuned, priority)
    except Exception as e:
        print(f"whole-case: constitutional analysis failed (non-fatal): {e}")

    corroboration = build_corroboration_map(case)
    per_doc = [
        {"filename": d.filename, "doc_type": d.doc_type, "priority": d.priority}
        for d in case.documents if d.analysis
    ]

    # Case-level PDF report (best-effort, never blocks the result).
    report_pdf = ""
    try:
        from case_priority_system.scripts.whole_case_report import save_whole_case_report
        report_pdf = save_whole_case_report(
            case.case_id, case.title, tuned, priority, analysis,
            merge_info=merge_info, corroboration=corroboration,
            per_doc=per_doc, reports_dir=REPORTS_DIR,
            case_gist=merged.get("case_gist", ""),
        )
    except Exception as e:
        print(f"whole-case: PDF report generation failed (non-fatal): {e}")

    justification = ""
    try:
        justification = build_priority_justification(
            tuned, priority, merge_info, len(per_doc)
        )
    except Exception as e:
        print(f"whole-case: priority justification failed (non-fatal): {e}")

    return {
        "priority": priority,
        "priority_justification": justification,
        "rationale": (
            f"Case-level priority {priority} — the Decision Tree run ONCE on the "
            f"merged features of all {len(per_doc)} analysed document(s) "
            f"(severity {tuned.get('severity')}, vulnerability "
            f"{tuned.get('vulnerability')}, category {tuned.get('case_category')})."
        ),
        "features": tuned,
        "merge_info": merge_info,
        "corroboration": corroboration,
        "corroboration_text": corroboration_to_text(corroboration),
        "per_document": per_doc,
        "decision_report": decision_report,
        "path_steps": path_steps,
        "constitutional": analysis,
        "case_gist": merged.get("case_gist", ""),
        "report_pdf": report_pdf,
        "computed_at": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
    }
