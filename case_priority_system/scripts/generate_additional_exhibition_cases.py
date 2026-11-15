r"""
Anavaya Additional Exhibition Showcase Cases Generator
Generates 9 authentic forensic PDFs across 3 diverse legal cases:
1. ANV-2026-0051: State of NCT of Delhi v. Kunal Singhania & Anr. (Fatal Hit & Run / Speed Camera vs Fastag Alibi Contradiction) -> HIGH PRIORITY
2. ANV-2026-0052: Gram Panchayat Chhatarpur & Ors. v. Apex Dyechem Industries Ltd. (Mass Toxic Chemical Discharge / 42 Victims) -> HIGH PRIORITY
3. ANV-2026-0053: Global Container Lines v. Custom House Nhava Sheva (Corporate Customs Demurrage & Ground Rent Dispute) -> LOW PRIORITY

Executes from repo root: F:\major_project
Outputs to:
  showcase_cases/delhi_hit_and_run/
  showcase_cases/chhatarpur_toxic_discharge/
  showcase_cases/customs_demurrage_dispute/
"""
import os
import sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)

# Output directories
BASE_DIR = os.path.abspath("showcase_cases")
DIR_CASE1 = os.path.join(BASE_DIR, "delhi_hit_and_run")
DIR_CASE2 = os.path.join(BASE_DIR, "chhatarpur_toxic_discharge")
DIR_CASE3 = os.path.join(BASE_DIR, "customs_demurrage_dispute")

for d in [DIR_CASE1, DIR_CASE2, DIR_CASE3]:
    os.makedirs(d, exist_ok=True)

def build_pdf(directory, filename, title, category, elements):
    filepath = os.path.join(directory, filename)
    doc = SimpleDocTemplate(
        filepath,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )
    doc.build(elements)
    size = os.path.getsize(filepath)
    print(f"Generated: {filepath} ({size:,} bytes)")
    return filepath

# Base Styles
styles = getSampleStyleSheet()

header_style = ParagraphStyle(
    "HeaderStyle",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=13,
    leading=17,
    alignment=1, # Center
    textColor=colors.HexColor("#0f172a"),
)

sub_header_style = ParagraphStyle(
    "SubHeaderStyle",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=8.5,
    leading=12,
    alignment=1,
    textColor=colors.HexColor("#475569"),
)

sec_title_style = ParagraphStyle(
    "SecTitleStyle",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=10,
    leading=13,
    textColor=colors.HexColor("#0f172a"),
)

body_style = ParagraphStyle(
    "BodyStyle",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=8.5,
    leading=12,
    textColor=colors.HexColor("#1e293b"),
)

body_bold = ParagraphStyle(
    "BodyBold",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=8.5,
    leading=12,
    textColor=colors.HexColor("#0f172a"),
)

meta_badge_red = ParagraphStyle(
    "MetaBadgeRed",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=8,
    leading=10,
    alignment=2,
    textColor=colors.HexColor("#b91c1c"),
)

meta_badge_amber = ParagraphStyle(
    "MetaBadgeAmber",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=8,
    leading=10,
    alignment=2,
    textColor=colors.HexColor("#b45309"),
)

meta_badge_blue = ParagraphStyle(
    "MetaBadgeBlue",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=8,
    leading=10,
    alignment=2,
    textColor=colors.HexColor("#1d4ed8"),
)

meta_badge_slate = ParagraphStyle(
    "MetaBadgeSlate",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=8,
    leading=10,
    alignment=2,
    textColor=colors.HexColor("#475569"),
)

# ==========================================================================
# CASE 1: ANV-2026-0051 — DELHI FATAL HIT & RUN (HIGH PRIORITY)
# Title: State of NCT of Delhi v. Kunal Singhania & Anr.
# ==========================================================================

def generate_case1_exhibit_p01():
    """Exhibit P-1: FIR No. 214/2026, Connaught Place Police Station"""
    elems = []
    elems.append(Paragraph("COURT EXHIBIT P-01 | CRIME DOCKET ANV-2026-0051", meta_badge_red))
    elems.append(Spacer(1, 3))
    elems.append(Paragraph("FORM NO. IIF-I — INTEGRATED FIRST INFORMATION REPORT", header_style))
    elems.append(Paragraph("DELHI POLICE • NEW DELHI DISTRICT • CONNAUGHT PLACE POLICE STATION<br/>Recorded under Section 173 Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023", sub_header_style))
    elems.append(Spacer(1, 6))
    elems.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0f172a"), spaceAfter=8))

    meta_table = [
        [Paragraph("<b>FIR No:</b> 214/2026", body_style), Paragraph("<b>Police Station:</b> Connaught Place", body_style), Paragraph("<b>Date & Time:</b> 18-JAN-2026 02:45 IST", body_style)],
        [Paragraph("<b>Acts & Sections:</b> BNS 105, 125(b), 281 & MV Act 134/184", body_style), Paragraph("<b>Occurrence:</b> 18-JAN-2026 01:40–01:45 IST", body_style), Paragraph("<b>GD Entry Ref:</b> GD-018/26", body_style)],
    ]
    t = Table(meta_table, colWidths=[180, 160, 180])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    elems.append(t)
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("1. COMPLAINANT, VICTIM & ACCUSED PARTICULARS", sec_title_style))
    c_table = [
        [Paragraph("<b>Complainant / First Informant:</b>", body_bold), Paragraph("Sub-Inspector Rajesh Kumar (No. 4412/DAP), Connaught Place PS Night Patrol Unit", body_style)],
        [Paragraph("<b>Deceased Victim (Fatal):</b>", body_bold), Paragraph("Late Ram Prasad, Age 48 Years, Roadside Fruit Vendor, Resident of Paharganj, New Delhi (Pronounced dead on arrival)", body_style)],
        [Paragraph("<b>Injured Minor Victim:</b>", body_bold), Paragraph("Master Dev Prasad, Age 9 Years (Son of Deceased), In Patient ICU #AIIMS-TC-PICU-109, Severe Traumatic Brain Injury, Critical / Ventilator Dependent", body_style)],
        [Paragraph("<b>Accused Person:</b>", body_bold), Paragraph("Kunal Singhania (Age 24), S/o Industrialist Harshvardhan Singhania, R/o Golf Links, New Delhi & Unknown Co-Passenger", body_style)],
        [Paragraph("<b>Offending Vehicle:</b>", body_bold), Paragraph("Metallic Grey Luxury Sports Sedan, Registration DL-1C-AA-9900 (High-Speed Hit & Run)", body_style)],
    ]
    t = Table(c_table, colWidths=[160, 360])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
    ]))
    elems.append(t)
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("2. CONCISE STATEMENT OF FACTUAL OCCURRENCE (SUBSTANTIVE COMPLAINT)", sec_title_style))
    statement = (
        "On 18-Jan-2026 at approximately 01:40 IST, while patrolling Outer Circle Connaught Place near Barakhamba Road radial, "
        "complainant heard a massive screech of tires followed by a violent kinetic impact. A grey sports sedan bearing registration "
        "DL-1C-AA-9900, traveling at excessive speed exceeding 130 km/h, lost control, mounted the pedestrian footpath and obliterated "
        "a night fruit kiosk. Roadside vendor Ram Prasad (48) was flung 22 metres onto the tarmac, sustaining fatal compound skull and thoracic crush "
        "injuries. His 9-year-old child Master Dev Prasad was pinned beneath the shattered curbstone and sustained severe traumatic brain injury. "
        "Rather than rendering medical aid, the driver reversed forcefully, dragged the vendor's cart, and fled the scene at high speed toward "
        "Barakhamba Road. The injured minor was rushed to AIIMS Trauma Centre in unconscious state with Glasgow Coma Scale 6. "
        "Automated speed cameras clocked the vehicle at 134.2 km/h. Offences registered under BNS Section 105 (Culpable homicide not amounting to murder), "
        "Section 125(b) (Act endangering life or personal safety), Section 281 (Rash driving), and Section 134 of Motor Vehicles Act. "
        "Direct engagement of Fundamental Right to Life under Article 21 of the Constitution of India."
    )
    elems.append(Paragraph(statement, body_style))
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("3. STATUTORY CLASSIFICATION & DISPATCH", sec_title_style))
    disp_text = (
        "Cognizable, Non-Bailable homicide and grievous bodily injury offences registered. Transmitted forthwith to Chief Metropolitan Magistrate, "
        "Patiala House Courts, and Special Bench for urgent judicial proceedings."
    )
    elems.append(Paragraph(disp_text, body_style))
    elems.append(Spacer(1, 10))

    sig_data = [
        [Paragraph("<b>Investigating Officer:</b><br/>Inspector Vikramaditya Singh<br/>SHO, Connaught Place PS, New Delhi", body_style),
         Paragraph("<b>Forwarded To:</b><br/>Duty Magistrate, CMM Court<br/>Patiala House Courts, New Delhi", body_style),
         Paragraph("<b>Digital Forensic Seal:</b><br/>SHA256: d94f81c4...e18b<br/>Status: Verified Intact", body_style)]
    ]
    st = Table(sig_data, colWidths=[180, 180, 160])
    st.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#94a3b8")),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f1f5f9")),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    elems.append(st)

    build_pdf(DIR_CASE1, "Exhibit_P01_FIR_214_2026_Connaught_Place.pdf", "Exhibit P-01 Police FIR", "FIR", elems)

