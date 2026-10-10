"""
In-memory + on-disk registry for live courtroom sessions.

A Room holds a roster of Participants and a running transcript. State is
persisted to case_priority_system/courtrooms/{room_id}.json after every
mutating call, so a room and its transcript survive server restarts and
can be reopened/exported later.

The manager is deliberately framework-agnostic: it knows nothing about
WebSockets or FastAPI. app.py wires it to the signaling transport.
"""

from __future__ import annotations

import json
import os
import secrets
import threading
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Optional


# Where room JSON files live (relative to the repo root, like the other paths).
COURTROOMS_DIR = "case_priority_system/courtrooms"

# The roles a participant may hold. Only the Judge is unique; counsel
# (Defence/Prosecution) and Witnesses may repeat — a real trial often has a
# second counsel on a side or several witnesses, and a repeat must never be
# the reason a member cannot join (Witness 1/2…, Defence Counsel 1/2…).
UNIQUE_ROLES = ("Judge",)
COUNSEL_ROLES = ("Defence", "Prosecution")
WITNESS_ROLE = "Witness"
ALL_ROLES = ("Judge", "Defence", "Prosecution", WITNESS_ROLE)

# Spoken statements arrive as ONE push-to-talk clip per press. A speaker who
# pauses, or who releases the key mid-sentence, produces several short clips
# that each read as a broken sentence in the record. Consecutive clips from the
# same speaker are therefore assembled into a single statement (see
# CourtroomManager.record_spoken_statement): within this window, and while the
# statement still looks unfinished, a new clip continues it.
STATEMENT_CONTINUATION_GAP_MS = 6000
# Hard ceiling on one assembled statement; longer speech starts a new entry.
STATEMENT_MAX_CHARS = 4000

# The ordered phases of a trial. The Judge advances through these.
TRIAL_PHASES = [
    "Opening",
    "Examination",
    "Cross-Examination",
    "Closing",
    "Concluded",
]

# Friendly labels shown in the UI / transcript.
ROLE_LABELS = {
    "Judge": "Presiding Judge",
    "Defence": "Defence Counsel",
    "Prosecution": "Prosecution Counsel",
    "Witness": "Witness",
}


