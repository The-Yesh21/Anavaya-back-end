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
    "lie": "Material Contradiction (Documentary Conflict)",
    "evasive": "Evasive / Non-Responsive Answer",
    "missing_evidence": "Uncorroborated Assertion (Absent from Record)",
    "consistent": "Corroborated by Case Evidence",
    "unverified": "Unverified Statement",
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
        # Full evidence document texts (summaries), not just per-claim excerpt
        # selection: the structured extractor often finds nothing for a claim
        # (denials of narrated acts like "I did not transfer the money"), but
        # the LLM can still see the transfer is recorded in the documents.
        context_blocks = _evidence_text_blocks(context)
        llm_results = _ollama_verify(entries, evidence, context_blocks=context_blocks)
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
        count_key = "lies" if v["verdict"] == "lie" else v["verdict"]
        if count_key in sp:
            sp[count_key] += 1
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
    """Full session analysis report as Markdown (transcript + testimony verification)."""
    lines: list[str] = []
    title = report.get("case_title") or room_title or "Trial Session"
    lines.append(f"# Courtroom Proceeding & Testimony Integrity Dossier — {title}")
    lines.append("")
    lines.append(f"- **Generated:** {report.get('ran_at', '')}")
    if report.get("case_id"):
        lines.append(f"- **Linked Case Docket:** {report['case_id']}")
    lines.append("")

    s = report.get("summary", {})
    lines.append("## I. Evidentiary Verification & Concordance Summary")
    lines.append("")
    lines.append(
        f"- Statements Analyzed: **{s.get('total_statements', 0)}** across "
        f"**{s.get('speakers_checked', 0)}** speaker(s)"
    )
    lines.append(f"- Material Contradictions (Documentary Conflict): **{s.get('lies', 0)}**")
    lines.append(f"- Evasive / Non-Responsive Answers: **{s.get('evasive', 0)}**")
    lines.append(f"- Uncorroborated Assertions (Absent from Record): **{s.get('missing_evidence', 0)}**")
    lines.append(f"- Corroborated by Case Evidence: **{s.get('consistent', 0)}**")
    lines.append(f"- Unverified Statements: **{s.get('unverified', 0)}**")
    lines.append("")

    if report.get("speakers"):
        lines.append("## II. Witness Testimony Concordance & Reliability Index")
        lines.append("")
        lines.append("| Speaker / Participant | Role / Capacity | Statements | Material Conflicts | Evasive | Uncorroborated | Corroborated | Concordance Index |")
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
        lines.append("## III. Testimonial Findings & Evidentiary Citations")
        lines.append("")
        for v in verdicts:
            ev = v.get("evidence") or {}
            label = VERDICT_LABELS.get(v['verdict'], v['verdict']).upper()
            lines.append(f"### [{label}] {v['actor']} ({v['role']}) — {v.get('timestamp', '')}")
            lines.append("")
            lines.append(f"> “{v['statement']}”")
            lines.append("")
            lines.append(f"- **Assessment:** {v['reason']}")
            if ev.get("document"):
                lines.append(f"- **Evidentiary Citation:** *{ev['document']}* — “{ev.get('excerpt', '')}”")
            lines.append("")

    if face_summaries:
        lines.append("## IV. Biometric Demeanour & Physiological Stress Aggregate")
        lines.append("")
        for f in face_summaries:
            lines.append(f"### {f.get('subject', 'Unknown')} ({f.get('subject_role', '')})")
            lines.append("")
            lines.append(
                f"- **Observation Period:** {f.get('duration_sec', 0)}s ({f.get('time_speaking_sec', 0)}s active vocalization); "
                f"baseline calm {f.get('calm_sec', 0)}s; peak arousal {f.get('peak_index', 0)}%; "
                f"session mean {f.get('mean_index', 0)}%."
            )
            counters = f.get("counters") or {}
            if counters:
                totals = ", ".join(
                    f"{name.replace('_', ' ').title()} ({int(sec)}s)"
                    for name, sec in sorted(counters.items(), key=lambda kv: -kv[1])
                )
                lines.append(f"- **Micro-Cues Recorded:** {totals}.")
            lines.append("")

    lines.append("---")
    lines.append("")
    lines.append(
        "**Judicial Notice & Statutory Disclaimer:** This automated evidentiary analysis is generated "
        "by the Anavaya Judicial Intelligence System solely for forensic investigative assistance under the "
        "Indian Evidence Act, 1872 / Bharatiya Sakshya Adhiniyam, 2023. A finding of “Material Contradiction” "
        "indicates documentary inconsistency with records on file; “Uncorroborated” denotes an assertion "
        "without supporting documentation on record. Neither metric constitutes a formal judicial finding of perjury. "
        "Final determination of witness veracity rests exclusively with the presiding court."
    )
    return "\n".join(lines).rstrip() + "\n"


