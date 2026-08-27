#!/usr/bin/env python3
"""
Courtroom Speech-to-Text Test Script
=====================================

Two modes:
  1. SINGLE SHOT (default): record for N seconds, transcribe once, print result.
  2. LIVE (--live): continuous recording — transcribes every few seconds and
     appends to a running transcript until you press Enter or Ctrl+C.

Usage (from repo root):
    python test_speech_recognition.py                    # single shot, 8s
    python test_speech_recognition.py --duration 10      # single shot, 10s
    python test_speech_recognition.py --live              # continuous mode
    python test_speech_recognition.py --live --chunk 5   # transcribe every 5s
    python test_speech_recognition.py --device 1         # pick mic by index
    python test_speech_recognition.py --no-correct       # skip Ollama step

Requires: sounddevice, numpy, openai-whisper
Optional: Ollama running locally with qwen2.5:3b (grammar correction)
"""

from __future__ import annotations

import argparse
import os
import signal
import sys
import tempfile
import threading
import time
import wave

import numpy as np
import sounddevice as sd


# ---------------------------------------------------------------------------
# Device listing
# ---------------------------------------------------------------------------

def list_input_devices():
    """Print all available input (capture) devices and return their indices."""
    devices = sd.query_devices()
    input_devices = []
    print("\n  Available input devices:\n")
    for i, d in enumerate(devices):
        if d["max_input_channels"] > 0:
            default_marker = "  <-- default" if i == sd.default.device[0] else ""
            ch = d["max_input_channels"]
            print(f"    {i:2d}  {d['name']:<50s}  ({ch} ch){default_marker}")
            input_devices.append((i, d["name"]))
    print()
    return input_devices


def resolve_device(device_arg):
    """Resolve a device index, name substring, or None (default)."""
    if device_arg is None:
        return sd.default.device[0]
    try:
        idx = int(device_arg)
        sd.check_input_device(idx)
        return idx
    except (ValueError, sd.PortAudioError):
        pass
    devices = sd.query_devices()
    term = device_arg.lower()
    for i, d in enumerate(devices):
        if d["max_input_channels"] > 0 and term in d["name"].lower():
            print(f"  Matched device: {i} — {d['name']}")
            return i
    print(f"  ERROR: No input device matching '{device_arg}'")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Audio helpers
# ---------------------------------------------------------------------------

def save_wav(audio, path, samplerate=16000):
    """Save a float32 mono array as a 16-bit WAV file."""
    audio_int16 = np.clip(audio * 32767, -32768, 32767).astype(np.int16)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(samplerate)
        wf.writeframes(audio_int16.tobytes())


# ---------------------------------------------------------------------------
# Whisper transcription (reuses project's courtroom_asr helpers)
# ---------------------------------------------------------------------------

def _import_asr():
    """Import the project's ASR helpers (try package, then flat import)."""
    try:
        from case_priority_system.scripts.courtroom_asr import (
            transcribe_audio,
            whisper_available,
            correct_transcript_text,
        )
    except ImportError:
        from scripts.courtroom_asr import (  # type: ignore
            transcribe_audio,
            whisper_available,
            correct_transcript_text,
        )
    return transcribe_audio, whisper_available, correct_transcript_text


def transcribe_wav(wav_path: str, transcribe_audio, whisper_available) -> str | None:
    """Transcribe a WAV file with openai-whisper. Returns text or None."""
    if not whisper_available():
        return None
    return transcribe_audio(wav_path)


# ---------------------------------------------------------------------------
# SINGLE-SHOT mode
# ---------------------------------------------------------------------------

