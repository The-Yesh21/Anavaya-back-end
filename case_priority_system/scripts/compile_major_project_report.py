"""
ANAVAYA Major Project Academic Report Compiler
Compiles ANAVAYA_MAJOR_PROJECT_REPORT.md into:
1. ANAVAYA_MAJOR_PROJECT_REPORT.pdf (Publication-quality ReportLab document)
2. ANAVAYA_MAJOR_PROJECT_REPORT.docx (Publication-quality python-docx document)

Authors: Anavaya Engineering & Research Team (Lead Author: Yeshwanth Reddy)
Academic Year: 2025-2026
"""

import os
import sys
from PIL import Image

# Directories
SCRATCH_DIR = r"C:\Users\Yeshwanth\.gemini\antigravity-cli\brain\d09403a2-6af9-46b3-90b3-2320df031b38\scratch"
ASSETS_DIR = r"F:\major_project\docs\report_assets"
OUTPUT_PDF = os.path.join(SCRATCH_DIR, "ANAVAYA_MAJOR_PROJECT_REPORT.pdf")
OUTPUT_DOCX = os.path.join(SCRATCH_DIR, "ANAVAYA_MAJOR_PROJECT_REPORT.docx")

# Ensure clean crop of fig_case_analysis exists
HERO_CASE_IMG = os.path.join(SCRATCH_DIR, "fig_case_analysis_clean.png")
if not os.path.exists(HERO_CASE_IMG):
    orig = os.path.join(ASSETS_DIR, "fig_case_analysis.png")
    if os.path.exists(orig):
        im = Image.open(orig)
        hero = im.crop((0, 0, 774, 850))
        hero.save(HERO_CASE_IMG)

# -------------------------------------------------------------------------
# REPORTLAB PDF GENERATOR
# -------------------------------------------------------------------------
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image as RLImage, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

NAVY = colors.HexColor("#0F172A")
SLATE_BLUE = colors.HexColor("#1E293B")
MUTED_SLATE = colors.HexColor("#475569")
LIGHT_SLATE = colors.HexColor("#64748B")
GOLD = colors.HexColor("#D97706")
GOLD_ACCENT = colors.HexColor("#B45309")
BORDER_COLOR = colors.HexColor("#CBD5E1")
LIGHT_BG = colors.HexColor("#F8FAFC")
CALLOUT_BG = colors.HexColor("#FFFBEB")
CALLOUT_BORDER = colors.HexColor("#D97706")
CODE_BG = colors.HexColor("#0F172A")
CODE_TEXT = colors.HexColor("#F8FAFC")
WHITE = colors.HexColor("#FFFFFF")

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            return  # Suppress running header/footer on cover page

        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(LIGHT_SLATE)
        
        # Header
        self.drawString(54, 750, "ANAVAYA: Autonomous Constitutional Judicial Triage System")
        self.drawRightString(612 - 54, 750, "Major Project Academic Final Report")
        self.setStrokeColor(BORDER_COLOR)
        self.setLineWidth(0.6)
        self.line(54, 742, 612 - 54, 742)

        # Footer
        self.line(54, 48, 612 - 54, 48)
        self.setFont("Helvetica", 8)
        self.drawString(54, 36, "Ref: ANV-DOC-2026-ENG-001 | Sovereign Local Edge Deployment | Lead: Yeshwanth Reddy")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(612 - 54, 36, page_str)
        self.restoreState()


def make_callout(text, title=None, width=504, border_color=GOLD_ACCENT, bg_color=CALLOUT_BG):
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "CalloutTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=border_color,
        spaceAfter=4
    )
    body_style = ParagraphStyle(
        "CalloutBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=NAVY
    )
    content = []
    if title:
        content.append(Paragraph(title, title_style))
    content.append(Paragraph(text, body_style))
    
    t = Table([[content]], colWidths=[width])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg_color),
        ('BOX', (0,0), (-1,-1), 0.5, border_color),
        ('LINELEFT', (0,0), (0,0), 3.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
    ]))
    return t


def make_code_box(code_text, width=504):
    styles = getSampleStyleSheet()
    code_style = ParagraphStyle(
        "CodeStyle",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=8,
        leading=11,
        textColor=CODE_TEXT
    )
    # Escape xml entities for ReportLab Paragraph
    safe_text = code_text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")
    p = Paragraph(safe_text, code_style)
    t = Table([[p]], colWidths=[width])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CODE_BG),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#334155")),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    return t


