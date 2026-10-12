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
import re
import threading
import time

import requests

# Config.
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")

# Whisper domain vocabulary prompt. Providing domain terms biases the decoder
# toward correct courtroom spellings (e.g. 'Your Honour', 'Judge', 'FIR')
# without confusing the decoder with conversational instruction text.
COURT_ASR_PROMPT = (
    "Indian courtroom proceeding: Your Honour, Your Lordship, Judge, "
    "Defence Counsel, Prosecution, Witness, objection, sustained, "
    "overruled, affidavit, FIR, IPC, CrPC, bail, exhibit, evidence."
)

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


def _make_room_for_asr():
    """Free GPU memory held by Ollama's correction LLM before whisper runs.

    On a 4 GiB GPU (RTX 2050), Ollama's qwen2.5:3b stays resident at ~2.16 GB
    and can leave whisper almost no VRAM headroom (measured 79 MiB free once
    both are loaded) — a real speech segment could then OOM mid-transcription,
    which whisper reports as failure and the statement is silently dropped.

    Unloading qwen (keep_alive=0) right before transcribing hands whisper the
    whole GPU; the grammar-correction step that follows reloads qwen on demand.
    On a 4 GiB GPU (RTX 2050) Ollama's qwen2.5:3b sits resident at ~2.16 GiB
    and torch's CUDA context + whisper-small add ~1.7 GiB more — that leaves
    almost no headroom (measured ~150 MiB free), and free memory also swings
    with browser GPU usage. A real speech segment could then OOM
    mid-transcription, which whisper reports as failure and the statement is
    silently dropped. So whenever qwen is resident (checked via /api/ps) it is
    unloaded before whisper runs; the grammar-correction step that follows
    reloads it on demand. No-op when qwen is not loaded or there is no CUDA
    torch (whisper is CPU-bound there).
    """
    try:
        import torch
        if not torch.cuda.is_available():
            return
    except Exception:
        return
    # Only bother unloading if the Ollama model is actually resident.
    try:
        r = requests.get(f"{OLLAMA_URL.rstrip('/')}/api/ps", timeout=8)
        r.raise_for_status()
        loaded = [m.get("name", "") for m in (r.json().get("models") or [])]
        if not any(OLLAMA_MODEL in name for name in loaded):
            return
    except Exception:
        return
    try:
        print(f"Unloading Ollama model '{OLLAMA_MODEL}' to free VRAM for ASR.")
        r = requests.post(
            f"{OLLAMA_URL.rstrip('/')}/api/generate",
            json={"model": OLLAMA_MODEL, "keep_alive": 0},
            timeout=8,
        )
        r.raise_for_status()
        # Give llama-server a beat to release the VRAM context.
        time.sleep(0.6)
    except Exception as e:
        print(f"Ollama VRAM pre-free skipped: {e}")