def generate_case1_exhibit_p02():
    """Exhibit P-2: AIIMS Trauma Centre Emergency Medico-Legal Certificate"""
    elems = []
    elems.append(Paragraph("COURT EXHIBIT P-02 | EMERGENCY CLINICAL & MLC RECORD", meta_badge_red))
    elems.append(Spacer(1, 3))
    elems.append(Paragraph("JAI PRAKASH NARAYAN APEX TRAUMA CENTRE — AIIMS NEW DELHI", header_style))
    elems.append(Paragraph("DEPARTMENT OF SURGICAL NEUROTRAUMA & EMERGENCY PEDIATRIC RESUSCITATION<br/>Emergency Medico-Legal Certificate under Section 39 Bharatiya Sakshya Adhiniyam, 2023", sub_header_style))
    elems.append(Spacer(1, 6))
    elems.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#b91c1c"), spaceAfter=8))

    patient_meta = [
        [Paragraph("<b>Patient Name:</b> Master Dev Prasad", body_style), Paragraph("<b>Age / Sex:</b> 9 Yrs / Male", body_style), Paragraph("<b>MLC No:</b> TC-2026-8812", body_style)],
        [Paragraph("<b>Attending Neurosurgeon:</b> Dr. Anurag Varma, M.Ch", body_style), Paragraph("<b>Ward / Bed:</b> Trauma ICU Bed 02", body_style), Paragraph("<b>Admission:</b> 18-JAN-2026 02:15 IST", body_style)],
    ]
    t = Table(patient_meta, colWidths=[180, 160, 180])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#fef2f2")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#fca5a5")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#fecaca")),
        ('PADDING', (0,0), (-1,-1), 3.5),
    ]))
    elems.append(t)
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("1. CLINICAL PRESENTATION & NEUROLOGICAL ASSESSMENT", sec_title_style))
    diag = (
        "The patient, 9-year-old Master Dev Prasad, was brought to AIIMS Apex Trauma Centre Emergency in a comatose state following "
        "a catastrophic vehicular impact at Connaught Place. On clinical intake, Glasgow Coma Scale (GCS) score was <b>6/15</b> (Eye 1, Verbal 2, Motor 3). "
        "Left pupil was dilated (5mm) and sluggishly responsive to light; right pupil was 3mm and reactive. Severe compound depressed skull fracture "
        "over the left fronto-parietal region with active oozing of blood and CSF. Patient was immediately intubated with an 5.5mm cuffed endotracheal "
        "tube and placed on synchronized mechanical ventilation."
    )
    elems.append(Paragraph(diag, body_style))
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("2. EMERGENCY NCCT HEAD FINDINGS & PERIL TO LIFE", sec_title_style))
    findings_table = [
        [Paragraph("<b>Diagnostic Modality</b>", body_bold), Paragraph("<b>Pathological Neurotrauma Finding</b>", body_bold), Paragraph("<b>Surgical Urgency</b>", body_bold)],
        [Paragraph("Non-Contrast CT Brain", body_style), Paragraph("Acute left fronto-temporo-parietal subdural hematoma (SDH) with max thickness of 14.2 mm", body_style), Paragraph("CRITICAL / LIFE RISK", body_style)],
        [Paragraph("Midline Brain Shift", body_style), Paragraph("Subfalcine herniation with 9.4 mm midline shift of cerebral structures from left to right", body_style), Paragraph("IMMEDIATE SURGERY", body_style)],
        [Paragraph("Cranial Vault Bony Window", body_style), Paragraph("Depressed frontal fracture with comminuted bone fragments driven 6mm into brain cortex", body_style), Paragraph("CRANIOTOMY", body_style)],
        [Paragraph("Cerebral Edema", body_style), Paragraph("Severe diffuse hemispheric edema with effacement of ipsilateral lateral ventricle", body_style), Paragraph("HIGH MORTALITY", body_style)],
    ]
    ft = Table(findings_table, colWidths=[120, 280, 120])
    ft.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#fee2e2")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#fca5a5")),
        ('PADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elems.append(ft)
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("3. CLINICAL DIRECTIVE & CONSTITUTIONAL VULNERABILITY", sec_title_style))
    directive = (
        "<b>EMERGENCY PROGNOSIS:</b> Patient requires emergency decompressive craniotomy within a 90-minute therapeutic window. "
        "Without immediate intracranial surgical decompression, fatal uncal brain herniation and brainstem arrest are imminent. "
        "Mortality risk is currently estimated at 75-80%. The minor victim is an impoverished orphan following the death of his father at the crime scene. "
        "The matter constitutes a grave emergency under Article 21 (Right to Life) of the Constitution of India requiring paramount state intervention."
    )
    elems.append(Paragraph(directive, body_style))
    elems.append(Spacer(1, 10))

    doc_sig = [
        [Paragraph("<b>Attending Neurosurgeon:</b><br/>Dr. Anurag Varma, MS, M.Ch (Neurosurgery)<br/>Associate Professor, JPNATC, AIIMS New Delhi<br/>MCI Reg No. 38412/DMC", body_style),
         Paragraph("<b>Chief Medical Officer (Trauma):</b><br/>Dr. Shailendra K. Rathore, MD<br/>Head of Emergency Services, AIIMS JPNATC<br/>Seal & Attestation Affixed", body_style)]
    ]
    dt = Table(doc_sig, colWidths=[260, 260])
    dt.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#fca5a5")),
        ('PADDING', (0,0), (-1,-1), 5),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#fef2f2")),
    ]))
    elems.append(dt)

    build_pdf(DIR_CASE1, "Exhibit_P02_AIIMS_Trauma_Emergency_MLC.pdf", "Exhibit P-02 AIIMS Emergency MLC", "Medical Record", elems)