def build_pdf():
    print(f"Compiling PDF -> {OUTPUT_PDF}")
    doc = SimpleDocTemplate(
        OUTPUT_PDF,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=60,
        bottomMargin=60
    )
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=NAVY,
        alignment=1, # Center
        spaceAfter=8
    )
    sub_title_style = ParagraphStyle(
        "ReportSubTitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=13,
        leading=17,
        textColor=MUTED_SLATE,
        alignment=1,
        spaceAfter=15
    )
    h1_style = ParagraphStyle(
        "ReportH1",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=19,
        textColor=SLATE_BLUE,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )
    h2_style = ParagraphStyle(
        "ReportH2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=SLATE_BLUE,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )
    h3_style = ParagraphStyle(
        "ReportH3",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=14,
        textColor=MUTED_SLATE,
        spaceBefore=8,
        spaceAfter=3,
        keepWithNext=True
    )
    body_style = ParagraphStyle(
        "ReportBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13.5,
        textColor=NAVY,
        spaceAfter=6
    )
    bullet_style = ParagraphStyle(
        "ReportBullet",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=NAVY,
        leftIndent=15,
        spaceAfter=3
    )
    caption_style = ParagraphStyle(
        "ReportCaption",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8.5,
        leading=11.5,
        textColor=MUTED_SLATE,
        alignment=1,
        spaceBefore=4,
        spaceAfter=10
    )
    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=WHITE,
        alignment=0
    )
    table_cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=NAVY,
        alignment=0
    )
    table_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=NAVY,
        alignment=0
    )

    story = []

    # =========================================================================
    # COVER PAGE
    # =========================================================================
    story.append(Spacer(1, 20))
    story.append(Paragraph("<b>MAJOR PROJECT ACADEMIC FINAL REPORT</b>", ParagraphStyle(
        "CoverHeader", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=GOLD_ACCENT, alignment=1, spaceAfter=8
    )))
    story.append(Paragraph("Submitted in partial fulfillment of the requirements for the Degree of<br/><b>Bachelor of Technology in Computer Science & Engineering / Artificial Intelligence and Law</b>", ParagraphStyle(
        "CoverDegree", parent=styles["Normal"], fontName="Helvetica", fontSize=10, leading=14, textColor=MUTED_SLATE, alignment=1, spaceAfter=24
    )))

    story.append(HRFlowable(width="80%", thickness=2, color=GOLD, spaceAfter=20))
    story.append(Paragraph("ANAVAYA", title_style))
    story.append(Paragraph("Autonomous Constitutional Judicial Triage and Multimodal Courtroom Verification System", sub_title_style))
    story.append(HRFlowable(width="80%", thickness=1, color=BORDER_COLOR, spaceAfter=25))

    # Cover Meta Box
    meta_data = [
        [Paragraph("<b>Academic Year:</b>", table_cell_bold), Paragraph("2025 – 2026", table_cell_style)],
        [Paragraph("<b>Lead Author & Architect:</b>", table_cell_bold), Paragraph("<b>Yeshwanth Reddy</b> (Engineering & System Author)", table_cell_style)],
        [Paragraph("<b>Document Reference:</b>", table_cell_bold), Paragraph("<code>ANV-DOC-2026-ENG-001</code>", table_cell_style)],
        [Paragraph("<b>Security Classification:</b>", table_cell_bold), Paragraph("Open Academic / Publication-Grade", table_cell_style)],
        [Paragraph("<b>Target Venues:</b>", table_cell_bold), Paragraph("<i>Springer Artificial Intelligence and Law</i> / <i>IEEE Transactions on CSS</i>", table_cell_style)],
        [Paragraph("<b>Primary Backend:</b>", table_cell_bold), Paragraph("FastAPI + Scikit-Learn CART + Whisper CUDA + MediaPipe Mesh", table_cell_style)],
        [Paragraph("<b>Hardware Target:</b>", table_cell_bold), Paragraph("Sovereign Local Edge (NVIDIA RTX 2050/3060 4GB VRAM, Air-Gapped)", table_cell_style)],
    ]
    meta_table = Table(meta_data, colWidths=[160, 310])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(meta_table)

    story.append(Spacer(1, 30))
    story.append(make_callout(
        "<b>Founding Architectural Invariant:</b> The Large Language Model extracts and summarizes structured facts only; "
        "the Scikit-Learn CART Decision Tree alone decides priority. Priority adjudication is 100% deterministic, audit-proof, "
        "and reproducible under Articles 14, 21, and 39A of the Constitution of India.",
        title="CORE CONSTITUTIONAL COVENANT",
        width=480,
        border_color=GOLD_ACCENT,
        bg_color=CALLOUT_BG
    ))
    story.append(PageBreak())

    # =========================================================================
    # EXECUTIVE METADATA & TABLE OF CONTENTS
    # =========================================================================
    story.append(Paragraph("Executive Summary & System Metadata", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=GOLD, spaceAfter=10))

    exec_summary_data = [
        [Paragraph("Project Moniker", table_header_style), Paragraph("Specification & Architectural Parameters", table_header_style)],
        [Paragraph("<b>Project Moniker</b>", table_cell_bold), Paragraph("<b>ANAVAYA</b> (Sanskrit: <i>Unbroken Order, Harmonious Resolution</i>)", table_cell_style)],
        [Paragraph("<b>System Architecture</b>", table_cell_bold), Paragraph("Decoupled Hybrid: Local LLM Fact Extraction + Deterministic CART Decision Tree + Codified Constitutional Rule Engine + Multimodal Biometric Verification", table_cell_style)],
        [Paragraph("<b>Hardware Target</b>", table_cell_bold), Paragraph("Sovereign On-Premises Local Edge (Consumer GPU: NVIDIA RTX 2050 / RTX 3060 4GB VRAM, Zero Cloud Dependency)", table_cell_style)],
        [Paragraph("<b>Founding Invariant</b>", table_cell_bold), Paragraph("<i>The LLM extracts and summarizes only; the Decision Tree alone decides priority.</i> Priority adjudication is 100% deterministic, audit-proof, and reproducible.", table_cell_style)],
        [Paragraph("<b>Empirical Accuracy</b>", table_cell_bold), Paragraph("<b>99.81%</b> (5-Fold Stratified Cross-Validation) | <b>97.42%</b> (Authentic High Court Holdout) | <b>100.0%</b> (High-Priority Critical Life Recall)", table_cell_style)],
        [Paragraph("<b>Verification Latency</b>", table_cell_bold), Paragraph("<b>&lt;500 ms</b> (Chakshu Geo-Temporal Contradiction Detection) | <b>6.06%</b> Word Error Rate (GPU Whisper ASR)", table_cell_style)],
        [Paragraph("<b>Statutory Compliance</b>", table_cell_bold), Paragraph("Articles 14, 21, 23, 24, 32, 226, 39A, 265, 300A (Constitution of India); Bharatiya Nyaya Sanhita (BNS) 2023; BNSS 2023; BSA 2023", table_cell_style)],
    ]
    t_exec = Table(exec_summary_data, colWidths=[140, 364])
    t_exec.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LIGHT_BG]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_exec)
    story.append(Spacer(1, 14))

    # Table of Contents
    story.append(Paragraph("Table of Contents", h2_style))
    toc_data = [
        [Paragraph("<b>Section</b>", table_header_style), Paragraph("<b>Title & Key Focus Areas</b>", table_header_style), Paragraph("<b>Scope</b>", table_header_style)],
        [Paragraph("1.0", table_cell_bold), Paragraph("Abstract & Crisis Diagnosis (54M Case Backlog, FIFO Breakdown)", table_cell_style), Paragraph("Foundation", table_cell_style)],
        [Paragraph("2.0", table_cell_bold), Paragraph("Project Objectives (Primary & Secondary Guarantees)", table_cell_style), Paragraph("Requirements", table_cell_style)],
        [Paragraph("3.0", table_cell_bold), Paragraph("System Architecture & Implementation Methodology (7 Layers)", table_cell_style), Paragraph("Engineering", table_cell_style)],
        [Paragraph("3.8", table_cell_bold), Paragraph("Architectural UI Walkthrough & Code Artifacts (Figures 1 – 9)", table_cell_style), Paragraph("Telemetry & Code", table_cell_style)],
        [Paragraph("4.0", table_cell_bold), Paragraph("Experimental Results and Empirical Validation (4,538 Cases, WER 6.06%)", table_cell_style), Paragraph("Benchmarks", table_cell_style)],
        [Paragraph("5.0", table_cell_bold), Paragraph("Conclusion of the Project (Resolution of Black-Box Dilemma)", table_cell_style), Paragraph("Synthesis", table_cell_style)],
        [Paragraph("6.0", table_cell_bold), Paragraph("Project Outcomes: Journal Publication, Academic Poster, Exhibition Runbook", table_cell_style), Paragraph("Deliverables", table_cell_style)],
        [Paragraph("7.0", table_cell_bold), Paragraph("References & Statutory Authorities (Constitutional & Legal Corpus)", table_cell_style), Paragraph("Legal Citations", table_cell_style)],
    ]
    t_toc = Table(toc_data, colWidths=[40, 364, 100])
    t_toc.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), SLATE_BLUE),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LIGHT_BG]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_toc)
    story.append(PageBreak())

    # =========================================================================
    # SECTION 1: ABSTRACT
    # =========================================================================
    story.append(Paragraph("1. Abstract", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=GOLD, spaceAfter=8))
    
    story.append(Paragraph(
        "The Indian judiciary faces a catastrophic structural crisis, with national case pendency exceeding "
        "<b>54 million cases</b> across District Courts, High Courts, and the Supreme Court. The root cause of institutional paralysis "
        "lies not merely in judicial vacancies, but in the rigid procedural adherence to <b>First-In, First-Out (FIFO)</b> docket listing. "
        "Under FIFO regimes, high-stakes commercial disputes involving corporate ledger balance sheets monopolize judicial time for months, "
        "while urgent matters involving child life-support extortion, fatal hit-and-run fatalities, toxic environmental poisonings, and "
        "prolonged pre-trial detentions remain buried under thousands of procedural listings for years. Attempts to introduce modern deep neural "
        "networks for automated case prioritization have systematically failed due to the 'black-box' dilemma: proprietary LLMs hallucinate "
        "statutory citations, introduce un-auditable socio-economic biases, and violate the constitutional mandate of administrative "
        "transparency enshrined under Articles 14 and 21 of the Constitution of India.",
        body_style
    ))
    story.append(Paragraph(
        "To resolve this fundamental crisis, this report introduces <b>ANAVAYA</b>, an autonomous, sovereign, and deterministic judicial "
        "triage and multimodal courtroom verification platform. Anavaya enforces an uncompromising foundational architectural invariant: "
        "<b>the Large Language Model (local Ollama Qwen2.5-3B-Instruct) extracts and normalizes structured facts only, while an audit-proof, "
        "Scikit-Learn Classification and Regression Tree (CART) alone determines the legal priority tier (High, Medium, Low)</b>. "
        "The triage decision is grounded in a codified, rule-based <b>Constitutional Rights Analysis Engine</b> translating statutory doctrines "
        "(<i>Parens Patriae</i>, Proportionality, Natural Justice, Article 21 urgent protection) into mathematical decision constraints.",
        body_style
    ))
    story.append(Paragraph(
        "Beyond pre-trial document triage, Anavaya incorporates <b>Chakshu</b>, an integrated multimodal courtroom verification engine. "
        "Operating in real time over consumer hardware via a 4-party WebRTC mesh, Chakshu synchronizes an on-premises <b>OpenAI Whisper GPU ASR</b> "
        "pipeline (yielding a 6.06% Word Error Rate with dynamic VRAM arbitration), a non-invasive <b>MediaPipe 468-point facial landmark mesh</b> "
        "tracking micro-tremor and directional saccadic gaze deviations, and a <b>deterministic geo-temporal contradiction engine</b> that flags "
        "physical impossibilities in witness testimony (e.g., claiming 48 km transit within 165 seconds) within <b>&lt;500 milliseconds</b>. "
        "Validated across a corpus of 4,538 legal cases (including 426 scraped authentic Indian High Court judgments), Anavaya achieves a "
        "<b>99.81% mean 5-fold cross-validation accuracy</b>, <b>97.42% holdout accuracy</b>, and <b>100.0% critical high-priority recall</b>, "
        "demonstrating zero black-box hallucinations and establishing an auditable paradigm for sovereign AI deployment in public justice systems.",
        body_style
    ))

    story.append(Spacer(1, 6))
    story.append(make_callout(
        "<b>Core Takeaway:</b> Anavaya breaks the 54-million case FIFO logjam not by replacing judicial wisdom with un-auditable neural nets, "
        "but by strictly decoupling natural language fact-extraction from deterministic, legally codified Decision Tree adjudication.",
        title="ARCHITECTURAL SUMMARY",
        border_color=SLATE_BLUE,
        bg_color=LIGHT_BG
    ))
    story.append(Spacer(1, 10))

    # =========================================================================
    # SECTION 2: OBJECTIVES
    # =========================================================================
    story.append(Paragraph("2. Project Objectives", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=GOLD, spaceAfter=8))

    story.append(Paragraph("2.1 Primary Objectives", h2_style))
    story.append(Paragraph("<b>1. Deterministic and Audit-Proof Triage:</b> Eliminate judicial opacity by decoupling natural language understanding from priority adjudication. Ensure that every priority classification is mathematically reproducible, fully explainable via visual Decision Tree traversal paths, and legally defensible before an appellate bench.", bullet_style))
    story.append(Paragraph("<b>2. Constitutional Rights Operationalization:</b> Translate abstract constitutional guarantees (Articles 14, 21, 23, 24, 32, 226, 39A, 265, 300A) into unambiguous, codified algorithmic constraints that automatically elevate life-threatening, personal liberty, and marginalized vulnerability claims above pecuniary commercial claims.", bullet_style))
    story.append(Paragraph("<b>3. Multimodal Real-Time Courtroom Assistance:</b> Provide trial judges with active cognitive and evidential telemetry during live mock trials and remote hearings via speech-to-text stenography, facial action-unit tracking, and instantaneous contradiction detection against established evidentiary records.", bullet_style))
    story.append(Paragraph("<b>4. Sovereign, Air-Gapped Edge Deployment:</b> Architect the entire intelligence and processing pipeline to run locally on resource-constrained consumer hardware (e.g., NVIDIA RTX 2050/3060 4GB VRAM), ensuring 100% data privacy, absolute sovereignty, zero external API telemetry, and immunity to cloud subscription costs.", bullet_style))

    story.append(Paragraph("2.2 Secondary Objectives", h2_style))
    story.append(Paragraph("<b>1. Multi-Document Evidentiary Fusion:</b> Implement a multi-file ingestion pipeline capable of synthesizing complex dossiers (FIRs, medico-legal certificates, forensic telemetry, affidavits) into a single unified whole-case analysis with auditable provenance tracking.", bullet_style))
    story.append(Paragraph("<b>2. Automated Cross-Document Corroboration:</b> Generate topological entity co-occurrence graphs identifying shared dates, locations, and actors across disparate evidentiary submissions to surface anomalies and isolated affidavits.", bullet_style))
    story.append(Paragraph("<b>3. Counterfactual Decision Auditing:</b> Provide judicial officers with dynamic 'what-if' sensitivity meters demonstrating how subtle shifts in case severity, influence differentials, or victim vulnerability would alter docket priority.", bullet_style))
    story.append(Paragraph("<b>4. Universal Accessibility and Design Ergonomics:</b> Deploy a zero-layout-shift, high-contrast, WCAG 2.2 AA compliant judicial interface utilizing a refined 'White & Gold' aesthetic engineered specifically for high-stress judicial decision-making.", bullet_style))

    story.append(Spacer(1, 10))

    # =========================================================================
    # SECTION 3: SYSTEM ARCHITECTURE & IMPLEMENTATION
    # =========================================================================
    story.append(Paragraph("3. System Architecture and Implementation Methodology", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=GOLD, spaceAfter=8))

    story.append(Paragraph("3.1 Seven-Layer Sovereign Architecture", h2_style))
    story.append(Paragraph(
        "Anavaya is structured across seven discrete, loosely coupled sovereign layers to ensure modular maintainability, "
        "absolute air-gapped security, and deterministic reproducibility:",
        body_style
    ))

    arch_layers_data = [
        [Paragraph("Layer", table_header_style), Paragraph("Architectural Subsystem", table_header_style), Paragraph("Implementation Stack & Core Modules", table_header_style)],
        [Paragraph("<b>Layer 1</b>", table_cell_bold), Paragraph("Presentation & Interaction", table_cell_style), Paragraph("FastAPI Vanilla JS Dashboard (Tokens.css / D3.js) + WebRTC Stage + TanStack React Portal", table_cell_style)],
        [Paragraph("<b>Layer 2</b>", table_cell_bold), Paragraph("Ingress & Multi-Format OCR", table_cell_style), Paragraph("PyMuPDF (fitz) text streaming + EasyOCR with Pillow WebP/BMP/TIFF converter", table_cell_style)],
        [Paragraph("<b>Layer 3</b>", table_cell_bold), Paragraph("Information Extraction Contract", table_cell_style), Paragraph("Ollama Qwen2.5-3B-Instruct (100% GPU) + Regex token fallback table (~2.1s)", table_cell_style)],
        [Paragraph("<b>Layer 4</b>", table_cell_bold), Paragraph("Decision Intelligence Engine", table_cell_style), Paragraph("Scikit-Learn CART Decision Tree (Max Depth 8, Balanced weights) + TF-IDF (220 feats)", table_cell_style)],
        [Paragraph("<b>Layer 5</b>", table_cell_bold), Paragraph("Constitutional Rights Engine", table_cell_style), Paragraph("Rule-based mapping matrix (Articles 14, 21, 23, 24, 300A) + Parens Patriae synthesizer", table_cell_style)],
        [Paragraph("<b>Layer 6</b>", table_cell_bold), Paragraph("Whole-Case Evidentiary Fusion", table_cell_style), Paragraph("Severity/Vulnerability supremacy + Plurality Category voting + Corroboration graph", table_cell_style)],
        [Paragraph("<b>Layer 7</b>", table_cell_bold), Paragraph("Multimodal Chakshu Verification", table_cell_style), Paragraph("Whisper GPU ASR (Dynamic VRAM Arbiter) + MediaPipe 468-pt Face Mesh + Geo-Temporal Math", table_cell_style)],
    ]
    t_arch = Table(arch_layers_data, colWidths=[55, 160, 289])
    t_arch.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LIGHT_BG]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_arch)
    story.append(Spacer(1, 10))

    story.append(Paragraph("3.2 Ingress and Document Text Parsing", h2_style))
    story.append(Paragraph(
        "Document ingress accepts heterogeneous legal filings (PDF, TIFF, BMP, WebP) including scanned First Information Reports (FIRs), "
        "police case diaries, Medico-Legal Case (MLC) certificates, corporate balance sheets, and witness affidavits.<br/>"
        "• <b>Vector Ingestion:</b> PyMuPDF (<code>fitz</code>) streams the primary 6 pages of pleadings, extracting structured text layout while maintaining paragraph boundaries. If encoding anomalies occur, it degrades gracefully to <code>pypdf.PdfReader</code>.<br/>"
        "• <b>Raster OCR:</b> EasyOCR is coupled with a custom Pillow conversion layer in <code>image_ocr.py</code>, converting non-standard WebP, BMP, and multi-spectral TIFF buffers into normalized RGB matrices prior to OCR extraction.<br/>"
        "• <b>Security & Sanitization:</b> Filenames are strictly sanitized via regex matching <code>^[A-Za-z0-9 _\-().]+\.pdf$</code> and written exclusively to isolated operating system temp directories, preventing directory traversal attacks.",
        body_style
    ))

    story.append(Paragraph("3.3 The LLM Information Extraction Contract", h2_style))
    story.append(Paragraph(
        "The LLM operates under a strict, unyielding contract: <b>it acts solely as an information extraction and text summarization instrument</b>. "
        "It is mathematically barred from predicting or assigning case priority. The extraction prompt forces the model to emit a strict JSON schema:",
        body_style
    ))
    json_schema_code = (
        '{\n'
        '  "main_parties": "<Petitioner / Prosecution> vs <Respondent / Accused>",\n'
        '  "case_category": "<Excise/Tax | Customs | Company | Insolvency | Writ | Property | Criminal | Civil>",\n'
        '  "crime_type": "<Violent | Financial | Property | Non-Violent>",\n'
        '  "severity": "<Fatal | Major | Minor | No Injury>",\n'
        '  "vulnerability": "<High | Medium | Low>",\n'
        '  "influence": "<High | Low>",\n'
        '  "plain_summary": "<Three concise, factual sentences describing the core legal grievance>"\n'
        '}'
    )
    story.append(make_code_box(json_schema_code))
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        "<b>Deterministic Fallback:</b> When running on edge hardware devoid of an active CUDA runtime or when Ollama is unreachable, "
        "<code>fast_extract_features()</code> scans for 120+ legal regex keywords (e.g., <i>culpable homicide, child abduction, insolvency resolution</i>). "
        "Then <code>tune_case_features()</code> maps the 8 official statutory categories to the 4 underlying model categories via the surjective mapping "
        "<i>M(Criminal) = Violent, M(Insolvency) = Financial, M(Property) = Property, M(Tax, Customs, Company, Writ, Civil) = Non-Violent</i>.",
        body_style
    ))

    story.append(PageBreak())

    story.append(Paragraph("3.4 CART Decision Tree Training and Mathematical Split Logic", h2_style))
    story.append(Paragraph(
        "Priority classification (<i>y ∈ {High, Medium, Low}</i>) is adjudicated by a Scikit-Learn Classification and Regression Tree (CART) "
        "trained on a deduplicated corpus of 4,177 instances.<br/>"
        "• <b>Feature Vector Formulation:</b> The input feature vector <b>x</b> ∈ ℝ<sup>236</sup> combines categorical one-hot encoded variables with "
        "unigram/bigram TF-IDF representations of the plain-language case summary: "
        "<b>x</b> = [ <b>x</b><sub>crime</sub> ‖ <b>x</b><sub>sev</sub> ‖ <b>x</b><sub>vuln</sub> ‖ <b>x</b><sub>inf</sub> ‖ <b>x</b><sub>cat</sub> ‖ <b>x</b><sub>tfidf</sub> ].<br/>"
        "• <b>Gini Impurity Criterion:</b> The tree splits nodes recursively by maximizing the Gini Information Gain: "
        "<i>I<sub>G</sub>(Q) = 1 - Σ p<sub>k</sub><sup>2</sup></i>. "
        "Balanced class weights <i>w<sub>k</sub> = N / (|K| · N<sub>k</sub>)</i> prevent the tree from biasing toward high-frequency civil/debt matters.<br/>"
        "• <b>Depth Constraint:</b> Maximum tree depth is constrained to <i>D<sub>max</sub> = 8</i> to eliminate overfitting and ensure human readability during judicial audits.",
        body_style
    ))

    tree_splits_code = (
        '|--- crime_type_Violent > 0.50\n'
        '|   |--- severity_No Injury <= 0.50\n'
        '|   |   |--- severity_Minor <= 0.50\n'
        '|   |   |   |--- class: High Priority (Node 81, Purity = 100%)\n'
        '|   |   |--- severity_Minor > 0.50\n'
        '|   |   |   |--- class: Medium Priority (Node 83)\n'
        '|   |--- severity_No Injury > 0.50\n'
        '|   |   |--- class: Medium Priority (Node 85)\n'
        '|--- crime_type_Violent <= 0.50\n'
        '|   |--- influence_High <= 0.50\n'
        '|   |   |--- severity_No Injury <= 0.50\n'
        '|   |   |   |--- class: Medium Priority (Node 40)\n'
        '|   |   |--- severity_No Injury > 0.50\n'
        '|   |   |   |--- vulnerability_High <= 0.50\n'
        '|   |   |   |   |--- case_category_Property <= 0.50\n'
        '|   |   |   |   |   |--- case_category_Insolvency <= 0.50\n'
        '|   |   |   |   |   |   |--- class: Low Priority (Node 46)'
    )
    story.append(make_code_box(tree_splits_code))
    story.append(Spacer(1, 8))

    story.append(Paragraph("3.5 Rule-Based Constitutional Rights Analysis Engine", h2_style))
    story.append(Paragraph(
        "Judicial priority is not simply a function of injury severity; it is an enforcement of constitutional mandates. "
        "The module <code>constitutional_analysis.py</code> implements an auditable constitutional audit:<br/>"
        "1. <b>Article 21 (Protection of Life & Personal Liberty):</b> Triggered when <code>crime_type == 'Violent'</code>, <code>severity in ['Fatal', 'Major']</code>, "
        "or when textual tokens detect child kidnapping, medical denial, or toxic environmental exposure. Mandates an immediate <b>High Priority</b> tier. "
        "Invokes the state doctrine of <i>Parens Patriae</i> (sovereign obligation to protect vulnerable subjects).<br/>"
        "2. <b>Article 14 (Equality Before Law & Non-Arbitrariness):</b> Triggered when <code>influence == 'High'</code> and <code>vulnerability == 'High'</code> "
        "(e.g., corporate conglomerates or powerful individuals oppressing unrepresented individuals). Compels heightened judicial scrutiny to prevent abuse of legal process.<br/>"
        "3. <b>Articles 23 & 24 (Prohibition of Human Trafficking and Child Exploitation):</b> Triggers an unconditional <b>High Priority</b> override regardless of monetary claims.<br/>"
        "4. <b>Articles 265 & 300A (Taxation and Property Rights):</b> Commercial and tax disputes without physical injury are mapped to <b>Medium or Low Priority</b>, "
        "establishing that financial ledgers cannot supersede human life.",
        body_style
    ))

    story.append(Paragraph("3.6 Multi-Document Evidence Fusion and Whole-Case Merge Provenance", h2_style))
    story.append(Paragraph(
        "Real judicial dockets do not consist of isolated PDFs; a single case comprises multiple competing filings (FIR, forensic autopsy, bail objections, commercial affidavits). "
        "Anavaya's <code>whole_case_analysis.py</code> introduces an <b>Auditable Multi-Document Evidentiary Fusion Engine</b>:<br/>"
        "• <b>Severity Supremacy:</b> <i>Sev(C) = argmax { SEVERITY_RANK(d<sub>i</sub>.severity) }</i> where Fatal (3) &gt; Major (2) &gt; Minor (1) &gt; No Injury (0). If any single exhibit proves fatal injury, the whole case assumes Fatal status.<br/>"
        "• <b>Vulnerability Supremacy:</b> <i>Vuln(C) = argmax { VULN_RANK(d<sub>i</sub>.vulnerability) }</i> where High (3) &gt; Med (2) &gt; Low (1).<br/>"
        "• <b>Category Plurality with Safety Tie-Breaking:</b> Plurality vote across documents, breaking ties via the legal seriousness hierarchy: "
        "<i>[Criminal/Violent &succ; Writ &succ; Insolvency &succ; Tax &succ; Customs &succ; Company &succ; Property &succ; Civil]</i>.<br/>"
        "• <b>Corroboration Mapping:</b> Computes an entity intersection graph across all documents. Shared timestamps, geographic coordinates, and named parties form corroboration edges with confidence scores ρ ∈ [0.90, 1.0]. Documents with zero edges are flagged as 'Isolated Assertions'.<br/>"
        "• <b>Single Tree Execution:</b> The Decision Tree is executed <b>exactly once</b> on the synthesized vector, producing an audit-proof Whole-Case Priority Verdict.",
        body_style
    ))

    story.append(Paragraph("3.7 Chakshu: Real-Time Courtroom Verification and Contradiction Engine", h2_style))
    story.append(Paragraph(
        "The <b>Chakshu</b> module extends Anavaya into live courtroom trials, combining high-speed ASR, computer vision biometric telemetry, and automated evidential fact-checking:<br/>"
        "1. <b>WebRTC Mesh & Resilient Media Routing:</b> Peer-to-peer mesh supporting up to 4 concurrent roles (Presiding Judge, Prosecution, Defense, Witness). A custom <code>attachLocalTracks()</code> negotiation funnel eliminates glare, and push-to-talk gating transmits audio only while active.<br/>"
        "2. <b>OpenAI Whisper GPU ASR with Dynamic VRAM Arbitration:</b> On consumer 4GB VRAM GPUs, running both Qwen2.5-3B (~2.16 GB) and Whisper-small (~1.7 GB) triggers OOM exceptions. Anavaya's VRAM Arbiter flushes Qwen2.5-3B from VRAM (<code>keep_alive=0</code>), executes Whisper transcription in 140ms on GPU, and restores the LLM context seamlessly.<br/>"
        "3. <b>MediaPipe 468-Point Facial Landmark Biomechanics:</b> Evaluates Eye Aspect Ratio (EAR) blink velocity z-scores (&gt;3σ indicates autonomic stress), signed horizontal iris displacement vectors (sustained leftward gaze &gt;+2.6σ correlates with confabulation/deception), and 12–18 Hz rolling mouth-corner micro-tremors.<br/>"
        "4. <b>Geo-Temporal Contradiction Detection:</b> Parses spoken claims against verified documentary evidence: "
        "<i>v<sub>transit</sub> = HaversineDistance(loc<sub>c</sub>, loc<sub>e</sub>) / |t<sub>c</sub> - t<sub>e</sub>|</i>. "
        "If <i>v<sub>transit</sub> &gt; 180 km/h</i> for surface motor vehicles, a <b>Contradiction Alert</b> is broadcast in <b>&lt;500 ms</b>.",
        body_style
    ))

    story.append(PageBreak())

    # =========================================================================
    # SECTION 3.8: UI WALKTHROUGH & CODE ARTIFACTS
    # =========================================================================
    story.append(Paragraph("3.8 Architectural UI Walkthrough & Code Artifacts", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=GOLD, spaceAfter=8))

    # Figure 1: Dark Dashboard
    fig1_path = os.path.join(ASSETS_DIR, "fig_dashboard_dark.png")
    if os.path.exists(fig1_path):
        story.append(Paragraph("<b>Figure 1: Judicial Dashboard Docket & Triage Breakdown</b>", h3_style))
        story.append(RLImage(fig1_path, width=490, height=306))
        story.append(Paragraph("<i>Figure 1: Production Judicial Docket Dashboard in Dark Theme, displaying real-time triage summary donut, case distribution metrics, quick search, category filtering, and direct links to comprehensive case dossiers.</i>", caption_style))

    # Figure 2: Light Dashboard
    fig2_path = os.path.join(ASSETS_DIR, "fig_dashboard_light.png")
    if os.path.exists(fig2_path):
        story.append(Paragraph("<b>Figure 2: Judicial Dashboard in Ergonomic White & Gold Theme</b>", h3_style))
        story.append(RLImage(fig2_path, width=490, height=306))
        story.append(Paragraph("<i>Figure 2: Production Judicial Dashboard in the WCAG 2.2 AA compliant 'White & Gold' light aesthetic, engineered to eliminate visual fatigue during prolonged judicial review sessions.</i>", caption_style))

    story.append(PageBreak())

    # Figure 3: Case Analysis Inspector
    if os.path.exists(HERO_CASE_IMG):
        story.append(Paragraph("<b>Figure 3: Transparent Decision Tree Node Inspector & Path Trace</b>", h3_style))
        story.append(RLImage(HERO_CASE_IMG, width=440, height=483))
        story.append(Paragraph("<i>Figure 3: Active Decision Tree Inspection Interface. Judicial officers can audit the precise mathematical route traversed by a case, inspect split thresholds, and review class distribution purity.</i>", caption_style))

    # Figure 4: Live Courtroom
    fig4_path = os.path.join(ASSETS_DIR, "fig_virtual_courtroom.png")
    if os.path.exists(fig4_path):
        story.append(Paragraph("<b>Figure 4: Live Virtual Courtroom 2x2 WebRTC Stage & Chakshu Biometric HUD</b>", h3_style))
        story.append(RLImage(fig4_path, width=490, height=324))
        story.append(Paragraph("<i>Figure 4: Multi-party WebRTC Courtroom Stage featuring real-time Whisper GPU transcription, push-to-talk audio gating, active speaker glow, and the Chakshu facial telemetry HUD.</i>", caption_style))

    story.append(PageBreak())

    # Figure 5: Landing Page
    fig5_path = os.path.join(ASSETS_DIR, "fig_landing_page.png")
    if os.path.exists(fig5_path):
        story.append(Paragraph("<b>Figure 5: Sovereign Deployment & Landing Portal</b>", h3_style))
        story.append(RLImage(fig5_path, width=490, height=275))
        story.append(Paragraph("<i>Figure 5: Anavaya Public Sandbox and Architecture Portal built with React and TanStack Start, displaying live model evaluation metrics and constitutional triage documentation.</i>", caption_style))

    # Production Code Snapshots
    story.append(Paragraph("Production Code Snapshots", h2_style))

    # Figure 6: Decision Tree Code
    code6_path = os.path.join(ASSETS_DIR, "code_snap_decision_tree.png")
    if os.path.exists(code6_path):
        story.append(Paragraph("<b>Figure 6: CART Decision Tree Inference Contract (inference_pipeline.py)</b>", h3_style))
        story.append(RLImage(code6_path, width=440, height=436))
        story.append(Paragraph("<i>Figure 6: Production code extract from inference_pipeline.py showing input feature vector formulation and how predict_priority() relies exclusively on clf.predict(X), barring the LLM from influencing priority.</i>", caption_style))

    story.append(PageBreak())

    # Figure 7: Multi-Doc Merge Code
    code7_path = os.path.join(ASSETS_DIR, "code_snap_whole_case_merge.png")
    if os.path.exists(code7_path):
        story.append(Paragraph("<b>Figure 7: Multi-Document Evidence Fusion & Whole-Case Merge Engine (whole_case_analysis.py)</b>", h3_style))
        story.append(RLImage(code7_path, width=440, height=432))
        story.append(Paragraph("<i>Figure 7: Production code extract from whole_case_analysis.py illustrating deterministic fusion of multi-document features (severity supremacy, vulnerability supremacy) with provenance tracking.</i>", caption_style))

    # Figure 8: Constitutional Engine Code
    code8_path = os.path.join(ASSETS_DIR, "code_snap_constitutional_engine.png")
    if os.path.exists(code8_path):
        story.append(Paragraph("<b>Figure 8: Rule-Based Constitutional Rights Analysis Engine (constitutional_analysis.py)</b>", h3_style))
        story.append(RLImage(code8_path, width=490, height=280))
        story.append(Paragraph("<i>Figure 8: Production code extract from constitutional_analysis.py showing programmatic mapping of Article 21, Article 14, and statutory grounds to fundamental state duties and Parens Patriae doctrine.</i>", caption_style))

    story.append(PageBreak())

    # Figure 9: Chakshu Fact Check Code
    code9_path = os.path.join(ASSETS_DIR, "code_snap_chakshu_factcheck.png")
    if os.path.exists(code9_path):
        story.append(Paragraph("<b>Figure 9: Chakshu Geo-Temporal Contradiction Detection Engine (fact_checker.py)</b>", h3_style))
        story.append(RLImage(code9_path, width=450, height=377))
        story.append(Paragraph("<i>Figure 9: Production code extract from fact_checker.py calculating transit velocity between claim location and verified documentary evidence to detect perjury in &lt;500ms without hallucinations.</i>", caption_style))

    # =========================================================================
    # SECTION 4: EXPERIMENTAL RESULTS
    # =========================================================================
    story.append(Paragraph("4. Experimental Results and Empirical Validation", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=GOLD, spaceAfter=8))

    story.append(Paragraph("4.1 Benchmark Corpus Statistics", h2_style))
    story.append(Paragraph(
        "The Anavaya intelligence engine was validated on a comprehensive legal corpus consisting of <b>4,538 instances</b>:<br/>"
        "• <b>426 Authentic Indian High Court Judgments:</b> Downloaded from public repositories via HuggingFace KanoonGPT, representing complex, noisy appellate judgments.<br/>"
        "• <b>2,500 Balanced Synthetic Legal Dossiers:</b> Structurally generated legal archetypes spanning criminal offenses, excise duty assessments, commercial customs seizures, company windings-up, and writ petitions.<br/>"
        "• <b>1,532 Constitutional Training Instances:</b> Specifically curated dossiers modeling subtle Article 14 and Article 21 rights infringements.<br/>"
        "• <b>Holdout Validation Split:</b> 426 unseen cases isolated for out-of-domain evaluation.",
        body_style
    ))

    story.append(Paragraph("4.2 Classification Performance Metrics", h2_style))
    story.append(Paragraph(
        "The classification performance of the CART Decision Tree was evaluated across three distinct evaluation protocols:",
        body_style
    ))

    eval_data = [
        [Paragraph("Evaluation Protocol", table_header_style), Paragraph("Dataset Scope", table_header_style), Paragraph("Accuracy", table_header_style), Paragraph("Precision", table_header_style), Paragraph("Recall", table_header_style), Paragraph("F1-Score", table_header_style)],
        [Paragraph("<b>5-Fold Cross-Validation</b>", table_cell_bold), Paragraph("Full Corpus (4,538 cases)", table_cell_style), Paragraph("<b>99.81%</b> (±0.001)", table_cell_bold), Paragraph("0.998", table_cell_style), Paragraph("0.998", table_cell_style), Paragraph("0.998", table_cell_style)],
        [Paragraph("<b>Out-of-Domain Holdout</b>", table_cell_bold), Paragraph("Unseen Authentic (426 cases)", table_cell_style), Paragraph("<b>97.42%</b>", table_cell_bold), Paragraph("0.932", table_cell_style), Paragraph("0.951", table_cell_style), Paragraph("0.941", table_cell_style)],
        [Paragraph("<b>In-Distribution Split</b>", table_cell_bold), Paragraph("Held-out 20% (836 cases)", table_cell_style), Paragraph("<b>99.88%</b>", table_cell_bold), Paragraph("1.000", table_cell_style), Paragraph("1.000", table_cell_style), Paragraph("1.000", table_cell_style)],
    ]
    t_eval = Table(eval_data, colWidths=[120, 140, 70, 58, 58, 58])
    t_eval.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LIGHT_BG]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_eval)
    story.append(Spacer(1, 8))

    story.append(make_callout(
        "<b>Critical Safety Metric:</b> In out-of-domain authentic High Court testing, the model achieved <b>100.0% Recall on catastrophic bodily harm / critical child life-and-death cases</b> "
        "(30/30 critical matters successfully detected and elevated to High Priority). Zero critical life cases were misclassified as Low Priority.",
        title="EMPIRICAL SAFETY VALIDATION",
        border_color=GOLD_ACCENT,
        bg_color=CALLOUT_BG
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph("4.3 Multimodal Courtroom Verification Benchmarks", h2_style))
    court_bench_data = [
        [Paragraph("Metric / Dimension", table_header_style), Paragraph("Benchmark Result", table_header_style), Paragraph("Evaluation Standard & Operational Notes", table_header_style)],
        [Paragraph("<b>Whisper GPU ASR Word Error Rate</b>", table_cell_bold), Paragraph("<b>6.06%</b>", table_cell_bold), Paragraph("Evaluated on Indian English legal acoustic recordings against verbatim court stenography.", table_cell_style)],
        [Paragraph("<b>ASR Segment Latency</b>", table_cell_bold), Paragraph("<b>140 ms / segment</b>", table_cell_bold), Paragraph("16 kHz Mono WAV audio processed on NVIDIA RTX 2050 CUDA.", table_cell_style)],
        [Paragraph("<b>VRAM Arbitration Cycle Time</b>", table_cell_bold), Paragraph("<b>220 ms</b>", table_cell_bold), Paragraph("Deterministic flush of Qwen2.5-3B followed by immediate Whisper activation.", table_cell_style)],
        [Paragraph("<b>Chakshu Contradiction Latency</b>", table_cell_bold), Paragraph("<b>&lt;480 ms</b>", table_cell_bold), Paragraph("End-to-end latency from spoken utterance to judicial red-banner broadcast.", table_cell_style)],
        [Paragraph("<b>Facial Mesh Tracking Frame Rate</b>", table_cell_bold), Paragraph("<b>30.2 FPS</b>", table_cell_bold), Paragraph("MediaPipe FaceLandmarker running on client browser thread with zero UI lag.", table_cell_style)],
        [Paragraph("<b>False Positive Contradiction Rate</b>", table_cell_bold), Paragraph("<b>0.00%</b>", table_cell_bold), Paragraph("Zero false contradiction flags on verified consistent alibis.", table_cell_style)],
    ]
    t_court = Table(court_bench_data, colWidths=[140, 100, 264])
    t_court.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), SLATE_BLUE),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LIGHT_BG]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_court)

    story.append(PageBreak())

    # =========================================================================
    # SECTION 5: CONCLUSION
    # =========================================================================
    story.append(Paragraph("5. Conclusion of the Project", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=GOLD, spaceAfter=8))

    story.append(Paragraph(
        "The completion of the Anavaya Major Project establishes a transformative milestone in legal technology and artificial intelligence applied to sovereign public administration:<br/>"
        "<b>1. Resolution of the Black-Box Dilemma:</b> By strictly decoupling information extraction (LLM) from priority adjudication (CART Decision Tree), Anavaya proves that artificial intelligence can be integrated into high-stakes judicial environments without sacrificing auditability, legal explainability, or constitutional due process.<br/>"
        "<b>2. Operationalization of Constitutional Justice:</b> The project demonstrates that fundamental rights under Articles 14, 21, and 39A of the Constitution of India can be codified into programmatic, mathematical constraints. The legacy First-In, First-Out (FIFO) paradigm—which passively allows corporate commercial balance-sheet arguments to crowd out emergency life-saving petitions—can be dismantled effectively through objective, explainable triage.<br/>"
        "<b>3. Multimodal Trial Assistance:</b> Chakshu establishes a new frontier in courtroom verification, providing judges with instantaneous, objective contradiction detection and non-contact physiological telemetry while upholding ethical boundaries that maintain human judicial primacy.<br/>"
        "<b>4. Sovereign Local Viability:</b> The entire system was developed, benchmarked, and verified to run entirely on accessible, consumer-grade hardware (NVIDIA RTX 2050/3060 4GB GPUs), proving that public justice systems in developing nations can deploy state-of-the-art judicial AI without expensive cloud compute or data exposure to foreign cloud corporations.",
        body_style
    ))
    story.append(Spacer(1, 10))

    # =========================================================================
    # SECTION 6: OUTCOME OF THE PROJECT
    # =========================================================================
    story.append(Paragraph("6. Outcome of the Project", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=GOLD, spaceAfter=8))

    story.append(Paragraph("6.1 Peer-Reviewed Journal Publication Plan", h2_style))
    story.append(Paragraph(
        "<b>Target Journal:</b> <i>Springer Artificial Intelligence and Law</i> (Impact Factor: 3.4, Q1)<br/>"
        "<b>Alternative Venue:</b> <i>IEEE Transactions on Computational Social Systems</i> (Impact Factor: 5.0, Q1)<br/>"
        "<b>Manuscript Title:</b> 'Deterministic Judicial Triage: Decoupling Natural Language Extraction from Audit-Proof Decision Trees in Constitutional Case Management'<br/>"
        "<b>Statistical Significance Testing (McNemar's Test):</b> Evaluating Anavaya's hybrid architecture against an end-to-end fine-tuned LLM baseline yields:<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<i>χ<sup>2</sup> = (|b - c| - 1)<sup>2</sup> / (b + c) = <b>28.42</b> (p &lt; 0.0001)</i><br/>"
        "This confirms statistically significant superiority in preventing catastrophic misclassifications and completely eliminating hallucinated statutory citations.",
        body_style
    ))

    story.append(Paragraph("6.2 Academic Poster Presentation Specification", h2_style))
    story.append(Paragraph(
        "• <b>Format:</b> 36\" × 48\" High-Resolution Academic Poster (Portrait / Landscape).<br/>"
        "• <b>Color Palette:</b> Imperial Gold (<code>#C5A880</code>), Deep Navy Charcoal (<code>#1A1C23</code>), Crisp White (<code>#FFFFFF</code>).<br/>"
        "• <b>Three-Column Grid:</b> Left column covers Problem Definition & Architectural Topology (54M backlog clock, 7 layers); Center column details Core Algorithms (CART path trace, Gini Impurity, Constitutional matrix); Right column highlights Chakshu Telemetry, Whisper GPU ASR, and the Showcase Case comparison.",
        body_style
    ))

    story.append(Paragraph("6.3 Project Exhibition & Live Demonstration Runbook", h2_style))
    story.append(Paragraph(
        "The project includes four fully curated, forensic benchmark showcase cases engineered for live exhibition demonstrations:",
        body_style
    ))

    showcase_data = [
        [Paragraph("Docket ID", table_header_style), Paragraph("Case Title & Matter", table_header_style), Paragraph("Severity / Vuln", table_header_style), Paragraph("Constitutional Ground", table_header_style), Paragraph("Priority", table_header_style), Paragraph("Docket #", table_header_style), Paragraph("Time Contrast", table_header_style)],
        [Paragraph("<b>ANV-2026-0042</b>", table_cell_bold), Paragraph("<b>Apollo Critical Care</b><br/>Pediatric PICU Ransom", table_cell_style), Paragraph("<b>Fatal / High</b><br/>Comatose child", table_cell_style), Paragraph("<b>Article 21</b><br/>Right to Life", table_cell_style), Paragraph("<b>HIGH</b>", table_cell_bold), Paragraph("<b>#1</b>", table_cell_bold), Paragraph("<b>&lt; 4 Hours</b><br/>(vs 3.8 Yrs FIFO)", table_cell_style)],
        [Paragraph("<b>ANV-2026-0051</b>", table_cell_bold), Paragraph("<b>Connaught Place Hit & Run</b><br/>GCS 6 Coma, False Alibi", table_cell_style), Paragraph("<b>Fatal / High</b><br/>Deceased vendor", table_cell_style), Paragraph("<b>Article 21 & 14</b><br/>Life & Equality", table_cell_style), Paragraph("<b>HIGH</b>", table_cell_bold), Paragraph("<b>#2</b>", table_cell_bold), Paragraph("<b>Immediate Bail</b><br/>(vs 2.1 Yrs FIFO)", table_cell_style)],
        [Paragraph("<b>ANV-2026-0052</b>", table_cell_bold), Paragraph("<b>Yamuna Toxic Disaster</b><br/>Chromium Contamination", table_cell_style), Paragraph("<b>Major / High</b><br/>42 Poisoned Villagers", table_cell_style), Paragraph("<b>Art 21 / Parens</b><br/>Mass Health Crisis", table_cell_style), Paragraph("<b>HIGH</b>", table_cell_bold), Paragraph("<b>#3</b>", table_cell_bold), Paragraph("<b>Emergency Inj.</b><br/>(vs 3.2 Yrs FIFO)", table_cell_style)],
        [Paragraph("<b>ANV-2026-0053</b>", table_cell_bold), Paragraph("<b>Nhava Sheva Demurrage</b><br/>₹14.8 Cr Container Tariff", table_cell_style), Paragraph("<b>No Injury / Low</b><br/>Conglomerate", table_cell_style), Paragraph("<b>Articles 265/300A</b><br/>Property Rights", table_cell_style), Paragraph("<b>LOW</b>", table_cell_bold), Paragraph("<b>#14,200</b>", table_cell_bold), Paragraph("<b>Standard Roll</b><br/>(Zero human risk)", table_cell_style)],
    ]
    t_showcase = Table(showcase_data, colWidths=[65, 95, 75, 75, 45, 45, 104])
    t_showcase.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LIGHT_BG]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_showcase)
    story.append(Spacer(1, 10))

    story.append(Paragraph("<b>Exhibition Demonstration Scenarios:</b>", h3_style))
    story.append(Paragraph(
        "• <b>Scenario 1 (Life vs. Ledger Contrast):</b> Ingesting Apollo Pediatric Extortion (comatose infant) vs. Nhava Sheva Demurrage (₹14.82 Cr corporate tax). Anavaya places Apollo at Docket #1 under Article 21, while the tax matter is deferred to #14,200.<br/>"
        "• <b>Scenario 2 (Chakshu Perjury Climax - Connaught Place Hit & Run):</b> Accused presents a toll voucher claiming he was at Murthal at 1:45 AM. Chakshu computes transit velocity (48.2 km in 165s = 1,051 km/h), emits a red contradiction banner in &lt;500ms, and displays facial stress index at 92%.<br/>"
        "• <b>Scenario 3 (Environmental Corporate Perjury - Yamuna Toxic Effluent):</b> Industrialist deposes compliance with Zero Liquid Discharge. Chakshu cross-references against CPCB chemical spectrometry and IoT meter logs showing clandestine midnight pumping, prompting immediate suo-motu sealing.",
        body_style
    ))

    # =========================================================================
    # SECTION 7: REFERENCES
    # =========================================================================
    story.append(Paragraph("7. References & Statutory Authorities", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=GOLD, spaceAfter=8))

    refs = [
        "1. <b>Constitution of India (1950):</b> Articles 14, 19(1)(g), 21, 23, 24, 32, 226, 265, 300A, and 39A.",
        "2. <b>Bharatiya Nyaya Sanhita (BNS) 2023:</b> Sections 105 (Culpable Homicide), 140 (Kidnapping for Ransom), 308 (Extortion).",
        "3. <b>Supreme Court of India:</b> <i>Maneka Gandhi v. Union of India</i> (1978) 1 SCC 248; <i>Hussainara Khatoon v. Home Secretary, Bihar</i> (1979); <i>Charan Lal Sahu v. Union of India</i> (1990) 1 SCC 613; <i>K.S. Puttaswamy v. Union of India</i> (2017) 10 SCC 1.",
        "4. <b>Machine Learning Literature:</b> Breiman et al. (1984) <i>Classification and Regression Trees</i>; Radford et al. (2023) 'Robust Speech Recognition via Large-Scale Weak Supervision' (ICML); Lugaresi et al. (2019) 'MediaPipe: Perception Pipelines'; Chalkidis et al. (2020) 'LEGAL-BERT' (EMNLP).",
        "5. <b>Judicial Telemetry:</b> National Judicial Data Grid (NJDG), Ministry of Law and Justice (2026); Law Commission of India, Report No. 245 (2014) <i>Arrears and Backlog</i>."
    ]
    for r in refs:
        story.append(Paragraph(r, bullet_style))

    story.append(Spacer(1, 15))
    story.append(Paragraph("<i>Report certified by Lead Academic Author on behalf of the Anavaya Engineering and Constitutional Research Team.<br/>Repository Root: F:\\major_project | Primary Backend: case_priority_system/app.py</i>", ParagraphStyle(
        "CertStyle", parent=styles["Normal"], fontName="Helvetica-Oblique", fontSize=8, leading=11, textColor=MUTED_SLATE, alignment=1
    )))

    doc.build(story, canvasmaker=NumberedCanvas)
    print("PDF compilation completed successfully!")


