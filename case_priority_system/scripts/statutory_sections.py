"""
Statutory Sections & Turnaround Time (TAT) Loss Mitigation Engine
================================================================
Determines the applicable statutory legal sections (IPC/BNS, CrPC/BNSS, Special Acts)
and computes evidence-grounded Turnaround Time (TAT) targets to mitigate legal, human,
and economic losses based on deterministic priority rules.
"""

from typing import Dict, List, Optional
import re

# Comprehensive registry of Indian statutory sections mapped by legal domain
STATUTORY_PROVISIONS_MAP = {
    # Homicide / Murder / Extreme Bodily Peril
    "murder": {
        "section": "Section 302 IPC / Section 103 BNS",
        "statute": "Indian Penal Code 1860 / Bharatiya Nyaya Sanhita 2023",
        "title": "Punishment for Murder",
        "category": "Criminal/Violent",
        "classification": "Cognizable · Non-Bailable · Triable by Court of Session",
        "severity_weight": "Fatal / Extreme",
        "statutory_mandate": "Punishable with death or imprisonment for life; mandatory prompt trial under BNSS §251.",
    },
    "attempt_murder": {
        "section": "Section 307 IPC / Section 109 BNS",
        "statute": "Indian Penal Code 1860 / Bharatiya Nyaya Sanhita 2023",
        "title": "Attempt to Murder",
        "category": "Criminal/Violent",
        "classification": "Cognizable · Non-Bailable · Triable by Court of Session",
        "severity_weight": "Major / Severe",
        "statutory_mandate": "Punishable up to 10 years or life if hurt is caused; speedy hearing to prevent victim retaliation.",
    },
    # Sexual Offenses & POCSO
    "rape": {
        "section": "Section 376 IPC / Section 64 BNS",
        "statute": "Indian Penal Code 1860 / Bharatiya Nyaya Sanhita 2023",
        "title": "Punishment for Rape / Aggravated Sexual Assault",
        "category": "Criminal/Violent",
        "classification": "Cognizable · Non-Bailable · Triable by Court of Session",
        "severity_weight": "Major / Trauma",
        "statutory_mandate": "Mandatory in-camera trial; CrPC §309 / BNSS §346 prescribes trial completion within two months.",
    },
    "pocso": {
        "section": "Sections 4 & 6 POCSO Act 2012",
        "statute": "Protection of Children from Sexual Offences Act, 2012",
        "title": "Aggravated Penetrative Sexual Assault on Child",
        "category": "Criminal/Violent",
        "classification": "Cognizable · Non-Bailable · Special POCSO Court",
        "severity_weight": "Major / Vulnerable Child",
        "statutory_mandate": "Section 35 POCSO Act explicitly mandates recording of child evidence in 30 days and trial completion within 1 year.",
    },
    # Kidnapping & Unlawful Confinement
    "kidnapping_ransom": {
        "section": "Section 364A IPC / Section 140(2) BNS",
        "statute": "Indian Penal Code 1860 / Bharatiya Nyaya Sanhita 2023",
        "title": "Kidnapping for Ransom / Hostage Taking",
        "category": "Criminal/Violent",
        "classification": "Cognizable · Non-Bailable · Court of Session",
        "severity_weight": "Fatal / Acute Life Threat",
        "statutory_mandate": "Immediate habeas relief and emergency judicial monitoring to prevent hostage death.",
    },
    "kidnapping": {
        "section": "Section 363 IPC / Section 137(2) BNS",
        "statute": "Indian Penal Code 1860 / Bharatiya Nyaya Sanhita 2023",
        "title": "Punishment for Kidnapping",
        "category": "Criminal/Violent",
        "classification": "Cognizable · Non-Bailable · Magistrate 1st Class",
        "severity_weight": "Major / Missing Person",
        "statutory_mandate": "Supreme Court Bachpan Bachao Andolan guidelines: immediate FIR and tracking within 24 hours.",
    },
    # Violent Assault / Hurt
    "grievous_hurt": {
        "section": "Sections 324 & 326 IPC / Sections 117 & 118 BNS",
        "statute": "Indian Penal Code 1860 / Bharatiya Nyaya Sanhita 2023",
        "title": "Voluntarily Causing Grievous Hurt by Dangerous Weapons",
        "category": "Criminal/Violent",
        "classification": "Cognizable · Non-Bailable · Magistrate 1st Class",
        "severity_weight": "Major / Permanent Disability Risk",
        "statutory_mandate": "Immediate medical preservation and bail hearing to prevent witness tampering.",
    },
    # Cyber Crime & Critical Infrastructure / Medical Sabotage
    "cyber_ransomware": {
        "section": "Sections 43, 66 & 66D IT Act 2000",
        "statute": "Information Technology Act, 2000",
        "title": "Computer Hacking, Denial of Service & Cyber Impersonation",
        "category": "Criminal/Violent",
        "classification": "Cognizable · Non-Bailable (where public harm or life threat is involved)",
        "severity_weight": "Fatal / Systemic Disruption",
        "statutory_mandate": "Immediate digital forensics preservation under §79A IT Act; emergency injunction for patient systems.",
    },
    "medical_negligence": {
        "section": "Section 304A IPC / Section 106 BNS",
        "statute": "Indian Penal Code 1860 / Bharatiya Nyaya Sanhita 2023",
        "title": "Causing Death by Rash or Negligent Act",
        "category": "Criminal/Violent",
        "classification": "Cognizable · Bailable · Magistrate 1st Class",
        "severity_weight": "Fatal / Reckless System Failure",
        "statutory_mandate": "Jacob Mathew v. State of Punjab medical board certification guidelines apply.",
    },
    # Commercial Fraud & Economic Offenses
    "cheating_fraud": {
        "section": "Section 420 IPC / Section 318(4) BNS",
        "statute": "Indian Penal Code 1860 / Bharatiya Nyaya Sanhita 2023",
        "title": "Cheating and Dishonestly Inducing Delivery of Property",
        "category": "Commercial/Financial",
        "classification": "Cognizable · Non-Bailable · Magistrate 1st Class",
        "severity_weight": "Economic / High Value",
        "statutory_mandate": "Asset attachment under CrPC §102 / BNSS §107 to prevent debtor flight or insolvency.",
    },
    "criminal_breach_of_trust": {
        "section": "Section 406 IPC / Section 316 BNS",
        "statute": "Indian Penal Code 1860 / Bharatiya Nyaya Sanhita 2023",
        "title": "Punishment for Criminal Breach of Trust",
        "category": "Commercial/Financial",
        "classification": "Cognizable · Non-Bailable · Magistrate 1st Class",
        "severity_weight": "Fiduciary Violation",
        "statutory_mandate": "Interim injunction to restrain dissipation of trust or corporate assets.",
    },
    "forgery_documents": {
        "section": "Sections 467 & 471 IPC / Sections 336 & 340 BNS",
        "statute": "Indian Penal Code 1860 / Bharatiya Nyaya Sanhita 2023",
        "title": "Forgery of Valuable Security / Using Forged Document as Genuine",
        "category": "Commercial/Financial",
        "classification": "Cognizable · Non-Bailable · Magistrate 1st Class",
        "severity_weight": "Documentary Tampering",
        "statutory_mandate": "Forensic handwriting/digital document impounding under Indian Evidence Act §45 / BSA §39.",
    },
    "cheque_bounce": {
        "section": "Section 138 Negotiable Instruments Act 1881",
        "statute": "Negotiable Instruments Act, 1881",
        "title": "Dishonour of Cheque for Insufficiency of Funds",
        "category": "Commercial/Financial",
        "classification": "Non-Cognizable · Bailable · Special Summary Magistrate",
        "severity_weight": "Liquid Debt Default",
        "statutory_mandate": "Section 143 NI Act mandates day-to-day trial with target conclusion within 6 months.",
    },
    "commercial_dispute": {
        "section": "Sections 2(1)(c) & 16 Commercial Courts Act 2015",
        "statute": "Commercial Courts Act, 2015",
        "title": "Commercial Dispute of Specified Value",
        "category": "Commercial/Financial",
        "classification": "Civil Jurisdiction · Commercial Division of High Court",
        "severity_weight": "Commercial Capital Lockup",
        "statutory_mandate": "Mandatory Case Management Hearing under Order XV-A CPC; judgment within 90 days of arguments.",
    },
    # Property, Land & Civil Injunctions
    "property_injunction": {
        "section": "Order 39 Rules 1 & 2 CPC / Section 38 Specific Relief Act",
        "statute": "Code of Civil Procedure, 1908 & Specific Relief Act, 1963",
        "title": "Temporary and Perpetual Injunction Against Dispossession / Encroachment",
        "category": "Civil/Property",
        "classification": "Civil Proceeding · Senior Civil Judge",
        "severity_weight": "Asset Title Dispute",
        "statutory_mandate": "Order 39 Rule 3A requires disposal of ex-parte ad-interim injunction applications within 30 days.",
    },
    "land_transfer": {
        "section": "Section 53A Transfer of Property Act 1882",
        "statute": "Transfer of Property Act, 1882",
        "title": "Doctrine of Part Performance & Title Protection",
        "category": "Civil/Property",
        "classification": "Civil Property Title Suit",
        "severity_weight": "Realty Capital Lockup",
        "statutory_mandate": "Preservation of status quo pending title deeds and encumbrance verification.",
    },
    # Taxation & Statutory Duties
    "gst_evasion": {
        "section": "Sections 67 & 132 Central Goods and Services Tax (CGST) Act 2017",
        "statute": "Central Goods and Services Tax Act, 2017",
        "title": "Offences, Search, Seizure & Fraudulent Input Tax Credit",
        "category": "Excise/Tax",
        "classification": "Cognizable & Non-Bailable (if tax evasion exceeds ₹5 Crore)",
        "severity_weight": "Fiscal Revenue Peril",
        "statutory_mandate": "Expedited revenue bench listing under Article 265 and statutory recovery timelines.",
    },
    "customs_duty": {
        "section": "Sections 111, 112 & 135 Customs Act 1962",
        "statute": "Customs Act, 1962",
        "title": "Confiscation of Improperly Imported Goods & Evasion of Duty",
        "category": "Excise/Tax",
        "classification": "Statutory Revenue Tribunal / High Court Reference",
        "severity_weight": "Border & Fiscal Compliance",
        "statutory_mandate": "Statutory appellate adjudication within prescribed fiscal quarters.",
    },
    # Constitutional & Writ Remedies
    "writ_remedy": {
        "section": "Article 226 & 227 of the Constitution of India",
        "statute": "Constitution of India",
        "title": "High Court Supervisory & Extraordinary Writ Jurisdiction",
        "category": "Constitutional/Writ",
        "classification": "Constitutional Bench / Division Bench",
        "severity_weight": "Fundamental Rights Infringement",
        "statutory_mandate": "Prompt judicial review to quash arbitrary administrative action or illegal incarceration.",
    },
}


