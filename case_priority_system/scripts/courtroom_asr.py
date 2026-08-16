"""
Courtroom speech-to-text + grammar correction via the local Ollama server.

Transcription
-------------
Ollama's /api/generate endpoint cannot receive raw audio. The community
whisper models (whisper-small, whisper-large-v3, ...) work by reading a
*file path* from the prompt: their custom runner loads the audio file from
the server's filesystem and transcribes it. So the flow is:

    1. Client records a speech segment and uploads it as WAV (16 kHz mono).
    2. The server writes it to disk.
    3. We POST /api/generate with {model: whisper-small, prompt: <path>}.
    4. The whisper runner transcribes the file; the response field holds the
       transcription (a JSON blob for the whisper models, parsed defensively).

The transcription is then passed through the chat LLM (qwen2.5:3b) for
grammar/punctuation cleanup so the official record reads cleanly. Both steps
degrade gracefully: if whisper is unavailable the caller falls back to the
browser's speech recognition; if the correction LLM is down the raw
transcription is used unchanged.
"""

from __future__ import annotations

import json
import os
import time

import requests

# Config (same env convention as the rest of the app).
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
OLLAMA_WHISPER_MODEL = os.getenv("OLLAMA_WHISPER_MODEL", "whisper-small")

# Once whisper is seen it stays cached; a negative probe is re-checked so a
# model pulled mid-session is picked up without a restart.
_whisper_available: bool | None = None
_whisper_checked_at: float = 0.0
_NEGATIVE_PROBE_TTL_S = 15.0


def whisper_available() -> bool:
    """Whether an Ollama whisper model is installed and reachable.

    Checks /api/tags (fast, localhost). Positive results are cached forever;
    negatives are re-probed every few seconds.
    """
    global _whisper_available, _whisper_checked_at
    if _whisper_available is True:
        return True
    now = time.time()
    if _whisper_available is False and now - _whisper_checked_at < _NEGATIVE_PROBE_TTL_S:
        return False
    _whisper_checked_at = now
    try:
        r = requests.get(f"{OLLAMA_URL.rstrip('/')}/api/tags", timeout=3)
        r.raise_for_status()
        models = [m.get("name", "") for m in r.json().get("models", [])]
        _whisper_available = any(name.split(":")[0].lower().startswith("whisper") for name in models)
    except Exception:
        _whisper_available = False
    return _whisper_available


def transcribe_audio(audio_path: str) -> str | None:
    """Transcribe a WAV file on disk with Ollama whisper. Returns text or None.

    The prompt is the absolute file path: the whisper runner reads the file
    itself (Ollama's API has no binary audio input). The response is parsed
    defensively because the whisper models return a JSON blob.
    """
    if not whisper_available() or not os.path.exists(audio_path):
        return None
    try:
        payload = {
            "model": OLLAMA_WHISPER_MODEL,
            "prompt": os.path.abspath(audio_path),
            "stream": False,
        }
        r = requests.post(
            f"{OLLAMA_URL.rstrip('/')}/api/generate", json=payload, timeout=180
        )
        if r.status_code == 404:
            # Model not installed locally — treat as unavailable.
            _whisper_available = False  # type: ignore[assignment]
            return None
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        print(f"Ollama whisper transcription failed: {e}")
        return None

    raw = (data.get("response") or "").strip()
    if not raw:
        return None

    # whisper models return a JSON object like {"text": ..., "segments": [...]}.
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            text = parsed.get("text") or ""
            if not text and parsed.get("transcription"):
                text = parsed["transcription"].get("text", "")
            if not text and parsed.get("segments"):
                text = " ".join(
                    seg.get("text", "") for seg in parsed["segments"] if isinstance(seg, dict)
                )
            if text and text.strip():
                return text.strip()
    except (ValueError, TypeError, AttributeError):
        pass

    return raw or None


def correct_transcript_text(text: str) -> tuple[str, bool]:
    """Clean up a spoken statement with the chat LLM.

    Fixes punctuation/capitalization/grammar and makes the sentence flow
    naturally without changing its meaning. Returns (corrected_text,
    used_llm). If Ollama is unavailable the text is returned unchanged.
    """
    text = (text or "").strip()
    if not text:
        return "", False

    try:
        import requests as _requests  # already imported above
    except ImportError:
        return text, False

    system_prompt = (
        "You are a courtroom transcript editor for the official record of an "
        "Indian court proceeding. Correct the punctuation, capitalization, and "
        "grammar of the speaker's words and make the sentence flow naturally. "
        "Keep the exact meaning and keep every fact, name, number, and legal "
        "term exactly as spoken: do not add, remove, or invent anything. "
        "Output only the corrected text."
    )
    payload_body = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ],
        "stream": False,
        "think": False,
        "options": {"temperature": 0, "num_predict": 512},
    }
    try:
        r = requests.post(
            f"{OLLAMA_URL.rstrip('/')}/api/chat", json=payload_body, timeout=60
        )
        r.raise_for_status()
        data = r.json()
        corrected = (data.get("message") or {}).get("content", "").strip()
        if corrected:
            return corrected, True
    except Exception as e:
        print(f"Transcript correction via Ollama failed: {e}")
    return text, False