def generate_case1_exhibit_p03():
    """Exhibit P-3: Delhi Traffic Police High-Definition Speed Camera Log"""
    elems = []
    elems.append(Paragraph("COURT EXHIBIT P-03 | CERTIFIED ELECTRONIC FORENSIC EVIDENCE", meta_badge_blue))
    elems.append(Spacer(1, 3))
    elems.append(Paragraph("DELHI TRAFFIC POLICE — CENTRAL INTELLIGENT TRAFFIC SURVEILLANCE", header_style))
    elems.append(Paragraph("AUTOMATED NUMBER PLATE RECOGNITION (ANPR) & DOPPLER RADAR AUDIT LOG<br/>Certificate under Section 63 of Bharatiya Sakshya Adhiniyam, 2023 (Sec 65B Indian Evidence Act)", sub_header_style))
    elems.append(Spacer(1, 6))
    elems.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#1d4ed8"), spaceAfter=8))

    cam_meta = [
        [Paragraph("<b>Camera Gantry ID:</b> CP-OC-Pole-14 (Outer Circle)", body_style), Paragraph("<b>Sensor Type:</b> Doppler 3D Radar + 4K ANPR", body_style)],
        [Paragraph("<b>Capture Timestamp:</b> 18-JAN-2026 01:42:15.820 IST", body_style), Paragraph("<b>Calibration Hash:</b> SHA256: 3a9e21...88ff", body_style)],
    ]
    t = Table(cam_meta, colWidths=[260, 260])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#eff6ff")),
        ('PADDING', (0,0), (-1,-1), 3.5),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#bfdbfe")),
    ]))
    elems.append(t)
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("1. VEHICLE TELEMETRY & OPTICAL RECOGNITION RECORD", sec_title_style))
    telemetry_table = [
        [Paragraph("<b>Telemetry Metric</b>", body_bold), Paragraph("<b>Calibrated Sensor Value</b>", body_bold), Paragraph("<b>Statutory Reference / Deviation</b>", body_bold)],
        [Paragraph("Target Registration Plate", body_style), Paragraph("<b>DL-1C-AA-9900</b>", body_bold), Paragraph("High OCR Confidence Score: 99.82%", body_style)],
        [Paragraph("Vehicle Make & Model", body_style), Paragraph("Porsche 911 Turbo S (Agate Grey Metallic)", body_style), Paragraph("Registered Owner: Kunal Singhania", body_style)],
        [Paragraph("<b>Recorded Speed</b>", body_bold), Paragraph("<b>134.2 km/h</b>", body_bold), Paragraph("<b>Speed Limit: 50.0 km/h (+84.2 km/h Overlimit)</b>", body_bold)],
        [Paragraph("Lane & Trajectory", body_style), Paragraph("Lane 02 traversing violently across kerb boundary", body_style), Paragraph("Rapid heading deviation 42 degrees", body_style)],
        [Paragraph("Optical Damage Pattern", body_style), Paragraph("Windshield left quarter shattered (spider-web impact); front left bumper detached", body_style), Paragraph("Consistent with severe pedestrian kinetic impact", body_style)],
    ]
    tt = Table(telemetry_table, colWidths=[140, 200, 180])
    tt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#dbeafe")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#bfdbfe")),
        ('PADDING', (0,0), (-1,-1), 3.5),
        ('BACKGROUND', (0,3), (-1,3), colors.HexColor("#fee2e2")),
    ]))
    elems.append(tt)
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("2. EXPERT FORENSIC CERTIFICATION & SPATIO-TEMPORAL AUDIT", sec_title_style))
    audit = (
        "<b>CERTIFIED FORENSIC CONCLUSION:</b> Vehicle registration DL-1C-AA-9900 was physically captured on Camera Gantry CP-OC-Pole-14 "
        "at Connaught Place Outer Circle at exactly <b>01:42:15 IST</b> traveling at 134.2 km/h with visible severe frontal collision trauma. "
        "Cryptographic sensor signatures prove zero tampering. Any assertion by the defence that vehicle DL-1C-AA-9900 or accused Kunal Singhania "
        "was physically present at Murthal Toll Plaza (Sonipat, Haryana — a road distance of 48.2 km) at <b>01:45:00 IST</b> requires traversing "
        "48.2 kilometers in exactly 165 seconds, requiring an average sustained speed of <b>1,051 km/h</b>. Such velocity is aerodynamically and "
        "mechanically impossible for a land motor vehicle, proving the defence alibi voucher is an electronic forgery or cloned Fastag."
    )
    elems.append(Paragraph(audit, body_style))
    elems.append(Spacer(1, 10))

    cert_box = [
        [Paragraph("<b>Forensic Systems Engineer:</b><br/>Inspector Devashish Ghosh, B.Tech, Cyber Forensics<br/>Traffic Monitoring Headquarters, Todapur, New Delhi<br/>BSA Sec 63 Electronic Certificate No: DTP-IT-2026-1104", body_style),
         Paragraph("<b>Cryptographic Verification:</b><br/>SHA-256: 7b2c019d44a2ef1089bc...<br/>Direct Optical Sensor Read (Zero Packet Loss)<br/>State Repository Status: Locked", body_style)]
    ]
    ct = Table(cert_box, colWidths=[260, 260])
    ct.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#bfdbfe")),
        ('PADDING', (0,0), (-1,-1), 5),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#eff6ff")),
    ]))
    elems.append(ct)

    build_pdf(DIR_CASE1, "Exhibit_P03_Traffic_Police_Speed_Camera_Log.pdf", "Exhibit P-03 Traffic Speed Camera Log", "Digital Log", elems)