def session_report_pdf_path(report: dict, room_title: str = "",
                            face_summaries: list | None = None) -> str:
    """Render the polished courtroom session analysis report to a PDF.

    Uses a robust two-pass layout architecture with reserved header and footer
    bands. Running headers and footers (with dynamic page numbering 'Page X of Y')
    are stamped after pagination, and any empty trailing page created by
    browser/PyMuPDF whitespace margins is automatically pruned.
    """
    import html as html_mod
    import os
    import tempfile

    import fitz  # PyMuPDF

    def esc(text):
        return html_mod.escape(str(text if text is not None else ""))

    title = report.get("case_title") or room_title or "Trial Proceeding Session"
    s = report.get("summary", {})
    case_id = report.get("case_id") or ""
    now_str = datetime.now().strftime("%d %B %Y, %H:%M")

    # ---- findings html ----
    verdict_badge_styles = {
        "lie": {"label": "MATERIAL CONTRADICTION", "bg": "#FEE2E2", "text": "#991B1B", "border": "#EF4444"},
        "evasive": {"label": "NON-RESPONSIVE", "bg": "#FEF3C7", "text": "#92400E", "border": "#F59E0B"},
        "missing_evidence": {"label": "UNCORROBORATED", "bg": "#FEF9C3", "text": "#854D0E", "border": "#EAB308"},
        "consistent": {"label": "CORROBORATED", "bg": "#DCFCE7", "text": "#166534", "border": "#22C55E"},
        "unverified": {"label": "UNVERIFIED", "bg": "#F3F4F6", "text": "#4B5563", "border": "#9CA3AF"},
    }

    findings_html = ""
    for v in report.get("verdicts", []):
        ev = v.get("evidence") or {}
        stype = verdict_badge_styles.get(v.get("verdict"), verdict_badge_styles["unverified"])
        ev_html = ""
        if ev.get("document"):
            ev_html = (
                f'<div class="evidence-box">'
                f'<strong>Conflicting Document on Record:</strong> <em>{esc(ev["document"])}</em><br>'
                f'<span class="ev-excerpt">“{esc(ev.get("excerpt", ""))}”</span>'
                f'</div>'
            )
        findings_html += (
            f'<div class="finding-card" style="border-left-color:{stype["border"]};">'
            f'<div class="finding-header">'
            f'<span class="badge" style="background:{stype["bg"]};color:{stype["text"]};border:1px solid {stype["border"]};">'
            f'{stype["label"]}</span>'
            f'<span class="speaker-name">{esc(v["actor"])}</span>'
            f'<span class="speaker-role">({esc(v["role"])})</span>'
            f'<span class="timestamp">{esc(v.get("timestamp", ""))}</span>'
            f'</div>'
            f'<div class="testimony-quote">“{esc(v["statement"])}”</div>'
            f'<div class="finding-reason"><strong>Evidentiary Analysis:</strong> {esc(v["reason"])}</div>'
            f'{ev_html}'
            f'</div>'
        )
    if not findings_html:
        findings_html = '<div class="empty-notice">No actionable testimonial statements were recorded during this proceeding session.</div>'

    # ---- speakers table ----
    speakers_rows = ""
    for sp in report.get("speakers", []):
        cred = "—" if sp.get("credibility") is None else f"{sp['credibility']}%"
        speakers_rows += (
            f"<tr><td><strong>{esc(sp['actor'])}</strong></td><td>{esc(sp['role'])}</td>"
            f"<td style='text-align:center;'>{sp['statements']}</td>"
            f"<td style='text-align:center;color:#991B1B;'><strong>{sp['lies']}</strong></td>"
            f"<td style='text-align:center;color:#92400E;'>{sp['evasive']}</td>"
            f"<td style='text-align:center;color:#854D0E;'>{sp['missing_evidence']}</td>"
            f"<td style='text-align:center;color:#166534;'>{sp['consistent']}</td>"
            f"<td style='text-align:center;' class='cred-badge'>{cred}</td></tr>"
        )
    if speakers_rows:
        speakers_html = (
            "<table><thead><tr><th>Participant / Speaker</th><th>Role / Capacity</th>"
            "<th style='text-align:center;'>Statements</th>"
            "<th style='text-align:center;'>Material Conflicts</th>"
            "<th style='text-align:center;'>Evasive</th>"
            "<th style='text-align:center;'>Uncorroborated</th>"
            "<th style='text-align:center;'>Corroborated</th>"
            "<th style='text-align:center;'>Concordance Index</th></tr></thead>"
            f"<tbody>{speakers_rows}</tbody></table>"
        )
    else:
        speakers_html = '<div class="empty-notice">No witness or participant testimony was evaluated in this session.</div>'

    # ---- face / demeanour section ----
    face_html = ""
    for f in (face_summaries or []):
        counters = f.get("counters") or {}
        totals = ", ".join(
            f"{name.replace('_', ' ').title()} ({int(sec)}s)"
            for name, sec in sorted(counters.items(), key=lambda kv: -kv[1])
        )
        cues_row = (
            f'<div class="face-cues-row"><strong>Micro-Behavioural &amp; Cognitive Cues:</strong> {esc(totals)}</div>'
            if totals else '<div class="face-cues-row"><strong>Micro-Cues:</strong> Calm baseline maintained; no abnormal cues recorded.</div>'
        )
        face_html += (
            f'<div class="face-card">'
            f'<div class="face-subject-title">'
            f'<strong>{esc(f.get("subject", "Unknown Participant"))}</strong> '
            f'<span class="subject-role-pill">{esc(f.get("subject_role", "Participant"))}</span>'
            f'</div>'
            f'<div class="face-metrics-row">'
            f'<span>Observation: <strong>{f.get("duration_sec", 0)}s</strong></span>'
            f'<span>Active Speech: <strong>{f.get("time_speaking_sec", 0)}s</strong></span>'
            f'<span>Calm Baseline: <strong>{f.get("calm_sec", 0)}s</strong></span>'
            f'<span>Peak Stress Index: <strong>{f.get("peak_index", 0)}%</strong></span>'
            f'<span>Mean Index: <strong>{f.get("mean_index", 0)}%</strong></span>'
            f'</div>'
            f'{cues_row}'
            f'</div>'
        )
    face_section = (
        f'<div class="section"><div class="section-title">IV. Biometric Demeanour &amp; Cognitive Stress Record</div>'
        f"{face_html}</div>" if face_html else ""
    )

    docket_meta = f"Docket Reference: Case {esc(case_id)} · " if case_id else ""
    docket_meta += f"Proceedings Concluded: {esc(now_str)}"

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body>
<div class="page-header">
    <div class="kicker">ANAVAYA · REPUBLIC OF INDIA · JUDICIAL INTELLIGENCE SYSTEM</div>
    <h1>Courtroom Proceeding &amp; Testimony Integrity Dossier</h1>
    <div class="sub">{esc(title)}</div>
    <div class="docket-row">{docket_meta}</div>