def extract_explicit_sections_from_text(text: str) -> List[Dict]:
    """Scan case text and document excerpts for explicit Indian legal statutory citations."""
    if not text:
        return []

    found = []
    seen = set()

    # Pattern: Section / Sec / u/s / § <number> followed by Act / IPC / CrPC / POCSO / BNS
    patterns = [
        r'(?:Section|Sec\.?|u/s|u/sec\.?|§)\s*(\d+[A-Z]?(?:\s*\([0-9a-zA-Z]+\))?)\s*(?:of\s*(?:the\s*)?)?(IPC|BNS|CrPC|BNSS|POCSO|IT Act|NI Act|Commercial Courts Act)?',
        r'(IPC|BNS|CrPC|BNSS|POCSO)\s*(?:Section|Sec\.?|§)\s*(\d+[A-Z]?)',
    ]

    for p in patterns:
        for match in re.finditer(p, text, re.IGNORECASE):
            raw = match.group(0).strip()
            key = raw.upper()
            if key not in seen:
                seen.add(key)
                found.append({
                    "raw_citation": raw,
                    "source": "Document Text Extraction",
                })
    return found


def determine_statutory_sections(
    category: str = "",
    crime_type: str = "",
    severity: str = "",
    vulnerability: str = "",
    influence: str = "",
    text: str = "",
) -> List[Dict]:
    """
    Derives the applicable Statutory Sections (IPC/BNS, CrPC/BNSS, Special Acts)
    based on deterministic legal rules and extracted document evidence.
    """
    cat = (category or "").lower()
    crime = (crime_type or "").lower()
    sev = (severity or "").lower()
    vuln = (vulnerability or "").lower()
    text_lower = (text or "").lower()

    sections: List[Dict] = []
    added_keys = set()

    def add_provision(key: str, reason: str = ""):
        if key in STATUTORY_PROVISIONS_MAP and key not in added_keys:
            entry = dict(STATUTORY_PROVISIONS_MAP[key])
            if reason:
                entry["inference_ground"] = reason
            sections.append(entry)
            added_keys.add(key)

    # 1. Check for specific high-stakes crime types
    if "murder" in text_lower or "homicide" in text_lower or (sev == "fatal" and "violent" in crime):
        add_provision("murder", "Direct match with fatal violence allegation / homicide report")

    if "kidnap" in text_lower or "abduction" in text_lower or "missing" in text_lower:
        if "ransom" in text_lower or "extortion" in text_lower or "hostage" in text_lower:
            add_provision("kidnapping_ransom", "Extortion / hostage allegation involving human life")
        else:
            add_provision("kidnapping", "Missing person / unlawful confinement allegation")

    if "pocso" in text_lower or ("child" in vuln and ("sexual" in text_lower or "rape" in text_lower or "assault" in text_lower)):
        add_provision("pocso", "Offense committed against child / statutory POCSO mandate")
        add_provision("rape", "Aggravated sexual assault penal provision")
    elif "rape" in text_lower or "sexual assault" in text_lower or "376" in text_lower:
        add_provision("rape", "Sexual violence / bodily integrity violation")

    if "hospital" in text_lower or "icu" in text_lower or "ventilator" in text_lower or "ransomware" in text_lower:
        add_provision("cyber_ransomware", "Malicious cyber interference affecting critical medical/life infrastructure")
        if sev in ["fatal", "major"]:
            add_provision("medical_negligence", "Critical healthcare delivery compromise causing bodily peril")

    if "assault" in text_lower or "weapon" in text_lower or ("violent" in crime and sev in ["major", "fatal"]):
        add_provision("grievous_hurt", "Armed assault / severe bodily injury inflicted")

    # 2. Commercial / Financial / Fraud
    if "commercial" in cat or "financial" in cat or "cheating" in text_lower or "fraud" in text_lower or "bank" in text_lower:
        if "forgery" in text_lower or "forged" in text_lower or "fake invoice" in text_lower:
            add_provision("forgery_documents", "Falsification of commercial records or tax invoices")
        add_provision("cheating_fraud", "Deceptive financial inducement / property misappropriation")
        if "breach of trust" in text_lower or "fiduciary" in text_lower or "director" in text_lower:
            add_provision("criminal_breach_of_trust", "Breach of corporate/fiduciary trust")
        if "cheque" in text_lower or "bounce" in text_lower or "138" in text_lower:
            add_provision("cheque_bounce", "Statutory negotiable instrument dishonour")
        add_provision("commercial_dispute", "Statutory commercial suit under Commercial Courts Act 2015")

    # 3. Property / Land
    if "property" in cat or "land" in cat or "eviction" in text_lower or "encroachment" in text_lower:
        add_provision("property_injunction", "Disputed physical possession requiring injunctive relief")
        add_provision("land_transfer", "Real estate conveyance / title validity dispute")

    # 4. Excise / Tax / Customs
    if "excise" in cat or "tax" in cat or "gst" in text_lower or "customs" in text_lower:
        if "gst" in text_lower or "tax" in cat:
            add_provision("gst_evasion", "Statutory tax audit and revenue evasion adjudication")
        if "customs" in text_lower or "import" in text_lower or "export" in text_lower:
            add_provision("customs_duty", "Customs duty assessment and clearance dispute")

    # 5. Constitutional / Writ Default
    if "constitutional" in cat or "writ" in cat or not sections:
        add_provision("writ_remedy", "Supervisory writ jurisdiction under Articles 226 & 227")

    # If still empty, supply appropriate defaults
    if not sections:
        if "violent" in crime or "criminal" in cat:
            add_provision("grievous_hurt", "General criminal penal provisions")
        elif "commercial" in cat:
            add_provision("commercial_dispute", "Commercial adjudication provisions")
        else:
            add_provision("writ_remedy", "General statutory judicial review")

    return sections