def generate_case1_exhibit_d01():
    """Exhibit D-1: Defence Alibi Statement & Fastag Murthal Toll Receipt"""
    elems = []
    elems.append(Paragraph("COURT EXHIBIT D-01 | DEFENCE ALIBI EVIDENCE", meta_badge_amber))
    elems.append(Spacer(1, 3))
    elems.append(Paragraph("IN THE COURT OF SESSIONS JUDGE, PATIALA HOUSE COURTS, NEW DELHI", header_style))
    elems.append(Paragraph("DEFENCE EVIDENCE DOCKET ON BEHALF OF ACCUSED KUNAL SINGHANIA<br/>Electronic Toll Collection (Fastag) Transaction Audit & Dhaba Food Invoice", sub_header_style))
    elems.append(Spacer(1, 6))
    elems.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#d97706"), spaceAfter=8))

    d_meta = [
        [Paragraph("<b>Counsel for Accused:</b> Adv. R. K. Mittal & Associates", body_style), Paragraph("<b>Claimed Alibi Location:</b> Murthal Toll Plaza / Amrik Sukhdev", body_style)],
        [Paragraph("<b>Claimed Transit Timestamp:</b> 18-JAN-2026 01:45:00 IST", body_style), Paragraph("<b>Vehicle Number:</b> DL-1C-AA-9900", body_style)],
    ]
    t = Table(d_meta, colWidths=[260, 260])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#fffbeb")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#fde68a")),
        ('PADDING', (0,0), (-1,-1), 3.5),
    ]))
    elems.append(t)
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("1. PURPORTED ELECTRONIC TOLL TRANSACTION RECORD", sec_title_style))
    alibi_desc = (
        "The Defence submits this purported Electronic Toll Collection voucher from the National Highways Authority of India (NHAI) "
        "Murthal Toll Plaza (NH-44, KM 50, Sonipat). The document alleges that vehicle registration DL-1C-AA-9900 passed Toll Lane 06 at "
        "<b>01:45:00 IST</b> on 18-January-2026, and that accused Kunal Singhania was consuming refreshments at Amrik Sukhdev Dhaba, "
        "Murthal at 01:50 IST. The defence argues Kunal Singhania was 48.2 km away from Connaught Place and could not have been involved in any crash."
    )
    elems.append(Paragraph(alibi_desc, body_style))
    elems.append(Spacer(1, 8))

    voucher_rows = [
        [Paragraph("<b>Transaction Field</b>", body_bold), Paragraph("<b>Voucher Data Value</b>", body_bold), Paragraph("<b>Forensic Cross-Check Remark</b>", body_bold)],
        [Paragraph("Toll Plaza Identifier", body_style), Paragraph("NHAI-Toll-Murthal-06", body_style), Paragraph("NH-44 KM 50 Outpost (Sonipat, Haryana)", body_style)],
        [Paragraph("Transaction Reference", body_style), Paragraph("FTG-NHAI-2026-99182300", body_style), Paragraph("Fastag Electronic RFID Log", body_style)],
        [Paragraph("Vehicle Plate Registered", body_style), Paragraph("DL-1C-AA-9900", body_style), Paragraph("Registered: Kunal Singhania", body_style)],
        [Paragraph("<b>Transaction Timestamp</b>", body_bold), Paragraph("<b>18-JAN-2026 01:45:00 IST</b>", body_bold), Paragraph("<b>IMPOSSIBLE SPEED CONTRADICTION (1,051 km/h)</b>", body_bold)],
        [Paragraph("Toll Fee Paid", body_style), Paragraph("₹105.00 (Fastag Wallet)", body_style), Paragraph("Automated Deduction", body_style)],
    ]
    vt = Table(voucher_rows, colWidths=[140, 180, 200])
    vt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#fef3c7")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#fde68a")),
        ('PADDING', (0,0), (-1,-1), 3.5),
        ('BACKGROUND', (0,4), (-1,4), colors.HexColor("#fee2e2")),
    ]))
    elems.append(vt)
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("2. DEFENCE PRAYER & FORENSIC CONTRADICTION NOTE", sec_title_style))
    subm = (
        "The Defence prays for immediate grant of anticipatory bail and discharge of Kunal Singhania. However, as detected by Anavaya's "
        "Chakshu cross-verification engine, moving 48.2 km from Connaught Place Outer Circle (01:42:15 IST) to Murthal (01:45:00 IST) "
        "in 165 seconds requires an impossible speed of 1,051 km/h, proving conclusively that the Fastag RFID chip was duplicated or transported "
        "in another vehicle to manufacture a fraudulent alibi."
    )
    elems.append(Paragraph(subm, body_style))
    elems.append(Spacer(1, 10))

    counsel_sig = [
        [Paragraph("<b>Submitted By:</b><br/>Adv. R. K. Mittal, LL.M.<br/>Senior Counsel for Kunal Singhania<br/>Bar Council of Delhi: D/412/2002", body_style),
         Paragraph("<b>Patiala House Courts Registry:</b><br/>Received under Protest u/s 103 Indian Evidence Act<br/>Referred to Judicial AI Triage & Fact-Check", body_style)]
    ]
    cst = Table(counsel_sig, colWidths=[260, 260])
    cst.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0,0), (-1,-1), 5),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
    ]))
    elems.append(cst)

    build_pdf(DIR_CASE1, "Exhibit_D01_Defence_Alibi_Murthal_Toll.pdf", "Exhibit D-01 Defence Alibi Murthal Toll", "Defence Exhibit", elems)

# ==========================================================================
# CASE 2: ANV-2026-0052 — CHHATARPUR TOXIC EFFLUENT DISCHARGE (HIGH PRIORITY)
# Title: Gram Panchayat Chhatarpur & Ors. v. Apex Dyechem Industries Ltd.
# ==========================================================================