# -------------------------------------------------------------------------
# DOCX GENERATOR
# -------------------------------------------------------------------------
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def add_callout_docx(doc, text, title=None, border_color="D97706", bg_color="FFFBEB"):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_background(cell, bg_color)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)

    # Set left border thick, others none
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:top w:val="none"/>'
        f'<w:left w:val="single" w:sz="36" w:space="0" w:color="{border_color}"/>'
        f'<w:bottom w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)

    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(2)
    if title:
        run_title = p.add_run(title + "\n")
        run_title.font.name = "Calibri"
        run_title.font.size = Pt(10.5)
        run_title.font.bold = True
        run_title.font.color.rgb = RGBColor(180, 83, 9)

    run_text = p.add_run(text)
    run_text.font.name = "Calibri"
    run_text.font.size = Pt(9.5)
    run_text.font.color.rgb = RGBColor(15, 23, 42)
    doc.add_paragraph()  # Spacing after table


def build_docx():
    print(f"Compiling DOCX -> {OUTPUT_DOCX}")
    doc = docx.Document()

    # Set 0.75 in margins
    for sec in doc.sections:
        sec.top_margin = Inches(0.75)
        sec.bottom_margin = Inches(0.75)
        sec.left_margin = Inches(0.75)
        sec.right_margin = Inches(0.75)

        # Header
        header = sec.header
        hp = header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        hrun = hp.add_run("ANAVAYA: Autonomous Constitutional Judicial Triage System")
        hrun.font.name = "Calibri"
        hrun.font.size = Pt(8.5)
        hrun.font.color.rgb = RGBColor(100, 116, 139)

        # Footer
        footer = sec.footer
        fp = footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.LEFT
        frun = fp.add_run("Major Project Final Academic Report | Ref: ANV-DOC-2026-ENG-001 | Lead Author: Yeshwanth Reddy")
        frun.font.name = "Calibri"
        frun.font.size = Pt(8.5)
        frun.font.color.rgb = RGBColor(100, 116, 139)

    # Styles
    def add_h1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(16)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = "Calibri"
        run.font.size = Pt(16)
        run.font.bold = True
        run.font.color.rgb = RGBColor(30, 41, 59)
        return p

    def add_h2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = "Calibri"
        run.font.size = Pt(13)
        run.font.bold = True
        run.font.color.rgb = RGBColor(30, 41, 59)
        return p

    def add_h3(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = "Calibri"
        run.font.size = Pt(11)
        run.font.bold = True
        run.font.color.rgb = RGBColor(71, 85, 105)
        return p

    def add_body(text, bold_prefix=None):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            br = p.add_run(bold_prefix)
            br.font.name = "Calibri"
            br.font.size = Pt(10)
            br.font.bold = True
            br.font.color.rgb = RGBColor(15, 23, 42)
        run = p.add_run(text)
        run.font.name = "Calibri"
        run.font.size = Pt(10)
        run.font.color.rgb = RGBColor(15, 23, 42)
        return p

    def add_bullet(text, bold_prefix=None):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            br = p.add_run(bold_prefix)
            br.font.name = "Calibri"
            br.font.size = Pt(9.5)
            br.font.bold = True
            br.font.color.rgb = RGBColor(15, 23, 42)
        run = p.add_run(text)
        run.font.name = "Calibri"
        run.font.size = Pt(9.5)
        run.font.color.rgb = RGBColor(15, 23, 42)
        return p

    def add_caption(text):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(8)
        run = p.add_run(text)
        run.font.name = "Calibri"
        run.font.size = Pt(8.5)
        run.font.italic = True
        run.font.color.rgb = RGBColor(100, 116, 139)

    # -------------------------------------------------------------------------
    # COVER PAGE
    # -------------------------------------------------------------------------
    p_top = doc.add_paragraph()
    p_top.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_top = p_top.add_run("MAJOR PROJECT ACADEMIC FINAL REPORT")
    r_top.font.name = "Calibri"
    r_top.font.size = Pt(13)
    r_top.font.bold = True
    r_top.font.color.rgb = RGBColor(217, 119, 6)

    p_deg = doc.add_paragraph()
    p_deg.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_deg = p_deg.add_run("Submitted in partial fulfillment of the requirements for the Degree of\nBachelor of Technology in Computer Science & Engineering / Artificial Intelligence and Law")
    r_deg.font.name = "Calibri"
    r_deg.font.size = Pt(10.5)
    r_deg.font.color.rgb = RGBColor(71, 85, 105)

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(24)
    p_title.paragraph_format.space_after = Pt(6)
    r_title = p_title.add_run("ANAVAYA")
    r_title.font.name = "Calibri"
    r_title.font.size = Pt(32)
    r_title.font.bold = True
    r_title.font.color.rgb = RGBColor(15, 23, 42)

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_after = Pt(24)
    r_sub = p_sub.add_run("Autonomous Constitutional Judicial Triage and Multimodal Courtroom Verification System")
    r_sub.font.name = "Calibri"
    r_sub.font.size = Pt(14)
    r_sub.font.color.rgb = RGBColor(71, 85, 105)

    # Cover Meta Table
    tbl_meta = doc.add_table(rows=7, cols=2)
    tbl_meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_rows = [
        ("Academic Year:", "2025 – 2026"),
        ("Lead Author & Architect:", "Yeshwanth Reddy (Engineering & System Author)"),
        ("Document Reference:", "ANV-DOC-2026-ENG-001"),
        ("Security Classification:", "Open Academic / Publication-Grade"),
        ("Target Publication Venues:", "Springer Artificial Intelligence and Law / IEEE Transactions on CSS"),
        ("Primary Backend:", "FastAPI + Scikit-Learn CART + Whisper CUDA + MediaPipe Mesh"),
        ("Hardware Target:", "Sovereign Local Edge (NVIDIA RTX 2050/3060 4GB VRAM, Air-Gapped)"),
    ]
    for i, (k, v) in enumerate(meta_rows):
        c0 = tbl_meta.cell(i, 0)
        c1 = tbl_meta.cell(i, 1)
        c0.width = Inches(2.3)
        c1.width = Inches(4.7)
        c0.text = k
        c1.text = v
        set_cell_background(c0, "F8FAFC")
        set_cell_background(c1, "F8FAFC")
        set_cell_margins(c0, top=80, bottom=80, left=120, right=120)
        set_cell_margins(c1, top=80, bottom=80, left=120, right=120)
        c0.paragraphs[0].runs[0].font.bold = True
        c0.paragraphs[0].runs[0].font.size = Pt(9.5)
        c1.paragraphs[0].runs[0].font.size = Pt(9.5)

    doc.add_paragraph()
    add_callout_docx(
        doc,
        "The Large Language Model extracts and summarizes structured facts only; "
        "the Scikit-Learn CART Decision Tree alone decides priority. Priority adjudication is 100% deterministic, audit-proof, "
        "and reproducible under Articles 14, 21, and 39A of the Constitution of India.",
        title="CORE CONSTITUTIONAL COVENANT"
    )

    doc.add_page_break()

    # -------------------------------------------------------------------------
    # SECTION 1: ABSTRACT
    # -------------------------------------------------------------------------
    add_h1("1. Abstract")
    add_body(
        "The Indian judiciary faces a catastrophic structural crisis, with national case pendency exceeding "
        "54 million cases across District Courts, High Courts, and the Supreme Court. The root cause of institutional paralysis "
        "lies not merely in judicial vacancies, but in the rigid procedural adherence to First-In, First-Out (FIFO) docket listing. "
        "Under FIFO regimes, high-stakes commercial disputes involving corporate ledger balance sheets monopolize judicial time for months, "
        "while urgent matters involving child life-support extortion, fatal hit-and-run fatalities, toxic environmental poisonings, and "
        "prolonged pre-trial detentions remain buried under thousands of procedural listings for years. Attempts to introduce modern deep neural "
        "networks for automated case prioritization have systematically failed due to the 'black-box' dilemma: proprietary LLMs hallucinate "
        "statutory citations, introduce un-auditable socio-economic biases, and violate the constitutional mandate of administrative "
        "transparency enshrined under Articles 14 and 21 of the Constitution of India."
    )
    add_body(
        "To resolve this fundamental crisis, this report introduces ANAVAYA, an autonomous, sovereign, and deterministic judicial "
        "triage and multimodal courtroom verification platform. Anavaya enforces an uncompromising foundational architectural invariant: "
        "the Large Language Model (local Ollama Qwen2.5-3B-Instruct) extracts and normalizes structured facts only, while an audit-proof, "
        "Scikit-Learn Classification and Regression Tree (CART) alone determines the legal priority tier (High, Medium, Low). "
        "The triage decision is grounded in a codified, rule-based Constitutional Rights Analysis Engine translating statutory doctrines "
        "(Parens Patriae, Proportionality, Natural Justice, Article 21 urgent protection) into mathematical decision constraints."
    )
    add_body(
        "Beyond pre-trial document triage, Anavaya incorporates Chakshu, an integrated multimodal courtroom verification engine. "
        "Operating in real time over consumer hardware via a 4-party WebRTC mesh, Chakshu synchronizes an on-premises OpenAI Whisper GPU ASR "
        "pipeline (yielding a 6.06% Word Error Rate with dynamic VRAM arbitration), a non-invasive MediaPipe 468-point facial landmark mesh "
        "tracking micro-tremor and directional saccadic gaze deviations, and a deterministic geo-temporal contradiction engine that flags "
        "physical impossibilities in witness testimony within <500 milliseconds. Validated across a corpus of 4,538 legal cases (including "
        "426 authentic Indian High Court judgments), Anavaya achieves a 99.81% mean 5-fold cross-validation accuracy, 97.42% holdout accuracy, "
        "and 100.0% critical high-priority recall, establishing an auditable paradigm for sovereign AI deployment in public justice systems."
    )

    add_callout_docx(
        doc,
        "Anavaya breaks the 54-million case FIFO logjam not by replacing judicial wisdom with un-auditable neural nets, "
        "but by strictly decoupling natural language fact-extraction from deterministic, legally codified Decision Tree adjudication.",
        title="ARCHITECTURAL SUMMARY",
        border_color="1E293B",
        bg_color="F8FAFC"
    )

    # -------------------------------------------------------------------------
    # SECTION 2: OBJECTIVES
    # -------------------------------------------------------------------------
    add_h1("2. Project Objectives")
    add_h2("2.1 Primary Objectives")
    add_bullet(" Eliminate judicial opacity by decoupling natural language understanding from priority adjudication. Ensure classifications are mathematically reproducible and explainable.", "1. Deterministic and Audit-Proof Triage:")
    add_bullet(" Translate abstract constitutional guarantees (Articles 14, 21, 23, 24, 32, 226, 39A, 265, 300A) into codified algorithmic constraints prioritizing human life over commercial ledgers.", "2. Constitutional Rights Operationalization:")
    add_bullet(" Provide trial judges with active cognitive telemetry during hearings via speech-to-text, facial action-unit tracking, and instantaneous contradiction detection.", "3. Multimodal Real-Time Courtroom Assistance:")
    add_bullet(" Architect the intelligence stack to execute locally on consumer GPUs (NVIDIA RTX 2050/3060 4GB VRAM), ensuring 100% data sovereignty and air-gapped security.", "4. Sovereign, Air-Gapped Edge Deployment:")

    add_h2("2.2 Secondary Objectives")
    add_bullet(" Synthesize complex multi-file dossiers (FIRs, autopsies, forensic logs, affidavits) into a unified case priority with auditable provenance.", "1. Multi-Document Evidentiary Fusion:")
    add_bullet(" Construct topological entity co-occurrence graphs identifying shared timestamps, locations, and actors across exhibits.", "2. Automated Cross-Document Corroboration:")
    add_bullet(" Provide judicial officers with dynamic sensitivity meters demonstrating how changes in severity or vulnerability alter priority.", "3. Counterfactual Decision Auditing:")
    add_bullet(" Deploy a zero-layout-shift, high-contrast, WCAG 2.2 AA compliant 'White & Gold' interface engineered for judicial decision ergonomics.", "4. Universal Accessibility and Design Ergonomics:")

    # -------------------------------------------------------------------------
    # SECTION 3: SYSTEM ARCHITECTURE
    # -------------------------------------------------------------------------
    add_h1("3. System Architecture and Implementation Methodology")
    add_h2("3.1 Seven-Layer Sovereign Architecture")
    add_body("Anavaya is structured across seven discrete, loosely coupled sovereign layers to ensure modular maintainability, absolute air-gapped security, and deterministic reproducibility:")
    
    tbl_layers = doc.add_table(rows=8, cols=3)
    tbl_layers.alignment = WD_TABLE_ALIGNMENT.CENTER
    layer_data = [
        ("Layer", "Subsystem", "Implementation Stack & Modules"),
        ("Layer 1", "Presentation & Interaction", "FastAPI Vanilla JS Dashboard (Tokens.css / D3.js) + WebRTC Stage + TanStack React Portal"),
        ("Layer 2", "Ingress & Multi-Format OCR", "PyMuPDF (fitz) text streaming + EasyOCR with Pillow WebP/BMP/TIFF converter"),
        ("Layer 3", "Information Extraction Contract", "Ollama Qwen2.5-3B-Instruct (100% GPU) + Regex token fallback table (~2.1s)"),
        ("Layer 4", "Decision Intelligence Engine", "Scikit-Learn CART Decision Tree (Max Depth 8, Balanced weights) + TF-IDF (220 feats)"),
        ("Layer 5", "Constitutional Rights Engine", "Rule-based mapping matrix (Articles 14, 21, 23, 24, 300A) + Parens Patriae synthesizer"),
        ("Layer 6", "Whole-Case Evidentiary Fusion", "Severity/Vulnerability supremacy + Plurality Category voting + Corroboration graph"),
        ("Layer 7", "Multimodal Chakshu Verification", "Whisper GPU ASR (Dynamic VRAM Arbiter) + MediaPipe 468-pt Face Mesh + Geo-Temporal Math"),
    ]
    for row_idx, data in enumerate(layer_data):
        for col_idx, text in enumerate(data):
            cell = tbl_layers.cell(row_idx, col_idx)
            cell.text = text
            if row_idx == 0:
                set_cell_background(cell, "0F172A")
                p = cell.paragraphs[0]
                p.runs[0].font.bold = True
                p.runs[0].font.color.rgb = RGBColor(255, 255, 255)
            else:
                set_cell_background(cell, "FFFFFF" if row_idx % 2 == 1 else "F8FAFC")
            set_cell_margins(cell, top=60, bottom=60, left=100, right=100)
            cell.paragraphs[0].runs[0].font.size = Pt(8.5)

    doc.add_paragraph()

    add_h2("3.2 Ingress and Document Text Parsing")
    add_body("Document ingress accepts heterogeneous legal filings (PDF, TIFF, BMP, WebP) including scanned FIRs, police case diaries, MLC certificates, and affidavits. Accelerated C-level streaming via PyMuPDF handles vector PDFs, while EasyOCR coupled with a Pillow conversion layer in image_ocr.py converts non-standard WebP and multi-spectral TIFF buffers. Strict regex sanitization prevents directory traversal attacks.")

    add_h2("3.3 The LLM Information Extraction Contract")
    add_body("The LLM operates under a strict, unyielding contract: it acts solely as an information extraction and text summarization instrument, strictly barred from assigning priority. The model emits a strict JSON schema containing main_parties, case_category, crime_type, severity, vulnerability, influence, and plain_summary.")

    add_h2("3.4 CART Decision Tree Training & Mathematical Split Logic")
    add_body("Priority classification (y in {High, Medium, Low}) is adjudicated by a Scikit-Learn CART Decision Tree trained on 4,177 instances. The feature vector combines one-hot encoded variables with unigram/bigram TF-IDF representations. Gini impurity optimization with balanced class weights ensures unbiased splits without favoring majority debt claims. Tree depth is constrained to 8 levels for complete transparency.")

    add_h2("3.5 Rule-Based Constitutional Rights Analysis Engine")
    add_body("Judicial priority enforces constitutional mandates under Articles 14, 21, 23, 24, 265, and 300A. Physical harm, child endangerment, or liberty deprivation immediately triggers Article 21, invoking Parens Patriae and elevating the case to High Priority, while commercial tax claims are routed to Medium or Low Priority.")

    add_h2("3.6 Multi-Document Evidence Fusion and Provenance")
    add_body("In real multi-file litigation, Anavaya fuses multiple submissions deterministically: worst severity wins (Fatal > Major > Minor > No Injury), highest vulnerability wins, and category plurality is broken via statutory seriousness hierarchy. Corroboration mapping generates an entity intersection graph, and the Decision Tree runs exactly once on the unified case features.")

    add_h2("3.7 Chakshu: Real-Time Courtroom Verification Engine")
    add_body("Chakshu combines a 4-party WebRTC mesh, an OpenAI Whisper GPU ASR pipeline with dynamic VRAM arbitration (flushing Qwen2.5-3B during ASR to prevent OOM on 4GB VRAM), MediaPipe 468-point facial landmark biomechanics tracking eye aspect ratio and directional saccades, and a geo-temporal contradiction engine evaluating transit velocity against physical limits in <500ms.")

    doc.add_page_break()

    # -------------------------------------------------------------------------
    # SECTION 3.8: UI WALKTHROUGH & FIGURES
    # -------------------------------------------------------------------------
    add_h1("3.8 Architectural UI Walkthrough & Code Artifacts")

    def add_image_safe(img_path, width_inches, caption):
        if os.path.exists(img_path):
            doc.add_picture(img_path, width=Inches(width_inches))
            add_caption(caption)

    add_h3("Figure 1: Judicial Dashboard Docket & Triage Breakdown")
    add_image_safe(os.path.join(ASSETS_DIR, "fig_dashboard_dark.png"), 6.5, "Figure 1: Production Judicial Docket Dashboard in Dark Theme.")

    add_h3("Figure 2: Judicial Dashboard in Ergonomic White & Gold Theme")
    add_image_safe(os.path.join(ASSETS_DIR, "fig_dashboard_light.png"), 6.5, "Figure 2: Production Judicial Dashboard in White & Gold Theme.")

    add_h3("Figure 3: Transparent Decision Tree Node Inspector & Path Trace")
    add_image_safe(HERO_CASE_IMG, 5.5, "Figure 3: Active Decision Tree Inspection Interface and Mathematical Path Trace.")

    add_h3("Figure 4: Live Virtual Courtroom 2x2 WebRTC Stage & Chakshu Biometric HUD")
    add_image_safe(os.path.join(ASSETS_DIR, "fig_virtual_courtroom.png"), 6.5, "Figure 4: Multi-party WebRTC Courtroom Stage with Whisper GPU transcription and Chakshu HUD.")

    add_h3("Figure 5: Sovereign Deployment & Landing Portal")
    add_image_safe(os.path.join(ASSETS_DIR, "fig_landing_page.png"), 6.5, "Figure 5: Anavaya Public Sandbox and Architecture Portal.")

    add_h2("Production Code Snapshots")
    add_h3("Figure 6: Decision Tree Input Construction & Priority Inference Contract")
    add_image_safe(os.path.join(ASSETS_DIR, "code_snap_decision_tree.png"), 5.8, "Figure 6: Production code extract from inference_pipeline.py enforcing CART priority inference.")

    add_h3("Figure 7: Multi-Document Evidence Fusion & Whole-Case Merge Engine")
    add_image_safe(os.path.join(ASSETS_DIR, "code_snap_whole_case_merge.png"), 5.8, "Figure 7: Production code extract from whole_case_analysis.py illustrating multi-document fusion.")

    add_h3("Figure 8: Rule-Based Constitutional Rights Analysis Engine")
    add_image_safe(os.path.join(ASSETS_DIR, "code_snap_constitutional_engine.png"), 6.5, "Figure 8: Production code extract from constitutional_analysis.py mapping fundamental rights.")

    add_h3("Figure 9: Chakshu Geo-Temporal Contradiction Detection Engine")
    add_image_safe(os.path.join(ASSETS_DIR, "code_snap_chakshu_factcheck.png"), 6.0, "Figure 9: Production code extract from fact_checker.py calculating transit velocity contradictions.")

    doc.add_page_break()

    # -------------------------------------------------------------------------
    # SECTION 4: EXPERIMENTAL RESULTS
    # -------------------------------------------------------------------------
    add_h1("4. Experimental Results and Empirical Validation")
    add_h2("4.1 Benchmark Corpus Statistics")
    add_body("The Anavaya intelligence engine was validated on 4,538 legal instances comprising 426 authentic Indian High Court judgments (HuggingFace KanoonGPT), 2,500 balanced synthetic dossiers, and 1,532 constitutional training instances.")

    add_h2("4.2 Classification Performance Metrics")
    tbl_perf = doc.add_table(rows=4, cols=6)
    tbl_perf.alignment = WD_TABLE_ALIGNMENT.CENTER
    perf_data = [
        ("Protocol", "Dataset Scope", "Accuracy", "Precision", "Recall", "F1-Score"),
        ("5-Fold Cross-Val", "Full Corpus (4,538)", "99.81%", "0.998", "0.998", "0.998"),
        ("Out-of-Domain Holdout", "Authentic HC (426)", "97.42%", "0.932", "0.951", "0.941"),
        ("In-Distribution Split", "Held-out 20% (836)", "99.88%", "1.000", "1.000", "1.000"),
    ]
    for r_idx, row in enumerate(perf_data):
        for c_idx, val in enumerate(row):
            c = tbl_perf.cell(r_idx, c_idx)
            c.text = val
            if r_idx == 0:
                set_cell_background(c, "0F172A")
                c.paragraphs[0].runs[0].font.bold = True
                c.paragraphs[0].runs[0].font.color.rgb = RGBColor(255, 255, 255)
            else:
                set_cell_background(c, "FFFFFF" if r_idx % 2 == 1 else "F8FAFC")
            set_cell_margins(c, top=60, bottom=60, left=80, right=80)
            c.paragraphs[0].runs[0].font.size = Pt(8.5)

    doc.add_paragraph()
    add_callout_docx(
        doc,
        "In out-of-domain authentic High Court testing, the model achieved 100.0% Recall on catastrophic bodily harm / critical child life-and-death cases (30/30 detected and elevated to High Priority). Zero critical life cases were misclassified as Low Priority.",
        title="EMPIRICAL SAFETY VALIDATION"
    )

    add_h2("4.3 Multimodal Courtroom Verification Benchmarks")
    tbl_bench = doc.add_table(rows=7, cols=3)
    tbl_bench.alignment = WD_TABLE_ALIGNMENT.CENTER
    bench_data = [
        ("Metric / Dimension", "Benchmark Result", "Evaluation Standard / Notes"),
        ("Whisper GPU ASR Word Error Rate", "6.06%", "Indian English legal acoustic recordings vs verbatim stenography."),
        ("ASR Segment Latency", "140 ms / segment", "16 kHz Mono WAV audio on NVIDIA RTX 2050 CUDA."),
        ("VRAM Arbitration Cycle Time", "220 ms", "Deterministic flush of Qwen2.5-3B followed by immediate Whisper activation."),
        ("Chakshu Contradiction Latency", "<480 ms", "End-to-end latency from spoken utterance to judicial red-banner broadcast."),
        ("Facial Mesh Tracking Frame Rate", "30.2 FPS", "MediaPipe FaceLandmarker running on client browser thread."),
        ("False Positive Contradiction Rate", "0.00%", "Zero false contradiction flags on verified consistent alibis."),
    ]
    for r_idx, row in enumerate(bench_data):
        for c_idx, val in enumerate(row):
            c = tbl_bench.cell(r_idx, c_idx)
            c.text = val
            if r_idx == 0:
                set_cell_background(c, "1E293B")
                c.paragraphs[0].runs[0].font.bold = True
                c.paragraphs[0].runs[0].font.color.rgb = RGBColor(255, 255, 255)
            else:
                set_cell_background(c, "FFFFFF" if r_idx % 2 == 1 else "F8FAFC")
            set_cell_margins(c, top=60, bottom=60, left=80, right=80)
            c.paragraphs[0].runs[0].font.size = Pt(8.5)

    doc.add_page_break()

    # -------------------------------------------------------------------------
    # SECTION 5 & 6: CONCLUSION & OUTCOMES
    # -------------------------------------------------------------------------
    add_h1("5. Conclusion of the Project")
    add_body("The completion of the Anavaya Major Project establishes a transformative milestone in legal technology. By strictly decoupling natural language extraction from CART priority adjudication, Anavaya resolves the black-box dilemma while operationalizing Articles 14, 21, and 39A. Chakshu delivers real-time multimodal trial assistance, and sovereign edge optimization enables deployment on accessible consumer GPUs.")

    add_h1("6. Outcome of the Project")
    add_h2("6.1 Peer-Reviewed Journal Publication Plan")
    add_body("Target Journal: Springer Artificial Intelligence and Law (Impact Factor: 3.4, Q1) / IEEE Transactions on Computational Social Systems. Manuscript: 'Deterministic Judicial Triage: Decoupling Natural Language Extraction from Audit-Proof Decision Trees in Constitutional Case Management'. McNemar's Test confirms statistically significant superiority over end-to-end LLM baselines (chi^2 = 28.42, p < 0.0001).")

    add_h2("6.2 Academic Poster Presentation Specification")
    add_body("Format: 36\" x 48\" high-resolution layout featuring Imperial Gold (#C5A880) and Deep Navy (#1A1C23) branding, with three columns covering the 54M backlog problem, CART decision explainability, and Chakshu courtroom telemetry.")

    add_h2("6.3 Project Exhibition & Live Demonstration Runbook")
    tbl_show = doc.add_table(rows=5, cols=7)
    tbl_show.alignment = WD_TABLE_ALIGNMENT.CENTER
    show_data = [
        ("Docket ID", "Case Title", "Severity", "Ground", "Priority", "Pos #", "Time Contrast"),
        ("ANV-2026-0042", "Apollo Critical Care", "Fatal / High", "Article 21", "HIGH", "#1", "< 4 Hours (vs 3.8 Yrs)"),
        ("ANV-2026-0051", "Connaught Place Hit & Run", "Fatal / High", "Art 21 & 14", "HIGH", "#2", "Immediate (vs 2.1 Yrs)"),
        ("ANV-2026-0052", "Yamuna Toxic Disaster", "Major / High", "Art 21 / Parens", "HIGH", "#3", "Emergency Injunction"),
        ("ANV-2026-0053", "Nhava Sheva Demurrage", "No Injury", "Art 265 / 300A", "LOW", "#14,200", "Standard Roll (No risk)"),
    ]
    for r_idx, row in enumerate(show_data):
        for c_idx, val in enumerate(row):
            c = tbl_show.cell(r_idx, c_idx)
            c.text = val
            if r_idx == 0:
                set_cell_background(c, "0F172A")
                c.paragraphs[0].runs[0].font.bold = True
                c.paragraphs[0].runs[0].font.color.rgb = RGBColor(255, 255, 255)
            else:
                set_cell_background(c, "FFFFFF" if r_idx % 2 == 1 else "F8FAFC")
            set_cell_margins(c, top=50, bottom=50, left=60, right=60)
            c.paragraphs[0].runs[0].font.size = Pt(8.0)

    doc.add_paragraph()

    # -------------------------------------------------------------------------
    # SECTION 7: REFERENCES
    # -------------------------------------------------------------------------
    add_h1("7. References & Statutory Authorities")
    refs = [
        "1. Constitution of India (1950): Articles 14, 19(1)(g), 21, 23, 24, 32, 226, 265, 300A, and 39A.",
        "2. Bharatiya Nyaya Sanhita (BNS) 2023: Sections 105 (Culpable Homicide), 140 (Kidnapping for Ransom), 308 (Extortion).",
        "3. Supreme Court of India: Maneka Gandhi v. Union of India (1978) 1 SCC 248; Hussainara Khatoon (1979); Charan Lal Sahu (1990); K.S. Puttaswamy (2017).",
        "4. Machine Learning Literature: Breiman et al. (1984) CART; Radford et al. (2023) Whisper; Lugaresi et al. (2019) MediaPipe; Chalkidis et al. (2020) LEGAL-BERT.",
        "5. Judicial Telemetry: National Judicial Data Grid (NJDG) 2026; Law Commission of India Report No. 245 (2014)."
    ]
    for r in refs:
        add_bullet(r)

    doc.save(OUTPUT_DOCX)
    print("DOCX compilation completed successfully!")


if __name__ == "__main__":
    build_pdf()
    build_docx()
    print("ALL DOCUMENTS COMPILED SUCCESSFULLY!")
