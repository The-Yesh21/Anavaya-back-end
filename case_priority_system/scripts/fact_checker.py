"""
Hybrid evidence fact-checking for Chakshu lie-detection sessions.

Cross-checks a session transcript (the subject's spoken statements) against
every uploaded case document, and decides per-claim:

    contradicted  — the documents assert the opposite (the statement is
                    very likely a lie / made-up)
    consistent    — the documents support the statement
    unverified    — no document either supports or contradicts it

Layer 1 (deterministic rules): extract checkable claims from the transcript
(dates, locations, events, persons, negation like "did not travel") and
comparable evidence facts from the document texts, then decide by exact
matching. This is fast, offline and fully explainable.

Layer 2 (hybrid): claims the rules cannot decide are batched to the local
Ollama LLM for semantic verification against the relevant document excerpts.
The LLM only *judges* inside a strict JSON schema; if Ollama is unavailable,
every undecided claim falls back to "unverified" — never a false accusation.
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime
from typing import Optional

try:
    import requests
except ImportError:  # pragma: no cover
    requests = None

# Local Ollama configuration (same env contract as inference_pipeline.py).
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")

VERDICTS = ("contradicted", "consistent", "unverified")

# ---------------------------------------------------------------------------
# Date extraction & normalization
# ---------------------------------------------------------------------------

_MONTHS = {
    "january": 1, "jan": 1, "february": 2, "feb": 2, "march": 3, "mar": 3,
    "april": 4, "apr": 4, "may": 5, "june": 6, "jun": 6, "july": 7, "jul": 7,
    "august": 8, "aug": 8, "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10, "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}

_DATE_WORD_RE = re.compile(
    r"\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(" + "|".join(_MONTHS.keys())
    + r")[a-z]*\.?,?\s+(\d{4})\b",
    re.IGNORECASE,
)
_DATE_NUMERIC_RE = re.compile(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b")


def _normalize_date(year, month, day):
    """(year, month, day) -> normalized (y, m, d) tuple or None."""
    try:
        y, m, d = int(year), int(month), int(day)
        if y < 100:
            y += 2000 if y < 50 else 1900
        if not (1 <= m <= 12 and 1 <= d <= 31):
            return None
        return (y, m, d)
    except (ValueError, TypeError):
        return None


def extract_dates(text: str):
    """All dates in a text as (normalized_tuple, display_string) pairs."""
    if not text:
        return []
    out = []
    for m in _DATE_WORD_RE.finditer(text):
        norm = _normalize_date(m.group(3), _MONTHS[m.group(2).lower()], m.group(1))
        if norm:
            out.append((norm, m.group(0)))
    for m in _DATE_NUMERIC_RE.finditer(text):
        d1, d2, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        # Indian format dd/mm/yyyy; fall back to mm/dd only if day part is > 12.
        if d1 > 12 and 1 <= d2 <= 12:
            norm = _normalize_date(y, d2, d1)
        else:
            norm = _normalize_date(y, d1, d2)
        if norm:
            out.append((norm, m.group(0)))
    return out


# ---------------------------------------------------------------------------
# Negation, location, event, person extraction
# ---------------------------------------------------------------------------

_NEGATION_RE = re.compile(
    r"\b(?:did\s+not|didn'?t|never|wasn'?t|was\s+not|weren'?t|were\s+not|"
    r"don'?t|do\s+not|doesn'?t|does\s+not|haven'?t|have\s+not|hasn'?t|has\s+not|"
    r"cannot|couldn'?t|could\s+not|denied?|refus(?:ed|es|ing))\b",
    re.IGNORECASE,
)

_LOCATION_PREP_RE = re.compile(
    r"\b(?:in|at|from|to|near|around|within|visited|went\s+to|travelled\s+to|"
    r"traveled\s+to|stayed\s+(?:at|in)|returned\s+from|arrived\s+(?:in|at)|"
    r"departed\s+(?:from|for))\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})"
)

# Known Indian cities/places matched anywhere (case-insensitive) as a fallback.
_KNOWN_PLACES = [
    "mumbai", "delhi", "new delhi", "bengaluru", "bangalore", "hyderabad",
    "chennai", "kolkata", "pune", "ahmedabad", "jaipur", "lucknow", "kanpur",
    "nagpur", "indore", "bhopal", "patna", "kochi", "cochin", "thiruvananthapuram",
    "surat", "vadodara", "chandigarh", "goa", "guwahati", "raipur", "ranchi",
    "jodhpur", "amritsar", "varanasi", "agra", "shimla", "dehradun", "meerut",
    "noida", "gurgaon", "gurugram", "faridabad", "ghaziabad", "kolkata",
]

# Event verbs grouped into families so "travelled" matches "travel".
_EVENT_FAMILIES = {
    "travel": ["travel", "travelled", "traveled", "went", "flew", "drove",
               "arrived", "departed", "left", "came", "boarded", "took a train",
               "took the train", "checked in", "checked into", "returned"],
    "present": ["present", "attended", "stayed", "visited", "checked in",
                "checked into", "attending", "present at"],
    "met": ["met", "saw", "contacted", "called", "talked to", "spoke to"],
}
_EVENT_WORD_SET = {w for words in _EVENT_FAMILIES.values() for w in words}
_EVENT_RE = re.compile(r"\b(" + "|".join(sorted(_EVENT_WORD_SET, key=len, reverse=True)) + r")\b", re.IGNORECASE)

_PERSON_RE = re.compile(
    r"\b(?:met|with|saw|talked\s+to|spoke\s+to|accompanied\s+by|accompanied|"
    r"contacted|called)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)"
)


def _event_family(verb: str) -> Optional[str]:
    v = verb.lower()
    for family, words in _EVENT_FAMILIES.items():
        if v in words:
            return family
    return None


def _sentences(text: str):
    if not text:
        return []
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def _negated(sentence: str) -> bool:
    return bool(_NEGATION_RE.search(sentence))


def _extract_locations(sentence: str):
    out = []
    for m in _LOCATION_PREP_RE.finditer(sentence):
        out.append(m.group(1).strip())
    lower = sentence.lower()
    for place in _KNOWN_PLACES:
        if place in lower:
            out.append(place.title())
    # Dedupe, keep order.
    seen = set()
    return [p for p in out if not (p.lower() in seen or seen.add(p.lower()))]


def _extract_events(sentence: str):
    """List of (event_family, verb_text) found in a sentence."""
    out = []
    for m in _EVENT_RE.finditer(sentence):
        family = _event_family(m.group(1))
        if family:
            out.append((family, m.group(1)))
    return out


def _extract_persons(sentence: str):
    seen = set()
    out = []
    for m in _PERSON_RE.finditer(sentence):
        name = m.group(1).strip()
        if name.lower() not in seen:
            seen.add(name.lower())
            out.append(name)
    return out


# ---------------------------------------------------------------------------
# Claim & evidence extraction
# ---------------------------------------------------------------------------

def _claims_from_sentence(sentence: str, ts: str = "", context_dates: tuple = ()):
    """Extract checkable claims from one witness sentence.

    context_dates: absolute dates taken from the examiner's preceding question,
    so an answer like "I did not travel that day" resolves against the date the
    officer just asked about ("...on 12 June 2026?").
    """
    claims = []
    negated = _negated(sentence)
    dates = extract_dates(sentence)

    for norm, disp in dates:
        claims.append({
            "type": "date",
            "value": norm,
            "display": disp,
            "negated": negated,
            "raw": sentence,
            "timestamp": ts,
        })

    sentence_dates = tuple(d for d, _ in dates) or context_dates or ()

    for loc in _extract_locations(sentence):
        claims.append({
            "type": "location",
            "value": loc.lower(),
            "display": loc,
            "negated": negated,
            "dates": sentence_dates,
            "raw": sentence,
            "timestamp": ts,
        })

    for family, verb in _extract_events(sentence):
        # Events carry the dates mentioned in the same sentence, falling back
        # to the date in the officer's question ("travelled on 12 June" vs
        # "I did not travel that day" must resolve as a contradiction).
        event_dates = sentence_dates or None
        claims.append({
            "type": "event",
            "value": (family, event_dates),
            "display": verb,
            "negated": negated,
            "raw": sentence,
            "timestamp": ts,
        })

    for person in _extract_persons(sentence):
        claims.append({
            "type": "person",
            "value": person.lower(),
            "display": person,
            "negated": negated,
            "dates": sentence_dates,
            "raw": sentence,
            "timestamp": ts,
        })
    return claims


def extract_claims(transcript: list) -> list:
    """Extract checkable claims from the witness lines of a session transcript.

    transcript: list of {"role": "examiner"|"witness", "text": ..., "ts": ...}
    Dates from each examiner question are carried into the following witness
    answer so relative phrasing ("that day") stays checkable.
    """
    claims = []
    last_question_dates: tuple = ()
    for entry in transcript or []:
        text = str(entry.get("text", "") or "").strip()
        if entry.get("role") == "examiner":
            last_question_dates = tuple(d for d, _ in extract_dates(text))
            continue
        if entry.get("role") != "witness":
            continue
        ts = entry.get("ts", "")
        for sentence in _sentences(text):
            claims.extend(_claims_from_sentence(sentence, ts, last_question_dates))
    return claims


def extract_evidence_from_text(text: str, doc_id: str = "", doc_name: str = "") -> list:
    """Extract comparable evidence facts from one document's text."""
    facts = []
    seen = set()
    for sentence in _sentences(text):
        if len(sentence) < 5:
            continue
        negated = _negated(sentence)
        for norm, disp in extract_dates(sentence):
            key = ("date", norm)
            if key in seen:
                continue
            seen.add(key)
            facts.append({
                "type": "date",
                "value": norm,
                "display": disp,
                "negated": negated,
                "doc_id": doc_id,
                "doc_name": doc_name,
                "excerpt": sentence[:300],
            })
        for loc in _extract_locations(sentence):
            key = ("location", loc.lower())
            if key in seen:
                continue
            seen.add(key)
            facts.append({
                "type": "location",
                "value": loc.lower(),
                "display": loc,
                "negated": negated,
                "doc_id": doc_id,
                "doc_name": doc_name,
                "excerpt": sentence[:300],
            })
        for family, verb in _extract_events(sentence):
            dates = tuple(d for d, _ in extract_dates(sentence))
            key = ("event", family, dates or None)
            if key in seen:
                continue
            seen.add(key)
            facts.append({
                "type": "event",
                "value": (family, dates or None),
                "display": verb,
                "negated": negated,
                "doc_id": doc_id,
                "doc_name": doc_name,
                "excerpt": sentence[:300],
            })
        for person in _extract_persons(sentence):
            key = ("person", person.lower())
            if key in seen:
                continue
            seen.add(key)
            facts.append({
                "type": "person",
                "value": person.lower(),
                "display": person,
                "negated": negated,
                "doc_id": doc_id,
                "doc_name": doc_name,
                "excerpt": sentence[:300],
            })
    return facts


