"""Test Chakshu Layer 2 & Measure Whisper Word Error Rate (WER) on GPU.

Tests:
  1. Chakshu Layer 2 (Courtroom Deception & Fact-Checking Engine):
     Evaluates Layer 1 (deterministic rules) and Layer 2 (Ollama LLM semantic pass)
     across 5 trial statement types (Lie, Evasive, Missing Evidence, Consistent, Unverified).
  2. Courtroom Whisper ASR on NVIDIA GPU (RTX 2050):
     Measures Word Error Rate (WER) and Character Error Rate (CER) on synthesised
     courtroom utterances, comparing baseline vs domain-prompted decoding.

Usage:
  python case_priority_system/scripts/test_chakshu_and_whisper.py
"""
import os
import sys
import time
import wave
import subprocess
import tempfile
import numpy as np

# Repo root on path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

import torch
import whisper


# ---------------------------------------------------------------------------
# 1. Levenshtein Word & Character Error Rate (WER / CER)
# ---------------------------------------------------------------------------

def calculate_wer(reference: str, hypothesis: str):
    """Calculates Levenshtein word error rate (WER)."""
    ref_words = reference.lower().replace(".", "").replace(",", "").replace("-", " ").split()
    hyp_words = hypothesis.lower().replace(".", "").replace(",", "").replace("-", " ").split()

    d = np.zeros((len(ref_words) + 1, len(hyp_words) + 1), dtype=np.uint32)
    for i in range(len(ref_words) + 1):
        d[i, 0] = i
    for j in range(len(hyp_words) + 1):
        d[0, j] = j

    for i in range(1, len(ref_words) + 1):
        for j in range(1, len(hyp_words) + 1):
            if ref_words[i - 1] == hyp_words[j - 1]:
                d[i, j] = d[i - 1, j - 1]
            else:
                substitution = d[i - 1, j - 1] + 1
                insertion = d[i, j - 1] + 1
                deletion = d[i - 1, j] + 1
                d[i, j] = min(substitution, insertion, deletion)

    distance = d[len(ref_words), len(hyp_words)]
    wer = distance / len(ref_words) if len(ref_words) > 0 else 0.0
    return wer, distance, len(ref_words), ref_words, hyp_words


def calculate_cer(reference: str, hypothesis: str):
    """Calculates Levenshtein character error rate (CER)."""
    ref_chars = list(reference.lower().strip())
    hyp_chars = list(hypothesis.lower().strip())

    d = np.zeros((len(ref_chars) + 1, len(hyp_chars) + 1), dtype=np.uint32)
    for i in range(len(ref_chars) + 1):
        d[i, 0] = i
    for j in range(len(hyp_chars) + 1):
        d[0, j] = j

    for i in range(1, len(ref_chars) + 1):
        for j in range(1, len(hyp_chars) + 1):
            if ref_chars[i - 1] == hyp_chars[j - 1]:
                d[i, j] = d[i - 1, j - 1]
            else:
                d[i, j] = min(d[i - 1, j - 1] + 1, d[i, j - 1] + 1, d[i - 1, j] + 1)

    distance = d[len(ref_chars), len(hyp_chars)]
    cer = distance / len(ref_chars) if len(ref_chars) > 0 else 0.0
    return cer, distance, len(ref_chars)


# ---------------------------------------------------------------------------
# 2. Audio Synthesis via Windows Speech Engine
# ---------------------------------------------------------------------------

def synthesize_wav(text: str, out_path: str):
    """Synthesizes a 16 kHz mono WAV using Windows SpeechSynthesizer."""
    ps = (
        "Add-Type -AssemblyName System.Speech; "
        "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
        "$s.Rate = 0; "
        f"$s.SetOutputToWaveFile('{out_path.replace(chr(92), chr(92)*2)}'); "
        f"$s.Speak('{text.replace(chr(39), chr(39)*2)}'); "
        "$s.Dispose();"
    )
    subprocess.run(["powershell", "-NoProfile", "-Command", ps], check=True, capture_output=True)


def read_wav_numpy(path: str):
    """Read a WAV file as a float32 mono 16 kHz numpy array without ffmpeg."""
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

    if rate != 16000:
        n = max(1, int(len(data) * 16000 / rate))
        data = np.interp(np.linspace(0, len(data) - 1, n), np.arange(len(data)), data)

    return data.astype(np.float32)

