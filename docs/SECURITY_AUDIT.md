# Anavaya — Security & Data Integrity Audit

## 1. Ingestion Security
- **Path Traversal Protection**: Filenames undergo `os.path.basename()` striping and strict regular expression sanitization `r"[A-Za-z0-9 _\-().]+"` prior to filesystem interaction.
- **Tempfile Isolation**: Uploaded byte buffers are written to the OS temp directory (`tempfile.mkstemp(prefix='anavaya_upload_')`) rather than the project root.
- **Allowed Extension Whitelist**: Strictly restricted to `.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp`, `.bmp`, `.tiff`.

## 2. On-Device Sovereign Processing
- All OCR (Qwen2.5-VL), feature extraction (Ollama qwen2.5:3b), and speech-to-text (Whisper) execute 100% on local GPU hardware.
- No legal documents, victim statements, or court video feeds leave the physical server perimeter.