</div>

<div class="section">
    <div class="section-title">I. Evidentiary Verification &amp; Concordance Summary</div>
    <div class="kpi-grid">
        <div class="kpi-card">
            <div class="kpi-val">{s.get('total_statements', 0)}</div>
            <div class="kpi-label">Statements Analyzed</div>
            <div class="kpi-sub">{s.get('speakers_checked', 0)} speaker(s)</div>
        </div>
        <div class="kpi-card kpi-danger">
            <div class="kpi-val">{s.get('lies', 0)}</div>
            <div class="kpi-label">Material Conflicts</div>
            <div class="kpi-sub">Direct document conflict</div>
        </div>
        <div class="kpi-card kpi-warning">
            <div class="kpi-val">{s.get('evasive', 0)}</div>
            <div class="kpi-label">Non-Responsive</div>
            <div class="kpi-sub">Evasive testimony</div>
        </div>
        <div class="kpi-card kpi-neutral">
            <div class="kpi-val">{s.get('missing_evidence', 0)}</div>
            <div class="kpi-label">Uncorroborated</div>
            <div class="kpi-sub">Absent from record</div>
        </div>
        <div class="kpi-card kpi-success">
            <div class="kpi-val">{s.get('consistent', 0)}</div>
            <div class="kpi-label">Corroborated</div>
            <div class="kpi-sub">Consistent with record</div>
        </div>
    </div>
</div>

<div class="section">
    <div class="section-title">II. Witness Testimony Concordance &amp; Reliability Index</div>
    {speakers_html}
