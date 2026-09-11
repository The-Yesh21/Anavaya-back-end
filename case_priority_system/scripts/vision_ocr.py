"""
Image text extraction using the local Qwen2.5-VL vision model via Ollama.

Reads evidence images (train tickets, invoices, receipts, photographed FIRs
and other physical documents) and returns their text so they can be fed into
the case priority pipeline and the Chakshu fact-checker.

The model transcribes and describes only. As everywhere else in Anavaya, the
Decision Tree alone assigns the final priority.

Usage:
    from case_priority_system.scripts.vision_ocr import transcribe_image
    text = transcribe_image("ticket.jpg")

Environment:
    OLLAMA_VISION_MODEL   vision model tag (default qwen2.5vl:3b)
    OLLAMA_URL            Ollama server (default http://localhost:11434)
    ANAVAYA_USE_VLM_OCR   1/0 to force the vision engine on or off
"""

from __future__ import annotations

import base64
import io
import os
import time

try:
    import requests
except ImportError:  # pragma: no cover - requests is a hard dep in practice
    requests = None

# Ollama config. OLLAMA_URL is shared with inference_pipeline; the vision model
# is separate because it is a different (larger) checkpoint than the text model.
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
VISION_MODEL = os.getenv("OLLAMA_VISION_MODEL", "qwen2.5vl:3b")

# Longest edge the image is downscaled to before encoding. Qwen2.5-VL bills
# vision tokens by pixel area; 1536 px keeps a full-page document legible while
# staying inside the VRAM budget of a 4 GB laptop GPU.
MAX_IMAGE_EDGE = 1536

# Sentinel the model is asked to emit when an image has no legible text.
_NO_TEXT = "NO_TEXT_FOUND"

OCR_PROMPT = """You are an OCR engine. Transcribe this image.

Rules:
1. Output every visible character exactly as printed or written, including
   numbers, codes, dates, station names, amounts and reference IDs.
2. Preserve the reading order and keep each printed line on its own line.
3. Do NOT summarise, translate, correct spelling, or invent text that is not
   visible. If a character is unreadable, write [?] in its place.
4. Do not add commentary, headings, or markdown around the transcription.

After the transcription, output exactly one final line beginning with
"VISUAL CONTEXT:" that states what kind of document or scene this is and what
is physically shown.

If the image contains no legible text at all, output only NO_TEXT_FOUND
followed by the VISUAL CONTEXT line."""

# Availability probe cache. Mirrors the _llm_probe_deadline pattern in
# inference_pipeline.llm_extraction_enabled(): a positive result is cached for
# the process, a negative one is re-probed at most once per interval so a
# later-started Ollama (or a finished `ollama pull`) is picked up.
_vision_cache: "bool | None" = None
_vision_probe_deadline: float = 0.0
_VISION_PROBE_INTERVAL = 30.0
_vision_reported = False


class VisionUnavailable(RuntimeError):
    """The vision model could not be reached, so no transcription was attempted.

    Distinct from "the model ran and found no text" — callers use this to tell
    the user their Ollama/model setup is the problem, not their image.
    """


def _ollama_helpers():
    """Return (_ollama_reachable, _ensure_ollama_daemon) from inference_pipeline.

    Reuses the daemon auto-start logic already written there rather than
    duplicating it. Returns (None, None) when the module cannot be imported.
    """
    try:
        from case_priority_system.scripts.inference_pipeline import (
            _ollama_reachable,
            _ensure_ollama_daemon,
        )
    except ImportError:
        try:
            from scripts.inference_pipeline import (  # type: ignore
                _ollama_reachable,
                _ensure_ollama_daemon,
            )
        except ImportError:
            return None, None
    return _ollama_reachable, _ensure_ollama_daemon


def _model_installed() -> bool:
    """True when VISION_MODEL appears in the Ollama server's model list."""
    if requests is None:
        return False
    try:
        r = requests.get(f"{OLLAMA_URL.rstrip('/')}/api/tags", timeout=5)
        if r.status_code != 200:
            return False
        names = [m.get("name", "") for m in (r.json().get("models") or [])]
    except Exception:
        return False
    # Ollama reports "qwen2.5vl:3b"; tolerate a bare "qwen2.5vl" config value.
    wanted = VISION_MODEL if ":" in VISION_MODEL else f"{VISION_MODEL}:latest"
    return any(n == wanted or n == VISION_MODEL for n in names)