def extract_evidence(case) -> list:
    """Aggregate evidence facts from every analysed document of a case."""
    evidence = []
    for doc in case.documents:
        text = (doc.analysis or {}).get("text_excerpt", "")
        if not text:
            continue
        evidence.extend(extract_evidence_from_text(text, doc.doc_id, doc.filename))
    return evidence


# ---------------------------------------------------------------------------
# Rule-based verdict layer
# ---------------------------------------------------------------------------

def _match_evidence(evidence: list, ctype: str, value) -> list:
    return [f for f in evidence if f["type"] == ctype and f["value"] == value]


def _rule_verdict(claim: dict, evidence: list):
    """Decide a claim by rules. Returns (verdict, reason, evidence_dict) or None."""
    ctype = claim["type"]
    matches = _match_evidence(evidence, ctype, claim["value"])

    if ctype == "event":
        # Prefer evidence of the SAME event family on the SAME date.
        family, dates = claim["value"]
        same_family = [
            f for f in evidence if f["type"] == "event" and f["value"][0] == family
        ]
        if dates:
            same_date = [f for f in same_family if f["value"][1] == dates]
            if same_date:
                f = same_date[0]
                if claim["negated"]:
                    return ("contradicted",
                            f"The documents record '{f['display']}' on the date the witness denied it.",
                            f)
                return ("consistent",
                        f"The documents corroborate '{f['display']}' on the stated date.",
                        f)
            # The claim pins a date but the documents only record the same
            # event family on a DIFFERENT date — leave to the LLM layer so we
            # never raise a false contradiction.
            return None
        if same_family:
            f = same_family[0]
            if claim["negated"]:
                return ("contradicted",
                        f"The documents record '{f['display']}', which the witness denied.",
                        f)
            return ("consistent", f"The documents corroborate '{f['display']}'.", f)
        return None

    if ctype == "date":
        if matches:
            f = matches[0]
            if claim["negated"]:
                return ("contradicted",
                        "The documents record this date, which the witness denied.",
                        f)
            return ("consistent", "The documents record the same date.", f)
        return None

    if ctype == "location":
        if matches:
            f = matches[0]
            if not claim["negated"]:
                return ("consistent",
                        f"The documents also mention {f['display']}.", f)
            # A denied location is only contradicted when the documents also
            # establish activity on the same date ("I was not in Delhi on
            # 12 June" vs. evidence of events on 12 June). Without a date
            # match, defer to the LLM layer to avoid cross-date false positives.
            claim_dates = claim.get("dates") or ()
            if claim_dates:
                activity_on_date = [
                    e for e in evidence
                    if e["type"] == "event" and e["value"][1] == claim_dates
                ]
                if activity_on_date:
                    return ("contradicted",
                            f"The documents place activity on that date at {f['display']}, "
                            "which the witness denied.",
                            f)
            return None
        return None

    if ctype == "person":
        if matches:
            f = matches[0]
            if claim["negated"]:
                return ("contradicted",
                        f"The documents name {f['display']}, whose involvement the witness denied.",
                        f)
            return ("consistent",
                    f"The documents also name {f['display']}.", f)
        return None

    return None


