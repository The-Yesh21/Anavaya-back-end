"""
Text extraction from images.

Extracts readable text from JPG, PNG, WEBP, BMP and TIFF images so that
evidence documents (train tickets, invoices, receipts, photos of
physical documents, etc.) can be fed into the case priority pipeline
and the Chakshu fact-checker.

Engine order (first available wins):
    1. Qwen2.5-VL via the local Ollama GPU  -- see vision_ocr.py
    2. EasyOCR                              -- only if the package is installed
    3. Tesseract via pytesseract            -- only if the binary is installed

Usage:
    from case_priority_system.scripts.image_ocr import extract_text_from_image
    text = extract_text_from_image("ticket.jpg")
"""

from __future__ import annotations

import os
from typing import Optional

# Lazy-loaded EasyOCR reader (model downloads on first use, ~100 MB).
_reader = None


def _vision_ocr():
    """Return the vision_ocr module, or None when it cannot be imported."""
    try:
        from case_priority_system.scripts import vision_ocr
    except ImportError:
        try:
            from scripts import vision_ocr  # type: ignore
        except ImportError:
            return None
    return vision_ocr


def _get_reader():
    """Return a cached EasyOCR reader for English (Latin script)."""
    global _reader
    if _reader is None:
        try:
            import easyocr
            _reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        except Exception as e:
            print(f"image_ocr: EasyOCR init failed: {e}")
            _reader = False  # sentinel — don't retry
    return _reader if _reader is not False else None


def _convert_to_png(path: str) -> str:
    """Convert an image to a temporary PNG that EasyOCR can read.

    EasyOCR (via imageio) lacks backends for some formats (e.g. WebP).
    Pillow handles almost everything, so we convert via Pillow and return
    the temp path. The caller is responsible for cleaning it up.
    """
    import tempfile
    import PIL.Image

    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    tmp.close()
    try:
        with PIL.Image.open(path) as img:
            img = img.convert("RGB")
            img.save(tmp.name, "PNG")
        return tmp.name
    except Exception as e:
        print(f"image_ocr: Pillow conversion failed for {path}: {e}")
        try:
            os.unlink(tmp.name)
        except OSError:
            pass
        return ""


def extract_text_from_image(path: str) -> str:
    """Extract text from an image file.

    Tries the Qwen2.5-VL vision model on the local Ollama GPU first, then
    falls back to EasyOCR and Tesseract if either is installed.

    Returns the full extracted text as a single string, or an empty string
    if every engine fails or the image contains no readable text.
    """
    if not os.path.exists(path):
        return ""

    # 1. Vision model (Qwen2.5-VL). Reads photographed and scanned documents
    # far more reliably than classical OCR, and needs no extra Python deps.
    vision = _vision_ocr()
    if vision is not None and vision.vision_model_available():
        try:
            text = vision.transcribe_image(path)
            if text.strip():
                return text
            # Model ran and found nothing legible: don't burn time on OCR
            # engines that are almost certainly weaker on the same image.
            return ""
        except vision.VisionUnavailable as e:
            print(f"image_ocr: vision model unavailable ({e}); trying OCR fallbacks.")
        except Exception as e:
            print(f"image_ocr: vision model failed on {path}: {e}")

    reader = _get_reader()
    if reader is None:
        # Fallback: try Pillow + pytesseract if available (binary must be installed).
        return _fallback_tesseract(path)

    # WebP and some other formats lack imageio backends; convert via Pillow.
    converted_path = None
    _CONVERT_EXTS = ('.webp', '.bmp', '.tiff', '.tif')
    if path.lower().endswith(_CONVERT_EXTS):
        converted_path = _convert_to_png(path)
        if converted_path:
            path = converted_path
        # If conversion failed, path still points to original — let EasyOCR try.

    try:
        results = reader.readtext(path, detail=0, paragraph=True)
        # EasyOCR returns a list of text strings; join with newlines.
        text = "\n".join(results).strip()
        return text
    except Exception as e:
        print(f"image_ocr: EasyOCR failed on {path}: {e}")
        return _fallback_tesseract(path)
    finally:
        if converted_path:
            try:
                os.unlink(converted_path)
            except OSError:
                pass


def _fallback_tesseract(path: str) -> str:
    """Fallback to pytesseract if Tesseract binary is installed."""
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(path)
        text = pytesseract.image_to_string(img)
        return (text or "").strip()
    except Exception:
        return ""


def is_image_file(filename: str) -> bool:
    """Check if a filename has an image extension we can OCR."""
    return filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"))


def image_text_engine() -> str:
    """Name the engine that extract_text_from_image() would actually use.

    Returns the vision model tag, "easyocr", "tesseract", or "none". Callers
    use this to tell the user whether an empty result means "your image is
    unreadable" or "no text engine is installed at all".
    """
    vision = _vision_ocr()
    if vision is not None and vision.vision_model_available():
        return vision.VISION_MODEL
    try:
        import easyocr  # noqa: F401
        return "easyocr"
    except ImportError:
        pass
    try:
        import pytesseract
        pytesseract.get_tesseract_version()
        return "tesseract"
    except Exception:
        pass
    return "none"


def extraction_model(is_image: bool) -> Optional[str]:
    """Ollama model override for feature extraction, or None for the default.

    Thin passthrough to vision_ocr.extraction_model() that tolerates the
    vision module being absent, so callers need only import from image_ocr.
    """
    vision = _vision_ocr()
    if vision is None:
        return None
    return vision.extraction_model(is_image)


def no_text_message(filename: str) -> str:
    """Build the user-facing error for an image that yielded no text."""
    engine = image_text_engine()
    if engine == "none":
        vision = _vision_ocr()
        model = vision.VISION_MODEL if vision is not None else "qwen2.5vl:3b"
        return (
            f"'{filename}' could not be read: no image text engine is available. "
            f"Start Ollama and run `ollama pull {model}` to enable image reading."
        )
    return (
        f"'{filename}' contains no extractable text ({engine} found nothing legible). "
        "Make sure the text in the image is in focus and not cropped."
    )