def transcribe_audio(audio_path: str, context_text: str = "") -> str | None:
    """Transcribe a WAV file with openai-whisper. Returns text or None.

    context_text (optional) is what this speaker said in the previous segment.
    It goes into the decoder's initial prompt, so a clip that starts
    mid-sentence is decoded as the CONTINUATION of that sentence: the recogniser
    keeps the sentence (and its vocabulary) going instead of re-hearing an
    isolated fragment and dropping the words at its edges.

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

    # Free VRAM held by the Ollama correction model so whisper has room.
    _make_room_for_asr()

    try:
        audio = _read_wav_np(audio_path)
    except Exception as e:
        print(f"Could not decode audio {audio_path}: {e}")
        return None

    with _whisper_lock:
        try:
            model, use_fp16 = _load_whisper_model()
            prompt = COURT_ASR_PROMPT
            if context_text:
                said = " ".join(context_text.split())[-150:]
                prompt = f"{COURT_ASR_PROMPT} Context: {said}"
            result = model.transcribe(
                audio,
                language="en",
                fp16=use_fp16,
                task="transcribe",
                temperature=0.0,
                initial_prompt=prompt,
                # Greedy decoding drops words on accented speech and can loop; the
                # courtroom clips are short, so beam search costs little and is
                # markedly more accurate on them. (Beam search is only used at
                # temperature 0, which is what we ask for.)
                beam_size=5,
                # Continuity is supplied explicitly through initial_prompt above.
                # Letting the model also condition on its own previous output is
                # how whisper starts repeating the same phrase.
                condition_on_previous_text=False,
            )
        except Exception as e:
            print(f"Whisper transcription failed: {e}")
            return None

    text = (result.get("text") or "").strip()
    if not text:
        return None
    # Collapse whitespace/newlines whisper may leave in.
    return " ".join(text.split())


def _breaks_off(text: str) -> bool:
    """True when the speech broke off mid-sentence (ellipsis, or no full stop)."""
    stripped = (text or "").strip()
    if not stripped:
        return False
    if stripped.endswith("...") or stripped.endswith("\u2026"):
        return True
    return stripped[-1] not in ".!?"


def _grew(corrected: str, raw: str) -> bool:
    """True when the correction added more than cosmetic words to the tail."""
    return len(corrected.split()) > len(raw.split()) + 2


def _is_invalid_correction(corrected: str, raw: str) -> bool:
    """Verifies that the LLM output is a faithful, verbatim formatting of raw speech.

    Rejects AI refusals, conversational commentary, and rephrased words.
    A court transcript MUST reflect what was actually spoken word-for-word.
    """
    if not corrected or not raw:
        return True
    c_lower = corrected.lower().strip()

    # 1. Refusal / meta-commentary check
    refusals = [
        "cannot produce", "can't produce", "cannot fulfill", "as an ai",
        "input provided does not", "not match the specified", "the input appears",
        "informal spoken statement", "court record", "i apologize", "here is the",
        "corrected statement", "transcript:", "note:", "disclaimer:", "as a court reporter"
    ]
    if any(r in c_lower for r in refusals):
        return True

    # 2. Word extraction & preservation check
    raw_words = re.findall(r"\b\w+\b", raw.lower())
    corr_words = re.findall(r"\b\w+\b", corrected.lower())
    if not raw_words or not corr_words:
        return True

    # Word count sanity check (cannot change length drastically)
    if abs(len(corr_words) - len(raw_words)) > max(2, int(len(raw_words) * 0.20)):
        return True

    raw_set = set(raw_words)
    corr_set = set(corr_words)
    if not raw_set or not corr_set:
        return True

    # Overlap check: at least 80% of raw words must be retained
    overlap = len(raw_set & corr_set)
    if (overlap / len(raw_set)) < 0.80:
        return True

    # Check for significant new content words introduced by LLM
    new_words = corr_set - raw_set
    particles = {"a", "an", "the", "to", "in", "of", "and", "or", "is", "are", "was", "were"}
    significant_new = new_words - particles
    if len(significant_new) > 0 and len(raw_words) < 8:
        return True
    if len(significant_new) > max(1, int(len(raw_words) * 0.15)):
        return True

    return False


def correct_transcript_text(text: str, context_hint: str = "") -> tuple[str, bool]:
    """Format and punctuate a spoken statement with strict verbatim preservation.

    A courtroom transcript is legal evidence and must record what was actually spoken
    word-for-word without rephrasing, omitting, or substituting terms.
    Short statements (<= 4 words) are returned directly from Whisper to prevent
    hallucination and reduce latency.
    Returns (formatted_text, used_llm).
    """
    text = (text or "").strip()
    if not text:
        return "", False

    # Short utterances (e.g. "Hello bro", "Yes, Your Honour", "One minute", "No")
    # are already cleanly punctuated by Whisper; skipping the LLM guarantees verbatim accuracy
    # and eliminates LLM refusal on casual/short speech.
    if len(text.split()) <= 4:
        return text, False

    context_block = ""
    if context_hint:
        context_block = (
            f"Case context terms for reference: {context_hint.strip()[:600]}\n"
        )

    system_prompt = (
        "You are an exact courtroom stenographer and transcription formatter.\n"
        "Your task is to punctuate and format the exact spoken words below into a clean court transcript.\n\n"
        "STRICT VERBATIM RULES:\n"
        "1. PRESERVE EVERY WORD: Do NOT change, replace, remove, or substitute ANY words.\n"
        "2. DO NOT FORMALIZE: If the speaker used casual, colloquial, or informal speech (such as 'bro', 'yeah', 'gonna', 'like'), keep their exact words.\n"
        "3. DO NOT INVENT: Do NOT add facts, words, or endings the speaker did not say.\n"
        "4. DO NOT REFUSE: Never output commentary, refusals, explanations, or notes.\n"
        "5. ONLY FIX: Capitalization (capitalize proper nouns, 'Your Honour', and start of sentences) and standard punctuation (periods, commas, question marks).\n"
        f"{context_block}"
        "Output ONLY the formatted statement."
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
            f"{OLLAMA_URL.rstrip('/')}/api/chat", json=payload_body, timeout=20
        )
        r.raise_for_status()
        data = r.json()
        corrected = (data.get("message") or {}).get("content", "").strip()
        if corrected.startswith('"') and corrected.endswith('"') and len(corrected) > 2:
            corrected = corrected[1:-1].strip()

        if corrected:
            # Fidelity guard against inventing endings on cut-off speech
            if _breaks_off(text) and not _breaks_off(corrected) and _grew(corrected, text):
                print("Transcript correction invented an ending - keeping verbatim raw text.")
                return text, False
            # Strict verbatim fidelity check
            if _is_invalid_correction(corrected, text):
                print(f"Transcript correction altered spoken words or refused - keeping verbatim raw text: '{text}'")
                return text, False
            return corrected, True
    except Exception as e:
        print(f"Transcript correction via Ollama skipped/failed: {e}")
    return text, False