def vision_model_available() -> bool:
    """Whether image text extraction should use the Qwen2.5-VL model.

    Resolution order:
      ANAVAYA_USE_VLM_OCR=0 / false -> disabled (forced)
      ANAVAYA_USE_VLM_OCR=1 / true  -> enabled if the Ollama daemon answers,
                                       skipping the model-list check
      unset / auto                  -> enabled when the daemon is reachable
                                       AND VISION_MODEL is installed
    """
    global _vision_cache, _vision_probe_deadline, _vision_reported

    env = os.getenv("ANAVAYA_USE_VLM_OCR", "").strip().lower()
    if env in ("0", "false", "no", "off"):
        return False

    if _vision_cache is True:
        return True
    if time.monotonic() < _vision_probe_deadline:
        return False
    _vision_probe_deadline = time.monotonic() + _VISION_PROBE_INTERVAL

    reachable, ensure_daemon = _ollama_helpers()
    if reachable is None:
        return False
    if not reachable():
        ensure_daemon()
    if not reachable():
        return False

    enabled = True if env in ("1", "true", "yes", "on") else _model_installed()
    if enabled:
        _vision_cache = True
        if not _vision_reported:
            _vision_reported = True
            print(f"[Anavaya] Image OCR using vision model {VISION_MODEL}.")
    return enabled


def extraction_model(is_image: bool) -> "str | None":
    """Which Ollama model should run feature extraction for this document.

    Returns VISION_MODEL for images whose text was just read by the vision
    model — it is still resident in VRAM, and on a 4 GB GPU swapping back to
    the text model would evict it and cost a full reload. Returns None (use
    the default OLLAMA_MODEL) for PDFs and when the vision model is inactive.
    """
    if is_image and vision_model_available():
        return VISION_MODEL
    return None


def _encode_image(path: str) -> str:
    """Load an image and return it base64-encoded as a JPEG for Ollama.

    Normalises everything through Pillow, which detects the format from the
    file contents. That matters because stored document paths may have lost
    their extension to filename truncation, and because WebP/BMP/TIFF need
    converting anyway. Also honours the EXIF orientation tag so photos taken
    on a phone are not transcribed sideways.
    """
    from PIL import Image, ImageOps

    with Image.open(path) as img:
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")
        longest = max(img.size)
        if longest > MAX_IMAGE_EDGE:
            scale = MAX_IMAGE_EDGE / longest
            new_size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
            img = img.resize(new_size, Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _clean_response(content: str) -> str:
    """Strip the no-text sentinel and any model preamble from a transcription."""
    text = (content or "").strip()
    if not text:
        return ""
    # Drop a leading NO_TEXT_FOUND line; a trailing VISUAL CONTEXT line may
    # still carry useful signal, so keep whatever follows.
    lines = text.splitlines()
    if lines and lines[0].strip().upper().startswith(_NO_TEXT):
        lines = lines[1:]
        text = "\n".join(lines).strip()
    # Models sometimes wrap the transcription in a fence despite the prompt.
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
    return text.strip()


def transcribe_image(path: str, timeout: int = 300) -> str:
    """Transcribe an image with the local Qwen2.5-VL model.

    Returns the transcribed text (plus a trailing "VISUAL CONTEXT:" line), or
    an empty string when the model read the image and found nothing legible.

    Raises VisionUnavailable when the model could not be reached at all, so the
    caller can distinguish a setup problem from an unreadable image.
    """
    if requests is None:
        raise VisionUnavailable("The 'requests' package is not installed.")
    if not os.path.exists(path):
        raise VisionUnavailable(f"Image not found: {path}")

    try:
        image_b64 = _encode_image(path)
    except Exception as e:
        # A file Pillow cannot open is a bad image, not a broken engine.
        print(f"vision_ocr: could not decode image {path}: {e}")
        return ""

    payload = {
        "model": VISION_MODEL,
        "messages": [{"role": "user", "content": OCR_PROMPT, "images": [image_b64]}],
        "stream": False,
        "think": False,
        "keep_alive": "5m",
        "options": {"temperature": 0, "seed": 42, "num_predict": 2048},
    }

    try:
        r = requests.post(f"{OLLAMA_URL.rstrip('/')}/api/chat", json=payload, timeout=timeout)
    except Exception as e:
        raise VisionUnavailable(f"Could not reach Ollama at {OLLAMA_URL}: {e}") from e

    if r.status_code == 404:
        raise VisionUnavailable(
            f"Vision model '{VISION_MODEL}' is not installed. "
            f"Run: ollama pull {VISION_MODEL}"
        )
    if r.status_code != 200:
        raise VisionUnavailable(
            f"Ollama returned HTTP {r.status_code} for {VISION_MODEL}: {r.text[:200]}"
        )

    try:
        content = (r.json().get("message") or {}).get("content", "")
    except Exception as e:
        raise VisionUnavailable(f"Malformed response from Ollama: {e}") from e

    return _clean_response(content)


if __name__ == "__main__":  # manual check: python -m ... vision_ocr <image>
    import sys

    if len(sys.argv) < 2:
        print(f"usage: python {os.path.basename(__file__)} <image path>")
        raise SystemExit(2)
    print(f"model={VISION_MODEL} available={vision_model_available()}")
    print("-" * 60)
    print(transcribe_image(sys.argv[1]))
