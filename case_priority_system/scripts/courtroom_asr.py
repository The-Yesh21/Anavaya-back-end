"""
Courtroom speech-to-text + grammar correction.

Transcription
-------------
Speech-to-text runs on the openai-whisper model (torch, NVIDIA GPU when
present). Ollama's whisper models were removed from its library, so this is
the reliable local ASR path. The client records each speech segment and
uploads it as 16 kHz mono WAV; we read it with the stdlib `wave` module and
pass a numpy array straight into whisper (no ffmpeg dependency needed).

The raw transcription is then passed through the Ollama chat LLM
(qwen2.5:3b) for grammar/punctuation cleanup so the official record reads
cleanly. Both steps degrade gracefully: if whisper is unavailable the caller
falls back to the browser's speech recognition; if the correction LLM is
down the raw transcription is used unchanged.

Config (env vars, same convention as the rest of the app):
    WHISPER_MODEL   whisper model name, default "small" (~460 MB, cached in
                    ~/.cache/whisper on first use; "base"/"tiny" are smaller)
    OLLAMA_URL      default http://localhost:11434
    OLLAMA_MODEL    correction LLM, default qwen2.5:3b
"""

from __future__ import annotations

import os
import threading
import time

import requests

# Config.
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")

# The whisper package is imported lazily (importing it pulls in torch, which
# costs seconds and can fail on Windows). Availability is cached; negatives
# are re-probed so an install mid-session is picked up without a restart.
_asr_available: bool | None = None
_asr_checked_at: float = 0.0
_NEGATIVE_PROBE_TTL_S = 15.0

# The loaded model + device, plus a lock so concurrent courtroom segments
# (multiple participants) never race on the shared model / CUDA context.
_whisper_model = None
_whisper_use_fp16 = False
_whisper_lock = threading.Lock()


def whisper_available() -> bool:
    """Whether the openai-whisper ASR engine is importable."""
    global _asr_available, _asr_checked_at
    if _asr_available is True:
        return True
    now = time.time()
    if _asr_available is False and now - _asr_checked_at < _NEGATIVE_PROBE_TTL_S:
        return False
    _asr_checked_at = now
    try:
        import whisper  # noqa: F401  (lazy: pulls in torch)
        _asr_available = True
    except Exception as e:
        print(f"Whisper ASR unavailable: {e}")
        _asr_available = False
    return _asr_available


def _load_whisper_model():
    """Load (once) and return (model, use_fp16). Caller holds _whisper_lock."""
    global _whisper_model, _whisper_use_fp16
    if _whisper_model is None:
        import torch
        import whisper

        _whisper_model = whisper.load_model(WHISPER_MODEL)
        _whisper_use_fp16 = torch.cuda.is_available()
        device = "cuda" if _whisper_use_fp16 else "cpu"
        print(f"Whisper model '{WHISPER_MODEL}' loaded on {device}.")
    return _whisper_model, _whisper_use_fp16


def _read_wav_np(path: str):
    """Read a WAV file as a float32 mono 16 kHz numpy array.

    Uses only the stdlib `wave` module, so whisper never needs ffmpeg for the
    WAV segments the courtroom client produces.
    """
    import numpy as np
    import wave

    with wave.open(path, "rb") as w:
        rate = w.getframerate()
        channels = w.getnchannels()
        width = w.getsampwidth()
        frames = w.readframes(w.getnframes())

    if width == 2:
        data = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    elif width == 4:
        data = np.frombuffer(frames, dtype=np.int32).astype(np.float32) / 2147483648.0
    else:
        raise ValueError(f"Unsupported WAV sample width: {width}")

    if channels > 1:
        data = data.reshape(-1, channels).mean(axis=1)

    # whisper expects 16 kHz mono; linear resample if needed.
    if rate != 16000:
        n = max(1, int(len(data) * 16000 / rate))
        data = np.interp(np.linspace(0, len(data) - 1, n), np.arange(len(data)), data)

    return data.astype(np.float32)


def transcribe_audio(audio_path: str) -> str | None:
    """Transcribe a WAV file with openai-whisper. Returns text or None.

    The model is loaded lazily on the first call (a one-time ~460 MB download
    for "small") and cached afterwards.
    """
    if not whisper_available() or not os.path.exists(audio_path):
        return None
    try:
        import numpy as np
        import whisper  # noqa: F401
    except ImportError:
        return None

    try:
        audio = _read_wav_np(audio_path)
    except Exception as e:
        print(f"Could not decode audio {audio_path}: {e}")
        return None

    with _whisper_lock:
        try:
            model, use_fp16 = _load_whisper_model()
            result = model.transcribe(
                audio,
                language="en",
                fp16=use_fp16,
                task="transcribe",
                temperature=0.0,
            )
        except Exception as e:
            print(f"Whisper transcription failed: {e}")
            return None

    text = (result.get("text") or "").strip()
    if not text:
        return None
    # Collapse whitespace/newlines whisper may leave in.
    return " ".join(text.split())


def correct_transcript_text(text: str) -> tuple[str, bool]:
    """Clean up a spoken statement with the Ollama chat LLM.

    Fixes punctuation/capitalization/grammar and makes the sentence flow
    naturally without changing its meaning. Returns (corrected_text,
    used_llm). If Ollama is unavailable the text is returned unchanged.
    """
    text = (text or "").strip()
    if not text:
        return "", False

    system_prompt = (
        "You are a senior court reporter finalizing the official record of an "
        "Indian court proceeding. The text below is raw automatic speech "
        "recognition of a spoken statement: it may contain misheard words, "
        "informal or broken grammar, fillers, and run-on sentences.\n\n"
        "Produce the corrected statement exactly as it should read in the "
        "official record:\n"
        "1. Fix speech-recognition errors: replace obviously misheard or "
        "garbled words with the word the speaker clearly intended, using the "
        "surrounding context (e.g. 'ware house' to 'warehouse', 'your honour' "
        "to 'Your Honour', 'he clearly seen the whole incident happened' to "
        "'he clearly saw the incident take place').\n"
        "2. Correct all grammar: subject-verb agreement, tense, articles, "
        "pronouns, and word order.\n"
        "3. Remove fillers and repeated words ('uh', 'um', 'actually', 'you "
        "know').\n"
        "4. Punctuate and capitalize correctly; write times, dates, and amounts "
        "in their natural formal form (6:30 pm, 12 June).\n"
        "5. Rewrite informal or fragmented phrasing into clear, formal, neutral "
        "language fit for an official record, keeping the speaker's sequence of "
        "events intact. Do not summarize, shorten, or omit anything.\n\n"
        "HARD RULES:\n"
        "- Keep every proper name (persons, companies, courts, places), date, "
        "number, amount, and legal citation EXACTLY as recognised. Never "
        "change, guess, or invent a name or figure, even if it seems wrong.\n"
        "- Never add facts the speaker did not say.\n"
        "- Output only the corrected statement, with no preamble, explanation, "
        "or commentary."
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
