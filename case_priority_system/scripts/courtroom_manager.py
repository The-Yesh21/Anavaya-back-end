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
from datetime import datetime
from typing import Optional


# Where room JSON files live (relative to the repo root, like the other paths).
COURTROOMS_DIR = "case_priority_system/courtrooms"

# The roles a participant may hold. Judge/Defence/Prosecution are unique;
# Witness may repeat (Witness 1, Witness 2, ...).
UNIQUE_ROLES = ("Judge", "Defence", "Prosecution")
WITNESS_ROLE = "Witness"

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

    kind values: 'statement' | 'action' | 'phase' | 'system'

    audio_file is the stored recording of a spoken statement (filename
    inside the room's audio dir). Empty for typed/action/system entries.
    """

    timestamp: str
    actor: str
    role: str
    kind: str
    text: str
    audio_file: str = ""

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
    participants: list[Participant] = field(default_factory=list)
    transcript: list[TranscriptEntry] = field(default_factory=list)

    # ---- roster helpers -------------------------------------------------

    def participant_ids(self) -> list[str]:
        return [p.participant_id for p in self.participants]

    def roles_taken(self) -> set[str]:
        """Unique roles only. Witnesses collapse to a single 'Witness'."""
        return {p.role for p in self.participants}

    def witness_count(self) -> int:
        return sum(1 for p in self.participants if p.role == WITNESS_ROLE)

    def role_available(self, role: str) -> bool:
        if role == WITNESS_ROLE:
            # Witnesses are unlimited for the demo.
            return True
        return role not in self.roles_taken()

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
            "participants": [p.to_dict() for p in self.participants],
            "transcript": [e.to_dict() for e in self.transcript],
        }

    def public_state(self) -> dict:
        """Room state safe to broadcast to all clients."""
        return {
            "room_id": self.room_id,
            "case_title": self.case_title,
            "phase": self.phase,
            "phase_options": TRIAL_PHASES,
            "participants": [p.to_dict() for p in self.participants],
            "transcript": [e.to_dict() for e in self.transcript],
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

    def create_room(self, case_title: str, created_by: str) -> Room:
        room_id = self._new_room_id()
        room = Room(
            room_id=room_id,
            case_title=case_title.strip() or "Untitled Trial",
            created_at=_now_iso(),
            created_by=created_by.strip() or "Host",
        )
        # Seed the transcript with a system line.
        room.add_entry("System", "system", "system",
                       f"Trial '{room.case_title}' opened by {room.created_by}.")
        with self._lock:
            self._rooms[room_id] = room
            self._persist(room)
        return room

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
        if role not in UNIQUE_ROLES and role != WITNESS_ROLE:
            raise ValueError(f"Unknown role '{role}'.")

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
            "active": room.room_id in self._rooms,
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
        else:  # statement
            lines.append(f"**[{ts}] {entry.role} ({entry.actor}):** {entry.text}")
            if entry.audio_file:
                lines.append(f"    🎙 _audio: {entry.audio_file}_")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------

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
    return Room(
        room_id=data["room_id"],
        case_title=data.get("case_title", "Untitled Trial"),
        created_at=data.get("created_at", _now_iso()),
        created_by=data.get("created_by", "Unknown"),
        phase=data.get("phase", TRIAL_PHASES[0]),
        participants=participants,
        transcript=transcript,
    )


# Module-level singleton used by app.py.
manager = CourtroomManager()