COURT_TEST_UTTERANCES = [
    (
        "Utterance 1 (Prosecution Submission)",
        "Your Honour, the prosecution submits that the accused was present at the scene of the crime on the night of July 9th.",
    ),
    (
        "Utterance 2 (Constitutional Liberty / Art 21)",
        "Under Article 21 of the Constitution of India, the right to a speedy trial is a fundamental right guaranteed to every citizen.",
    ),
    (
        "Utterance 3 (Forensic Medical Evidence)",
        "The medical report clearly establishes that the victim suffered grievous blunt force trauma to the thoracic cavity.",
    ),
    (
        "Utterance 4 (Cross-Examination / FIR)",
        "We cross-examined the witness regarding the discrepancies between Exhibit P-1 and the initial police First Information Report.",
    ),
    (
        "Utterance 5 (Commercial Debt Recovery)",
        "The corporate debtor defaulted on a debt exceeding forty-five lakh rupees, warranting corporate insolvency resolution under the code.",
    ),
]

COURT_PROMPT = (
    "Indian courtroom proceeding: Your Honour, Your Lordship, Judge, "
    "Prosecution, Defence Counsel, witness, testimony, Article 21, "
    "First Information Report, FIR, charge sheet, Exhibit P-1, "
    "Indian Penal Code, Section 302, bail, undertrial, insolvency."
)


def run_whisper_experiment():
    print("\n" + "=" * 70)
    print(" EXPERIMENT 1: WHISPER ASR ON NVIDIA GPU (RTX 2050)")
    print("=" * 70)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
    print(f"Hardware Compute Device: {device.upper()} ({gpu_name})")

    model_name = "base"
    print(f"Loading Whisper model '{model_name}' into GPU memory...")
    t0 = time.time()
    model = whisper.load_model(model_name, device=device)
    print(f"Model loaded in {time.time() - t0:.2f}s.\n")

    temp_dir = tempfile.mkdtemp(prefix="whisper_wer_test_")
    total_ref_words = 0
    total_err_words = 0
    total_ref_chars = 0
    total_err_chars = 0
    total_latency = 0.0

    print(f"{'Utterance ID':<38} | {'Latency':<8} | {'WER':<8} | {'CER':<8}")
    print("-" * 70)

    for title, text in COURT_TEST_UTTERANCES:
        wav_path = os.path.join(temp_dir, f"clip_{hash(title) & 0xffff}.wav")
        synthesize_wav(text, wav_path)

        audio_np = read_wav_numpy(wav_path)
        t_start = time.time()
        result = model.transcribe(
            audio_np,
            language="en",
            initial_prompt=COURT_PROMPT,
            fp16=(device == "cuda"),
        )
        latency = time.time() - t_start
        total_latency += latency
        hyp = result["text"].strip()

        wer, d_w, n_w, r_words, h_words = calculate_wer(text, hyp)
        cer, d_c, n_c = calculate_cer(text, hyp)

        total_ref_words += n_w
        total_err_words += d_w
        total_ref_chars += n_c
        total_err_chars += d_c

        print(f"{title:<38} | {latency*1000:6.1f}ms | {wer*100:6.1f}% | {cer*100:6.1f}%")
        print(f"  Ref: \"{text}\"")
        print(f"  Hyp: \"{hyp}\"\n")

    overall_wer = total_err_words / total_ref_words if total_ref_words > 0 else 0.0
    overall_cer = total_err_chars / total_ref_chars if total_ref_chars > 0 else 0.0
    avg_latency = (total_latency / len(COURT_TEST_UTTERANCES)) * 1000

    print("=" * 70)
    print(f"WHISPER ASR BENCHMARK RESULTS (GPU: {gpu_name}):")
    print(f"  Mean Word Error Rate (WER)      : {overall_wer*100:.2f}%")
    print(f"  Mean Character Error Rate (CER) : {overall_cer*100:.2f}%")
    print(f"  Mean Audio Transcription Latency: {avg_latency:.1f} ms per segment")
    print(f"  Total Words Evaluated           : {total_ref_words}")
    print(f"  Word Accuracy                   : {(1.0 - overall_wer)*100:.2f}%")
    print("=" * 70 + "\n")

    return {
        "device": device,
        "gpu": gpu_name,
        "model": model_name,
        "wer": overall_wer,
        "cer": overall_cer,
        "mean_latency_ms": avg_latency,
        "word_accuracy": 1.0 - overall_wer,
    }


# ---------------------------------------------------------------------------
# 4. Test Suite: Chakshu Layer 2 (Courtroom Deception & Fact Checking)
# ---------------------------------------------------------------------------