@dataclass
class Participant:
    """One courtroom attendee."""

    participant_id: str
    name: str
    role: str
    joined_at: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class TranscriptEntry:
    """One line of the official record.

    kind values: 'statement' | 'action' | 'phase' | 'system' | 'behavior'

    audio_file is the stored recording of a spoken statement (filename
    inside the room's audio dir). Empty for typed/action/system entries.

    kind='behavior' entries carry automated face/expression observations
    (lip pressing, rapid blinking, gaze avoidance, ...) produced by the
    client-side MediaPipe analyzer, so nervousness cues become part of the
    official record.

    Spoken statements are assembled from push-to-talk segments (see
    record_spoken_statement): one press is one clip, but a speaker rarely stops
    neatly at the end of a sentence, so consecutive clips from the same speaker
    are folded into ONE entry - the text is joined, the clips accumulate, and
    the completed line is broadcast again so every client replaces the fragment
    it is already showing.
    """

    timestamp: str
    actor: str
    role: str
    kind: str
    text: str
    audio_file: str = ""
    # ---- speech assembly -------------------------------------------------
    # audio_files      every clip of this statement, in order (audio_file stays
    #                  the FIRST clip so older readers keep working)
    # speaker_id       the participant_id the statement belongs to. Empty on
    #                  typed/action/phase/system/behavior entries AND on records
    #                  written before this field existed - which is exactly what
    #                  keeps legacy lines from being merged into.
    # last_segment_at  when the most recent clip was SPOKEN, so the
    #                  continuation window is measured between clips, not from
    #                  the first one (or from the slow server clock)
    # last_segment_raw the raw recogniser output of that clip. It is the honest
    #                  "did the sentence finish?" signal: whisper leaves an
    #                  ellipsis or no punctuation when the speech was cut off,
    #                  while the grammar correction may well invent an ending.
    # entry_id         stable identity of the line, so a client can replace the
    #                  fragment it shows instead of duplicating it
    last_segment_raw: str = ""
    audio_files: list = field(default_factory=list)
    speaker_id: str = ""
    last_segment_at: str = ""
    entry_id: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class FaceSummary:
    """Whole-session face/expression result for one analyzed feed.

    Recorded once when the observer stops the analyzer (or the session
    ends). counters/peak/active_durations carry the *aggregate* evidence for
    the whole run — a brief spike never defines the person; the court record
    keeps the balanced, session-long view.
    """

    subject: str                  # participant name of the analyzed feed
    subject_role: str             # display role of that participant
    observer: str = ""            # who ran the analysis
    analyzed_source: str = ""     # "self" or participant_id
    started_at: str = ""
    ended_at: str = ""
    duration_sec: int = 0
    time_speaking_sec: int = 0    # portion where the subject was actually talking
    calm_sec: int = 0             # session time with no active cue
    peak_index: int = 0           # peak nervousness index (0-100)
    mean_index: int = 0           # session-average index (only while a face was visible)
    end_index: int = 0            # last index before stop
    peak_during_speech: bool = False  # whether the peak coincided with speech
    counters: dict = field(default_factory=dict)   # cue name -> seconds active
    active_durations: dict = field(default_factory=dict)  # kept for the PDF renderer
    cue_events: int = 0           # number of distinct cue episodes

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Room:
    """A single trial session."""

    room_id: str
    case_title: str
    created_at: str
    created_by: str
    phase: str = TRIAL_PHASES[0]
    status: str = "live"       # "live" | "ended" — ended rooms reject new joins
    participants: list[Participant] = field(default_factory=list)
    transcript: list[TranscriptEntry] = field(default_factory=list)
    # Optional link to a registered case (ANV-…). When set, the courtroom
    # client is shown the case context (parties, evidence, links) and the
    # session deception report can check statements against that case's
    # collected evidence.
    case_id: str = ""
    case_context: dict = field(default_factory=dict)  # built by case_manager.build_case_context()
    face_summaries: list[FaceSummary] = field(default_factory=list)
    # Judge-controlled: the live transcript is shown to the room by default; the
    # presiding judge can turn it off for everyone (and back on). The record is
    # still written while off — only the live view is hidden.
    transcript_enabled: bool = True

    # ---- roster helpers -------------------------------------------------

    def participant_ids(self) -> list[str]:
        return [p.participant_id for p in self.participants]

    def roles_taken(self) -> set[str]:
        """Unique roles only. Witnesses collapse to a single 'Witness'."""
        return {p.role for p in self.participants}

    def witness_count(self) -> int:
        return sum(1 for p in self.participants if p.role == WITNESS_ROLE)

    def role_available(self, role: str) -> bool:
        # Only the Judge is exclusive; counsel and witnesses may repeat.
        if role == "Judge":
            return role not in self.roles_taken()
        return True

    def get_participant(self, participant_id: str) -> Optional[Participant]:
        for p in self.participants:
            if p.participant_id == participant_id:
                return p
        return None

    def add_participant(self, participant: Participant) -> None:
        self.participants.append(participant)

    def remove_participant(self, participant_id: str) -> Optional[Participant]:
        for i, p in enumerate(self.participants):
            if p.participant_id == participant_id:
                return self.participants.pop(i)
        return None

    # ---- transcript helpers --------------------------------------------

    def add_entry(self, actor: str, role: str, kind: str, text: str) -> TranscriptEntry:
        entry = TranscriptEntry(
            timestamp=_now_iso(),
            actor=actor,
            role=role,
            kind=kind,
            text=text,
            entry_id=secrets.token_hex(4),
        )
        self.transcript.append(entry)
        return entry

    # ---- serialization -------------------------------------------------

    def to_dict(self) -> dict:
        return {
            "room_id": self.room_id,
            "case_title": self.case_title,
            "created_at": self.created_at,
            "created_by": self.created_by,
            "phase": self.phase,
            "status": self.status,
            "participants": [p.to_dict() for p in self.participants],
            "transcript": [e.to_dict() for e in self.transcript],
            "case_id": self.case_id,
            "case_context": self.case_context,
            "face_summaries": [f.to_dict() for f in self.face_summaries],
            "transcript_enabled": self.transcript_enabled,
        }

    def public_state(self) -> dict:
        """Room state safe to broadcast to all clients."""
        return {
            "room_id": self.room_id,
            "case_title": self.case_title,
            "case_id": self.case_id,
            "case_context": self.case_context,
            "phase": self.phase,
            "phase_options": TRIAL_PHASES,
            "status": self.status,
            "participants": [p.to_dict() for p in self.participants],
            "transcript": [e.to_dict() for e in self.transcript],
            "face_summaries": [f.to_dict() for f in self.face_summaries],
            "transcript_enabled": self.transcript_enabled,
        }


