"""End-to-end check of the courtroom speech path, against the running server.

Posts two REAL speech clips (synthesised locally) that together make one
sentence and asserts what the user cares about:

  * the first clip is transcribed at all (whisper available and working),
  * the second clip CONTINUES the first segment instead of appearing as a second
    broken half-sentence (merged=true, replaces_entry_id points at the first),
  * the record holds ONE statement entry with both clips and the joined text,
  * every client is told to replace that line (WS broadcast),
  * the Markdown export shows the completed sentence.

    python _courtroom_speech_live_check.py [base_url]
"""
from __future__ import annotations

import json
import os
import ssl
import subprocess
import sys
import time
import urllib.request
import uuid

import websocket  # websocket-client

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://127.0.0.1:8000"
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE
TMP = os.path.join(os.environ.get("TEMP", "."), "anavaya_speech_clips")

CHECKS = []


def check(name, ok, detail=""):
    CHECKS.append((name, bool(ok), detail))
    print("%s  %s%s" % ("PASS" if ok else "FAIL", name, ("  [%s]" % detail) if detail else ""))


def api(path, payload=None, method="GET"):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        BASE + path, data=data,
        headers={"Content-Type": "application/json"} if data else {}, method=method)
    with urllib.request.urlopen(req, context=CTX, timeout=60) as resp:
        body = resp.read().decode()
    return json.loads(body) if body.strip() else {}


def make_clip(name, text):
    """Synthesise a WAV of `text` with the Windows speech engine."""
    os.makedirs(TMP, exist_ok=True)
    path = os.path.join(TMP, name)
    ps = (
        "Add-Type -AssemblyName System.Speech;"
        "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;"
        "$s.Rate = 0;"
        "$s.SetOutputToWaveFile('%s');"
        "$s.Speak('%s');"
        "$s.Dispose()" % (path.replace("\\", "\\\\"), text)
    )
    subprocess.run(["powershell", "-NoProfile", "-Command", ps], check=True,
                   capture_output=True)
    return path


def post_audio(room_id, participant_id, path, recorded_at_ms):
    boundary = "----anavaya" + uuid.uuid4().hex
    with open(path, "rb") as fh:
        audio = fh.read()
    parts = []
    for key, value in (("room_id", room_id), ("participant_id", participant_id),
                       ("recorded_at", str(int(recorded_at_ms)))):
        parts.append(("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n"
                      % (boundary, key, value)).encode())
    parts.append(("--%s\r\nContent-Disposition: form-data; name=\"audio\"; "
                  "filename=\"check.wav\"\r\nContent-Type: audio/wav\r\n\r\n"
                  % boundary).encode())
    parts.append(audio)
    parts.append(("\r\n--%s--\r\n" % boundary).encode())
    body = b"".join(parts)
    req = urllib.request.Request(
        BASE + "/api/court/transcribe", data=body, method="POST",
        headers={"Content-Type": "multipart/form-data; boundary=" + boundary})
    with urllib.request.urlopen(req, context=CTX, timeout=300) as resp:
        return json.loads(resp.read().decode())


def drain(ws, timeout=6.0):
    """Collect every pending socket message."""
    msgs = []
    ws.settimeout(timeout)
    try:
        while True:
            raw = ws.recv()
            if not raw:
                break
            try:
                msgs.append(json.loads(raw))
            except ValueError:
                pass
    except Exception:
        pass
    return msgs


# ---------------------------------------------------------------- room + join
room = api("/api/court/rooms", {"case_title": "Live speech check", "created_by": "Checker"},
           method="POST")
rid = room["room_id"]
# Derive the socket endpoint from BASE so the check can run against either the
# plain-HTTP dev server or the TLS one.
ws_base = BASE.replace("https://", "wss://").replace("http://", "ws://").rstrip("/")
ws = websocket.create_connection(ws_base + "/ws/court/" + rid, timeout=30,
                                 sslopt={"cert_reqs": ssl.CERT_NONE})
ws.send(json.dumps({"type": "join", "name": "Justice Live", "role": "Judge"}))
hello = json.loads(ws.recv())
assert hello["type"] == "room_state", hello
participant_id = hello["me"]["participant_id"]
drain(ws, 2)
print("room %s, participant %s" % (rid, participant_id))