</div>

<div class="section">
    <div class="section-title">III. Testimonial Findings &amp; Evidentiary Citations</div>
    {findings_html}
</div>

{face_section}

<div class="legal-disclaimer-card">
    <div class="disclaimer-title">STATUTORY JUDICIAL NOTICE &amp; FORENSIC DISCLAIMER</div>
    <p>This proceeding dossier is compiled autonomously by the <strong>Anavaya Judicial Intelligence System</strong> solely for investigative triage and judicial reference under the Indian Evidence Act, 1872 / Bharatiya Sakshya Adhiniyam, 2023. A finding of <em>“Material Contradiction”</em> denotes that testimony conflicts with documentary exhibits currently admitted into the case repository; <em>“Uncorroborated”</em> denotes an assertion unsupported by records on file. These markers do not constitute a conclusive finding of perjury or a final judicial decree. The sovereign prerogative of evaluating witness credibility, intent, and weight of evidence remains exclusively with the Presiding Judge.</p>
</div>
</body></html>"""

    css = """
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
           font-size: 10px; color: #1F2937; line-height: 1.5; margin: 0; padding: 0; }
    .page-header { background: #1B2A4A; color: #FFFFFF; padding: 20px 24px; border-radius: 6px;
                   border-bottom: 4px solid #C9A227; margin-bottom: 14px; }
    .page-header .kicker { font-size: 8px; letter-spacing: 2.2px; text-transform: uppercase;
                           color: #C9A227; font-weight: 700; }
    .page-header h1 { margin: 5px 0 3px; font-size: 19px; color: #FFFFFF; }
    .page-header .sub { font-size: 11px; color: #C7D2E5; margin-top: 3px; }
    .page-header .docket-row { margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.15);
                               font-size: 9px; color: #E2E8F0; }
    .section { margin-bottom: 16px; page-break-inside: avoid; }
    .section-title { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;
                     color: #1B2A4A; padding: 4px 0 4px 8px; margin-bottom: 8px;
                     border-left: 4px solid #C9A227; border-bottom: 1px solid #E5E7EB; }
    .kpi-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .kpi-card { flex: 1; min-width: 80px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 4px;
                padding: 6px 8px; }
    .kpi-val { font-size: 16px; font-weight: 800; color: #1B2A4A; line-height: 1.1; }
    .kpi-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
                 color: #4B5563; margin-top: 2px; }
    .kpi-sub { font-size: 7.5px; color: #6B7280; }
    .kpi-danger .kpi-val { color: #DC2626; }
    .kpi-warning .kpi-val { color: #D97706; }
    .kpi-neutral .kpi-val { color: #CA8A04; }
    .kpi-success .kpi-val { color: #16A34A; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9px; }
    th { background: #1B2A4A; color: #FFFFFF; font-size: 8px; text-transform: uppercase;
         letter-spacing: 0.6px; text-align: left; padding: 5px 6px; }
    td { padding: 5px 6px; border-bottom: 1px solid #F1F5F9; color: #1E293B; }
    tr:nth-child(even) td { background: #F8FAFC; }
    .cred-badge { font-weight: 700; color: #1B2A4A; }

    .finding-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-left: 4px solid #94A3B8;
                    border-radius: 4px; padding: 8px 10px; margin-bottom: 8px; page-break-inside: avoid; }
    .finding-header { margin-bottom: 4px; }
    .badge { display: inline-block; font-size: 7.5px; font-weight: 800; text-transform: uppercase;
             letter-spacing: 0.6px; padding: 2px 6px; border-radius: 3px; margin-right: 6px; vertical-align: 1px; }
    .speaker-name { font-weight: 700; color: #0F172A; font-size: 10px; margin-right: 4px; }
    .speaker-role { font-size: 9px; color: #475569; margin-right: 6px; }
    .timestamp { font-size: 8px; color: #94A3B8; }
    .testimony-quote { font-family: Georgia, 'Times New Roman', serif; font-size: 10.5px; font-style: italic;
                       color: #1E293B; background: #F8FAFC; border-left: 3px solid #CBD5E1;
                       padding: 4px 8px; margin: 3px 0 5px; border-radius: 0 4px 4px 0; }
    .finding-reason { font-size: 9px; color: #334155; margin-top: 3px; }
    .evidence-box { margin-top: 5px; background: #FEF9C3; border: 1px solid #FDE047; border-radius: 3px;
                    padding: 5px 7px; font-size: 8.5px; color: #713F12; }
    .ev-excerpt { font-style: italic; color: #854D0E; }
    .empty-notice { font-size: 9.5px; color: #64748B; font-style: italic; padding: 6px 0; }

    .face-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-left: 4px solid #3B82F6;
                 border-radius: 4px; padding: 7px 9px; margin-bottom: 6px; page-break-inside: avoid; }
    .face-subject-title { font-size: 10px; color: #0F172A; margin-bottom: 3px; }
    .subject-role-pill { font-size: 8px; color: #475569; background: #E2E8F0; padding: 1px 5px;
                         border-radius: 3px; margin-left: 5px; }
    .face-metrics-row { font-size: 8.5px; color: #475569; display: flex; flex-wrap: wrap; gap: 10px; }
    .face-cues-row { margin-top: 3px; font-size: 8px; color: #64748B; }

    .legal-disclaimer-card { background: #FFFBEB; border: 1px solid #FDE68A; border-left: 5px solid #C9A227;
                             padding: 9px 12px; border-radius: 4px; margin-top: 12px; page-break-inside: avoid; }
    .disclaimer-title { font-size: 8px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase;
                        color: #92400E; margin-bottom: 2px; }
    .legal-disclaimer-card p { font-size: 8px; color: #78350F; line-height: 1.4; margin: 0; }
    """

    full_html = f"<html><head><meta charset='utf-8'></head><style>{css}</style><body>{html}</body></html>"

    fd_raw, raw_pdf_path = tempfile.mkstemp(suffix=".pdf", prefix="session_report_raw_")
    os.close(fd_raw)
    fd_final, final_pdf_path = tempfile.mkstemp(suffix=".pdf", prefix="session_report_")
    os.close(fd_final)

    page_rect = fitz.paper_rect("a4")
    margin_x = 32
    top_margin = 42
    bottom_margin = 48
    body_rect = fitz.Rect(margin_x, top_margin, page_rect.width - margin_x, page_rect.height - bottom_margin)

    story = fitz.Story(html=full_html, user_css=css, em=10.5)
    writer = fitz.DocumentWriter(raw_pdf_path)
    more = 1
    while more:
        dev = writer.begin_page(page_rect)
        more, filled = story.place(body_rect)
        story.draw(dev)
        writer.end_page()
    writer.close()

    # Post-process: inspect pages, delete empty trailing page, stamp running header & footer
    doc = fitz.open(raw_pdf_path)
    # Prune any accidental trailing empty page
    if len(doc) > 1 and len(doc[-1].get_text().strip()) <= 10:
        doc.delete_page(len(doc) - 1)

    total_pages = len(doc)
    for idx, page in enumerate(doc):
        r = page.rect
        # Draw bottom footer line
        page.draw_line(fitz.Point(margin_x, r.height - 34), fitz.Point(r.width - margin_x, r.height - 34), color=(0.82, 0.85, 0.90), width=0.6)
        page.insert_text(fitz.Point(margin_x, r.height - 22), "ANAVAYA JUDICIAL INTELLIGENCE SYSTEM · CONFIDENTIAL COURT RECORD", fontsize=7.2, color=(0.42, 0.46, 0.52), fontname="helv")
        p_str = f"Page {idx + 1} of {total_pages}"
        page.insert_text(fitz.Point(r.width - margin_x - len(p_str) * 5.4, r.height - 22), p_str, fontsize=7.2, color=(0.42, 0.46, 0.52), fontname="helv")

        # Running top header on Page 2+
        if idx > 0:
            page.draw_line(fitz.Point(margin_x, 30), fitz.Point(r.width - margin_x, 30), color=(0.82, 0.85, 0.90), width=0.6)
            h_left = f"ANAVAYA PROCEEDING DOSSIER · {str(title)[:50]}"
            page.insert_text(fitz.Point(margin_x, 23), h_left, fontsize=7.2, color=(0.42, 0.46, 0.52), fontname="helv")
            h_right = f"DOCKET: {str(case_id or room_title or 'COURT')[:25]}"
            page.insert_text(fitz.Point(r.width - margin_x - len(h_right) * 5.1, 23), h_right, fontsize=7.2, color=(0.55, 0.58, 0.62), fontname="helv")

    doc.save(final_pdf_path, garbage=4, deflate=True)
    doc.close()

    try:
        os.remove(raw_pdf_path)
    except Exception:
        pass

    return final_pdf_path