def generate_case2_exhibit_p01():
    """Exhibit P-1: Public Interest Writ Petition under Article 226 before High Court of Delhi"""
    elems = []
    elems.append(Paragraph("COURT EXHIBIT P-01 | WRIT PETITION (CIVIL) NO. 1408/2026", meta_badge_red))
    elems.append(Spacer(1, 3))
    elems.append(Paragraph("IN THE HIGH COURT OF DELHI AT NEW DELHI", header_style))
    elems.append(Paragraph("EXTRAORDINARY ORIGINAL WRIT JURISDICTION — PUBLIC INTEREST LITIGATION<br/>Under Article 226 of the Constitution of India for Enforcement of Article 21 & Article 48A", sub_header_style))
    elems.append(Spacer(1, 6))
    elems.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#047857"), spaceAfter=8))

    parties_table = [
        [Paragraph("<b>Petitioners:</b>", body_bold), Paragraph("1. Gram Panchayat Chhatarpur, South Delhi (Through Sarpanch Smt. Sunita Devi)<br/>2. 42 Hospitalized Agrarian Villagers & Vulnerable Victims", body_style)],
        [Paragraph("<b>Versus</b>", body_bold), Paragraph("", body_style)],
        [Paragraph("<b>Respondents:</b>", body_bold), Paragraph("1. Apex Dyechem Industries Ltd. (Factory Unit No. 4, Chhatarpur Industrial Area)<br/>2. Delhi Pollution Control Committee (DPCC)<br/>3. Central Pollution Control Board (CPCB)<br/>4. Govt. of NCT of Delhi (Through Chief Secretary)", body_style)],
    ]
    t = Table(parties_table, colWidths=[120, 400])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f0fdf4")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#86efac")),
        ('PADDING', (0,0), (-1,-1), 3.5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    elems.append(t)
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("1. FACTUAL MATRIX & GRAVE PUBLIC HEALTH CATASTROPHE", sec_title_style))
    matrix_text = (
        "The Petitioners represent the rural agrarian population of Chhatarpur Village, South Delhi. "
        "Respondent No. 1 operates an industrial manufacturing plant producing synthetic azo-dyes and chemical solvents. "
        "Over the past 72 hours, Respondent No. 1 secretly unleashed tens of thousands of litres of raw, untreated, toxic industrial effluent "
        "directly into the community groundwater drainage network and village irrigation reservoir via an illegal underground bypass valve. "
        "This constitutes criminal culpable homicide and act endangering life causing grievous bodily injury through chemical poisoning of village drinking water. "
        "As a direct consequence, 42 victims, including 8 pregnant women and 12 infants with child in danger, have collapsed with acute chemical cyanosis, "
        "methemoglobinemia, severe gastrointestinal hemorrhaging, and toxic respiratory failure, currently fighting for their lives in intensive care units. "
        "This constitutes a flagrant violation of the Right to Life under Article 21, the Right to Clean Water, and the state's Parens Patriae obligation."
    )
    elems.append(Paragraph(matrix_text, body_style))
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("2. CONSTITUTIONAL GROUNDS & APPLICABLE DOCTRINES", sec_title_style))
    grounds_table = [
        [Paragraph("<b>Constitutional Article / Doctrine</b>", body_bold), Paragraph("<b>Judicial Basis & Legal Precedent</b>", body_bold)],
        [Paragraph("<b>Article 21: Right to Life & Clean Water</b>", body_bold), Paragraph("Right to life encompasses the fundamental right to wholesome water and unpolluted environment (Subhash Kumar v. State of Bihar; M.C. Mehta v. Union of India).", body_style)],
        [Paragraph("<b>Article 48A & 51A(g): Environmental Duty</b>", body_bold), Paragraph("State obligation to protect and improve the natural environment and safeguard public health from corporate toxification.", body_style)],
        [Paragraph("<b>Absolute Liability Doctrine</b>", body_bold), Paragraph("Enterprise engaged in hazardous industry owes an absolute, non-delegable duty to the community (Oleum Gas Leak case).", body_style)],
        [Paragraph("<b>Parens Patriae Jurisdiction</b>", body_bold), Paragraph("Inherent duty of the High Court to intervene urgently to protect vulnerable, impoverished citizens unable to protect themselves.", body_style)],
    ]
    gt = Table(grounds_table, colWidths=[180, 340])
    gt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#dcfce7")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#86efac")),
        ('PADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    elems.append(gt)
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("3. PRAYERS FOR IMMEDIATE INTERIM RELIEF", sec_title_style))
    prayers = (
        "<b>INTERIM PRAYERS:</b> 1. Issue an ad-interim mandatory order directing the immediate sealing and closure of Respondent No. 1's factory; "
        "2. Direct Delhi Jal Board to deploy 30 potable water tankers to Chhatarpur Village within 3 hours; "
        "3. Direct the Health Department to establish an emergency toxicology triage camp and provide free critical medical care to all 42 hospitalized victims; "
        "4. Direct CPCB to seize effluent samples and inspect the bypass drainage line."
    )
    elems.append(Paragraph(prayers, body_style))
    elems.append(Spacer(1, 10))

    sig_tab = [
        [Paragraph("<b>Advocate for the Petitioners:</b><br/>Adv. Vandana Krishnamurthy, LL.M.<br/>Counsel for Gram Panchayat Chhatarpur<br/>High Court of Delhi Enrollment: D/1892/2011", body_style),
         Paragraph("<b>Verification & Affidavit:</b><br/>Affidavit sworn by Smt. Sunita Devi (Sarpanch)<br/>High Court Registry Urgent Listing Cell<br/>Matter Listed before Division Bench I", body_style)]
    ]
    st = Table(sig_tab, colWidths=[260, 260])
    st.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#86efac")),
        ('PADDING', (0,0), (-1,-1), 5),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f0fdf4")),
    ]))
    elems.append(st)

    build_pdf(DIR_CASE2, "Exhibit_P01_Writ_Petition_Article_226_PIL.pdf", "Exhibit P-01 Writ Petition PIL", "Writ Petition", elems)

def generate_case2_exhibit_p02():
    """Exhibit P-2: Central Pollution Control Board (CPCB) Urgent Chemical Analysis Report"""
    elems = []
    elems.append(Paragraph("COURT EXHIBIT P-02 | CERTIFIED CHEMICAL FORENSIC TOXICOLOGY REPORT", meta_badge_red))
    elems.append(Spacer(1, 3))
    elems.append(Paragraph("CENTRAL POLLUTION CONTROL BOARD (CPCB) — PARIVESH BHAWAN", header_style))
    elems.append(Paragraph("CENTRAL CHEMICAL & TOXICOLOGY LABORATORY • GOVT. OF INDIA<br/>Report under Section 21/26 Water (Prevention and Control of Pollution) Act, 1974 & Sec 39 BSA 2023", sub_header_style))
    elems.append(Spacer(1, 6))
    elems.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0f766e"), spaceAfter=8))

    lab_meta = [
        [Paragraph("<b>Sample Ref:</b> CPCB/LAB/TOX-2026/0412", body_style), Paragraph("<b>Sample Source:</b> Chhatarpur Irrigation Outfall & Borewell 02", body_style)],
        [Paragraph("<b>Testing Date:</b> 23-JAN-2026 14:00–18:30 IST", body_style), Paragraph("<b>Lead Analyst:</b> Dr. K. Radhakrishnan, Ph.D. (Toxicology)", body_style)],
    ]
    t = Table(lab_meta, colWidths=[260, 260])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f0fdfa")),
        ('PADDING', (0,0), (-1,-1), 3.5),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#99f6e4")),
    ]))
    elems.append(t)
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("1. QUANTITATIVE CHEMICAL & HEAVY METAL EFFLUENT ASSAY", sec_title_style))
    chem_rows = [
        [Paragraph("<b>Physicochemical Parameter</b>", body_bold), Paragraph("<b>Effluent Sample Value</b>", body_bold), Paragraph("<b>CPCB Prescribed Limit</b>", body_bold), Paragraph("<b>Forensic Hazard Ratio</b>", body_bold)],
        [Paragraph("pH (Acidity Index)", body_style), Paragraph("<b>1.84 (Highly Acidic)</b>", body_bold), Paragraph("6.5 – 8.5", body_style), Paragraph("Corrosive Hazard", body_style)],
        [Paragraph("<b>Chemical Oxygen Demand (COD)</b>", body_bold), Paragraph("<b>14,200 mg/L</b>", body_bold), Paragraph("250 mg/L", body_style), Paragraph("<b>56.8x Permissible Limit</b>", body_bold)],
        [Paragraph("Biochemical Oxygen Demand (BOD)", body_style), Paragraph("3,850 mg/L", body_style), Paragraph("30 mg/L", body_style), Paragraph("128.3x Permissible Limit", body_style)],
        [Paragraph("Total Dissolved Solids (TDS)", body_style), Paragraph("28,400 mg/L", body_style), Paragraph("2,100 mg/L", body_style), Paragraph("13.5x Permissible Limit", body_style)],
        [Paragraph("<b>Dissolved Lead (Pb)</b>", body_bold), Paragraph("<b>3.42 mg/L</b>", body_bold), Paragraph("0.10 mg/L", body_style), Paragraph("<b>34.2x (Severe Neurotoxin)</b>", body_bold)],
        [Paragraph("<b>Dissolved Cadmium (Cd)</b>", body_bold), Paragraph("<b>0.68 mg/L</b>", body_bold), Paragraph("0.02 mg/L", body_style), Paragraph("<b>34.0x (Acute Renal Toxin)</b>", body_bold)],
        [Paragraph("Hexavalent Chromium (Cr-VI)", body_style), Paragraph("4.85 mg/L", body_style), Paragraph("0.10 mg/L", body_style), Paragraph("48.5x (Carcinogen)", body_style)],
        [Paragraph("Aromatic Amines & Aniline Dyes", body_style), Paragraph("92.4 mg/L", body_style), Paragraph("Not Detectable (0.0)", body_style), Paragraph("Lethal Methemoglobinemia", body_style)],
    ]
    ct = Table(chem_rows, colWidths=[150, 130, 110, 130])
    ct.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#ccfbf1")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#99f6e4")),
        ('PADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,2), (-1,2), colors.HexColor("#fee2e2")),
        ('BACKGROUND', (0,5), (-1,6), colors.HexColor("#fee2e2")),
    ]))
    elems.append(ct)
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("2. TOXICOLOGICAL EXPERT OPINION & HEALTH PERIL", sec_title_style))
    toxic_opinion = (
        "<b>CERTIFIED EXPERT OPINION:</b> The wastewater tested from Apex Dyechem Industries Outfall Gate 4 contains unprecedented, "
        "catastrophic levels of industrial toxics. COD of 14,200 mg/L alongside heavy metals Lead (3.42 mg/L) and Cadmium (0.68 mg/L) "
        "exceeding legal safety thresholds by <b>34 times</b> represents an acute toxicological hazard. The presence of aniline dyes explains "
        "the acute chemical cyanosis and methemoglobinemia reported in hospitalized pediatric patients. The discharge poses an existential threat "
        "to human life and an irreversible disaster for groundwater ecology. Immediate total industrial shutdown is mandatory."
    )
    elems.append(Paragraph(toxic_opinion, body_style))
    elems.append(Spacer(1, 10))

    cert_tab = [
        [Paragraph("<b>Chief Scientific Officer:</b><br/>Dr. K. Radhakrishnan, M.Sc., Ph.D.<br/>Director of Laboratories, Central Pollution Control Board<br/>Accreditation: NABL / CPCB-ISO-17025", body_style),
         Paragraph("<b>Institutional Attestation:</b><br/>Member Secretary, Central Pollution Control Board<br/>Govt. of India, Ministry of Environment & Forests<br/>Official Seal Affixed", body_style)]
    ]
    st = Table(cert_tab, colWidths=[260, 260])
    st.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#99f6e4")),
        ('PADDING', (0,0), (-1,-1), 5),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f0fdfa")),
    ]))
    elems.append(st)

    build_pdf(DIR_CASE2, "Exhibit_P02_CPCB_Urgent_Chemical_Analysis_Report.pdf", "Exhibit P-02 CPCB Chemical Analysis", "Chemical Report", elems)

