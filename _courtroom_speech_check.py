"""Checks the spoken-statement assembly in courtroom_manager.

One push-to-talk press is one clip, so a sentence the speaker had to break up
used to land in the record as several disconnected fragments. Consecutive clips
from the same speaker must now be folded into ONE entry (text joined, clips
accumulated, entry id stable) so the clients can complete the line they show —
without gluing genuinely separate statements together.

Runs standalone against a throwaway storage directory:
    python _courtroom_speech_check.py
"""
from __future__ import annotations

import datetime
import os
import shutil
import sys
import tempfile
import time

sys.path.insert(0, os.path.join("case_priority_system", "scripts"))
import courtroom_manager as cm  # noqa: E402

CHECKS = []


def check(name, ok, detail=""):
    CHECKS.append((name, bool(ok), detail))
    print("%s  %s%s" % ("PASS" if ok else "FAIL", name, ("  [%s]" % detail) if detail else ""))


tmp = tempfile.mkdtemp(prefix="anavaya_speech_")
mgr = cm.CourtroomManager(tmp)

room = mgr.create_room("Speech assembly check", "Checker")
rid = room.room_id
judge = mgr.join_room(rid, "Justice Rao", "Judge")[1]
witness = mgr.join_room(rid, "Witness One", "Witness")[1]


def speak(participant, text, clip, raw=None, spoken_at=None):
    return mgr.record_spoken_statement(
        rid, participant.participant_id, text, audio_file=clip,
        raw_text=raw if raw is not None else text, spoken_at=spoken_at)


def statements():
    return [e for e in room.transcript if e.kind == "statement"]


# ---- 1. a first segment opens a statement --------------------------------
entry, replaced = speak(judge, "The accused was seen at the", "a1.wav")
check("first segment creates an entry", entry is not None and replaced == "",
      "replaced=%r" % replaced)
check("entry carries an id and its speaker",
      bool(entry.entry_id) and entry.speaker_id == judge.participant_id,
      "entry_id=%s" % entry.entry_id)
check("first clip is attached (audio_file + audio_files)",
      entry.audio_file == "a1.wav" and entry.audio_files == ["a1.wav"],
      "%r %r" % (entry.audio_file, entry.audio_files))

# ---- 2. the next press completes it --------------------------------------
entry2, replaced2 = speak(judge, "warehouse at nine in the evening.", "a2.wav")
check("the follow-up segment CONTINUES the statement",
      entry2 is entry and replaced2 == entry.entry_id, "replaced=%r" % replaced2)
check("the sentence is joined, not split",
      entry.text == "The accused was seen at the warehouse at nine in the evening.",
      repr(entry.text))
check("both clips are kept on the entry", entry.audio_files == ["a1.wav", "a2.wav"],
      repr(entry.audio_files))
check("the record shows ONE statement, not two fragments", len(statements()) == 1,
      "count=%d" % len(statements()))

# ---- 3. a finished, full-length statement is not continued ---------------
long_stmt = ("I have considered the bail application and I am of the view that the "
             "material on record does not justify custody at this stage.")
speak(judge, long_stmt, "a3.wav")
entry4, replaced4 = speak(judge, "The matter is adjourned to Friday.", "a4.wav")
check("a finished full-length statement starts a new entry", replaced4 == "",
      "replaced=%r" % replaced4)
check("the new entry holds only its own clip", entry4.audio_files == ["a4.wav"],
      repr(entry4.audio_files))
held = [e for e in statements() if e.text == long_stmt]
check("the previous statement kept exactly its own clip",
      len(held) == 1 and held[0].audio_files == ["a3.wav"],
      repr(held[0].audio_files) if held else "entry missing")

# ---- 3b. a corrected-but-unfinished segment keeps being completed --------
# The grammar correction can tidy a cut-off half-sentence into something that
# looks complete, so the SHAPE signal comes from the raw recogniser text: an
# ellipsis (or no punctuation) means the sentence is not finished yet.
frag, rep_frag = speak(judge, "The accused was seen at the.", "a5.wav",
                       raw="The accused was seen at the...")