try:
    clip1 = make_clip("part_one.wav", "The accused was seen at the")
    clip2 = make_clip("part_two.wav", "warehouse at nine in the evening")

    # The two halves are SPOKEN three seconds apart (that is the gap the server
    # must judge), while transcription takes tens of seconds - exactly the case
    # that used to break sentence assembly.
    spoken_base = time.time() * 1000.0 - 3000.0
    t0 = time.time()
    first = post_audio(rid, participant_id, clip1, spoken_base)
    t1 = time.time()
    check("the first clip is transcribed", bool(first.get("raw")),
          "raw=%r (%.1fs)" % (first.get("raw"), t1 - t0))
    entry1 = first.get("entry") or {}
    check("the first clip becomes a statement entry", bool(entry1.get("entry_id")),
          "entry_id=%s" % entry1.get("entry_id"))
    check("the first response is not a merge", first.get("merged") is False and
          first.get("replaces_entry_id") == "", "merged=%r" % first.get("merged"))
    ws_msgs_1 = drain(ws)

    second = post_audio(rid, participant_id, clip2, spoken_base + 3000.0)
    t2 = time.time()
    check("the second clip is transcribed", bool(second.get("raw")),
          "raw=%r (%.1fs)" % (second.get("raw"), t2 - t1))
    entry2 = second.get("entry") or {}
    check("the second segment CONTINUES the statement",
          bool(second.get("merged")) and second.get("replaces_entry_id") == entry1.get("entry_id"),
          "merged=%r replaces=%r" % (second.get("merged"), second.get("replaces_entry_id")))
    check("the assembled entry is the same record line",
          entry2.get("entry_id") == entry1.get("entry_id"), "entry_id=%s" % entry2.get("entry_id"))
    check("both clips are attached to it",
          len(entry2.get("audio_files") or []) == 2, repr(entry2.get("audio_files")))
    check("the first fragment is kept honest (nothing invented)",
          "scene of the incident" not in (first.get("corrected") or "")
          and "scene" not in (first.get("corrected") or "").lower(),
          repr(first.get("corrected")))
    joined = (entry2.get("text") or "").lower()
    check("the joined statement reads as one sentence about both halves",
          "warehouse" in joined and joined.lstrip().startswith("the accused")
          and ("nine" in joined or "9" in joined), repr(entry2.get("text")))
    check("the joined statement invents nothing",
          "scene of the incident" not in joined, repr(entry2.get("text")))
    ws_msgs_2 = drain(ws)
    broadcasts = [m for m in ws_msgs_2 if m.get("type") == "transcript_entry"]
    check("the room is told to replace that line",
          bool(broadcasts) and broadcasts[-1].get("replaces_entry_id") == entry1.get("entry_id"),
          "broadcasts=%d" % len(broadcasts))

    # ---- the record on disk has exactly one statement --------------------
    state = api("/api/court/rooms/" + rid)
    statements = [e for e in state["transcript"] if e.get("kind") == "statement"]
    check("the record holds ONE statement, not two fragments", len(statements) == 1,
          "count=%d" % len(statements))
    check("the stored entry is the completed sentence",
          bool(statements) and statements[0].get("text") == entry2.get("text"),
          repr(statements[0].get("text")) if statements else "none")
    md = urllib.request.urlopen(BASE + "/api/court/rooms/%s/transcript" % rid,
                               context=CTX, timeout=30).read().decode()
    clips = entry2.get("audio_files") or []
    check("markdown shows both clips",
          len(clips) == 2 and md.count(clips[0]) == 1 and md.count(clips[1]) == 1,
          repr(clips))
    check("markdown shows the completed sentence",
          bool(entry2.get("text")) and entry2["text"] in md, repr(entry2.get("text")))
    # The wiring that makes the spoken-time gap work: the client must send when
    # the clip was spoken, or every segment is judged against the slow server
    # clock and nothing ever merges.
    js = urllib.request.urlopen(BASE + "/courtroom.js", context=CTX, timeout=30).read().decode()
    check("the client sends when the clip was spoken",
          'fd.append("recorded_at"' in js and "ptt.startedAt" in js)
finally:
    try:
        ws.close()
    except Exception:
        pass
    api("/api/court/rooms/" + rid, method="DELETE")

failed = [c for c in CHECKS if not c[1]]
print("\n%d/%d checks passed" % (len(CHECKS) - len(failed), len(CHECKS)))
if failed:
    print("FAILED: " + "; ".join("%s [%s]" % (n, d) for n, _, d in failed))
    sys.exit(1)