def generate_case2_exhibit_p03():
    """Exhibit P-3: District Sub-Divisional Magistrate Spot Inspection & Seal Panchnama"""
    elems = []
    elems.append(Paragraph("COURT EXHIBIT P-03 | EXECUTIVE MAGISTRATE SEALING PANCHNAMA", meta_badge_red))
    elems.append(Spacer(1, 3))
    elems.append(Paragraph("OFFICE OF THE SUB-DIVISIONAL MAGISTRATE (SOUTH DISTRICT)", header_style))
    elems.append(Paragraph("REVENUE DEPARTMENT • GOVT. OF NCT OF DELHI • SAKET COURT COMPLEX<br/>Executive Sealing Panchnama under Section 152 Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023 (Sec 133 CrPC)", sub_header_style))
    elems.append(Spacer(1, 6))
    elems.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0f172a"), spaceAfter=8))

    mag_meta = [
        [Paragraph("<b>Inspecting Magistrate:</b> Shri Alok Sharma, IAS, SDM (South)", body_style), Paragraph("<b>Target Facility:</b> Apex Dyechem Industries Unit 4", body_style)],
        [Paragraph("<b>Date & Time of Raid:</b> 24-JAN-2026 02:15 IST (Midnight)", body_style), Paragraph("<b>Police Escort:</b> Insp. M. S. Hooda, PS Mehrauli", body_style)],
    ]
    t = Table(mag_meta, colWidths=[260, 260])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('PADDING', (0,0), (-1,-1), 3.5),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
    ]))
    elems.append(t)
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("1. SPOT INSPECTION FINDINGS & DISCOVERY OF CLANDESTINE BYPASS", sec_title_style))
    panch_text = (
        "Pursuant to urgent public health distress calls and reports of mass poisoning in Chhatarpur village, the undersigned Sub-Divisional Magistrate, "
        "accompanied by DPCC engineers and armed police escort, conducted an unannounced midnight raid on Apex Dyechem Industries Ltd. at 02:15 IST.<br/><br/>"
        "<b>CLANDESTINE BYPASS VALVE DISCOVERY:</b> The factory's main computerized Effluent Treatment Plant (ETP) control board indicated zero discharge. "
        "However, physical probing behind Boiler Shed No. 3 revealed a concealed 450 mm reinforced concrete drainage pipe hidden beneath a movable artificial "
        "grass carpet. A high-pressure 75 HP industrial submersible pump was actively pumping steaming, dark purple acidic dye wastewater at an estimated rate "
        "of 850 litres per minute directly into the rural storm-water conduit. The pipe discharged directly into the irrigation channel feeding Chhatarpur village. "
        "Factory operations manager Mr. Rajiv Goel was apprehended on site attempting to disconnect the pump's power cables."
    )
    elems.append(Paragraph(panch_text, body_style))
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("2. EVIDENCE SEIZURE & SUMMARY SEALING SCHEDULE", sec_title_style))
    seizure_table = [
        [Paragraph("<b>Item No.</b>", body_bold), Paragraph("<b>Seized Property / Apparatus</b>", body_bold), Paragraph("<b>Custody / Forensic Status</b>", body_bold)],
        [Paragraph("Item 01", body_style), Paragraph("75 HP Kirloskar Submersible Bypass Pump & Wiring", body_style), Paragraph("Disconnected, Sealed with Lead Seal #SDM-S-01", body_style)],
        [Paragraph("Item 02", body_style), Paragraph("Manual Bypass Flow Gate Wheel & 450mm Concrete Valve", body_style), Paragraph("Welded Shut and Affixed with Government Wax Seal", body_style)],
        [Paragraph("Item 03", body_style), Paragraph("SCADA PLC Server Hard Disk & Factory Logbook", body_style), Paragraph("Seized for Cyber Forensic Audit u/s 63 BSA 2023", body_style)],
        [Paragraph("Item 04", body_style), Paragraph("Factory Main Electrical Incomer & Production Floor Gates", body_style), Paragraph("Padlocked and Sealed under Section 152 BNSS", body_style)],
    ]
    stt = Table(seizure_table, colWidths=[70, 270, 180])
    stt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#e2e8f0")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elems.append(stt)
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("3. EXECUTIVE MAGISTRATE DIRECTIVE", sec_title_style))
    directive_text = (
        "Plant operations are halted with immediate effect. No person shall tamper with the sealed locks. "
        "This Panchnama is submitted directly to the Hon'ble High Court of Delhi for immediate judicial confirmation in WP(C) 1408/2026."
    )
    elems.append(Paragraph(directive_text, body_style))
    elems.append(Spacer(1, 10))

    panch_sig = [
        [Paragraph("<b>Independent Panch Witness 1:</b><br/>Shri Rakesh Verma (Panchayat Member)<br/>Chhatarpur, New Delhi", body_style),
         Paragraph("<b>Independent Panch Witness 2:</b><br/>Shri Dalbir Singh (Farmer / Resident)<br/>Chhatarpur, New Delhi", body_style),
         Paragraph("<b>Sub-Divisional Magistrate:</b><br/>Shri Alok Sharma, IAS<br/>SDM (South), Govt. of NCT of Delhi<br/>Official Seal Affixed", body_style)]
    ]
    pst = Table(panch_sig, colWidths=[175, 175, 170])
    pst.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#94a3b8")),
        ('PADDING', (0,0), (-1,-1), 5),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
    ]))
    elems.append(pst)

    build_pdf(DIR_CASE2, "Exhibit_P03_SDM_Spot_Inspection_Seal_Panchnama.pdf", "Exhibit P-03 SDM Sealing Panchnama", "Magistrate Panchnama", elems)