frag2, rep_frag2 = speak(judge, "counter at seven in the evening.", "a6.wav",
                         raw="counter at seven in the evening.")
# The SHAPE rule itself, stated directly (what counts as "unfinished").
def _shape(raw):
    seen = cm.TranscriptEntry(
        timestamp=cm._now_iso(), actor="J", role="Judge", kind="statement",
        text="The accused was seen at the.", speaker_id="p1", entry_id="probe",
        last_segment_raw=raw,
        last_segment_at=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"))
    return cm._statement_continues(seen, "more words", time.time())

check("an ellipsis in the raw text means unfinished", _shape("..."))
check("no terminal punctuation means unfinished", _shape("The accused was seen at the"))
check("a terminal period means finished",
      not _shape("The accused left the warehouse."))
check("the chain keeps completing the same entry", rep_frag2 == frag.entry_id,
      "replaced=%r" % rep_frag2)
check("the fragments completed into one entry",
      frag2.text.endswith("The accused was seen at the. counter at seven in the evening."),
      repr(frag2.text))

# A segment whose RAW output ended the sentence closes the statement, even when
# the corrected text looks identical to the fragment above.
closed, rep_closed = speak(judge, "The accused left the warehouse.", "a6b.wav",
                           raw="The accused left the warehouse.")
after, rep_after = speak(judge, "The court adjourned for the day.", "a6c.wav",
                         raw="The court adjourned for the day.")
check("a finished raw sentence closes the statement", rep_after == "",
      "replaced=%r" % rep_after)

# ---- 4. a longer pause starts a new statement ----------------------------
speak(judge, "One more short point,", "a7.wav")
last = room.transcript[-1]
# Spoken-time stamps are UTC (see _stamp_for), so back-date in UTC too.
last.last_segment_at = (datetime.datetime.now(datetime.timezone.utc)
                        - datetime.timedelta(seconds=30)).isoformat(timespec="seconds")
entry8, replaced8 = speak(judge, "the witness may step down.", "a8.wav")
check("a pause longer than the window starts a new entry",
      replaced8 == "" and entry8 is not last, "replaced=%r" % replaced8)

# ---- 5. another speaker never merges into it ----------------------------
w_entry, w_replaced = speak(witness, "I saw nothing that evening.", "w1.wav")
check("a different speaker gets their own entry",
      w_replaced == "" and w_entry.speaker_id == witness.participant_id,
      "replaced=%r" % w_replaced)
judge_next, judge_replaced = speak(judge, "Thank you, witness.", "a9.wav")
check("the previous speaker cannot continue across another speaker",
      judge_replaced == "" and judge_next is not w_entry, "replaced=%r" % judge_replaced)

# ---- 6. records written before this feature are never merged into --------
legacy = cm.TranscriptEntry(timestamp=cm._now_iso(), actor="Old Counsel",
                            role="Defence Counsel", kind="statement",
                            text="a legacy line from an older record")
room.transcript.append(legacy)
l_entry, l_replaced = speak(judge, "and this is new.", "a10.wav")
check("a legacy entry (no speaker id) is left alone",
      l_replaced == "" and l_entry is not legacy, "replaced=%r" % l_replaced)

# ---- 6b. the gap is judged on when the clip was SPOKEN --------------------
# Transcription takes tens of seconds, so a segment uploaded 3 s after the last
# one must still continue it even though the server stored it 20 s later.
base = time.time() + 60          # well clear of the previous server-stamped line
first_late, rep_late = mgr.record_spoken_statement(
    rid, judge.participant_id, "and the vehicle was", audio_file="a11.wav",
    spoken_at=base)
check("a segment spoken a minute after the last starts a new entry",
      rep_late == "", "replaced=%r" % rep_late)
backlog, backlog_replaced = mgr.record_spoken_statement(
    rid, judge.participant_id, "dark blue in colour.", audio_file="a12.wav",
    spoken_at=base + 2)
check("a segment spoken 2 s after the last continues it",
      backlog_replaced == first_late.entry_id, "replaced=%r" % backlog_replaced)
late, late_replaced = mgr.record_spoken_statement(
    rid, judge.participant_id, "A new statement after a long pause.",
    audio_file="a13.wav", spoken_at=base + 42)
check("a segment spoken 40 s later starts a new entry", late_replaced == "",
      "replaced=%r" % late_replaced)

# ---- 7. context lookup for the decoder ----------------------------------
ctx = mgr.last_spoken_statement(rid, judge.participant_id)
check("last_spoken_statement returns that speaker's latest statement",
      ctx is not None and ctx.text == "A new statement after a long pause.",
      repr(getattr(ctx, "text", None)))
check("last_spoken_statement ignores other speakers",
      mgr.last_spoken_statement(rid, witness.participant_id).text == "I saw nothing that evening.")

# ---- 8. exports carry every clip ----------------------------------------
md = mgr.export_markdown(rid)
check("markdown lists both clips of an assembled statement",
      md.count("a1.wav") == 1 and md.count("a2.wav") == 1,
      "a1=%d a2=%d" % (md.count("a1.wav"), md.count("a2.wav")))
check("markdown shows the completed sentence",
      "The accused was seen at the warehouse at nine in the evening." in md)

# ---- 8b. the correction must not invent an ending ----------------------
# A 3b model will happily finish a cut-off sentence; a court record must not
# contain words the speaker never said, so the raw fragment is kept instead.
sys.path.insert(0, os.path.join("case_priority_system", "scripts"))
import courtroom_asr as asr  # noqa: E402


def _stub_ollama(reply):
    class _Resp:
        def raise_for_status(self):
            return None

        def json(self):
            return {"message": {"content": reply}}

    def _post(*_args, **_kwargs):
        return _Resp()

    asr.requests.post = _post


_stub_ollama("The accused was seen at the scene of the incident.")
out_text, _ = asr.correct_transcript_text("The accused was seen at the...")
check("an invented ending is rejected", out_text == "The accused was seen at the...", repr(out_text))
_stub_ollama("The accused left the warehouse at nine.")
out_text2, used2 = asr.correct_transcript_text("The accused left the ware house at 9.")
check("a complete sentence is still corrected",
      out_text2 == "The accused left the warehouse at nine." and used2 is True, repr(out_text2))

# ---- 8c. the joined sentence can be re-read as a whole -------------------
updated = mgr.update_statement_text(rid, entry.entry_id,
                                   "The accused was seen at the warehouse at nine in the evening.")
check("update_statement_text replaces the joined sentence",
      updated is entry and entry.text == "The accused was seen at the warehouse at nine in the evening.",
      repr(entry.text))
check("re-reading the sentence keeps the clips and the id",
      entry.audio_files == ["a1.wav", "a2.wav"] and updated.entry_id == entry.entry_id,
      repr(entry.audio_files))

# ---- 9. an assembled statement survives persistence ---------------------
reloaded = mgr._load(rid)
first = [e for e in reloaded.transcript if e.kind == "statement"][0]
check("persisted entry keeps id/clips/speaker/re-read sentence",
      first.entry_id == entry.entry_id
      and first.audio_files == ["a1.wav", "a2.wav"]
      and first.speaker_id == judge.participant_id
      and first.text == "The accused was seen at the warehouse at nine in the evening.",
      "%s %r %s" % (first.entry_id, first.audio_files, first.speaker_id))
check("legacy lines load with empty defaults",
      all(isinstance(e.audio_files, list) for e in reloaded.transcript))

shutil.rmtree(tmp, ignore_errors=True)

failed = [c for c in CHECKS if not c[1]]
print("\n%d/%d checks passed" % (len(CHECKS) - len(failed), len(CHECKS)))
if failed:
    print("FAILED: " + "; ".join("%s [%s]" % (n, d) for n, _, d in failed))
    sys.exit(1)
