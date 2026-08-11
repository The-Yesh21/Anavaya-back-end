"""End-to-end test for the Anavaya "Create New Case" workflow.

Boots the FastAPI server, then exercises:
  1. POST /api/cases                (create case, optional FIR)
  2. POST /api/cases/{id}/documents (attach evidence)
  3. POST /api/cases/{id}/analyze   (per-document + aggregate priority)
  4. POST /api/cases/{id}/sessions  (save a Chakshu transcript)
  5. POST /api/cases/{id}/fact-check (hybrid evidence fact-checking)
  6. GET  /api/case-registry        (case listing)
  7. GET  /api/cases/{id}/dossier   (markdown export)

Usage:  python test_case_workflow_e2e.py
"""

import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request

PORT = 8123
BASE = f"http://127.0.0.1:{PORT}"
FIR_PDF = "Sample_Medium_Priority_FIR.pdf"  # exists in the repo root

CASES_DIR = "case_priority_system/cases"
DOCS_DIR = "case_priority_system/case_documents"
EXCEL = "case_priority_system/case_results.xlsx"
INDEX_JSON = os.path.join(CASES_DIR, "_index.json")


def snapshot_artifacts():
    """Backup the Excel sheet + case index so the test can restore them."""
    backups = {}
    for src in (EXCEL, INDEX_JSON):
        if os.path.exists(src):
            dst = src + ".e2e.bak"
            shutil.copy(src, dst)
            backups[src] = dst
    return backups


def restore_artifacts(backups):
    """Restore Excel/index and remove every case JSON + uploaded document created by the test."""
    for src, dst in backups.items():
        if os.path.exists(dst):
            shutil.copy(dst, src)
            os.remove(dst)
    if os.path.isdir(CASES_DIR):
        for f in os.listdir(CASES_DIR):
            if f.endswith(".json") and f != "_index.json":
                try:
                    os.remove(os.path.join(CASES_DIR, f))
                except OSError:
                    pass
    if os.path.isdir(DOCS_DIR):
        shutil.rmtree(DOCS_DIR, ignore_errors=True)
        os.makedirs(DOCS_DIR, exist_ok=True)
    # Remove analysis artifacts generated for the synthetic evidence PDF.
    for pattern in ("e2e_evidence_decision_path.dot", "e2e_evidence_decision_report.md"):
        p = os.path.join("case_priority_system", "decision_graphs", pattern)
        if os.path.exists(p):
            os.remove(p)
    p = os.path.join("case_priority_system", "reports", "_e2e_evidence_report.pdf")
    if os.path.exists(p):
        os.remove(p)