# ==========================================================================
# CASE 3: ANV-2026-0053 — NHAVA SHEVA CUSTOMS DEMURRAGE (LOW PRIORITY)
# Title: Global Container Lines v. Custom House Nhava Sheva
# ==========================================================================

def generate_case3_exhibit_c01():
    """Exhibit C-1: Customs Appeal Memorandum against ₹14.8 Crore Terminal Demurrage"""
    elems = []
    elems.append(Paragraph("COURT EXHIBIT C-01 | CUSTOMS REVENUE APPEAL MEMORANDUM", meta_badge_slate))
    elems.append(Spacer(1, 3))
    elems.append(Paragraph("BEFORE THE CUSTOMS & EXCISE APPELLATE BENCH AT MUMBAI", header_style))
    elems.append(Paragraph("WEST ZONAL BENCH • STATUTORY TAX APPELLATE JURISDICTION<br/>Customs Appeal No. C/88210/2026-MUM under Section 129A of the Customs Act, 1962", sub_header_style))
    elems.append(Spacer(1, 6))
    elems.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#334155"), spaceAfter=8))

    tax_parties = [
        [Paragraph("<b>Appellant:</b>", body_bold), Paragraph("Global Container Lines (Commercial Ocean Carrier, Regional Office: Nariman Point)", body_style)],
        [Paragraph("<b>Versus</b>", body_bold), Paragraph("", body_style)],
        [Paragraph("<b>Respondent:</b>", body_bold), Paragraph("Custom House Nhava Sheva, Jawahar Custom House, Taluka Uran, Dist. Raigad", body_style)],
    ]
    t = Table(tax_parties, colWidths=[100, 420])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0,0), (-1,-1), 3.5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    elems.append(t)
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("1. PARTICULARS OF THE IMPUGNED FINANCIAL DEMAND ORDER", sec_title_style))
    order_meta = [
        [Paragraph("<b>Impugned Order:</b> Order No. JNPT/DEM-44/2026", body_style), Paragraph("<b>Dated:</b> 15-JAN-2026", body_style)],
        [Paragraph("<b>Disputed Demurrage & Ground Rent:</b> ₹9,36,00,000/-", body_style), Paragraph("<b>Reassessed 18% IGST Demand:</b> ₹5,46,40,000/-", body_style)],
        [Paragraph("<b>Total Pecuniary Amount in Controversy:</b>", body_bold), Paragraph("<b>₹14,82,40,000/- (Fourteen Crores Eighty-Two Lakhs)</b>", body_bold)],
    ]
    ot = Table(order_meta, colWidths=[260, 260])
    ot.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f1f5f9")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0,0), (-1,-1), 3),
    ]))
    elems.append(ot)
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("2. CONCISE STATEMENT OF COMMERCIAL FACTS", sec_title_style))
    comm_facts = (
        "The Appellant, Global Container Lines, is an ocean maritime carrier operating container transport vessels. "
        "Between December 2025 and January 2026, 420 Forty-Foot Equivalent Unit (FEU) maritime containers carrying industrial polymer resin "
        "arrived on vessel MV Global Horizon at Nhava Sheva container terminal. "
        "Due to routine administrative tariff documentation verification, cargo clearance was deferred for 45 days. "
        "The respondent custom house assessed terminal ground rent demurrage of ₹9.36 Crores and reassessed Integrated GST of ₹5.46 Crores, "
        "imposing an aggregate fiscal demand of ₹14.82 Crores, proposing container auction under Section 48 of the Customs Act, 1962. "
        "Appellant has deposited an unconditional bank guarantee of ₹5.00 Crores as financial security. "
        "The controversy is strictly pecuniary and commercial, involving zero physical casualties or bodily distress."
    )
    elems.append(Paragraph(comm_facts, body_style))
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("3. STATUTORY GROUNDS & CONSTITUTIONAL ARGUMENTS", sec_title_style))
    grounds_c = [
        [Paragraph("<b>Ground</b>", body_bold), Paragraph("<b>Statutory & Constitutional Contention</b>", body_bold)],
        [Paragraph("<b>Article 265: Lawful Tax Imposition</b>", body_bold), Paragraph("No tax or fiscal surcharge can be collected except by express sanction of law (CBIC Customs Instruction No. 11/2010-Cus).", body_style)],
        [Paragraph("<b>Article 300A: Right to Property</b>", body_bold), Paragraph("Commercial maritime container lien deprives ocean carrier of rightful corporate earnings without due process.", body_style)],
        [Paragraph("<b>Section 128 Customs Act</b>", body_bold), Paragraph("Port ground rent charges cannot be assessed against ocean carrier when delay is attributable to administrative processing.", body_style)],
    ]
    gt = Table(grounds_c, colWidths=[180, 340])
    gt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#e2e8f0")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    elems.append(gt)
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("4. JUDICIAL TRIAGE ASSESSMENT: LOW PRIORITY CLASSIFICATION", sec_title_style))
    triage_note = (
        "<b>ANAVAYA JUDICIAL TRIAGE RATIONALE:</b> This case is an exclusively commercial, corporate, financial, and tax demurrage dispute between a "
        "wealthy multinational shipping carrier and the customs tax outpost. There is zero bodily casualty, zero physical distress, "
        "zero threat to personal liberty, and zero vulnerable individual involved. Anavaya's Decision Tree correctly assigns this matter "
        "<b>LOW PRIORITY</b>. Under constitutional principles of resource triage, commercial balance-sheet arguments must never bottleneck "
        "emergency Article 21 life-safety cases or environmental poisonings on the daily judicial cause list."
    )
    elems.append(Paragraph(triage_note, body_style))
    elems.append(Spacer(1, 10))

    c_sig = [
        [Paragraph("<b>Senior Counsel for Appellant:</b><br/>Adv. Farokh J. Bharucha, LL.M. (Cantab)<br/>Counsel for Global Container Lines<br/>Bar Council of Maharashtra & Goa: MAH/892/1998", body_style),
         Paragraph("<b>Customs Appellate Registry:</b><br/>Customs Appeal Section, Mumbai<br/>Registered under Routine Commercial List<br/>Ordinary Hearing Track Assigned", body_style)]
    ]
    ct = Table(c_sig, colWidths=[260, 260])
    ct.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0,0), (-1,-1), 5),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
    ]))
    elems.append(ct)

    build_pdf(DIR_CASE3, "Exhibit_C01_Customs_Appeal_Memorandum.pdf", "Exhibit C-01 Customs Appeal Memorandum", "Customs Appeal", elems)