# ---------------------------------------------------------------------------
# Hybrid LLM layer (semantic verification of undecided claims)
# ---------------------------------------------------------------------------

def _evidence_context(claim: dict, evidence: list, limit: int = 3) -> str:
    """Top excerpts of evidence for an undecided claim.

    Prefers exact value matches; falls back to same-type evidence (other
    locations / events / dates) so the LLM can reason about conflicts such as
    the witness saying Mumbai while the documents place the event in Delhi.
    """
    ctype = claim["type"]
    exact = [f for f in evidence if f["type"] == ctype and f["value"] == claim["value"]]
    if ctype == "event":
        family, dates = claim["value"]
        same_family = [f for f in evidence if f["type"] == "event" and f["value"][0] == family]
        same_date = [f for f in same_family if f["value"][1] == dates] if dates else []
        exact = exact or same_date or same_family
    same_type = [f for f in evidence if f["type"] == ctype and f not in exact]

    candidates = exact[:limit] or same_type[:limit]
    lines = []
    for f in candidates:
        lines.append(f"- [{f['doc_name']}] {f['excerpt']}")
    return "\n".join(lines) if lines else "No directly matching excerpt found."


def _ollama_verify(undecided: list, evidence: list, ollama_url: str = OLLAMA_URL,
                   ollama_model: str = OLLAMA_MODEL, chunk_size: int = 20) -> dict:
    """Ask the local Ollama LLM to judge undecided claims. Never raises.

    Claims are processed in bounded chunks so the prompt (and the JSON schema
    instruction at its tail) always fits.
    """
    if requests is None or not undecided:
        return {}
    from case_priority_system.scripts.inference_pipeline import parse_llm_json

    results: dict = {}
    for start in range(0, len(undecided), chunk_size):
        chunk = undecided[start:start + chunk_size]
        claims_block = "\n".join(
            f"{i}. \"{c['raw']}\" "
            f"(type={c['type']}, value={c['display']}, negated={c['negated']})"
            for i, c in chunk
        )
        system_prompt = (
            "You are a strict legal fact-checking assistant for the Indian judiciary. "
            "You compare a witness's statements against case documents and decide "
            "whether each statement is consistent, contradicted, or unverified. "
            "Return ONLY a JSON object of the form "
            '{"verdicts": [{"index": 0, "verdict": "consistent|contradicted|unverified", "reason": "..."}]}. '
            "Use 'contradicted' only when a document explicitly asserts the opposite "
            "of a negated claim or the two cannot both be true."
        )
        user_prompt = (
            "Witness statements to check:\n" + claims_block +
            "\n\nEvidence from case documents:\n" +
            "\n".join(_evidence_context(c, evidence) for _, c in chunk) +
            "\n\nJudge each statement and return the JSON verdict object only."
        )
        payload = {
            "model": ollama_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt[:14000]},
            ],
            "stream": False,
            "think": False,
            "options": {"temperature": 0, "num_predict": 2048, "seed": 42},
        }
        try:
            resp = requests.post(f"{ollama_url.rstrip('/')}/api/chat", json=payload, timeout=180)
            resp.raise_for_status()
            content = (resp.json().get("message") or {}).get("content", "")
            if not content:
                continue
            data = parse_llm_json(content)
            for v in data.get("verdicts", []):
                idx = v.get("index")
                verdict = str(v.get("verdict", "")).lower()
                if isinstance(idx, int) and verdict in VERDICTS:
                    results[idx] = {"verdict": verdict, "reason": str(v.get("reason", ""))}
        except Exception as e:
            print(f"fact_checker: Ollama verification unavailable: {e}")
    return results


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def run_fact_check(case, session, ollama_url: str | None = None,
                   ollama_model: str | None = None) -> dict:
    """Cross-check a session transcript against the case documents.

    Returns a fact-check report: {ran_at, summary, verdicts}.
    """
    evidence = extract_evidence(case)
    claims = extract_claims(session.transcript)

    verdicts: list[dict] = []
    undecided: list[tuple[int, dict]] = []

    for idx, claim in enumerate(claims):
        decision = _rule_verdict(claim, evidence)
        if decision is not None:
            verdict, reason, ev = decision
            verdicts.append({
                "claim": claim["raw"],
                "claim_type": claim["type"],
                "value": claim["display"],
                "negated": claim["negated"],
                "timestamp": claim["timestamp"],
                "verdict": verdict,
                "made_up": verdict == "contradicted",
                "reason": reason,
                "evidence": {
                    "document": ev["doc_name"],
                    "excerpt": ev["excerpt"],
                },
                "confidence": 0.9,
            })
        else:
            undecided.append((idx, claim))

    # Hybrid layer: semantic verification of undecided claims.
    if undecided:
        llm_results = _ollama_verify(undecided, evidence, ollama_url, ollama_model)
        for idx, claim in undecided:
            r = llm_results.get(idx, {})
            verdict = r.get("verdict", "unverified")
            reason = r.get("reason", "") or (
                "No document directly supports or contradicts this statement."
            )
            evidence_hit = _best_evidence(claim, evidence)
            verdicts.append({
                "claim": claim["raw"],
                "claim_type": claim["type"],
                "value": claim["display"],
                "negated": claim["negated"],
                "timestamp": claim["timestamp"],
                "verdict": verdict,
                "made_up": verdict == "contradicted",
                "reason": reason,
                "evidence": {
                    "document": evidence_hit["doc_name"] if evidence_hit else None,
                    "excerpt": evidence_hit["excerpt"] if evidence_hit else None,
                },
                "confidence": 0.6 if verdict != "unverified" else 0.5,
                "engine": "ollama",
            })

    # Order: contradicted first (most important), then consistent, then unverified.
    order = {"contradicted": 0, "consistent": 1, "unverified": 2}
    verdicts.sort(key=lambda v: (order.get(v["verdict"], 3), v["timestamp"] or ""))

    decided = [v for v in verdicts if v["verdict"] in ("contradicted", "consistent")]
    contradicted = sum(1 for v in verdicts if v["verdict"] == "contradicted")
    consistent = sum(1 for v in verdicts if v["verdict"] == "consistent")
    unverified = sum(1 for v in verdicts if v["verdict"] == "unverified")
    credibility = round((consistent / len(decided)) * 100) if decided else None

    return {
        "ran_at": datetime.now().isoformat(timespec="seconds"),
        "summary": {
            "total_claims": len(verdicts),
            "contradicted": contradicted,
            "consistent": consistent,
            "unverified": unverified,
            "credibility_index": credibility,
        },
        "verdicts": verdicts,
    }


def _best_evidence(claim: dict, evidence: list):
    """Best matching evidence excerpt for a claim, if any."""
    matches = _match_evidence(evidence, claim["type"], claim["value"])
    if matches:
        return matches[0]
    # For events, relax to same family.
    if claim["type"] == "event":
        family, _ = claim["value"]
        same_family = [f for f in evidence if f["type"] == "event" and f["value"][0] == family]
        if same_family:
            return same_family[0]
    return None
