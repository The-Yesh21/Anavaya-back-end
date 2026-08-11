"""
Case-centric registry for the Anavaya "Create New Case" workflow.

A Case groups multiple documents (FIR, reports, statements, ...) under one
system-assigned case id. Every document is run through the existing Anavaya
pipeline (feature extraction -> decision tree priority -> constitutional
analysis -> PDF report), and the case exposes an *aggregate* priority with a
per-document breakdown (highest document priority wins, safety-first).

The manager also stores Chakshu (lie-detection) sessions: the speech-to-text
transcript, the physiological summary, and the hybrid fact-check report
produced by fact_checker.py.

Design mirrors scripts/courtroom_manager.py: framework-agnostic, thread-safe,
persisted as one JSON file per case under case_priority_system/cases/, with
uploaded PDFs stored under case_priority_system/case_documents/{case_id}/.
"""

from __future__ import annotations

import json
import os
import re
import secrets
import threading
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Optional

CASES_DIR = "case_priority_system/cases"
DOCUMENTS_DIR = "case_priority_system/case_documents"
INDEX_PATH = os.path.join(CASES_DIR, "_index.json")

# Document types a user may tag an uploaded file with.
DOC_TYPES = ("FIR", "Police Report", "Medical", "Statement", "Other")

# Highest-wins ordering used by the aggregate priority.
PRIORITY_RANK = {"High": 3, "Medium": 2, "Low": 1}

# Case ids are always system-assigned in the ANV-YYYY-NNNN format. Every
# public entry point validates against this before touching the filesystem
# (defence-in-depth against path traversal via the URL).
CASE_ID_RE = re.compile(r"^ANV-\d{4}-\d{4}$")

# How much document text we keep for fact-checking evidence.
TEXT_EXCERPT_CHARS = 12000


def _now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(4)}"


@dataclass
class CaseDocument:
    """One uploaded evidence file attached to a case."""

    doc_id: str
    filename: str
    doc_type: str
    path: str
    uploaded_at: str
    # Filled by analyze_document(): extracted features + text_excerpt.
    analysis: dict = field(default_factory=dict)
    priority: Optional[str] = None
    decision_report: str = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        return d


@dataclass
class CaseSession:
    """One Chakshu (lie-detection) session attached to a case."""

    session_id: str
    started_at: str
    physio: dict = field(default_factory=dict)
    transcript: list = field(default_factory=list)
    fact_check: Optional[dict] = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Case:
    """A single case entity grouping documents, sessions and a fact-check."""

    case_id: str
    title: str
    created_at: str
    created_by: str
    source: str
    documents: list[CaseDocument] = field(default_factory=list)
    aggregate_priority: Optional[str] = None
    aggregate_rationale: str = ""
    sessions: list[CaseSession] = field(default_factory=list)

    # ---- helpers -----------------------------------------------------

    def get_document(self, doc_id: str) -> Optional[CaseDocument]:
        for d in self.documents:
            if d.doc_id == doc_id:
                return d
        return None

    def to_dict(self) -> dict:
        return asdict(self)

    def summary(self) -> dict:
        """Lightweight view for the sidebar registry (no heavy analysis)."""
        return {
            "case_id": self.case_id,
            "title": self.title,
            "created_at": self.created_at,
            "created_by": self.created_by,
            "source": self.source,
            "aggregate_priority": self.aggregate_priority,
            "document_count": len(self.documents),
            "session_count": len(self.sessions),
            "documents": [
                {
                    "doc_id": d.doc_id,
                    "filename": d.filename,
                    "doc_type": d.doc_type,
                    "uploaded_at": d.uploaded_at,
                    "priority": d.priority,
                    "decision_report": d.decision_report,
                }
                for d in self.documents
            ],
        }


