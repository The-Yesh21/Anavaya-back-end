"""
OCR text extraction from images using EasyOCR.

Extracts readable text from JPG, PNG, WEBP, and BMP images so that
evidence documents (train tickets, invoices, receipts, photos of
physical documents, etc.) can be fed into the case priority pipeline
and the Chakshu fact-checker.

Usage:
    from case_priority_system.scripts.image_ocr import extract_text_from_image
    text = extract_text_from_image("ticket.jpg")
"""

from __future__ import annotations

import os
from typing import Optional

# Lazy-loaded EasyOCR reader (model downloads on first use, ~100 MB).
_reader = None


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
    """Extract text from an image file using EasyOCR.

    Returns the full extracted text as a single string, or an empty
    string if OCR fails or the image contains no readable text.
    """
    if not os.path.exists(path):
        return ""

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
