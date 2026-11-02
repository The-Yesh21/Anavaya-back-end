"""
Anavaya Showcase Case Exhibit Generator
Generates 5 authentic forensic PDFs for the Apollo Hope Critical Care Extortion case:
State of Maharashtra v. Vikram Malhotra & Anr. (Docket ANV-2026-0042)
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

OUTPUT_DIR = os.path.abspath("showcase_cases/apollo_critical_care")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def build_pdf(filename, title, category, elements):
    filepath = os.path.join(OUTPUT_DIR, filename)
    doc = SimpleDocTemplate(
        filepath,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )
    doc.build(elements)
    print(f"Generated: {filepath} ({os.path.getsize(filepath):,} bytes)")
    return filepath

# Base Styles
styles = getSampleStyleSheet()

header_style = ParagraphStyle(
    "HeaderStyle",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=14,
    leading=18,
    alignment=1, # Center
    textColor=colors.HexColor("#1e293b"),
)

sub_header_style = ParagraphStyle(
    "SubHeaderStyle",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=9,
    leading=12,
    alignment=1,
    textColor=colors.HexColor("#475569"),
)

sec_title_style = ParagraphStyle(
    "SecTitleStyle",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=11,
    leading=14,
    textColor=colors.HexColor("#0f172a"),
)

body_style = ParagraphStyle(
    "BodyStyle",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=9,
    leading=13,
    textColor=colors.HexColor("#1e293b"),
)

bold_style = ParagraphStyle(
    "BoldStyle",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=9,
    leading=13,
    textColor=colors.HexColor("#0f172a"),
)

meta_badge_style = ParagraphStyle(
    "MetaBadgeStyle",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=8,
    leading=10,
    alignment=2, # Right
    textColor=colors.HexColor("#b91c1c"),
)

# --------------------------------------------------------------------------
# EXHIBIT P-01: FIRST INFORMATION REPORT (FIR)
# --------------------------------------------------------------------------
def generate_exhibit_p01():
    elems = []
    elems.append(Paragraph("COURT EXHIBIT P-01 | CRIME DOCKET ANV-2026-0042", meta_badge_style))
    elems.append(Spacer(1, 4))
    elems.append(Paragraph("FORM NO. IIF-I — INTEGRATED FIRST INFORMATION REPORT", header_style))
    elems.append(Paragraph("MAHARASHTRA STATE POLICE • BANDRA DIVISION • DISTRICT MUMBAI SUBURBAN<br/>Recorded under Section 173 Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023", sub_header_style))
    elems.append(Spacer(1, 8))
    elems.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0f172a"), spaceAfter=10))

    meta_table = [
        [Paragraph("<b>FIR No:</b> 412/2026", body_style), Paragraph("<b>Police Station:</b> Bandra West", body_style), Paragraph("<b>Date & Time:</b> 14-OCT-2026 21:45 IST", body_style)],
        [Paragraph("<b>Acts & Sections:</b> BNS 140(2), 308(2), 61(2) & IT Act Sec 66", body_style), Paragraph("<b>Occurrence:</b> 14-OCT-2026 20:45–21:15 IST", body_style), Paragraph("<b>GD Entry Ref:</b> GD-889/26", body_style)],
    ]
    t = Table(meta_table, colWidths=[180, 160, 180])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    elems.append(t)
    elems.append(Spacer(1, 10))

    elems.append(Paragraph("1. COMPLAINANT & VICTIM PARTICULARS", sec_title_style))
    c_table = [
        [Paragraph("<b>Complainant / Informant:</b>", bold_style), Paragraph("Dr. Arvind Swaminathan, Medical Superintendent, Apollo Hope Children's Hospital, Mumbai", body_style)],
        [Paragraph("<b>Victim / Endangered Minor:</b>", bold_style), Paragraph("Master Aarav Sharma, Age 8 Years, Patient ID #AH-PICU-402, Admitted to PICU Bed 04.", body_style)],
        [Paragraph("<b>Accused / Suspects:</b>", bold_style), Paragraph("Rohan Verma (Senior Biomedical Tech, Employee ID #BT-8842), Vikram Malhotra, & Unknown Conspirators", body_style)],
    ]
    t = Table(c_table, colWidths=[150, 370])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    elems.append(t)
    elems.append(Spacer(1, 10))

    elems.append(Paragraph("2. CONCISE STATEMENT OF FACTUAL OCCURRENCE (SUBSTANTIVE COMPLAINT)", sec_title_style))
    statement = (
        "On 14-Oct-2026 at approximately 20:45 IST, Dr. Arvind Swaminathan was notified that the central digital telemetry "
        "monitoring unit for Ward 4B (Pediatric Intensive Care Unit) suffered an abrupt unauthorized override. "
        "Concurrently, the oxygen saturation and ECMO extracorporeal life-support loop connected to 8-year-old patient "
        "Master Aarav Sharma was physically sabotaged and disconnected at Bed 04. An extortion communication was delivered "
        "demanding ₹2.5 Crores (Two Crores Fifty Lakhs) and 500,000 USDT in cryptocurrency within 4 hours, failing which "
        "the child's vital oxygen loop would be remotely purged. Master Aarav Sharma suffers from severe post-operative myocarditis "
        "and is incapable of spontaneous respiration. Any cessation of specialized arterial pressure support results in fatal "
        "cardiac collapse within a 4-hour clinical threshold. Staff Nurse Anjali Nair witnessed suspect Rohan Verma tampering "
        "with the ventilator telemetry sub-station at 20:56 IST. Biometric access records verify Badge #BT-8842 entered the server "
        "room at 20:58:14 IST. This constitutes deliberate Kidnapping for Ransom, Cyber Extortion, and an immediate existential "
        "threat to human life engaging fundamental rights under Article 21 of the Constitution of India."
    )
    elems.append(Paragraph(statement, body_style))
    elems.append(Spacer(1, 10))

    elems.append(Paragraph("3. STATUTORY CLASSIFICATION & DISPATCH", sec_title_style))
    disp_text = (
        "Cognizable offences registered under Sections 140(2) (Kidnapping with threat to murder/cause hurt for ransom), "
        "308(2) (Extortion by putting person in fear of death), 61(2) (Criminal Conspiracy) of Bharatiya Nyaya Sanhita, 2023, "
        "and Section 66 of Information Technology Act, 2000. Forwarded forthwith to the Hon'ble Judicial Magistrate & High Court Emergency Vacation Bench."
    )
    elems.append(Paragraph(disp_text, body_style))
    elems.append(Spacer(1, 15))

    sig_data = [
        [Paragraph("<b>Recorded By:</b><br/>Inspector R. Gaikwad<br/>Station House Officer, Bandra PS", body_style),
         Paragraph("<b>Forwarded To:</b><br/>Registrar (Judicial)<br/>High Court of Judicature", body_style),
         Paragraph("<b>Digital Forensic Seal:</b><br/>SHA256: e8b9f12a...77cd<br/>Status: Verified Intact", body_style)]
    ]
    st = Table(sig_data, colWidths=[180, 180, 160])
    st.setStyle(TableStyle([('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#94a3b8")), ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f1f5f9")), ('PADDING', (0,0), (-1,-1), 6)]))
    elems.append(st)

    build_pdf("Exhibit_P01_FIR_CR_2026_089_Cyber_Kidnap.pdf", "Exhibit P-01 Police FIR", "FIR", elems)

# --------------------------------------------------------------------------
# EXHIBIT P-02: EMERGENCY PEDIATRIC MEDICAL STATUS CERTIFICATE
# --------------------------------------------------------------------------
def generate_exhibit_p02():
    elems = []
    elems.append(Paragraph("COURT EXHIBIT P-02 | EMERGENCY CLINICAL RECORD", meta_badge_style))
    elems.append(Spacer(1, 4))
    elems.append(Paragraph("APOLLO HOPE CHILDREN'S HOSPITAL — CRITICAL CARE DIRECTORATE", header_style))
    elems.append(Paragraph("DEPARTMENT OF PEDIATRIC CARDIOTHORACIC MEDICINE & SURGICAL INTENSIVE CARE<br/>Certified Medical Expert Opinion under Section 39 Bharatiya Sakshya Adhiniyam, 2023", sub_header_style))
    elems.append(Spacer(1, 8))
    elems.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#b91c1c"), spaceAfter=10))

    patient_meta = [
        [Paragraph("<b>Patient Name:</b> Master Aarav Sharma", body_style), Paragraph("<b>Age / Sex:</b> 8 Yrs / Male", body_style), Paragraph("<b>IPD No:</b> IP-2026-9042", body_style)],
        [Paragraph("<b>Attending Specialist:</b> Dr. Radhika Sen, MD, DM", body_style), Paragraph("<b>Ward / Bed:</b> PICU Bed 04", body_style), Paragraph("<b>Date & Time:</b> 14-OCT-2026 21:15 IST", body_style)],
    ]
    t = Table(patient_meta, colWidths=[180, 160, 180])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#fef2f2")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#fca5a5")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#fecaca")),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    elems.append(t)
    elems.append(Spacer(1, 10))

    elems.append(Paragraph("1. CLINICAL DIAGNOSIS & PHYSIOLOGICAL DEPENDENCE", sec_title_style))
    diag = (
        "The patient, Master Aarav Sharma, is in a critical post-operative state following emergency aortic conduit revision "
        "and fulminant myocarditis. The patient is 100% dependent on continuous mechanical ventilation and an active Extracorporeal "
        "Membrane Oxygenation (ECMO) circuit. Vital arterial line infusion of Epinephrine (0.08 mcg/kg/min) and Milrinone is governed "
        "by the digital telemetry servo-loop linked to PICU Server Sub-Station A."
    )
    elems.append(Paragraph(diag, body_style))
    elems.append(Spacer(1, 10))

    elems.append(Paragraph("2. PERIL TO HUMAN LIFE & TIME-SENSITIVITY ASSESSMENT", sec_title_style))
    peril = (
        "<b>IMMEDIATE FATAL RISK ASSESSMENT:</b> Physical tampering or remote digital locking of the ECMO gas-blender manifold "
        "renders arterial oxygen saturation (SaO2) unstable. In the event of battery or localized power cutoff without immediate "
        "manual biomedical reconstitution, irreversible hypoxic brain damage will ensue within <b>12 to 18 minutes</b>, and fatal "
        "cardiopulmonary arrest is inevitable within a maximum clinical threshold of <b>4 hours</b>. The patient cannot survive transport "
        "without specialized mobile neonatal/pediatric life-support escort. This matter constitutes an acute emergency under "
        "Article 21 (Right to Life) of the Constitution of India."
    )
    elems.append(Paragraph(peril, body_style))
    elems.append(Spacer(1, 10))

    elems.append(Paragraph("3. CLINICAL DIRECTIVE FOR JUDICIAL RECORD", sec_title_style))
    directive = (
        "I solemnly certify that any administrative delay, procedural backlog, or deprivation of immediate judicial and police "
        "intervention will result in immediate mortality. Unconditional emergency priority is mandatory to secure the digital "
        "telemetry decrypt keys and patient recovery."
    )
    elems.append(Paragraph(directive, body_style))
    elems.append(Spacer(1, 20))

    doc_sig = [
        [Paragraph("<b>Certifying Clinician:</b><br/>Dr. Radhika Sen, MBBS, MD, DM (Cardiology)<br/>Director, Pediatric ICU, Apollo Hope Hospital<br/>Reg. No: MMC-2004/08/3120", body_style),
         Paragraph("<b>Institutional Attestation:</b><br/>Dr. Arvind Swaminathan<br/>Medical Superintendent, Apollo Hope Hospital<br/>Seal & Signature Affixed", body_style)]
    ]
    dt = Table(doc_sig, colWidths=[260, 260])
    dt.setStyle(TableStyle([('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")), ('PADDING', (0,0), (-1,-1), 6), ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc"))]))
    elems.append(dt)

    build_pdf("Exhibit_P02_Pediatric_ICU_Clinical_Status.pdf", "Exhibit P-02 Medical Status Certificate", "Medical Record", elems)

# --------------------------------------------------------------------------
# EXHIBIT P-03: HOSPITAL CCTV & SERVER ACCESS AUDIT LOG
# --------------------------------------------------------------------------
def generate_exhibit_p03():
    elems = []
    elems.append(Paragraph("COURT EXHIBIT P-03 | CERTIFIED ELECTRONIC EVIDENCE", meta_badge_style))
    elems.append(Spacer(1, 4))
    elems.append(Paragraph("DIRECTORATE OF CYBER SECURITY & DIGITAL FORENSICS", header_style))
    elems.append(Paragraph("CENTRAL AUDIT LOG REPORT — APPOLLO HOPE HEALTHCARE SYSTEM<br/>Certificate under Section 63 of Bharatiya Sakshya Adhiniyam, 2023 (Sec 65B IEA)", sub_header_style))
    elems.append(Spacer(1, 8))
    elems.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#1e3a8a"), spaceAfter=10))

    report_meta = [
        [Paragraph("<b>Target System:</b> PICU Sub-Station A & Server Node 04", body_style), Paragraph("<b>Log Window:</b> 14-OCT-2026 20:30–21:30 IST", body_style)],
        [Paragraph("<b>Forensic Analyst:</b> Insp. V. Kulkarni, Cyber Cell CID", body_style), Paragraph("<b>Device Hash:</b> SHA256: 7f8a91...bc04 (Immutable)", body_style)],
    ]
    t = Table(report_meta, colWidths=[260, 260])
    t.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f1f5f9")), ('PADDING', (0,0), (-1,-1), 4), ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1"))]))
    elems.append(t)
    elems.append(Spacer(1, 10))

    elems.append(Paragraph("1. CHRONOLOGICAL AUDIT OF BIOMETRIC & ELECTRONIC ACCESS", sec_title_style))
    
    log_rows = [
        [Paragraph("<b>Timestamp (IST)</b>", bold_style), Paragraph("<b>Subsystem / Sensor</b>", bold_style), Paragraph("<b>Event & Authenticated Credential</b>", bold_style), Paragraph("<b>Forensic Status</b>", bold_style)],
        [Paragraph("20:42:10", body_style), Paragraph("Ward 4B Perimeter", body_style), Paragraph("Badge Swipe #RN-104 (Nurse Nair - Authorized Access)", body_style), Paragraph("NORMAL", body_style)],
        [Paragraph("20:51:33", body_style), Paragraph("Main Server Gateway", body_style), Paragraph("SSH Connection initiated from internal terminal IP 10.14.4.88", body_style), Paragraph("FLAGGED", body_style)],
        [Paragraph("<b>20:58:14</b>", bold_style), Paragraph("<b>Server Room Sub-Station A</b>", bold_style), Paragraph("<b>Biometric Smart Badge #BT-8842 swiped. Registered to: ROHAN VERMA (Senior Biomedical Tech). Door unlatched.</b>", bold_style), Paragraph("<b>CRITICAL MATCH</b>", bold_style)],
        [Paragraph("21:02:40", body_style), Paragraph("CCTV Camera 07 (Corridor)", body_style), Paragraph("Signal blackout triggered; manual coaxial loop cut detected.", body_style), Paragraph("TAMPERED", body_style)],
        [Paragraph("21:06:15", body_style), Paragraph("Service Elevator B", body_style), Paragraph("Elevator called to Basement 2. Visual sighting by Nurse Anjali Nair.", body_style), Paragraph("CORROBORATED", body_style)],
        [Paragraph("21:14:02", body_style), Paragraph("Ambulance Bay Gate 03", body_style), Paragraph("Boom barrier override; Black SUV MH-02-CB-9021 exited at high speed.", body_style), Paragraph("SUSPICIOUS", body_style)],
    ]
    lt = Table(log_rows, colWidths=[75, 120, 240, 85])
    lt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#e2e8f0")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('BACKGROUND', (0,3), (-1,3), colors.HexColor("#fef3c7")),
    ]))
    elems.append(lt)
    elems.append(Spacer(1, 10))

    elems.append(Paragraph("2. EXPERT FORENSIC FINDING & TEMPORAL CONTRADICTION CITATION", sec_title_style))
    finding = (
        "<b>CERTIFIED FORENSIC CONCLUSION:</b> Smart Badge <b>#BT-8842</b> assigned exclusively to Rohan Verma was physically "
        "swiped at the Apollo Hope Hospital Server Room at <b>20:58:14 IST</b> on 14-Oct-2026. Cryptographic hardware verification "
        "confirms zero digital replication or cloning. Any subsequent claim or receipt asserting that Rohan Verma or his vehicle "
        "was physically present at the Electronic City / Vashi Toll Plaza (a distance of 28.4 km to 42 km) at <b>21:00:00 IST</b> is "
        "<b>PHYSICALLY AND CHRONOLOGICALLY IMPOSSIBLE</b>, as it would require traveling 28.4 kilometers in 106 seconds (exceeding 964 km/h)."
    )
    elems.append(Paragraph(finding, body_style))
    elems.append(Spacer(1, 15))

    cert_box = [
        [Paragraph("<b>Electronic Evidence Certifier:</b><br/>Inspector Vikram Kulkarni, B.Tech, Cyber Forensics<br/>State Cyber Police Headquarters, Mumbai<br/>Digital Certificate ID: CERT-BSA-63-2026-9941", body_style),
         Paragraph("<b>Authentication Hash:</b><br/>SHA-256: 4e892c9081fba671c890123ef...<br/>Raw Bitstream Dump Archived on WORM Drive", body_style)]
    ]
    ct = Table(cert_box, colWidths=[260, 260])
    ct.setStyle(TableStyle([('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")), ('PADDING', (0,0), (-1,-1), 5), ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc"))]))
    elems.append(ct)

    build_pdf("Exhibit_P03_Hospital_CCTV_and_Server_Access_Log.pdf", "Exhibit P-03 Server & CCTV Audit Log", "Digital Log", elems)

# --------------------------------------------------------------------------
# EXHIBIT P-04: SWORN WITNESS DEPOSITION (NURSE ANJALI NAIR)
# --------------------------------------------------------------------------
def generate_exhibit_p04():
    elems = []
    elems.append(Paragraph("COURT EXHIBIT P-04 | SWORN WITNESS STATEMENT", meta_badge_style))
    elems.append(Spacer(1, 4))
    elems.append(Paragraph("IN THE COURT OF THE JUDICIAL MAGISTRATE 1ST CLASS, BANDRA", header_style))
    elems.append(Paragraph("DEPOSITION RECORDED UNDER SECTION 183 BHARATIYA NAGARIK SURAKSHA SANHITA (BNSS), 2023<br/>Case Docket: State of Maharashtra v. Vikram Malhotra & Anr. (FIR 412/2026)", sub_header_style))
    elems.append(Spacer(1, 8))
    elems.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#047857"), spaceAfter=10))

    w_meta = [
        [Paragraph("<b>Witness Name:</b> Nurse Anjali Nair", body_style), Paragraph("<b>Age:</b> 34 Years", body_style), Paragraph("<b>Designation:</b> Head Staff Nurse, PICU Ward 4B", body_style)],
        [Paragraph("<b>Residing At:</b> Khar West, Mumbai", body_style), Paragraph("<b>Date:</b> 15-OCT-2026 09:30 IST", body_style), Paragraph("<b>Oath:</b> Administered on Solemn Affirmation", body_style)],
    ]
    t = Table(w_meta, colWidths=[180, 140, 200])
    t.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f0fdf4")), ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#86efac")), ('PADDING', (0,0), (-1,-1), 4)]))
    elems.append(t)
    elems.append(Spacer(1, 10))

    elems.append(Paragraph("STATEMENT OF THE WITNESS UPON SOLEMN OATH", sec_title_style))
    dep_text = (
        "\"I, Anjali Nair, do solemnly state on oath as follows:<br/><br/>"
        "1. I was on night duty in Pediatric Intensive Care Unit (PICU) Ward 4B on October 14, 2026. Master Aarav Sharma, "
        "age 8, was under my direct monitoring at Bed 04 on ECMO arterial life support.<br/><br/>"
        "2. At approximately 20:56 IST, I walked down the central corridor toward the medicine dispensary. Near the telemetry sub-station, "
        "I observed an individual wearing grey biomedical maintenance overalls and a dark hoodie. He was leaning over the central manifold "
        "console with a diagnostic laptop connected directly into the auxiliary port.<br/><br/>"
        "3. When I asked what he was doing, he turned halfway toward me. I clearly recognized his facial features and build — it was "
        "<b>Rohan Verma</b>, who is our senior biomedical equipment technician. He appeared visibly startled, had an irregular nervous stammer, "
        "and abruptly stated he was running a routine oxygen firmware recalibration.<br/><br/>"
        "4. At approximately 21:05 IST, while returning with medications, I saw him pushing a sealed portable pediatric transport incubator "
        "toward Service Elevator B. The emergency telemetry alarms began sounding immediately thereafter at 21:08 IST. "
        "When I rushed into Bed 04, Master Aarav Sharma was missing, and the life-support sensor conduits were severed.<br/><br/>"
        "5. I state with complete certainty that Rohan Verma was physically inside Apollo Hope Hospital between 20:55 and 21:07 IST. "
        "Any assertion that he was elsewhere is completely false.\""
    )
    elems.append(Paragraph(dep_text, body_style))
    elems.append(Spacer(1, 15))

    sig_tab = [
        [Paragraph("<b>Deponent / Witness:</b><br/>(Sd/- Anjali Nair)<br/>Thumb Impression & Signature Verified", body_style),
         Paragraph("<b>Magistrate 1st Class Attestation:</b><br/>Statement recorded under my hand and supervision.<br/>Court Seal & Signature Affixed", body_style)]
    ]
    st = Table(sig_tab, colWidths=[260, 260])
    st.setStyle(TableStyle([('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")), ('PADDING', (0,0), (-1,-1), 6), ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc"))]))
    elems.append(st)

    build_pdf("Exhibit_P04_Witness_Deposition_Nurse_Anjali.pdf", "Exhibit P-04 Witness Deposition", "Witness Statement", elems)

# --------------------------------------------------------------------------
# EXHIBIT D-01: DEFENCE ALIBI FASTAG TOLL & PETROLEUM RECEIPT
# --------------------------------------------------------------------------
def generate_exhibit_d01():
    elems = []
    elems.append(Paragraph("COURT EXHIBIT D-01 | DEFENCE ALIBI EXHIBIT", meta_badge_style))
    elems.append(Spacer(1, 4))
    elems.append(Paragraph("DEFENCE EVIDENCE DOCKET — ADVOCATE KABIR SINGHANIA", header_style))
    elems.append(Paragraph("SUBMITTED ON BEHALF OF ACCUSED ROHAN VERMA<br/>Fastag Electronic Toll Transit Audit & Petroleum Voucher", sub_header_style))
    elems.append(Spacer(1, 8))
    elems.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#d97706"), spaceAfter=10))

    d_meta = [
        [Paragraph("<b>Presented By:</b> Adv. Kabir Singhania, Defence Counsel", body_style), Paragraph("<b>Claimed Alibi Location:</b> Electronic City Toll Plaza", body_style)],
        [Paragraph("<b>Claimed Transit Time:</b> 14-OCT-2026 21:00:00 IST", body_style), Paragraph("<b>Vehicle Number:</b> MH-02-AZ-4410", body_style)],
    ]
    t = Table(d_meta, colWidths=[260, 260])
    t.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#fffbeb")), ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#fde68a")), ('PADDING', (0,0), (-1,-1), 4)]))
    elems.append(t)
    elems.append(Spacer(1, 10))

    elems.append(Paragraph("1. PURPORTED ELECTRONIC TOLL TRANSIT RECORD (FASTAG)", sec_title_style))
    toll_desc = (
        "The Defence submits this purported transaction voucher generated by Metro Petroleum & NHAI Toll Gate (Electronic City/Vashi corridor). "
        "It alleges that vehicle registration MH-02-AZ-4410 registered to Rohan Verma passed Lane 04 at exactly <b>21:00:00 IST</b> on 14-October-2026, "
        "and purchased 25 Litres of fuel at 21:04 IST. On this basis, the Defence contends that Rohan Verma was physically <b>28.4 km away</b> from "
        "the Apollo Hope Hospital at the exact time the PICU server room was breached."
    )
    elems.append(Paragraph(toll_desc, body_style))
    elems.append(Spacer(1, 10))

    voucher_rows = [
        [Paragraph("<b>Field Description</b>", bold_style), Paragraph("<b>Voucher Data Value</b>", bold_style), Paragraph("<b>Audit Remark</b>", bold_style)],
        [Paragraph("Toll Plaza ID", body_style), Paragraph("NHAI-Toll-EC-08", body_style), Paragraph("Electronic City Outpost", body_style)],
        [Paragraph("Transaction ID", body_style), Paragraph("TXN-90218841-FTG", body_style), Paragraph("Fastag Electronic Capture", body_style)],
        [Paragraph("Vehicle Plate", body_style), Paragraph("MH-02-AZ-4410", body_style), Paragraph("Registered to Rohan Verma", body_style)],
        [Paragraph("<b>Transaction Time</b>", bold_style), Paragraph("<b>14-OCT-2026 21:00:00 IST</b>", bold_style), Paragraph("<b>DIRECT CONTRADICTION WITH EX. P-03</b>", bold_style)],
        [Paragraph("Amount Paid", body_style), Paragraph("₹125.00", body_style), Paragraph("Standard Car Class", body_style)],
    ]
    vt = Table(voucher_rows, colWidths=[150, 180, 190])
    vt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#fef3c7")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#fde68a")),
        ('PADDING', (0,0), (-1,-1), 4),
        ('BACKGROUND', (0,4), (-1,4), colors.HexColor("#fee2e2")),
    ]))
    elems.append(vt)
    elems.append(Spacer(1, 10))

    elems.append(Paragraph("2. DEFENCE SUBMISSION & PRAYER", sec_title_style))
    subm = (
        "The Defence prays for immediate quashing of coercive warrants against Rohan Verma on grounds of an iron-clad alibi. "
        "However, as noted in Anavaya's forensic corroboration matrix, this alibi directly conflicts with Exhibit P-03 (Biometric badge swipe at 20:58:14 IST) "
        "and Exhibit P-04 (Nurse Nair eyewitness sighting at 20:56 IST), proving either the toll tag was cloned or transported in absentia."
    )
    elems.append(Paragraph(subm, body_style))
    elems.append(Spacer(1, 15))

    counsel_sig = [
        [Paragraph("<b>Filed By:</b><br/>Adv. Kabir Singhania<br/>Senior Counsel for the Accused<br/>Bar Council Enrollment: MAH/1089/2012", body_style),
         Paragraph("<b>Registry Endorsement:</b><br/>Filed under Objection u/s 103 Evidence Act.<br/>Subject to Forensic Cross-Examination", body_style)]
    ]
    cst = Table(counsel_sig, colWidths=[260, 260])
    cst.setStyle(TableStyle([('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")), ('PADDING', (0,0), (-1,-1), 6), ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc"))]))
    elems.append(cst)

    build_pdf("Exhibit_D01_Defence_Alibi_Toll_Receipt.pdf", "Exhibit D-01 Defence Alibi Toll Receipt", "Defence Exhibit", elems)

def generate_all():
    print("=== Generating 5 Forensic Showcase Exhibits ===")
    generate_exhibit_p01()
    generate_exhibit_p02()
    generate_exhibit_p03()
    generate_exhibit_p04()
    generate_exhibit_d01()
    print("=== All 5 Exhibits Generated Successfully in showcase_cases/apollo_critical_care/ ===")

if __name__ == "__main__":
    generate_all()