# ----------------------------------------------------------------------
# Manager — the singleton registry
# ----------------------------------------------------------------------

class CourtroomManager:
    """Thread-safe registry of active rooms with disk persistence."""

    def __init__(self, storage_dir: str = COURTROOMS_DIR):
        self.storage_dir = storage_dir
        self._rooms: dict[str, Room] = {}
        self._lock = threading.Lock()
        os.makedirs(self.storage_dir, exist_ok=True)

    # ---- room lifecycle ------------------------------------------------

    def create_room(self, case_title: str, created_by: str, case_id: str = "",
                    case_manager=None) -> Room:
        """Open a trial room, optionally linked to a registered case (ANV-…).

        When case_id is given and resolvable, the room stores the id and a
        case context snapshot (parties, evidence, how the evidence links
        together) so every participant sees what the trial is about and the
        deception report can check statements against the actual evidence.
        """
        room_id = self._new_room_id()
        room = Room(
            room_id=room_id,
            case_title=case_title.strip() or "Untitled Trial",
            created_at=_now_iso(),
            created_by=created_by.strip() or "Host",
            case_id=(case_id or "").strip(),
        )
        if room.case_id and case_manager is not None:
            case = case_manager.get_case(room.case_id)
            if case is not None:
                room.case_context = case_manager.build_case_context(room.case_id)
                # A linked trial is titled after the case unless the host typed one.
                if not case_title.strip():
                    room.case_title = case.title
            else:
                room.case_id = ""
        # Seed the transcript with a system line.
        room.add_entry("System", "system", "system",
                       f"Trial '{room.case_title}' opened by {room.created_by}.")
        if room.case_id:
            room.add_entry("System", "system", "system",
                           f"Linked to case {room.case_id} — the court record now has the case file context.")
        with self._lock:
            self._rooms[room_id] = room
            self._persist(room)
        return room

    def refresh_case_context(self, room_id: str, case_manager=None) -> Optional[dict]:
        """Rebuild the linked case's context snapshot (evidence changed).
        Returns the fresh context, or None when the room has no (valid) link."""
        room = self.get_room(room_id)
        if room is None or not room.case_id or case_manager is None:
            return None
        case = case_manager.get_case(room.case_id)
        if case is None:
            return None
        ctx = case_manager.build_case_context(room.case_id)
        with self._lock:
            room.case_context = ctx
            self._persist(room)
        return ctx

    def get_room(self, room_id: str) -> Optional[Room]:
        """Active room by id, falling back to disk if the server restarted."""
        with self._lock:
            if room_id in self._rooms:
                return self._rooms[room_id]
        # Try to (re)load from disk so old rooms are reopenable.
        room = self._load(room_id)
        if room is not None:
            with self._lock:
                self._rooms[room_id] = room
        return room

    def list_rooms(self) -> list[dict]:
        """All rooms: active in memory plus any persisted on disk."""
        seen: set[str] = set()
        out: list[dict] = []

        with self._lock:
            for room in self._rooms.values():
                seen.add(room.room_id)
                out.append(self._summary(room))

        # Pull any disk-only rooms (e.g. after a restart).
        if os.path.isdir(self.storage_dir):
            for fname in os.listdir(self.storage_dir):
                if not fname.endswith(".json"):
                    continue
                room_id = fname[:-5]
                if room_id in seen:
                    continue
                room = self._load(room_id)
                if room is not None:
                    out.append(self._summary(room))
                    seen.add(room_id)

        # Newest first.
        out.sort(key=lambda r: r["created_at"], reverse=True)
        return out

    # ---- roster + transcript mutations ---------------------------------

    def join_room(self, room_id: str, name: str, role: str) -> tuple[Room, Participant, str]:
        """Attach a participant. Returns (room, participant, display_role).

        Raises ValueError if the room is missing or the role is taken/invalid.
        """
        room = self.get_room(room_id)
        if room is None:
            raise ValueError("Room not found.")
        if role not in ALL_ROLES:
            raise ValueError(f"Unknown role '{role}'.")
        if room.status == "ended":
            raise ValueError("This trial session has ended and can no longer be joined.")

        with self._lock:
            if not room.role_available(role):
                raise ValueError(f"The role '{role}' is already taken in this trial.")

            participant = Participant(
                participant_id=_new_id("p"),
                name=name.strip() or "Anonymous",
                role=role,
                joined_at=_now_iso(),
            )
            room.add_participant(participant)

            display_role = ROLE_LABELS.get(role, role)
            if role == WITNESS_ROLE:
                # Give witnesses a numbered badge so the roster stays legible.
                display_role = f"Witness {room.witness_count()}"
            elif role in COUNSEL_ROLES:
                # Number a second/third counsel on the same side so the roster
                # can tell them apart (the first keeps the plain label).
                n = sum(1 for p in room.participants if p.role == role)
                if n > 1:
                    display_role = f"{display_role} {n}"

            room.add_entry(
                actor=participant.name,
                role=display_role,
                kind="system",
                text=f"{participant.name} ({display_role}) joined the court.",
            )
            self._persist(room)
        return room, participant, display_role

    def leave_room(self, room_id: str, participant_id: str) -> Optional[Participant]:
        room = self.get_room(room_id)
        if room is None:
            return None
        with self._lock:
            participant = room.remove_participant(participant_id)
            if participant is not None:
                display_role = ROLE_LABELS.get(participant.role, participant.role)
                room.add_entry(
                    actor=participant.name,
                    role=display_role,
                    kind="system",
                    text=f"{participant.name} ({display_role}) left the court.",
                )
                self._persist(room)
        return participant

    def delete_room(self, room_id: str) -> bool:
        """Permanently delete a trial room: memory, disk JSON, and audio clips.

        Returns True when anything was removed. Used by the dashboard's
        cleanup control for abandoned/ended sessions.
        """
        removed = False
        with self._lock:
            if room_id in self._rooms:
                del self._rooms[room_id]
                removed = True
        json_path = os.path.join(self.storage_dir, f"{room_id}.json")
        if os.path.exists(json_path):
            try:
                os.remove(json_path)
                removed = True
            except OSError:
                pass
        audio_dir = os.path.join(self.storage_dir, "audio", room_id)
        if os.path.isdir(audio_dir):
            import shutil
            shutil.rmtree(audio_dir, ignore_errors=True)
            removed = True
        return removed

    def set_transcript_enabled(self, room_id: str, enabled: bool) -> Optional[Room]:
        """Judge-controlled live-transcript visibility for the whole room.

        The record keeps being written while off — only the live view is hidden,
        so nothing is lost and the judge can turn it back on.
        """
        room = self.get_room(room_id)
        if room is None:
            return None
        enabled = bool(enabled)
        with self._lock:
            if room.transcript_enabled != enabled:
                room.transcript_enabled = enabled
                room.add_entry(
                    actor="Court",
                    role="system",
                    kind="system",
                    text=("The Presiding Judge turned the live transcript on."
                          if enabled else
                          "The Presiding Judge turned the live transcript off."),
                )
                self._persist(room)
        return room

    def end_room(self, room_id: str, ended_by: str) -> Optional[Room]:
        """Adjourn a trial: mark the room ended, set the phase to Concluded,
        and append a system entry. The transcript + roster stay on disk so the
        official record can still be exported; new joins are refused.

        Idempotent — ending an already-ended room is a no-op that returns it.
        """
        room = self.get_room(room_id)
        if room is None:
            return None
        with self._lock:
            if room.status != "ended":
                room.status = "ended"
                room.phase = "Concluded"
                room.add_entry(
                    actor=ended_by or "The Court",
                    role="system",
                    kind="system",
                    text="The Presiding Judge ended the session. The court stands adjourned.",
                )
                self._persist(room)
        return room

    def record_statement(self, room_id: str, participant_id: str, text: str,
                         audio_file: str = "") -> Optional[TranscriptEntry]:
        room = self.get_room(room_id)
        if room is None:
            return None
        p = room.get_participant(participant_id)
        if p is None:
            return None
        text = (text or "").strip()
        if not text:
            return None
        with self._lock:
            entry = room.add_entry(
                actor=p.name,
                role=ROLE_LABELS.get(p.role, p.role),
                kind="statement",
                text=text,
            )
            entry.audio_file = audio_file or ""
            self._persist(room)
        return entry

    # ---- spoken statements: assembly ------------------------------------
    def last_spoken_statement(self, room_id: str, participant_id: str) -> Optional[TranscriptEntry]:
        """The speaker's most recent spoken statement, or None.

        Used as the ASR continuation context: feeding whisper what this speaker
        just said lets a clip that starts mid-sentence be decoded as the rest of
        that sentence instead of an isolated fragment missing its edges.
        """
        room = self.get_room(room_id)
        if room is None:
            return None
        for entry in reversed(room.transcript):
            if entry.kind == "statement" and entry.speaker_id == participant_id:
                return entry
        return None

    def record_spoken_statement(self, room_id: str, participant_id: str, text: str,
                                audio_file: str = "", spoken_at: Optional[float] = None,
                                raw_text: str = "") -> tuple:
        """Append a transcribed speech segment, or CONTINUE the previous one.

        Returns (entry, replaces_entry_id). replaces_entry_id is empty when a
        new entry was created, and the id of the entry that was completed
        otherwise - the caller re-broadcasts with it so clients update that line
        in place instead of showing two halves of one sentence.
        """
        room = self.get_room(room_id)
        if room is None:
            return None, ""
        participant = room.get_participant(participant_id)
        if participant is None:
            return None, ""
        text = (text or "").strip()
        if not text:
            return None, ""
        role = ROLE_LABELS.get(participant.role, participant.role)
        # When the clip was SPOKEN (epoch seconds, from the client) — not when the
        # server finished transcribing it. Transcription takes 10-60 s, so the
        # server clock would make every consecutive segment look minutes apart and
        # no sentence would ever be completed.
        now_stamp = _stamp_for(spoken_at)
        with self._lock:
            previous = room.transcript[-1] if room.transcript else None
            replaces_id = ""
            if (previous is not None
                    and previous.kind == "statement"
                    and previous.speaker_id == participant_id
                    and _statement_continues(previous, text, spoken_at)):
                # Same utterance: extend the text, keep every clip, and move the
                # continuation clock to this segment.
                entry = previous
                replaces_id = previous.entry_id
                entry.text = ((entry.text.rstrip() + " " + text).strip()
                              [:STATEMENT_MAX_CHARS])
                if audio_file:
                    if not entry.audio_files:
                        entry.audio_files = [entry.audio_file] if entry.audio_file else []
                    entry.audio_files.append(audio_file)
                    if not entry.audio_file:
                        entry.audio_file = audio_file
                entry.last_segment_at = now_stamp
                entry.last_segment_raw = (raw_text or text).strip()
            else:
                entry = room.add_entry(
                    actor=participant.name,
                    role=role,
                    kind="statement",
                    text=text[:STATEMENT_MAX_CHARS],
                )
                entry.speaker_id = participant_id
                entry.audio_file = audio_file or ""
                entry.audio_files = [audio_file] if audio_file else []
                entry.last_segment_at = now_stamp
                entry.last_segment_raw = (raw_text or text).strip()
            self._persist(room)
        return entry, replaces_id

    def update_statement_text(self, room_id: str, entry_id: str, text: str) -> Optional[TranscriptEntry]:
        """Replace the text of one spoken statement (already-merged segments).

        Used after a merge to re-read the JOINED sentence as a whole: two
        separately corrected fragments read as two half-sentences, while the
        joined text is one complete statement. Only text is replaced - the
        timestamp, speaker, clips and entry id stay exactly as recorded.
        """
        text = (text or "").strip()
        if not text:
            return None
        room = self.get_room(room_id)
        if room is None:
            return None
        with self._lock:
            for entry in room.transcript:
                if entry.kind == "statement" and entry.entry_id == entry_id:
                    entry.text = text[:STATEMENT_MAX_CHARS]
                    self._persist(room)
                    return entry
        return None

    def record_action(self, room_id: str, participant_id: str, text: str) -> Optional[TranscriptEntry]:
        """A structured courtroom action (objection, ruling, examination call)."""
        room = self.get_room(room_id)
        if room is None:
            return None
        p = room.get_participant(participant_id)
        if p is None:
            return None
        text = (text or "").strip()
        if not text:
            return None
        with self._lock:
            entry = room.add_entry(
                actor=p.name,
                role=ROLE_LABELS.get(p.role, p.role),
                kind="action",
                text=text,
            )
            self._persist(room)
        return entry

    def record_face_summary(self, room_id: str, summary: dict) -> Optional[FaceSummary]:
        """Store the whole-session face/expression result for one analyzed feed.

        Called when the observer stops the analyzer (or the session ends) so
        the official record carries the balanced, session-long aggregate
        instead of only momentary cue logs.
        """
        room = self.get_room(room_id)
        if room is None:
            return None
        try:
            fs = FaceSummary(
                subject=str(summary.get("subject", "Unknown")),
                subject_role=str(summary.get("subject_role", "")),
                observer=str(summary.get("observer", "")),
                analyzed_source=str(summary.get("analyzed_source", "")),
                started_at=str(summary.get("started_at", "")),
                ended_at=str(summary.get("ended_at", "")),
                duration_sec=int(summary.get("duration_sec", 0) or 0),
                time_speaking_sec=int(summary.get("time_speaking_sec", 0) or 0),
                calm_sec=int(summary.get("calm_sec", 0) or 0),
                peak_index=int(summary.get("peak_index", 0) or 0),
                mean_index=int(summary.get("mean_index", 0) or 0),
                end_index=int(summary.get("end_index", 0) or 0),
                peak_during_speech=bool(summary.get("peak_during_speech", False)),
                counters=dict(summary.get("counters", {}) or {}),
                active_durations=dict(summary.get("active_durations", {}) or {}),
                cue_events=int(summary.get("cue_events", 0) or 0),
            )
        except (TypeError, ValueError):
            return None
        # Replace a previous summary for the same analyzed source (re-runs).
        with self._lock:
            room.face_summaries = [
                f for f in room.face_summaries
                if f.analyzed_source != fs.analyzed_source
            ]
            room.face_summaries.append(fs)
            self._persist(room)
        return fs

    def record_behavior(self, room_id: str, participant_id: str, text: str) -> Optional[TranscriptEntry]:
        """Log a face/expression analysis observation (nervousness cue).

        Produced by the client-side MediaPipe analyzer and appended to the
        official transcript so the court's record captures behavioural cues
        (lip pressing, rapid blinking, directional lateral gaze, ...).
        """
        room = self.get_room(room_id)
        if room is None:
            return None
        p = room.get_participant(participant_id)
        if p is None:
            return None
        text = (text or "").strip()
        if not text:
            return None
        with self._lock:
            entry = room.add_entry(
                actor=p.name,
                role=ROLE_LABELS.get(p.role, p.role),
                kind="behavior",
                text=text,
            )
            self._persist(room)
        return entry

    def set_phase(self, room_id: str, phase: str) -> Optional[TranscriptEntry]:
        room = self.get_room(room_id)
        if room is None:
            return None
        if phase not in TRIAL_PHASES:
            return None
        with self._lock:
            previous = room.phase
            if previous == phase:
                return None
            room.phase = phase
            entry = room.add_entry(
                actor="Court",
                role="system",
                kind="phase",
                text=f"Proceedings moved to the {phase} phase.",
            )
            self._persist(room)
        return entry

    # ---- export --------------------------------------------------------

    def export_markdown(self, room_id: str) -> Optional[str]:
        """Render the full transcript as Markdown."""
        room = self.get_room(room_id)
        if room is None:
            return None
        return room_to_markdown(room)

    # ---- internals -----------------------------------------------------

    def _summary(self, room: Room) -> dict:
        return {
            "room_id": room.room_id,
            "case_title": room.case_title,
            "created_at": room.created_at,
            "created_by": room.created_by,
            "phase": room.phase,
            "participant_count": len(room.participants),
            "transcript_entries": len(room.transcript),
            "status": room.status,
            "active": room.room_id in self._rooms,
            "case_id": room.case_id,
        }

    def _persist(self, room: Room) -> None:
        """Write the room to disk. Caller already holds the lock."""
        path = os.path.join(self.storage_dir, f"{room.room_id}.json")
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(room.to_dict(), f, indent=2, ensure_ascii=False)
        os.replace(tmp, path)

    def _load(self, room_id: str) -> Optional[Room]:
        path = os.path.join(self.storage_dir, f"{room_id}.json")
        if not os.path.exists(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return _room_from_dict(data)
        except (json.JSONDecodeError, KeyError, TypeError):
            return None

    def _new_room_id(self) -> str:
        # 4-char human-friendly id; collision-checked against memory + disk.
        for _ in range(20):
            candidate = secrets.token_hex(2).upper()  # e.g. "A4F2"
            if candidate not in self._rooms and not os.path.exists(
                os.path.join(self.storage_dir, f"{candidate}.json")
            ):
                return candidate
        # Extremely unlikely fallback.
        return secrets.token_hex(3).upper()


# ----------------------------------------------------------------------
# Markdown export
# ----------------------------------------------------------------------

def room_to_markdown(room: Room) -> str:
    lines: list[str] = []
    lines.append(f"# Courtroom Transcript — {room.case_title}")
    lines.append("")
    lines.append(f"- **Room ID:** {room.room_id}")
    lines.append(f"- **Opened:** {_format_dt(room.created_at)}")
    lines.append(f"- **Opened by:** {room.created_by}")
    lines.append(f"- **Final phase:** {room.phase}")
    if room.case_id:
        lines.append(f"- **Linked case:** {room.case_id}")
    lines.append("")

    if room.case_context:
        lines.append("## Case Context")
        lines.append("")
        ctx = room.case_context
        lines.append(f"- **Case:** {ctx.get('title', '')} ({ctx.get('case_id', '')})")
        if ctx.get("case_level_priority"):
            lines.append(f"- **Whole-case priority:** {ctx.get('case_level_priority')} (Decision Tree on merged evidence)")
            if ctx.get("case_level_summary"):
                lines.append(f"- **Whole-case summary:** {ctx.get('case_level_summary')}")
        elif ctx.get("aggregate_priority"):
            lines.append(f"- **Aggregate priority:** {ctx.get('aggregate_priority')}")
        parties = ctx.get("parties") or []
        if parties:
            lines.append(f"- **Main parties:** {', '.join(parties)}")
        lines.append("")
        if ctx.get("evidence"):
            lines.append("### Evidence on record")
            lines.append("")
            for ev in ctx["evidence"]:
                lines.append(
                    f"- **{ev.get('filename', '')}** ({ev.get('doc_type', '')}) — "
                    f"{ev.get('priority') or 'not analysed'}. {ev.get('summary', '')}"
                )
            lines.append("")
        if ctx.get("evidence_links"):
            lines.append("### How the evidence links together")
            lines.append("")
            lines.append(ctx["evidence_links"])
            lines.append("")

    if room.participants:
        lines.append("## Participants")
        lines.append("")
        for p in room.participants:
            label = ROLE_LABELS.get(p.role, p.role)
            lines.append(f"- {p.name} — {label}")
        lines.append("")

    lines.append("## Proceedings")
    lines.append("")
    for entry in room.transcript:
        ts = _format_dt(entry.timestamp)
        if entry.kind == "system":
            lines.append(f"_{ts} — {entry.text}_")
        elif entry.kind == "phase":
            lines.append(f"### {entry.text}")
        elif entry.kind == "action":
            lines.append(f"**[{ts}] {entry.role} ({entry.actor}):** *{entry.text}*")
        elif entry.kind == "behavior":
            lines.append(f"⚠ **[{ts}] {entry.role} ({entry.actor}):** _{entry.text}_")
        else:  # statement
            lines.append(f"**[{ts}] {entry.role} ({entry.actor}):** {entry.text}")
            for clip in (entry.audio_files or ([entry.audio_file] if entry.audio_file else [])):
                lines.append(f"    🎙 _audio: {clip}_")
        lines.append("")

    if room.face_summaries:
        lines.append("## Face & Expression — Session Summary")
        lines.append("")
        for f in room.face_summaries:
            lines.append(f"### {f.subject} ({f.subject_role})")
            lines.append("")
            lines.append(
                f"- Observed for {f.duration_sec}s ({f.time_speaking_sec}s speaking) — "
                f"peak index {f.peak_index}%, session average {f.mean_index}%."
            )
            lines.append(
                f"- Calm {f.calm_sec}s of {f.duration_sec}s; "
                f"{f.cue_events} cue episode(s)."
            )
            if f.counters:
                totals = ", ".join(
                    f"{name.replace('_', ' ')} {int(sec)}s"
                    for name, sec in sorted(f.counters.items(), key=lambda kv: -kv[1])
                )
                lines.append(f"- Cues: {totals}.")
            lines.append("")

    return "\n".join(lines).rstrip() + "\n"


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------

def _statement_continues(previous: TranscriptEntry, text: str,
                         spoken_at: Optional[float] = None) -> bool:
    """Whether a new segment is the tail of `previous` rather than a new statement.

    Two cheap, explainable signals:
      * TIME  - the clip was SPOKEN inside STATEMENT_CONTINUATION_GAP_MS of the
        previous one: the speaker paused, or released the key mid-sentence.
      * SHAPE - the previous segment did not finish a sentence (an ellipsis, or
        no terminal punctuation).
    A wider gap, a finished sentence, or a different speaker starts a new entry.
    """
    if len(previous.text) >= STATEMENT_MAX_CHARS:
        return False
    then = _epoch_of(previous.last_segment_at or previous.timestamp)
    if then is None:
        return False
    # The gap is between the two clips being SPOKEN - both stamped with the
    # client's clock when the client supplies it - never between the two uploads:
    # transcription takes 10-60 s, so the server clock would make every
    # consecutive segment of one sentence look minutes apart.
    now_s = spoken_at if spoken_at else datetime.now(timezone.utc).timestamp()
    gap_ms = (now_s - then) * 1000
    if gap_ms > STATEMENT_CONTINUATION_GAP_MS:
        return False
    # A large NEGATIVE gap means the two stamps cannot be compared (a segment
    # from a client that did not report spoken time, against one that did): be
    # conservative and start a new entry rather than gluing unrelated speech.
    if gap_ms < -STATEMENT_CONTINUATION_GAP_MS:
        return False
    # "Did the sentence finish?" is read from the RAW recogniser text whenever it
    # is available, because that is where a cut-off shows up: whisper ends such a
    # clip with an ellipsis or with no punctuation at all, while the grammar
    # correction may have tidied it into a complete-looking sentence.
    tail = (previous.last_segment_raw or previous.text).rstrip()
    if not tail:
        return False
    if tail.endswith("...") or tail.endswith("\u2026"):
        return True          # the recogniser heard the sentence break off
    return tail[-1] not in ".!?"


def _stamp_for(spoken_at: Optional[float]) -> str:
    """The moment a speech segment was SPOKEN, as an ISO string.

    spoken_at (epoch seconds, sent by the client with the clip) wins; without it
    the server clock is the only thing available. Everything is written in UTC so
    stamps from the browser and from the server can be compared directly.
    """
    if spoken_at:
        try:
            return datetime.fromtimestamp(float(spoken_at), tz=timezone.utc).isoformat(
                timespec="seconds")
        except (TypeError, ValueError, OSError, OverflowError):
            pass
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _epoch_of(stamp: str) -> Optional[float]:
    """ISO stamp -> epoch seconds. Naive stamps are read as UTC (see _stamp_for)."""
    try:
        dt = datetime.fromisoformat(stamp)
    except (TypeError, ValueError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


def _now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _format_dt(iso: str) -> str:
    """ISO -> 'YYYY-MM-DD HH:MM' for human display."""
    try:
        return datetime.fromisoformat(iso).strftime("%Y-%m-%d %H:%M")
    except (ValueError, TypeError):
        return iso


def _new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(4)}"


def _room_from_dict(data: dict) -> Room:
    participants = [Participant(**p) for p in data.get("participants", [])]
    transcript = [TranscriptEntry(**e) for e in data.get("transcript", [])]
    face_summaries = [FaceSummary(**f) for f in data.get("face_summaries", [])]
    return Room(
        room_id=data["room_id"],
        case_title=data.get("case_title", "Untitled Trial"),
        created_at=data.get("created_at", _now_iso()),
        created_by=data.get("created_by", "Unknown"),
        phase=data.get("phase", TRIAL_PHASES[0]),
        status=data.get("status", "live"),
        participants=participants,
        transcript=transcript,
        case_id=data.get("case_id", ""),
        case_context=data.get("case_context", {}),
        face_summaries=face_summaries,
        transcript_enabled=bool(data.get("transcript_enabled", True)),
    )


# Module-level singleton used by app.py.
manager = CourtroomManager()