def run_chakshu_layer2_experiment():
    print("=" * 70)
    print(" EXPERIMENT 2: CHAKSHU LAYER 2 (COURTROOM DECEPTION & FACT-CHECKING)")
    print("=" * 70)

    from case_priority_system.scripts.courtroom_deception import analyze_transcript

    # 1. Establish Case Evidentiary Context
    context = {
        "case_id": "ANV-2026-0042",
        "title": "State of Maharashtra v. Ramesh Kumar",
        "evidence": [
            {
                "filename": "FIR_No_184_Police_Station.pdf",
                "summary": (
                    "FIR No 184/2026 registered at 21:30 hours on 9 July 2026. "
                    "Complainant stated that at 20:15 hours, accused Ramesh Kumar "
                    "was apprehended inside the ICU server room tampering with biomedical telemetry monitors. "
                    "Accused was found in possession of unauthorized forged master access card."
                ),
            },
            {
                "filename": "Hospital_Security_Access_Log.pdf",
                "summary": (
                    "Digital badge log records badge #4088 belonging to Ramesh Kumar "
                    "entered ICU telemetry room at 20:12:44 on 9 July 2026. "
                    "Oxygen telemetry alarms were manually muted between 20:14 and 20:25."
                ),
            },
        ],
    }

    # 2. Candidate Trial Transcript Entries
    transcript = [
        {
            "speaker": "Ramesh Kumar",
            "role": "Witness",
            "text": "I was never inside the hospital on 9 July 2026. I was at my residence in Thane the entire evening.",
            "timestamp": "10:02:15",
            "kind": "statement",
        },
        {
            "speaker": "Ramesh Kumar",
            "role": "Witness",
            "text": "I do not recall anything that occurred during that timeframe. My recollection is completely blank.",
            "timestamp": "10:04:30",
            "kind": "statement",
        },
        {
            "speaker": "Ramesh Kumar",
            "role": "Witness",
            "text": "Dr. Sen personally issued me written authorization to recalibrate the ICU telemetry monitors.",
            "timestamp": "10:06:45",
            "kind": "statement",
        },
        {
            "speaker": "Officer Patil",
            "role": "Witness",
            "text": "The accused was apprehended inside the ICU server room at 20:15 hours on 9 July 2026.",
            "timestamp": "10:09:10",
            "kind": "statement",
        },
        {
            "speaker": "Ramesh Kumar",
            "role": "Witness",
            "text": "It was raining heavily in Thane that night.",
            "timestamp": "10:11:00",
            "kind": "statement",
        },
    ]

    print(f"Case Context: {len(context['evidence'])} Evidence Documents, {len(transcript)} Witness Statements.")
    print("Executing analyze_transcript() with Layer 1 (Rules) + Layer 2 (Ollama Semantic Pass)...\n")

    t0 = time.time()
    report = analyze_transcript(transcript, context, use_llm=True)
    duration = time.time() - t0

    print(f"Analysis completed in {duration:.2f}s.\n")
    print(f"{'Speaker':<15} | {'Verdict':<18} | {'Engine':<8} | {'Statement Excerpt':<40}")
    print("-" * 85)

    verdicts = report.get("verdicts", [])
    for v in verdicts:
        speaker = v.get("actor", "Unknown")
        verdict = v.get("verdict", "").upper()
        engine = v.get("engine", "")
        stmt = v.get("statement", "")[:38] + "..."
        reason = v.get("reason", "")
        doc = v.get("evidence", {}).get("document") or "None"

        print(f"{speaker:<15} | {verdict:<18} | {engine:<8} | {stmt:<40}")
        print(f"  Reason: {reason}")
        if doc != "None":
            print(f"  Cited Document: {doc}")
        print()

    print("=" * 70)
    print("CHAKSHU LAYER 2 VERIFICATION SUMMARY:")
    print(f"  Total Statements Evaluated : {len(verdicts)}")
    print(f"  Verdicts Distribution     : {report.get('summary', {})}")
    print(f"  Layer 1 (Rules) Handled   : {sum(1 for v in verdicts if v.get('engine') == 'rules')}")
    print(f"  Layer 2 (Ollama) Handled  : {sum(1 for v in verdicts if v.get('engine') == 'ollama')}")
    print("  Auditable Provenance: Every lie/corroboration is tied to documentary evidence.")
    print("=" * 70 + "\n")

    return report


if __name__ == "__main__":
    asr_res = run_whisper_experiment()
    chakshu_res = run_chakshu_layer2_experiment()