def calculate_turnaround_time(
    priority: str,
    category: str = "",
    severity: str = "",
    vulnerability: str = "",
    document_count: int = 1,
    delay_days: int = 0,
) -> Dict:
    """
    Computes the recommended Turnaround Time (TAT) and Loss Mitigation Metrics
    to prevent irreversible human, custodial, or economic damage.
    """
    prio = (priority or "Medium").capitalize()
    cat = (category or "").lower()
    sev = (severity or "").lower()
    vuln = (vulnerability or "").lower()

    if prio == "High":
        hearing_window = "Within 24 to 72 Hours"
        hearing_days = 3
        disposal_window = "30 to 90 Days"
        disposal_days = 90
        benchmark = "Article 21 Speedy Trial Mandate & Hussainara Khatoon Doctrine (Emergency Liberty Bench)"
        loss_category = "Irreversible Loss of Liberty & Bodily Integrity"
        risk_level = "Critical / Imminent"
        projected_loss = (
            "Prolonged pendency risks unconstitutional undertrial incarceration beyond statutory threshold "
            "(CrPC §436A / BNSS §479), severe psychiatric trauma, witness coercion, and irrecoverable digital/forensic evidence spoilage."
        )
        mitigation_benefit = (
            "Immediate listing within 72 hours halts ongoing bodily/liberty damage, secures interim bail/protection, "
            "and prevents institutional delay from degenerating into human tragedy."
        )
        mitigation_pct = 94
        action_directive = "Emergency Hearing Scheduled in Next Immediate Court Session"
        urgency_pill = "IMMEDIATE_ACTION"

    elif prio == "Medium":
        hearing_window = "Within 7 to 14 Days"
        hearing_days = 14
        disposal_window = "90 to 180 Days"
        disposal_days = 180
        benchmark = "Commercial Courts Act 2015 (§16 Case Management) & Arbitration Act Section 29A"
        loss_category = "Commercial Solvency & Compounding Fiscal Attrition"
        risk_level = "Elevated / Financial Compounding"
        projected_loss = (
            "Delay leads to compounding interest liability, blocked operating capital, potential enterprise insolvency, "
            "and asset dissipation by adverse parties."
        )
        mitigation_benefit = (
            "Fast-track listing within 14 days preserves commercial liquidity, mandates pre-trial disclosures, "
            "and curtails compound commercial attrition by up to 80%."
        )
        mitigation_pct = 78
        action_directive = "Routed to Fast-Track Commercial Docket / Statutory Supervisory Calendar"
        urgency_pill = "FAST_TRACK"

    else:  # Low
        hearing_window = "Within 30 to 60 Days"
        hearing_days = 60
        disposal_window = "180 to 365 Days"
        disposal_days = 365
        benchmark = "National Court Management System (NCMS) Routine Civil Docket Guidelines"
        loss_category = "Standard Civil Procedure & Transactional Docketing"
        risk_level = "Low / Stable"
        projected_loss = (
            "Routine procedural delay without risk of irreversible bodily harm or corporate liquidation."
        )
        mitigation_benefit = (
            "Orderly chronological triage prevents queue-jumping, preserving judicial bench hours for urgent liberty "
            "and severe commercial distress cases."
        )
        mitigation_pct = 45
        action_directive = "Queued on Standard Civil Hearing Docket in Regular Chronological Order"
        urgency_pill = "STANDARD_QUEUE"

    # Evidence adjustment
    if document_count >= 5:
        target_hearing_count = "4–6 Structured Sessions"
    elif document_count >= 3:
        target_hearing_count = "2–4 Structured Sessions"
    else:
        target_hearing_count = "1–2 Summary Sessions"

    return {
        "priority_tier": prio,
        "recommended_hearing_window": hearing_window,
        "recommended_hearing_days": hearing_days,
        "target_disposal_window": disposal_window,
        "target_disposal_days": disposal_days,
        "statutory_benchmark": benchmark,
        "target_hearing_sessions": target_hearing_count,
        "loss_category": loss_category,
        "loss_risk_level": risk_level,
        "projected_loss_if_delayed": projected_loss,
        "loss_mitigation_benefit": mitigation_benefit,
        "mitigation_percentage": f"{mitigation_pct}%",
        "action_directive": action_directive,
        "urgency_pill": urgency_pill,
    }