def http(method, path, data=None, headers=None, files=None, raw_body=None):
    """Minimal HTTP helper (std lib only)."""
    url = BASE + path
    if files:
        boundary = "----AnavayaBoundary7MA4YWxkTrZu0gW"
        parts = []
        for field, (fname, content, ctype) in files.items():
            parts.append(
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{field}"; filename="{fname}"\r\n'
                f"Content-Type: {ctype}\r\n\r\n"
            .encode() + content + b"\r\n")
        if data:
            for k, v in data.items():
                parts.append(
                    f"--{boundary}\r\n"
                    f'Content-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        parts.append(f"--{boundary}--\r\n".encode())
        body = b"".join(parts)
        req = urllib.request.Request(url, data=body, method=method)
        req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    else:
        body = None
        req = urllib.request.Request(url, data=body, method=method)
        if raw_body is not None:
            req.data = raw_body.encode() if isinstance(raw_body, str) else raw_body
            req.add_header("Content-Type", "application/json")
        if headers:
            for k, v in headers.items():
                req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            ctype = resp.headers.get("Content-Type", "")
            body = resp.read().decode()
            if "json" in ctype:
                return resp.status, json.loads(body)
            return resp.status, body
    except urllib.error.HTTPError as e:
        ctype = e.headers.get("Content-Type", "") if e.headers else ""
        body = e.read().decode()
        if "json" in ctype:
            return e.code, json.loads(body)
        return e.code, body


def wait_ready(timeout=120):
    start = time.time()
    while time.time() - start < timeout:
        try:
            status, _ = http("GET", "/api/cases")
            if status == 200:
                return True
        except Exception:
            time.sleep(2)
    return False


def main():
    backups = snapshot_artifacts()
    server = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "case_priority_system.app:app",
         "--host", "127.0.0.1", "--port", str(PORT), "--ws-ping-interval", "0"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        if not wait_ready():
            print("FAIL: server did not become ready")
            sys.exit(1)
        print("server ready")

        # 1. Create a case WITHOUT a FIR -> auto-assigned id
        status, case = http("POST", "/api/cases",
                            data={"case_title": "E2E Test Theft Case", "created_by": "Officer Rao"})
        assert status == 200 and case["case_id"].startswith("ANV-"), (status, case)
        case_id = case["case_id"]
        print(f"1. created case {case_id} (source={case['source']})")

        # 2. Attach the FIR document
        with open(FIR_PDF, "rb") as f:
            fir_bytes = f.read()
        status, doc = http("POST", f"/api/cases/{case_id}/documents",
                           files={"file": (FIR_PDF, fir_bytes, "application/pdf")},
                           data={"doc_type": "FIR"})
        assert status == 200 and doc["doc_type"] == "FIR", (status, doc)
        print(f"2. attached document {doc['doc_id']} ({doc['filename']})")

        # 3. Analyse the case
        status, analyzed = http("POST", f"/api/cases/{case_id}/analyze")
        assert status == 200, (status, analyzed)
        print(f"3. aggregate={analyzed['aggregate_priority']} | "
              f"docs={[(d['filename'], d['priority']) for d in analyzed['documents']]}")

        # 4. Save a Chakshu session with the user's exact contradiction scenario
        session_payload = {
            "physio": {"score": 64, "verdict": "Deceptive Patterns Detected",
                       "blinks": 41, "gaze_avoidance": 12, "twitches": 9, "duration": 190},
            "transcript": [
                {"role": "examiner", "text": "Did you travel to Delhi on 12 June 2026?", "ts": "10:00:00"},
                {"role": "witness", "text": "I did not travel anywhere that day. I was in Mumbai.", "ts": "10:00:01"},
            ],
        }
        status, session = http("POST", f"/api/cases/{case_id}/sessions",
                               raw_body=json.dumps(session_payload))
        assert status == 200, (status, session)
        print(f"4. saved session {session['session_id']} ({len(session['transcript'])} entries)")

        # 5. Fact-check against the sample FIR (travel facts absent -> unverified)
        status, report = http("POST", f"/api/cases/{case_id}/fact-check", raw_body="{}")
        assert status == 200, (status, report)
        print(f"5. fact-check summary: {report['summary']}")

        # 5b. Build a synthetic EVIDENCE pdf that CONTAINS the travel facts, attach
        #     it, and re-run the fact-check -> the witness denial must be flagged
        #     as contradicted (likely made-up).
        evidence_pdf = "_e2e_evidence.pdf"
        try:
            import fitz
            story_text = (
                "Statement of the investigating officer: on 12 June 2026 the accused "
                "travelled to Delhi by train and checked into Hotel Ashok. CCTV records "
                "confirm the accused was present in Delhi on 12 June 2026. The hotel "
                "register shows arrival on 12 June 2026."
            )
            doc = fitz.open()
            page = doc.new_page()
            page.insert_text((72, 72), story_text, fontsize=11)
            doc.save(evidence_pdf)
            doc.close()
            with open(evidence_pdf, "rb") as f:
                ev_bytes = f.read()
            status, ev_doc = http(
                "POST", f"/api/cases/{case_id}/documents",
                files={"file": (evidence_pdf, ev_bytes, "application/pdf")},
                data={"doc_type": "Police Report"},
            )
            assert status == 200, (status, ev_doc)
            status, analyzed2 = http("POST", f"/api/cases/{case_id}/analyze")
            assert status == 200
            print(f"    evidence doc attached; aggregate now {analyzed2['aggregate_priority']}")

            status, report2 = http("POST", f"/api/cases/{case_id}/fact-check", raw_body="{}")
            assert status == 200, (status, report2)
            print(f"    re-check summary: {report2['summary']}")
            contradicted = [v for v in report2["verdicts"] if v["verdict"] == "contradicted"]
            assert contradicted, "expected at least one contradicted verdict"
            print(f"    CONTRADICTED FOUND: {contradicted[0]['claim']!r}")
            print(f"    reason: {contradicted[0]['reason']}")
            print(f"    evidence: {contradicted[0]['evidence']}")
        finally:
            if os.path.exists(evidence_pdf):
                os.remove(evidence_pdf)

        # 6. Registry
        status, registry = http("GET", "/api/case-registry")
        assert status == 200
        print(f"6. registry entries: {len(registry)}")

        # 7. Dossier export (markdown)
        status, dossier = http("GET", f"/api/cases/{case_id}/dossier")
        assert status == 200 and isinstance(dossier, str) and "Case Dossier" in dossier
        print(f"7. dossier export OK ({len(dossier)} chars)")

        print("\nE2E TEST PASSED")
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except Exception:
            server.kill()
        restore_artifacts(backups)


if __name__ == "__main__":
    main()