def run_single_shot(device, duration, no_correct):
    """Record for *duration* seconds, transcribe, grammar-correct, print."""
    from functools import partial

    transcribe_audio, whisper_available, correct_fn = _import_asr()

    if not whisper_available():
        print("\n  ERROR: openai-whisper is not installed.")
        print("  Install it with:  pip install openai-whisper")
        sys.exit(1)

    print(f"  Recording {duration}s ...")
    print("  >> Speak now! <<\n")
    audio = sd.rec(
        int(duration * 16000), samplerate=16000, channels=1,
        dtype="float32", device=device,
    )
    sd.wait()
    audio = audio.flatten()

    rms = np.sqrt(np.mean(audio ** 2))
    peak = np.max(np.abs(audio))
    print(f"  Recording done. Peak: {peak:.4f}  RMS: {rms:.4f}")
    if rms < 0.001:
        print("  WARNING: Audio is nearly silent. Did you speak?\n")

    # Save temp WAV
    fd, wav_path = tempfile.mkstemp(suffix=".wav", prefix="anavaya_stt_")
    os.close(fd)
    save_wav(audio, wav_path)

    # Transcribe
    print("  Transcribing with Whisper ...")
    t0 = time.time()
    raw_text = transcribe_wav(wav_path, transcribe_audio, whisper_available) or ""
    print(f"  Whisper done in {time.time() - t0:.1f}s.")

    # Grammar correct
    corrected_text = raw_text
    used_llm = False
    if not no_correct and raw_text and correct_fn:
        print("  Grammar-correcting with Ollama ...")
        t0 = time.time()
        corrected_text, used_llm = correct_fn(raw_text)
        print(f"  {'Ollama' if used_llm else 'Skipped'} ({time.time() - t0:.1f}s).")

    # Display
    w = 72
    print("\n" + "=" * w)
    print("  TRANSCRIPTION RESULT")
    print("=" * w)
    print(f"\n  Raw:\n    {raw_text}")
    if corrected_text and corrected_text != raw_text and used_llm:
        print(f"\n  Corrected:\n    {corrected_text}")
    print("=" * w)

    os.remove(wav_path)
    print("\nDone.\n")


# ---------------------------------------------------------------------------
# LIVE (continuous) mode
# ---------------------------------------------------------------------------

class ContinuousRecorder:
    """Records mic audio in a background thread, filling a ring buffer.

    The main thread pulls *chunk_duration*-second windows from the buffer
    for transcription.
    """

    def __init__(self, device, samplerate=16000, chunk_duration=5.0, pre_roll=1.0):
        self.device = device
        self.samplerate = samplerate
        self.chunk_duration = chunk_duration
        self.pre_roll = pre_roll  # overlap from previous chunk for context

        self._lock = threading.Lock()
        self._buffer: list[np.ndarray] = []
        self._running = False
        self._stream = None

    def start(self):
        self._running = True
        self._stream = sd.InputStream(
            samplerate=self.samplerate,
            channels=1,
            dtype="float32",
            device=self.device,
            blocksize=int(self.samplerate * 0.1),  # 100ms blocks
            callback=self._audio_callback,
        )
        self._stream.start()

    def stop(self):
        self._running = False
        if self._stream:
            self._stream.stop()
            self._stream.close()
            self._stream = None

    def _audio_callback(self, indata, frames, time_info, status):
        if not self._running:
            return
        chunk = indata[:, 0].copy()
        with self._lock:
            self._buffer.append(chunk)

    def grab_chunk(self) -> np.ndarray | None:
        """Return the next chunk_duration-second window, or None if not enough audio yet."""
        with self._lock:
            if not self._buffer:
                return None
            all_audio = np.concatenate(self._buffer)

        needed = int(self.chunk_duration * self.samplerate)
        if len(all_audio) < needed:
            return None

        # Take the last *needed* samples (most recent chunk)
        chunk = all_audio[-needed:]

        # Trim the buffer — keep only the pre_roll overlap for the next grab
        pre_roll_samples = int(self.pre_roll * self.samplerate)
        with self._lock:
            self._buffer = [all_audio[-pre_roll_samples:]]

        return chunk

    @property
    def rms(self) -> float:
        with self._lock:
            if not self._buffer:
                return 0.0
            all_audio = np.concatenate(self._buffer)
        return float(np.sqrt(np.mean(all_audio ** 2)))


