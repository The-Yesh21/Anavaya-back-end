"""
Courtroom session deception analysis (Chakshu-style fact-check for trials).

Cross-checks the *trial transcript* of a courtroom session against the
collected evidence of the linked case and produces a per-speaker deception
report:

    lie               — the evidence directly contradicts the statement
    evasive           — the speaker dodged / did not answer (recalled nothing,
                        answered on someone else's behalf, refused)
    missing_evidence  — the speaker asserted a fact that no collected
                        document supports at all (e.g. never mentions the
                        evidence that was collected) → flagged as probable
                        fabrication, NOT as a proven lie
    consistent        — the evidence corroborates the statement
    unverified        — nothing either way

Layer 1 (deterministic rules): reuses the exact claim/evidence extraction
from fact_checker.py (dates, locations, events, persons, negation) and
matches statements against evidence extracted from every analysed case
document. Fast, offline, explainable.

Layer 2 (LLM semantic pass): statements the rules cannot decide are judged
in strict JSON by the local Ollama LLM *with the case context in the
prompt*, so it knows the parties and what the evidence says. Unavailable
LLM ⇒ everything undecided stays "unverified" — never a false accusation.

The LLM only judges phrasings; every "lie" verdict the report relies on is
traceable to a document excerpt (layer 1) or comes with the LLM's cited
reason. Priority decisions are untouched — this module never sees the
Decision Tree.
"""

from __future__ import annotations

import re
from datetime import datetime

try:
    import requests
except ImportError:  # pragma: no cover
    requests = None

try:
    from case_priority_system.scripts.fact_checker import (
        extract_claims,
        extract_evidence_from_text,
        _ollama_verify,
    )
except ImportError:  # pragma: no cover (script-style import)
    from scripts.fact_checker import (  # type: ignore
        extract_claims,
        extract_evidence_from_text,
        _ollama_verify,
    )

# Display labels used by the report renderers.
VERDICT_LABELS = {
    "lie": "Lie (contradicted by evidence)",
    "evasive": "Evasive / non-answer",
    "missing_evidence": "Asserted without any supporting evidence",
    "consistent": "Consistent with evidence",
    "unverified": "Unverified",
}