def generate_case3_exhibit_c02():
    """Exhibit C-2: Bill of Entry & Port Trust Container Ground Rent Schedule"""
    elems = []
    elems.append(Paragraph("COURT EXHIBIT C-02 | CERTIFIED PORT TRUST FISCAL LEDGER", meta_badge_slate))
    elems.append(Spacer(1, 3))
    elems.append(Paragraph("NHAVA SHEVA INTERNATIONAL CONTAINER TERMINAL (NSICT)", header_style))
    elems.append(Paragraph("TERMINAL OPERATIONS & REVENUE AUDIT SECTION • PORT CORRIDOR<br/>Certified Container Ground Rent & Demurrage Schedule under Indian Ports Act, 1908", sub_header_style))
    elems.append(Spacer(1, 6))
    elems.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#334155"), spaceAfter=8))

    port_meta = [
        [Paragraph("<b>Terminal:</b> NSICT Container Terminal Nhava Sheva", body_style), Paragraph("<b>Consignment Ref:</b> IGM No. 2026/JNPT-4019", body_style)],
        [Paragraph("<b>Vessel:</b> MV Global Horizon (Voyage 204E)", body_style), Paragraph("<b>Bill of Entry No:</b> BOE-8819204/2026", body_style)],
    ]
    t = Table(port_meta, colWidths=[260, 260])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f1f5f9")),
        ('PADDING', (0,0), (-1,-1), 3.5),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
    ]))
    elems.append(t)
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("1. COMMERCIAL CONTAINER YARD DWELL TIME & TARIFF ASSESSMENT", sec_title_style))
    ledger_table = [
        [Paragraph("<b>Tariff Component</b>", body_bold), Paragraph("<b>Container Quantity & Dwell Basis</b>", body_bold), Paragraph("<b>Applicable Rate</b>", body_bold), Paragraph("<b>Total Surcharge (INR)</b>", body_bold)],
        [Paragraph("Free Period Dwell", body_style), Paragraph("420 FEU Containers (Days 01–07)", body_style), Paragraph("Free of Charge", body_style), Paragraph("₹0.00", body_style)],
        [Paragraph("Slab 1 Ground Rent", body_style), Paragraph("420 FEU (Days 08–21: 14 Days)", body_style), Paragraph("₹3,500 / FEU / Day", body_style), Paragraph("₹2,05,80,000.00", body_style)],
        [Paragraph("Slab 2 Ground Rent", body_style), Paragraph("420 FEU (Days 22–35: 14 Days)", body_style), Paragraph("₹7,000 / FEU / Day", body_style), Paragraph("₹4,11,60,000.00", body_style)],
        [Paragraph("Slab 3 Penalty Rent", body_style), Paragraph("420 FEU (Days 36–52: 17 Days)", body_style), Paragraph("₹10,500 / FEU / Day", body_style), Paragraph("₹7,49,70,000.00", body_style)],
        [Paragraph("Reassessed 18% IGST", body_style), Paragraph("Integrated GST on Port Terminal Services", body_style), Paragraph("Statutory 18%", body_style), Paragraph("₹5,46,40,000.00", body_style)],
        [Paragraph("<b>Gross Outstanding</b>", body_bold), Paragraph("<b>Consolidated Commercial Port Dues</b>", body_bold), Paragraph("<b>Demand Finalized</b>", body_bold), Paragraph("<b>₹14,82,40,000.00</b>", body_bold)],
    ]
    lt = Table(ledger_table, colWidths=[120, 160, 110, 130])
    lt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#e2e8f0")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,6), (-1,6), colors.HexColor("#f1f5f9")),
    ]))
    elems.append(lt)
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("2. FINANCIAL SECURITIZATION & COMMERCIAL LIEN NOTICE", sec_title_style))
    lien_text = (
        "Under Section 53 of the Port Regulations, the terminal operator holds a possessory commercial maritime lien on the "
        "aforesaid 420 FEU containers pending remittance of ₹14.82 Crores. Appellant Global Container Lines has tendered an Axis Bank "
        "Irrevocable Letter of Credit (LC No. AX-2026-9041) for ₹5.00 Crores as conditional interim security. The dispute represents an "
        "ordinary commercial revenue dispute with no personal bodily casualty or health risk."
    )
    elems.append(Paragraph(lien_text, body_style))
    elems.append(Spacer(1, 10))

    audit_sig = [
        [Paragraph("<b>Chief Accounts Officer:</b><br/>Shri S. Ramanathan, ICAS<br/>Financial Adviser & CAO, Port Container Terminal", body_style),
         Paragraph("<b>Terminal Operations Manager:</b><br/>Capt. Rajesh Deshmukh<br/>NSICT Yard Operations, Nhava Sheva<br/>Official Audit Stamp Affixed", body_style)]
    ]
    at = Table(audit_sig, colWidths=[260, 260])
    at.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0,0), (-1,-1), 5),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
    ]))
    elems.append(at)

    build_pdf(DIR_CASE3, "Exhibit_C02_Bill_of_Entry_Port_Trust_Schedule.pdf", "Exhibit C-02 Port Demurrage Schedule", "Financial Ledger", elems)

def generate_all():
    print("=" * 60)
    print("Generating Additional Exhibition Cases (9 Forensic Exhibits)")
    print("=" * 60)

    print("\n--- CASE 1: State of NCT of Delhi v. Kunal Singhania (ANV-2026-0051) ---")
    generate_case1_exhibit_p01()
    generate_case1_exhibit_p02()
    generate_case1_exhibit_p03()
    generate_case1_exhibit_d01()

    print("\n--- CASE 2: Gram Panchayat Chhatarpur v. Apex Dyechem (ANV-2026-0052) ---")
    generate_case2_exhibit_p01()
    generate_case2_exhibit_p02()
    generate_case2_exhibit_p03()

    print("\n--- CASE 3: Global Container Lines v. Custom House Nhava Sheva (ANV-2026-0053) ---")
    generate_case3_exhibit_c01()
    generate_case3_exhibit_c02()

    print("\n" + "=" * 60)
    print("All 9 Forensic Showcase Exhibits Generated Successfully!")
    print("=" * 60)

if __name__ == "__main__":
    generate_all()