def run_live(device, chunk_duration, no_correct):
    """Continuous recording + transcription loop. Press Enter or Ctrl+C to stop."""
    transcribe_audio, whisper_available, correct_fn = _import_asr()

    if not whisper_available():
        print("\n  ERROR: openai-whisper is not installed.")
        print("  Install it with:  pip install openai-whisper")
        sys.exit(1)

    w = 72
    print("\n" + "=" * w)
    print("  ANAVAYA — LIVE COURTROOM STT")
    print("=" * w)
    print(f"  Chunk size : {chunk_duration}s  (transcribes every chunk)")
    print(f"  Grammar    : {'Ollama (qwen2.5:3b)' if (not no_correct and correct_fn) else 'disabled'}")
    print(f"  Mic device : {device}")
    print("-" * w)
    print("  Press ENTER or Ctrl+C to stop.\n")

    recorder = ContinuousRecorder(device, chunk_duration=chunk_duration)
    recorder.start()

    transcript_lines: list[str] = []
    chunk_num = 0

    # Clean shutdown on Ctrl+C
    stop_event = threading.Event()

    def _signal_handler(sig, frame):
        stop_event.set()

    signal.signal(signal.SIGINT, _signal_handler)

    try:
        while not stop_event.is_set():
            # Wait for enough audio (check every 200ms)
            chunk = None
            deadline = time.time() + chunk_duration + 2
            while time.time() < deadline:
                chunk = recorder.grab_chunk()
                if chunk is not None:
                    break
                # Show a mic level indicator while waiting
                rms = recorder.rms
                bars = int(min(rms * 200, 30))
                level = "█" * bars + "░" * (30 - bars)
                print(f"\r  🎤 [{level}] {rms:.4f}", end="", flush=True)
                stop_event.wait(0.2)
                if stop_event.is_set():
                    break

            if chunk is None:
                continue

            chunk_num += 1
            rms_chunk = float(np.sqrt(np.mean(chunk ** 2)))
            print(f"\r  [{chunk_num:3d}] Transcribing chunk ({chunk_duration}s, rms={rms_chunk:.4f}) ...", flush=True)

            # Save temp WAV
            fd, wav_path = tempfile.mkstemp(suffix=".wav", prefix="anavaya_live_")
            os.close(fd)
            save_wav(chunk, wav_path)

            # Transcribe
            t0 = time.time()
            raw_text = transcribe_wav(wav_path, transcribe_audio, whisper_available) or ""
            whisper_time = time.time() - t0

            # Grammar correct
            corrected_text = raw_text
            used_llm = False
            if not no_correct and raw_text and correct_fn:
                t0 = time.time()
                corrected_text, used_llm = correct_fn(raw_text)
                llm_time = time.time() - t0
            else:
                llm_time = 0

            # Clean up WAV
            try:
                os.remove(wav_path)
            except OSError:
                pass

            # Display
            if raw_text.strip():
                tag = "LLM" if used_llm else "RAW"
                text = (corrected_text if used_llm and corrected_text else raw_text).strip()
                elapsed = whisper_time + llm_time
                print(f"\r  [{chunk_num:3d}] ⏱ {elapsed:.1f}s ({tag})")
                print(f"       {text}\n")
                transcript_lines.append(text)
            else:
                print(f"\r  [{chunk_num:3d}] (silence)\n")

    except (KeyboardInterrupt, SystemExit):
        pass
    finally:
        recorder.stop()
        signal.signal(signal.SIGINT, signal.SIG_DFL)

    # Final transcript
    print("\n" + "=" * w)
    print("  FULL TRANSCRIPT")
    print("=" * w)
    if transcript_lines:
        for i, line in enumerate(transcript_lines, 1):
            print(f"  [{i:3d}] {line}")
    else:
        print("  (no speech detected)")
    print("=" * w)
    print(f"\n  {chunk_num} chunks processed. Done.\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Courtroom STT test — single-shot or continuous live mode."
    )
    parser.add_argument(
        "--device", "-d", default=None,
        help="Input device index (int) or name substring. Omit for system default."
    )
    parser.add_argument(
        "--duration", "-t", type=float, default=8,
        help="Recording duration in seconds for single-shot mode (default: 8)."
    )
    parser.add_argument(
        "--live", action="store_true",
        help="Continuous recording mode — transcribes in chunks until you press Enter."
    )
    parser.add_argument(
        "--chunk", "-c", type=float, default=5.0,
        help="Chunk duration in seconds for live mode (default: 5)."
    )
    parser.add_argument(
        "--no-correct", action="store_true",
        help="Skip the Ollama grammar-correction step."
    )
    parser.add_argument(
        "--list-devices", action="store_true",
        help="List available input devices and exit."
    )
    args = parser.parse_args()

    if args.list_devices:
        list_input_devices()
        return

    # --- Device selection ---
    device = resolve_device(args.device)
    dev_info = sd.query_devices(device)
    print(f"\n  Using device: {device} — {dev_info['name']}")

    if args.live:
        run_live(device, args.chunk, args.no_correct)
    else:
        run_single_shot(device, args.duration, args.no_correct)


if __name__ == "__main__":
    main()