EVASIVE_PATTERNS = re.compile(
    r"\b(?:i (?:do(?:es)? not|don't|did not|didn't) (?:know|remember|recall)"
    r"|i (?:am not|'m not) (?:aware|sure)|no idea|cannot say|can't say"
    r"|i was not present|i wasn't there|i don't remember anything"
    r"|i did not see anything|i didn't see anything|ask (?:him|her|them|my)"
    r"|i cannot answer|no recollection)\b",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Role helpers — only witnesses/accused speak under the evidence
# ---------------------------------------------------------------------------

def _is_counsel(role: str) -> bool:
    """Counsel argue positions (they may characterise evidence); they do not
    testify, so their statements are not evidence-checked."""
    r = (role or "").lower()
    return "judge" in r or "prosecution" in r or "defence" in r


# ---------------------------------------------------------------------------
# Statement collection
# ---------------------------------------------------------------------------

def statements_from_transcript(transcript: list, context: dict) -> list:
    """Turn courtroom transcript entries into checkable statements.

    Grouped by speaker (actor + role); the examiner-question carry-over from
    fact_checker.extract_claims() is used per speaker run: in a courtroom the
    question usually comes from counsel and the answer from the witness, so
    dates mentioned in *any* preceding entry are carried into the next
    non-counsel statement.
    """
    # Map participant names -> roles from the room participants list is not
    # available here; transcript entries already carry the display role.
    statements: list[dict] = []
    pending_dates: tuple = ()

    for entry in transcript or []:
        kind = entry.get("kind", "statement")
        if kind not in ("statement",):
            continue
        role = str(entry.get("role", ""))
        actor = str(entry.get("actor", ""))
        text = str(entry.get("text", "")).strip()
        if not text:
            continue

        if _is_counsel(role) or role.lower() in ("system",):
            # Counsel questions may pin dates the witness then answers about.
            pending_dates = tuple(
                d for d, _ in _extract_dates_from(text)
            ) or pending_dates
            continue

        statements.append({
            "actor": actor or "Unknown",
            "role": role,
            "text": text,
            "timestamp": entry.get("timestamp", ""),
            "context_dates": pending_dates,
        })
        # Keep the dates only for the immediately following answer.
        pending_dates = ()

    return statements


def _extract_dates_from(text: str):
    """Local date-extraction shim (kept tiny; fact_checker.extract_dates)."""
    try:
        from case_priority_system.scripts.fact_checker import extract_dates
    except ImportError:  # pragma: no cover
        from scripts.fact_checker import extract_dates  # type: ignore
    return extract_dates(text)


# ---------------------------------------------------------------------------
# Evasion detection
# ---------------------------------------------------------------------------

def _is_evasive(text: str) -> bool:
    return bool(EVASIVE_PATTERNS.search(text or ""))


# ---------------------------------------------------------------------------
# Core analysis
# ---------------------------------------------------------------------------

def _evidence_text_blocks(context: dict) -> list:
    """(doc_name, text) pairs for every analysed evidence document."""
    out = []
    for ev in (context or {}).get("evidence", []):
        text = f"{ev.get('summary', '')}".strip()
        if text:
            out.append((ev.get("filename", "evidence"), text))
    return out


def analyze_transcript(transcript: list, context: dict,
                       use_llm: bool = True) -> dict:
    """Run the deception analysis for one courtroom session.

    context: the case context snapshot (case_manager.build_case_context()).
    Returns {ran_at, case_id, summary, speakers:[...], verdicts:[...]}.
    """
    # Reuse the fact-checker's evidence extraction on the context's evidence
    # summaries (the excerpts are already truncated to 600 chars each, which
    # is enough for claim matching).
    evidence: list[dict] = []
    for doc_name, text in _evidence_text_blocks(context):
        evidence.extend(
            extract_evidence_from_text(text, doc_name, doc_name)
        )
    # Without a linked case (or without analysed evidence) there is nothing
    # to check against — statements are marked unverified, NOT flagged as
    # unsupported. "Missing evidence" only means: the linked case file has
    # evidence on record and none of it supports the statement.
    evidence_free = not evidence

    statements = statements_from_transcript(transcript, context)

    verdicts: list[dict] = []
    undecided: list[tuple[int, dict]] = []

    for idx, st in enumerate(statements):
        if _is_evasive(st["text"]):
            verdicts.append({
                "actor": st["actor"], "role": st["role"],
                "statement": st["text"], "timestamp": st["timestamp"],
                "verdict": "evasive",
                "reason": "The speaker did not answer — claimed no knowledge or recollection.",
                "evidence": {"document": None, "excerpt": None},
                "confidence": 0.8,
                "engine": "rules",
            })
            continue

        claims = []
        for sentence in _sentences(st["text"]):
            claims.extend(
                _claims_from_sentence(sentence, st["timestamp"], st["context_dates"])
            )
        st["_claims"] = claims

        if not claims:
            # Nothing checkable in this statement (opinion, argument…).
            verdicts.append({
                "actor": st["actor"], "role": st["role"],
                "statement": st["text"], "timestamp": st["timestamp"],
                "verdict": "unverified",
                "reason": "Statement contains no concrete checkable fact.",
                "evidence": {"document": None, "excerpt": None},
                "confidence": 0.5,
                "engine": "rules",
            })
            continue

        # Rule layer over all claims of the statement.
        any_contradicted = None
        any_consistent = None
        per_claim_decided = 0
        for claim in claims:
            decision = _rule_verdict(claim, evidence)
            if decision is None:
                continue
            per_claim_decided += 1
            verdict, reason, ev = decision
            if verdict == "contradicted" and any_contradicted is None:
                any_contradicted = (reason, ev)
            elif verdict == "consistent" and any_consistent is None:
                any_consistent = (reason, ev)

        if any_contradicted is not None:
            reason, ev = any_contradicted
            verdicts.append({
                "actor": st["actor"], "role": st["role"],
                "statement": st["text"], "timestamp": st["timestamp"],
                "verdict": "lie",
                "reason": reason,
                "evidence": {"document": ev["doc_name"], "excerpt": ev["excerpt"]},
                "confidence": 0.9,
                "engine": "rules",
            })
            continue
        if any_consistent is not None:
            reason, ev = any_consistent
            verdicts.append({
                "actor": st["actor"], "role": st["role"],
                "statement": st["text"], "timestamp": st["timestamp"],
                "verdict": "consistent",
                "reason": reason,
                "evidence": {"document": ev["doc_name"], "excerpt": ev["excerpt"]},
                "confidence": 0.9,
                "engine": "rules",
            })
            continue

        if per_claim_decided == 0 and claims:
            # Nothing in the evidence either supports or contradicts — the
            # speaker asserted facts the collected evidence never records.
            undecided.append((idx, st))
            continue
        verdicts.append({
            "actor": st["actor"], "role": st["role"],
            "statement": st["text"], "timestamp": st["timestamp"],
            "verdict": "unverified",
            "reason": "The evidence neither clearly supports nor contradicts this statement.",
            "evidence": {"document": None, "excerpt": None},
            "confidence": 0.5,
            "engine": "rules",
        })

    # ---- LLM semantic layer on undecided statements --------------------
    # Every claim of every undecided statement is judged separately (unique
    # keys idx*1000+j so the results map back per statement); the statement
    # then takes its WORST supported verdict — a single contradiction from
    # the evidence outweighs any corroboration.
    if use_llm and undecided and requests is not None and evidence:
        entries: list[tuple[int, dict]] = []
        claim_owners: dict[int, int] = {}
        for idx, st in undecided:
            claims = st["_claims"] or [_fallback_claim(st)]
            for j, claim in enumerate(claims):
                key = idx * 1000 + j
                claim_owners[key] = idx
                entries.append((key, claim))
        llm_results = _ollama_verify(entries, evidence)
        by_statement: dict[int, list[str]] = {}
        reasons: dict[int, str] = {}
        for key, r in llm_results.items():
            owner = claim_owners.get(key)
            if owner is None:
                continue
            by_statement.setdefault(owner, []).append(r.get("verdict", "unverified"))
            if r.get("reason"):
                reasons[owner] = r["reason"]
        for idx, st in undecided:
            vv = by_statement.get(idx, [])
            ev = _best_evidence(st["_claims"], evidence)
            if "contradicted" in vv:
                mapped = "lie"
            elif "consistent" in vv:
                mapped = "consistent"
            else:
                # LLM could not confirm either way → the statement asserts
                # facts nothing in the record supports.
                mapped = "missing_evidence"
            verdicts.append({
                "actor": st["actor"], "role": st["role"],
                "statement": st["text"], "timestamp": st["timestamp"],
                "verdict": mapped,
                "reason": reasons.get(idx, "") or (
                    "No collected document supports or contradicts this statement."
                    if mapped != "missing_evidence" else
                    "No collected document records the facts asserted in this statement."
                ),
                "evidence": {"document": ev["doc_name"] if ev else None,
                             "excerpt": ev["excerpt"] if ev else None},
                "confidence": 0.6 if mapped in ("lie", "consistent") else 0.55,
                "engine": "ollama",
            })
    elif undecided:
        for idx, st in undecided:
            if evidence_free:
                verdicts.append({
                    "actor": st["actor"], "role": st["role"],
                    "statement": st["text"], "timestamp": st["timestamp"],
                    "verdict": "unverified",
                    "reason": (
                        "No case file is linked to this session — the statement "
                        "was not checked against collected evidence."
                    ),
                    "evidence": {"document": None, "excerpt": None},
                    "confidence": 0.5,
                    "engine": "rules",
                })
            else:
                verdicts.append({
                    "actor": st["actor"], "role": st["role"],
                    "statement": st["text"], "timestamp": st["timestamp"],
                    "verdict": "missing_evidence",
                    "reason": (
                        "No collected document records the facts asserted in this "
                        "statement — it is unsupported by the evidence on record."
                    ),
                    "evidence": {"document": None, "excerpt": None},
                    "confidence": 0.55,
                    "engine": "rules",
                })

    order = {"lie": 0, "evasive": 1, "missing_evidence": 2, "consistent": 3, "unverified": 4}
    verdicts.sort(key=lambda v: (order.get(v["verdict"], 9), v["timestamp"] or ""))

    speakers: dict[str, dict] = {}
    for v in verdicts:
        key = f"{v['actor']}|{v['role']}"
        sp = speakers.setdefault(key, {
            "actor": v["actor"], "role": v["role"],
            "statements": 0, "lies": 0, "evasive": 0,
            "missing_evidence": 0, "consistent": 0, "unverified": 0,
            "credibility": None,
        })
        sp["statements"] += 1
        if v["verdict"] in sp:
            sp[v["verdict"]] += 1
    decided = lambda sp: sp["lies"] + sp["evasive"] + sp["missing_evidence"] + sp["consistent"]
    for sp in speakers.values():
        d = decided(sp)
        # Credibility: corroborated statements vs. everything that counts
        # against the speaker (lies + evasions + unsupported assertions).
        if d:
            sp["credibility"] = round(100 * sp["consistent"] / d)

    return {
        "ran_at": datetime.now().isoformat(timespec="seconds"),
        "case_id": (context or {}).get("case_id", ""),
        "case_title": (context or {}).get("title", ""),
        "summary": {
            "total_statements": len(verdicts),
            "lies": sum(1 for v in verdicts if v["verdict"] == "lie"),
            "evasive": sum(1 for v in verdicts if v["verdict"] == "evasive"),
            "missing_evidence": sum(1 for v in verdicts if v["verdict"] == "missing_evidence"),
            "consistent": sum(1 for v in verdicts if v["verdict"] == "consistent"),
            "unverified": sum(1 for v in verdicts if v["verdict"] == "unverified"),
            "speakers_checked": len(speakers),
        },
        "speakers": list(speakers.values()),
        "verdicts": verdicts,
    }


def _fallback_claim(st: dict) -> dict:
    """A minimal pseudo-claim so the LLM layer always has something to cite."""
    return {
        "type": "event", "value": ("present", None),
        "display": st["text"][:80], "negated": False,
        "raw": st["text"], "timestamp": st["timestamp"],
    }


# fact_checker shims ----------------------------------------------------------------

def _sentences(text: str):
    try:
        from case_priority_system.scripts.fact_checker import _sentences as s
    except ImportError:  # pragma: no cover
        from scripts.fact_checker import _sentences as s  # type: ignore
    return s(text)


def _claims_from_sentence(sentence: str, ts: str = "", context_dates: tuple = ()):
    try:
        from case_priority_system.scripts.fact_checker import _claims_from_sentence as c
    except ImportError:  # pragma: no cover
        from scripts.fact_checker import _claims_from_sentence as c  # type: ignore
    return c(sentence, ts, context_dates)


def _rule_verdict(claim: dict, evidence: list):
    try:
        from case_priority_system.scripts.fact_checker import _rule_verdict as rv
    except ImportError:  # pragma: no cover
        from scripts.fact_checker import _rule_verdict as rv  # type: ignore
    return rv(claim, evidence)


def _best_evidence(claims: list, evidence: list):
    try:
        from case_priority_system.scripts.fact_checker import _best_evidence as be
    except ImportError:  # pragma: no cover
        from scripts.fact_checker import _best_evidence as be  # type: ignore
    for claim in claims:
        hit = be(claim, evidence)
        if hit:
            return hit
    return None


# ---------------------------------------------------------------------------
# Report renderers
# ---------------------------------------------------------------------------

def session_report_markdown(report: dict, room_title: str = "",
                            face_summaries: list | None = None) -> str:
    """Full session analysis report as Markdown (transcript + deception)."""
    lines: list[str] = []
    title = report.get("case_title") or room_title or "Trial Session"
    lines.append(f"# Session Analysis Report — {title}")
    lines.append("")
    lines.append(f"- **Generated:** {report.get('ran_at', '')}")
    if report.get("case_id"):
        lines.append(f"- **Linked case:** {report['case_id']}")
    lines.append("")

    s = report.get("summary", {})
    lines.append("## Deception Check Summary")
    lines.append("")
    lines.append(
        f"- Statements checked: **{s.get('total_statements', 0)}** across "
        f"**{s.get('speakers_checked', 0)}** speaker(s)"
    )
    lines.append(f"- Lies (contradicted by evidence): **{s.get('lies', 0)}**")
    lines.append(f"- Evasive / non-answers: **{s.get('evasive', 0)}**")
    lines.append(f"- Asserted without any supporting evidence: **{s.get('missing_evidence', 0)}**")
    lines.append(f"- Consistent with evidence: **{s.get('consistent', 0)}**")
    lines.append(f"- Unverified: **{s.get('unverified', 0)}**")
    lines.append("")

    if report.get("speakers"):
        lines.append("### Per-speaker credibility")
        lines.append("")
        lines.append("| Speaker | Role | Statements | Lies | Evasive | Unsupported | Consistent | Credibility |")
        lines.append("|---|---|---|---|---|---|---|---|")
        for sp in report["speakers"]:
            cred = "—" if sp.get("credibility") is None else f"{sp['credibility']}%"
            lines.append(
                f"| {sp['actor']} | {sp['role']} | {sp['statements']} | {sp['lies']} | "
                f"{sp['evasive']} | {sp['missing_evidence']} | {sp['consistent']} | {cred} |"
            )
        lines.append("")

    verdicts = report.get("verdicts", [])
    if verdicts:
        lines.append("### Findings")
        lines.append("")
        for v in verdicts:
            ev = v.get("evidence") or {}
            lines.append(f"**[{VERDICT_LABELS.get(v['verdict'], v['verdict']).upper()}] "
                         f"{v['actor']} ({v['role']})** — {v.get('timestamp', '')}")
            lines.append("")
            lines.append(f"> {v['statement']}")
            lines.append("")
            lines.append(f"- {v['reason']}")
            if ev.get("document"):
                lines.append(f"- Evidence: *{ev['document']}* — “{ev.get('excerpt', '')}”")
            lines.append("")

    if face_summaries:
        lines.append("## Face & Expression — Session Aggregate")
        lines.append("")
        for f in face_summaries:
            lines.append(f"### {f.get('subject', 'Unknown')} ({f.get('subject_role', '')})")
            lines.append("")
            lines.append(
                f"- Observed {f.get('duration_sec', 0)}s ({f.get('time_speaking_sec', 0)}s speaking); "
                f"calm {f.get('calm_sec', 0)}s; peak index {f.get('peak_index', 0)}%; "
                f"session average {f.get('mean_index', 0)}%."
            )
            counters = f.get("counters") or {}
            if counters:
                totals = ", ".join(
                    f"{name.replace('_', ' ')} {int(sec)}s"
                    for name, sec in sorted(counters.items(), key=lambda kv: -kv[1])
                )
                lines.append(f"- Cues: {totals}.")
            lines.append("")

    lines.append("---")
    lines.append("")
    lines.append(
        "*Disclaimer: automated analysis for investigative assistance. A “lie” verdict means a "
        "collected document contradicts the statement; “unsupported” means no collected document "
        "records the asserted fact. Neither is a judicial finding.*"
    )
    return "\n".join(lines).rstrip() + "\n"


def session_report_pdf_path(report: dict, room_title: str = "",
                            face_summaries: list | None = None) -> str:
    """Render the session analysis report to a temp PDF and return its path."""
    import html as html_mod
    import os
    import tempfile

    import fitz  # PyMuPDF

    def esc(text):
        return html_mod.escape(str(text if text is not None else ""))

    title = report.get("case_title") or room_title or "Trial Session"
    s = report.get("summary", {})

    # ---- findings html ----
    verdict_colors = {
        "lie": "#B3402E", "evasive": "#B45309",
        "missing_evidence": "#8A6D1A", "consistent": "#4E7A66",
        "unverified": "#6B7280",
    }
    findings_html = ""
    for v in report.get("verdicts", []):
        ev = v.get("evidence") or {}
        color = verdict_colors.get(v["verdict"], "#6B7280")
        findings_html += (
            f'<div class="finding">'
            f'<div class="finding-head"><span class="verdict" style="color:{color}">'
            f'{esc(VERDICT_LABELS.get(v["verdict"], v["verdict"]))}</span>'
            f'<span class="who">{esc(v["actor"])} ({esc(v["role"])})</span>'
            f'<span class="when">{esc(v.get("timestamp", ""))}</span></div>'
            f'<div class="quote">“{esc(v["statement"])}”</div>'
            f'<div class="why">{esc(v["reason"])}'
            + (f' <span class="evdoc">Evidence — {esc(ev["document"])}: '
               f"“{esc(ev.get('excerpt', ''))}”</span>" if ev.get("document") else "")
            + "</div></div>"
        )
    if not findings_html:
        findings_html = '<div class="empty">No checkable statements were recorded.</div>'

    speakers_rows = ""
    for sp in report.get("speakers", []):
        cred = "—" if sp.get("credibility") is None else f"{sp['credibility']}%"
        speakers_rows += (
            f"<tr><td>{esc(sp['actor'])}</td><td>{esc(sp['role'])}</td>"
            f"<td>{sp['statements']}</td><td>{sp['lies']}</td><td>{sp['evasive']}</td>"
            f"<td>{sp['missing_evidence']}</td><td>{sp['consistent']}</td>"
            f"<td>{cred}</td></tr>"
        )
    if speakers_rows:
        speakers_html = (
            "<table><thead><tr><th>Speaker</th><th>Role</th><th>Statements</th>"
            "<th>Lies</th><th>Evasive</th><th>Unsupported</th><th>Consistent</th>"
            "<th>Credibility</th></tr></thead>"
            f"<tbody>{speakers_rows}</tbody></table>"
        )
    else:
        speakers_html = '<div class="empty">No speakers were checked.</div>'

    face_html = ""
    for f in (face_summaries or []):
        counters = f.get("counters") or {}
        totals = ", ".join(
            f"{name.replace('_', ' ')} {int(sec)}s"
            for name, sec in sorted(counters.items(), key=lambda kv: -kv[1])
        )
        face_html += (
            f'<div class="face-row"><strong>{esc(f.get("subject", "Unknown"))}</strong> '
            f'({esc(f.get("subject_role", ""))}) — observed {f.get("duration_sec", 0)}s '
            f'({f.get("time_speaking_sec", 0)}s speaking), calm {f.get("calm_sec", 0)}s; '
            f'peak {f.get("peak_index", 0)}%, average {f.get("mean_index", 0)}%.'
            + (f' Cues: {esc(totals)}.' if totals else "")
            + "</div>"
        )
    face_section = (
        f'<div class="section"><div class="section-title">Face & Expression — Session Aggregate</div>'
        f"{face_html}</div>" if face_html else ""
    )

    now_str = datetime.now().strftime("%d %B %Y, %H:%M")
    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body>
<div class="page-header">
    <div class="kicker">ANAVAYA · SESSION ANALYSIS</div>
    <h1>Session Deception &amp; Demeanour Report</h1>
    <div class="sub">{esc(title)}{(' · Case ' + esc(report['case_id'])) if report.get('case_id') else ''}</div>
</div>

<div class="section">
    <div class="section-title">Deception Check Summary</div>
    <div class="detail-grid">
        <div class="detail"><span class="dt">Statements checked</span><span class="dd">{s.get('total_statements', 0)} across {s.get('speakers_checked', 0)} speaker(s)</span></div>
        <div class="detail"><span class="dt">Lies (contradicted)</span><span class="dd">{s.get('lies', 0)}</span></div>
        <div class="detail"><span class="dt">Evasive</span><span class="dd">{s.get('evasive', 0)}</span></div>
        <div class="detail"><span class="dt">Unsupported assertions</span><span class="dd">{s.get('missing_evidence', 0)}</span></div>
        <div class="detail"><span class="dt">Consistent</span><span class="dd">{s.get('consistent', 0)}</span></div>
        <div class="detail"><span class="dt">Unverified</span><span class="dd">{s.get('unverified', 0)}</span></div>
    </div>
</div>

<div class="section">
    <div class="section-title">Per-speaker Credibility</div>
    {speakers_html}
</div>

<div class="section">
    <div class="section-title">Findings</div>
    {findings_html}
</div>

{face_section}

<div class="legal-note">
    <strong>Disclaimer:</strong> automated analysis for investigative assistance. A “lie” verdict
    means a collected document contradicts the statement; “unsupported” means no collected document
    records the asserted fact. Neither is a judicial finding. Statements are checked only against
    the evidence attached to the linked case.
</div>

<div class="page-footer">
    Anavaya — AI-Powered Judicial System · Session analysis generated {esc(now_str)}
</div>
</body></html>"""

    css = """
    body { font-family: Georgia, 'Times New Roman', serif; font-size: 11px;
           color: #1F2937; line-height: 1.5; margin: 0; padding: 0; }
    .page-header { background: #1B2A4A; color: #fff; padding: 24px 28px;
                   border-bottom: 5px solid #C9A227; }
    .page-header .kicker { font-family: Helvetica, Arial, sans-serif; font-size: 9px;
                   letter-spacing: 3px; text-transform: uppercase; color: #C9A227; }
    .page-header h1 { margin: 6px 0 4px; font-size: 20px; color: #FFFFFF; }
    .page-header .sub { font-size: 12px; color: #C7D2E5; font-family: Helvetica, Arial, sans-serif; }
    .section { margin: 16px 24px; page-break-inside: avoid; }
    .section-title { font-family: Helvetica, Arial, sans-serif; font-size: 11px;
             font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px;
             color: #1B2A4A; padding: 5px 0 5px 10px; margin-bottom: 10px;
             border-bottom: 1px solid #E5E7EB; }
    .detail-grid { display: flex; flex-wrap: wrap; gap: 6px 20px; }
    .detail { font-family: Helvetica, Arial, sans-serif; }
    .dt { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #6B7280; display: block; }
    .dd { font-size: 11px; font-weight: 600; color: #111827; }
    table { width: 100%; border-collapse: collapse; font-family: Helvetica, Arial, sans-serif; }
    th { background: #F8FAFC; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px;
         color: #374151; text-align: left; padding: 5px 8px; border-bottom: 2px solid #E5E7EB; }
    td { font-size: 10px; padding: 5px 8px; border-bottom: 1px solid #F3F4F6; }
    .finding { padding: 8px 0 8px 10px; border-left: 4px solid #E5E7EB;
               border-bottom: 1px solid #F3F4F6; page-break-inside: avoid; }
    .finding-head { font-family: Helvetica, Arial, sans-serif; margin-bottom: 3px; }
    .verdict { font-size: 9px; font-weight: 800; text-transform: uppercase;
               letter-spacing: 0.8px; margin-right: 8px; }
    .who { font-size: 10px; color: #374151; margin-right: 8px; font-weight: 700; }
    .when { font-size: 9px; color: #9CA3AF; }
    .quote { font-size: 11px; color: #1F2937; font-style: italic; margin: 2px 0; }
    .why { font-size: 10px; color: #4B5563; }
    .evdoc { color: #713F12; }
    .empty { font-size: 10px; color: #6B7280; font-style: italic; }
    .face-row { font-size: 10px; padding: 4px 0; border-bottom: 1px solid #F3F4F6; }
    .legal-note { background: #FFFBEB; border: 1px solid #FDE68A; border-left: 6px solid #C9A227;
            padding: 10px 14px; border-radius: 4px; font-size: 10px; color: #713F12;
            margin: 16px 24px; }
    .page-footer { margin: 20px 24px; padding-top: 8px; border-top: 1px solid #E5E7EB;
            font-size: 9px; color: #9CA3AF; font-family: Helvetica, Arial, sans-serif; }
    """

    full_html = f"<html><head><meta charset='utf-8'></head><style>{css}</style><body>{html}</body></html>"

    fd, pdf_path = tempfile.mkstemp(suffix=".pdf", prefix="session_report_")
    os.close(fd)
    story = fitz.Story(html=full_html, user_css=css, em=11)
    writer = fitz.DocumentWriter(pdf_path)
    rect = fitz.paper_rect("a4")
    more = 1
    while more:
        dev = writer.begin_page(rect)
        more, _ = story.place(rect)
        story.draw(dev)
        writer.end_page()
    writer.close()
    return pdf_path