class CaseManager:
    """Thread-safe registry of cases with disk persistence."""

    def __init__(self, cases_dir: str = CASES_DIR, documents_dir: str = DOCUMENTS_DIR):
        self.cases_dir = cases_dir
        self.documents_dir = documents_dir
        self._cases: dict[str, Case] = {}
        self._lock = threading.Lock()
        os.makedirs(self.cases_dir, exist_ok=True)
        os.makedirs(self.documents_dir, exist_ok=True)

    # ---- case lifecycle ----------------------------------------------

    def create_case(self, title: str = "", created_by: str = "", source: str = "AUTO_ID") -> Case:
        """Create an empty case. The case id is always system-assigned."""
        case_id = self._new_case_id()
        case = Case(
            case_id=case_id,
            title=(title or "").strip() or f"Untitled Case {case_id}",
            created_at=_now_iso(),
            created_by=(created_by or "").strip() or "Officer",
            source=source if source in ("FIR_UPLOADED", "AUTO_ID") else "AUTO_ID",
        )
        with self._lock:
            self._cases[case_id] = case
            self._persist(case)
        return case

    @staticmethod
    def valid_case_id(case_id: str) -> bool:
        """True when case_id matches the system-assigned format."""
        return bool(case_id) and bool(CASE_ID_RE.fullmatch(case_id))

    def get_case(self, case_id: str) -> Optional[Case]:
        """Active case by id, falling back to disk (survives restarts)."""
        if not self.valid_case_id(case_id):
            return None
        with self._lock:
            if case_id in self._cases:
                return self._cases[case_id]
        case = self._load(case_id)
        if case is not None:
            with self._lock:
                self._cases[case_id] = case
        return case

    def list_cases(self) -> list[dict]:
        """All cases: in memory plus any persisted on disk. Newest first."""
        seen: set[str] = set()
        out: list[dict] = []
        with self._lock:
            for case in self._cases.values():
                seen.add(case.case_id)
                out.append(case.summary())
        if os.path.isdir(self.cases_dir):
            for fname in os.listdir(self.cases_dir):
                if not fname.endswith(".json") or fname == "_index.json":
                    continue
                case_id = fname[:-5]
                if case_id in seen:
                    continue
                case = self._load(case_id)
                if case is not None:
                    out.append(case.summary())
                    seen.add(case_id)
        out.sort(key=lambda c: c["created_at"], reverse=True)
        return out

    # ---- documents ---------------------------------------------------

    def add_document(self, case_id: str, file_obj, doc_type: str = "Other", filename: str | None = None) -> CaseDocument:
        """Save an uploaded file onto disk and attach it to the case.

        file_obj must expose .read() (e.g. an UploadFile). Raises ValueError
        when the case is missing or the file cannot be stored.
        """
        case = self.get_case(case_id)
        if case is None:
            raise ValueError(f"Case {case_id} not found.")
        if doc_type not in DOC_TYPES:
            doc_type = "Other"
        filename = os.path.basename(filename or getattr(file_obj, "name", "") or "document.pdf")
        safe_name = re.sub(r"[^A-Za-z0-9_.\-]+", "_", filename)[:80] or "document.pdf"

        doc_id = _new_id("d")
        case_dir = os.path.join(self.documents_dir, case_id)
        os.makedirs(case_dir, exist_ok=True)
        path = os.path.join(case_dir, f"{doc_id}_{safe_name}")

        data = file_obj.read()
        if not data:
            raise ValueError("Uploaded file is empty.")
        with open(path, "wb") as out:
            out.write(data)

        doc = CaseDocument(
            doc_id=doc_id,
            filename=filename,
            doc_type=doc_type,
            path=path,
            uploaded_at=_now_iso(),
        )
        with self._lock:
            case.documents.append(doc)
            self._persist(case)
        return doc

    def analyze_document(self, case: Case, doc: CaseDocument, model_data=None) -> CaseDocument:
        """Run one document through the full Anavaya pipeline.

        Mirrors app.upload_case steps: text -> features -> priority ->
        decision path -> constitutional analysis -> PDF report. The result is
        stored on the document record (features + text_excerpt) and persisted.
        """
        from case_priority_system.scripts.inference_pipeline import (
            extract_text_from_pdf,
            fast_extract_features,
            call_ollama_api,
            llm_extraction_enabled,
            tune_case_features,
            predict_priority,
            build_decision_path_graph,
            load_model,
        )
        from case_priority_system.scripts.constitutional_analysis import (
            get_comprehensive_constitutional_analysis,
        )

        text = extract_text_from_pdf(doc.path)
        if not text.strip():
            raise ValueError(f"'{doc.filename}' contains no extractable text. Please upload a searchable PDF.")

        # Same GPU/LLM mode as the web upload path: when an NVIDIA GPU is
        # present (or ANAVAYA_USE_LLM=1), extract features with the local
        # Ollama LLM running on the GPU; otherwise fall back to the fast
        # deterministic rule-based extractor.
        features = None
        if llm_extraction_enabled():
            features = call_ollama_api(text)
        if not features:
            features = fast_extract_features(text, doc.filename)
        features = tune_case_features(features, text)
        if model_data is None:
            model_data = load_model()

        model_text = f"{features.get('plain_summary', '')} {features.get('main_parties', '')}"
        priority = predict_priority(model_data, features, model_text)
        decision_report, _ = build_decision_path_graph(
            model_data, features, model_text, doc.filename, priority
        )

        # Constitutional analysis (deterministic, no LLM).
        analysis = get_comprehensive_constitutional_analysis(features, priority)

        # PDF report (fast path, no LLM) so the officer can download it.
        report_pdf = ""
        try:
            from case_priority_system.scripts.generate_case_report import save_case_report
            report_pdf = save_case_report(doc.filename, features, priority, analysis)
        except Exception as e:
            print(f"Case {case.case_id} report generation failed (non-fatal): {e}")

        self.attach_analysis(
            case.case_id, doc.doc_id,
            analysis=features,
            priority=priority,
            decision_report=decision_report,
            text_excerpt=text,
            constitutional=analysis,
            report_pdf=report_pdf,
        )
        return doc

    def attach_analysis(self, case_id: str, doc_id: str, analysis: dict, priority: str,
                        decision_report: str = "", text_excerpt: str = "",
                        constitutional: Optional[dict] = None, report_pdf: str = "") -> None:
        """Store a precomputed pipeline result on a document (used by app.upload_case
        so a single-PDF upload can also register into the case registry without
        re-running the analysis)."""
        case = self.get_case(case_id)
        if case is None:
            raise ValueError(f"Case {case_id} not found.")
        doc = case.get_document(doc_id)
        if doc is None:
            raise ValueError(f"Document {doc_id} not found.")
        with self._lock:
            doc.analysis = dict(analysis or {})
            if text_excerpt:
                doc.analysis["text_excerpt"] = text_excerpt[:TEXT_EXCERPT_CHARS]
            if constitutional:
                doc.analysis["_constitutional"] = dict(constitutional)
            if report_pdf:
                doc.analysis["report_pdf"] = report_pdf
            doc.priority = priority
            doc.decision_report = decision_report
            self._persist(case)

    def analyze_case(self, case_id: str, model_data=None) -> Case:
        """Analyse every unanalysed document, then refresh the aggregate."""
        case = self.get_case(case_id)
        if case is None:
            raise ValueError(f"Case {case_id} not found.")
        for doc in list(case.documents):
            if not doc.priority:
                try:
                    self.analyze_document(case, doc, model_data)
                except Exception as e:
                    print(f"Case {case_id}: analysis of '{doc.filename}' failed: {e}")
        self.refresh_aggregate(case)
        return case

    def refresh_aggregate(self, case: Case) -> None:
        """Recompute the case aggregate priority from document priorities."""
        aggregate, rationale = self.compute_aggregate_priority(case)
        with self._lock:
            case.aggregate_priority = aggregate
            case.aggregate_rationale = rationale
            self._persist(case)

    @staticmethod
    def compute_aggregate_priority(case: Case) -> tuple[Optional[str], str]:
        """Highest document priority wins; rationale lists the breakdown."""
        priorities = [d.priority for d in case.documents if d.priority]
        if not priorities:
            return None, "No documents analysed yet."
        best = max(priorities, key=lambda p: PRIORITY_RANK.get(p, 0))
        parts = [
            f"{d.filename} ({d.doc_type}): {d.priority or 'not analysed'}"
            for d in case.documents
        ]
        rationale = (
            f"Aggregate priority is {best} — the highest priority among the case "
            f"documents (safety-first: High > Medium > Low). Breakdown: "
            + "; ".join(parts)
            + "."
        )
        return best, rationale

    # ---- sessions & fact-checking ------------------------------------

    def save_session(self, case_id: str, physio: dict | None = None, transcript: list | None = None) -> CaseSession:
        """Attach a completed Chakshu session (physio summary + transcript)."""
        case = self.get_case(case_id)
        if case is None:
            raise ValueError(f"Case {case_id} not found.")
        session = CaseSession(
            session_id=_new_id("s"),
            started_at=_now_iso(),
            physio=physio or {},
            transcript=transcript or [],
        )
        with self._lock:
            case.sessions.append(session)
            self._persist(case)
        return session

    def set_fact_check(self, case_id: str, session_id: str, report: dict) -> None:
        case = self.get_case(case_id)
        if case is None:
            raise ValueError(f"Case {case_id} not found.")
        with self._lock:
            for s in case.sessions:
                if s.session_id == session_id:
                    s.fact_check = report
                    break
            self._persist(case)

    # ---- export ------------------------------------------------------

    def export_markdown(self, case_id: str) -> Optional[str]:
        """Render the full case dossier (docs + sessions + fact-check) as Markdown."""
        case = self.get_case(case_id)
        if case is None:
            return None
        return case_to_markdown(case)

    # ---- internals ---------------------------------------------------

    def _persist(self, case: Case) -> None:
        path = os.path.join(self.cases_dir, f"{case.case_id}.json")
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(case.to_dict(), f, indent=2, ensure_ascii=False)
        os.replace(tmp, path)

    def _load(self, case_id: str) -> Optional[Case]:
        path = os.path.join(self.cases_dir, f"{case_id}.json")
        if not os.path.exists(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return _case_from_dict(data)
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            print(f"case_manager: failed to load {case_id}: {e}")
            return None

    def _new_case_id(self) -> str:
        """ANV-YYYY-NNNN; sequence counter persisted in cases/_index.json."""
        with self._lock:
            seq = 0
            if os.path.exists(INDEX_PATH):
                try:
                    with open(INDEX_PATH, "r", encoding="utf-8") as f:
                        seq = int(json.load(f).get("next_seq", 0))
                except Exception:
                    seq = 0
            seq += 1
            tmp = INDEX_PATH + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump({"next_seq": seq}, f)
            os.replace(tmp, INDEX_PATH)
        year = datetime.now().year
        candidate = f"ANV-{year}-{seq:04d}"
        # Defensive: never reuse an id that already exists on disk.
        guard = 0
        while os.path.exists(os.path.join(self.cases_dir, f"{candidate}.json")) and guard < 1000:
            seq += 1
            candidate = f"ANV-{year}-{seq:04d}"
            guard += 1
        return candidate


# ----------------------------------------------------------------------
# Markdown export
# ----------------------------------------------------------------------

def case_to_markdown(case: Case) -> str:
    lines: list[str] = []
    lines.append(f"# Case Dossier — {case.title}")
    lines.append("")
    lines.append(f"- **Case ID:** {case.case_id}")
    lines.append(f"- **Created:** {case.created_at}")
    lines.append(f"- **Created by:** {case.created_by}")
    lines.append(f"- **Source:** {case.source}")
    lines.append(f"- **Aggregate priority:** {case.aggregate_priority or 'Not analysed'}")
    if case.aggregate_rationale:
        lines.append(f"- **Rationale:** {case.aggregate_rationale}")
    lines.append("")

    if case.documents:
        lines.append("## Documents")
        lines.append("")
        for d in case.documents:
            lines.append(f"### {d.filename} ({d.doc_type})")
            lines.append("")
            lines.append(f"- Priority: **{d.priority or 'Not analysed'}**")
            f = d.analysis
            if f:
                lines.append(f"- Parties: {f.get('main_parties', 'Unknown')}")
                lines.append(f"- Category: {f.get('case_category', 'N/A')} | "
                             f"Severity: {f.get('severity', 'N/A')} | "
                             f"Vulnerability: {f.get('vulnerability', 'N/A')} | "
                             f"Influence: {f.get('influence', 'N/A')}")
                lines.append(f"- Summary: {f.get('plain_summary', '')}")
            lines.append("")

    if case.sessions:
        lines.append("## Chakshu Sessions")
        lines.append("")
        for s in case.sessions:
            lines.append(f"### Session {s.session_id} ({s.started_at})")
            physio = s.physio or {}
            lines.append(f"- Score: {physio.get('score', 'n/a')}% | "
                         f"Verdict: {physio.get('verdict', 'n/a')} | "
                         f"Blinks: {physio.get('blinks', 0)} | "
                         f"Gaze avoidance: {physio.get('gaze_avoidance', 0)} | "
                         f"Twitches: {physio.get('twitches', 0)}")
            for entry in s.transcript:
                role = entry.get("role", "?")
                text = entry.get("text", "")
                lines.append(f"- **{role}:** {text}")
            if s.fact_check:
                lines.append("")
                lines.append("### Fact-Check Report")
                summary = s.fact_check.get("summary", {})
                lines.append(
                    f"- Contradicted: {summary.get('contradicted', 0)} | "
                    f"Consistent: {summary.get('consistent', 0)} | "
                    f"Unverified: {summary.get('unverified', 0)} | "
                    f"Credibility index: {summary.get('credibility_index', 'n/a')}"
                )
                for v in s.fact_check.get("verdicts", []):
                    ev = v.get("evidence") or {}
                    lines.append(
                        f"- [{v.get('verdict', '?').upper()}] {v.get('claim', '')} "
                        f"— {ev.get('document', 'no evidence')}: {ev.get('excerpt', '')}"
                    )
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------

def _case_from_dict(data: dict) -> Case:
    documents = []
    for d in data.get("documents", []):
        documents.append(CaseDocument(
            doc_id=d["doc_id"],
            filename=d.get("filename", "document.pdf"),
            doc_type=d.get("doc_type", "Other"),
            path=d.get("path", ""),
            uploaded_at=d.get("uploaded_at", _now_iso()),
            analysis=d.get("analysis", {}),
            priority=d.get("priority"),
            decision_report=d.get("decision_report", ""),
        ))
    sessions = []
    for s in data.get("sessions", []):
        sessions.append(CaseSession(
            session_id=s.get("session_id", _new_id("s")),
            started_at=s.get("started_at", _now_iso()),
            physio=s.get("physio", {}),
            transcript=s.get("transcript", []),
            fact_check=s.get("fact_check"),
        ))
    return Case(
        case_id=data["case_id"],
        title=data.get("title", "Untitled Case"),
        created_at=data.get("created_at", _now_iso()),
        created_by=data.get("created_by", "Officer"),
        source=data.get("source", "AUTO_ID"),
        documents=documents,
        aggregate_priority=data.get("aggregate_priority"),
        aggregate_rationale=data.get("aggregate_rationale", ""),
        sessions=sessions,
    )


# Module-level singleton used by app.py (same pattern as courtroom_manager).
manager = CaseManager()
