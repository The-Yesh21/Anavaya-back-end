"""
Constitutional & Legal Analysis Module
=======================================

Provides a detailed, unbiased 'State's Perspective' analysis of legal cases
based on the Constitution of India. This module is designed to help the
judiciary (as an unbiased state) assess case priority through the lens of
constitutional rights, duties, and legal principles.

The analysis covers:
  1. Constitutional rights engaged — specific articles triggered by the case
  2. State's duty & obligation — what the state (judiciary) must do
  3. Competing rights balancing — how to weigh conflicting constitutional interests
  4. Proportionality analysis — whether the priority is proportionate
  5. Doctrinal references — key constitutional doctrines applicable
  6. Remedial direction — what the court should consider
  7. Full narrative opinion — a comprehensive, reasoned opinion written from
     the perspective of an unbiased constitutional court
"""

from typing import Dict, List, Tuple, Optional

# ---------------------------------------------------------------------------
# CONSTITUTIONAL KNOWLEDGE BASE
# ---------------------------------------------------------------------------

CONSTITUTIONAL_ARTICLES = {
    "Article 14": {
        "title": "Equality Before Law",
        "text": "The State shall not deny to any person equality before the law or the equal protection of the laws within the territory of India.",
        "type": "fundamental_right",
        "category": "equality",
        "key_principles": [
            "Equality before law",
            "Equal protection of laws",
            "Reasonable classification is permitted",
            "Anti-arbitrariness",
        ],
    },
    "Article 15": {
        "title": "Prohibition of Discrimination",
        "text": "The State shall not discriminate against any citizen on grounds only of religion, race, caste, sex, place of birth or any of them.",
        "type": "fundamental_right",
        "category": "equality",
        "key_principles": [
            "Non-discrimination",
            "Special provisions for women, children, SC/ST, and backward classes",
        ],
    },
    "Article 19": {
        "title": "Protection of Certain Rights Regarding Freedom of Speech, etc.",
        "text": "All citizens shall have the right to freedom of speech, assembly, association, movement, residence, and profession.",
        "type": "fundamental_right",
        "category": "liberty",
        "key_principles": [
            "Freedom of speech and expression",
            "Freedom to practice any profession",
            "Reasonable restrictions in public interest",
            "Trade, commerce, and business rights under Article 19(1)(g)",
        ],
    },
    "Article 21": {
        "title": "Protection of Life and Personal Liberty",
        "text": "No person shall be deprived of his life or personal liberty except according to procedure established by law.",
        "type": "fundamental_right",
        "category": "life_liberty",
        "key_principles": [
            "Right to life includes right to live with dignity",
            "Right to a speedy trial",
            "Right to health and medical care",
            "Right to fair procedure",
            "Right to safety and security",
            "Due process and procedural fairness",
        ],
    },
    "Articles 23 & 24": {
        "title": "Protection Against Exploitation",
        "text": "Traffic in human beings, begar, and other similar forms of forced labour are prohibited. Children under 14 shall not be employed in hazardous work.",
        "type": "fundamental_right",
        "category": "exploitation",
        "key_principles": [
            "Prohibition of human trafficking",
            "Prohibition of forced labour",
            "Prohibition of child labour in hazardous industries",
        ],
    },
    "Article 32": {
        "title": "Remedies for Enforcement of Fundamental Rights",
        "text": "The right to move the Supreme Court for the enforcement of fundamental rights is guaranteed.",
        "type": "fundamental_right",
        "category": "remedial",
        "key_principles": [
            "Right to constitutional remedies",
            "Writ jurisdiction of Supreme Court",
            "Enforcement of fundamental rights",
        ],
    },
    "Article 226": {
        "title": "Power of High Courts to Issue Certain Writs",
        "text": "Every High Court shall have power to issue directions, orders, or writs for enforcement of fundamental rights and for any other purpose.",
        "type": "constitutional_remedy",
        "category": "remedial",
        "key_principles": [
            "Writ jurisdiction of High Courts",
            "Judicial review of state action",
            "Enforcement of legal rights",
        ],
    },
    "Article 265": {
        "title": "Tax Not to be Imposed Save by Authority of Law",
        "text": "No tax shall be levied or collected except by authority of law.",
        "type": "constitutional_principle",
        "category": "taxation",
        "key_principles": [
            "No taxation without law",
            "Lawful authority for tax levy",
            "Procedural fairness in tax matters",
        ],
    },
    "Article 300A": {
        "title": "Right to Property",
        "text": "No person shall be deprived of his property save by authority of law.",
        "type": "constitutional_right",
        "category": "property",
        "key_principles": [
            "Protection against deprivation of property",
            "Lawful procedure for acquisition",
            "Right not to be dispossessed without legal authority",
        ],
    },
}

# Landmark constitutional doctrines and their descriptions
DOCTRINES = {
    "Doctrine of Proportionality": {
        "description": "Any state action restricting rights must be proportionate to the aim sought — it must be necessary, suitable, and not excessive.",
        "application": "Used to assess whether the priority assigned is proportionate to the gravity of the rights violation.",
    },
    "Doctrine of Reasonable Classification": {
        "description": "Article 14 permits classification if it is based on intelligible differentia and has rational nexus to the object.",
        "application": "Used to justify differential priority treatment among cases based on objective criteria.",
    },
    "Doctrine of Eclipse": {
        "description": "A law inconsistent with fundamental rights is not void ab initio but is overshadowed or 'eclipsed' by the fundamental right.",
        "application": "Applicable when evaluating whether statutory procedures meet constitutional standards.",
    },
    "Doctrine of Severability": {
        "description": "If a part of a law is unconstitutional, only that part is void if it can be separated from the rest.",
        "application": "Relevant for cases challenging the validity of specific statutory provisions.",
    },
    "Doctrine of Basic Structure": {
        "description": "The Parliament cannot amend the Constitution to destroy its basic features such as supremacy of the Constitution, rule of law, and judicial review.",
        "application": "Applicable to cases involving constitutional amendments or executive actions affecting foundational principles.",
    },
    "Doctrine of Parens Patriae": {
        "description": "The state has a duty to protect those who cannot protect themselves, such as minors, disabled persons, and the mentally ill.",
        "application": "Critical for cases involving vulnerable victims — the state must act as guardian.",
    },
    "Doctrine of Strict Liability": {
        "description": "A person who brings a hazardous thing onto land is strictly liable for any harm caused by its escape.",
        "application": "Applicable to industrial accident and environmental harm cases.",
    },
    "Principle of Natural Justice — Audi Alteram Partem": {
        "description": "No person shall be condemned without being heard. The right to be heard is a fundamental principle of justice.",
        "application": "Ensures procedural fairness in administrative and quasi-judicial proceedings.",
    },
    "Principle of Res Ipsa Loquitur": {
        "description": "'The thing speaks for itself.' In certain cases, negligence is presumed from the nature of the accident.",
        "application": "Applicable in personal injury and medical negligence cases where direct evidence is unavailable.",
    },
}

# Type of case → which Articles & Doctrines apply
CATEGORY_CONSTITUTIONAL_MAP = {
    "Criminal/Violent": {
        "primary_articles": ["Article 21"],
        "secondary_articles": ["Article 14", "Article 22"],
        "doctrines": [
            "Doctrine of Proportionality",
            "Doctrine of Parens Patriae",
        ],
        "state_duty": (
            "The State has a non-derogable duty under Article 21 to protect the "
            "right to life and personal liberty of every person. In violent crimes, "
            "the judiciary must ensure: (a) immediate protection of the victim and "
            "witnesses, (b) preservation of evidence, (c) expeditious trial to "
            "prevent secondary victimisation, and (d) enforcement of the victim's "
            "right to a speedy trial as an integral part of Article 21."
        ),
        "priority_rationale": (
            "Cases involving violent crime directly implicate the most fundamental "
            "right under the Constitution — the right to life. The state's failure "
            "to accord such cases the highest priority would constitute a violation "
            "of its affirmative obligation under Article 21 to protect life and "
            "ensure access to justice."
        ),
    },
    "Insolvency/Debt": {
        "primary_articles": ["Article 14", "Article 300A"],
        "secondary_articles": ["Article 19(1)(g)", "Article 21"],
        "doctrines": [
            "Doctrine of Proportionality",
            "Principle of Natural Justice — Audi Alteram Partem",
        ],
        "state_duty": (
            "The State must ensure that insolvency and debt proceedings are "
            "conducted fairly, without arbitrary deprivation of property (Article 300A). "
            "The judiciary must balance the creditor's right to recovery with the "
            "debtor's right to livelihood and dignity under Article 21, ensuring "
            "that the process under the IBC or other debt laws is not used as a "
            "tool of oppression."
        ),
        "priority_rationale": (
            "While important, economic and debt disputes primarily affect property "
            "rights and commercial interests rather than physical safety or personal "
            "liberty. Under Article 300A, property deprivation must be by lawful "
            "authority, but such cases do not typically require the same urgency as "
            "those involving threats to life or personal liberty. Medium or Low "
            "priority is appropriate unless violence, fraud, or extreme vulnerability "
            "is present."
        ),
    },
    "Excise/Tax": {
        "primary_articles": ["Article 265", "Article 14"],
        "secondary_articles": ["Article 19(1)(g)", "Article 300A"],
        "doctrines": [
            "Doctrine of Proportionality",
            "Principle of Natural Justice — Audi Alteram Partem",
        ],
        "state_duty": (
            "Under Article 265, the State cannot levy or collect tax without the "
            "authority of law. The judiciary must ensure that tax proceedings are "
            "conducted lawfully, non-arbitrarily, and in accordance with principles "
            "of natural justice. The state's duty extends to ensuring that tax "
            "demands and assessments follow procedural fairness and that the "
            "citizen's right to carry on business (Article 19(1)(g)) is not "
            "unreasonably restricted."
        ),
        "priority_rationale": (
            "Tax and excise matters involve statutory interpretation, procedural "
            "compliance, and economic regulation. They do not typically engage "
            "the right to life under Article 21. These cases should be processed "
            "according to their legal complexity and the amount involved, but do "
            "not warrant the highest priority unless they involve personal liberty "
            "or criminal sanctions."
        ),
    },
    "Customs/Import-Export": {
        "primary_articles": ["Article 14", "Article 19(1)(g)", "Article 300A"],
        "secondary_articles": ["Article 265", "Article 21"],
        "doctrines": [
            "Doctrine of Proportionality",
            "Principle of Natural Justice — Audi Alteram Partem",
        ],
        "state_duty": (
            "The State must ensure that customs and import-export regulations are "
            "enforced lawfully and proportionately. Seizures, confiscations, and "
            "penalties must have legal sanction and must not arbitrarily deprive "
            "a person of their right to trade (Article 19(1)(g)) or property "
            "(Article 300A). The Directorate of Revenue Intelligence and customs "
            "authorities must act within the bounds of the law."
        ),
        "priority_rationale": (
            "Customs and trade matters primarily affect commercial and property "
            "rights. While procedural fairness is critical, these cases do not "
            "typically involve threats to life or physical safety. Priority should "
            "be based on the quantum of economic impact, with exceptional urgency "
            "only when perishable goods, personal liberty, or livelihood of "
            "vulnerable persons is at stake."
        ),
    },
    "Company/Winding Up": {
        "primary_articles": ["Article 14", "Article 300A"],
        "secondary_articles": ["Article 19(1)(g)", "Article 21"],
        "doctrines": [
            "Doctrine of Proportionality",
            "Principle of Natural Justice — Audi Alteram Partem",
        ],
        "state_duty": (
            "The State must ensure that company disputes and winding-up proceedings "
            "are adjudicated fairly, with due regard to the rights of shareholders, "
            "creditors, and employees. The judiciary must balance commercial "
            "efficiency with procedural fairness, ensuring that oppression and "
            "mismanagement claims are heard without undue delay but without "
            "displacing more urgent life-and-liberty matters."
        ),
        "priority_rationale": (
            "Company law matters involve corporate governance, shareholder rights, "
            "and commercial disputes. While they can have significant economic "
            "consequences affecting livelihoods (Article 21), they do not involve "
            "direct threats to life or physical safety. They warrant moderated "
            "priority unless fraud, criminal conduct, or imminent liquidation "
            "threatening employee welfare is established."
        ),
    },
    "Constitutional/Writ": {
        "primary_articles": ["Article 32", "Article 226", "Article 14", "Article 21"],
        "secondary_articles": ["Article 227"],
        "doctrines": [
            "Doctrine of Basic Structure",
            "Doctrine of Proportionality",
            "Principle of Natural Justice — Audi Alteram Partem",
        ],
        "state_duty": (
            "The State, through the judiciary, is the ultimate guardian of "
            "fundamental rights. Under Articles 32 and 226, the High Courts and "
            "Supreme Court have a constitutional duty to protect citizens against "
            "arbitrary state action, violations of fundamental rights, and "
            "jurisdictional errors by subordinate tribunals. These cases often "
            "involve the very legitimacy of state action and require careful, "
            "principled consideration."
        ),
        "priority_rationale": (
            "Constitutional writ matters directly engage fundamental rights and "
            "the rule of law. Cases involving imminent threats to life or liberty "
            "(habeas corpus) warrant the highest priority. Cases challenging "
            "administrative or quasi-judicial orders should receive priority "
            "proportionate to the gravity of the rights violation alleged and the "
            "urgency of the relief sought."
        ),
    },
    "Property/Land": {
        "primary_articles": ["Article 300A", "Article 14"],
        "secondary_articles": ["Article 21"],
        "doctrines": [
            "Doctrine of Proportionality",
            "Principle of Natural Justice — Audi Alteram Partem",
        ],
        "state_duty": (
            "Under Article 300A, no person shall be deprived of property except "
            "by authority of law. The State must ensure that land acquisition, "
            "eviction, and possession proceedings follow due process. When land "
            "disputes involve the homeless, tenants, or agricultural labourers, "
            "the right to livelihood under Article 21 is also engaged, requiring "
            "heightened judicial protection."
        ),
        "priority_rationale": (
            "Property and land disputes primarily affect economic and possessory "
            "rights. However, when they involve the right to shelter or livelihood "
            "(Article 21), priority should be elevated. Routine property disputes "
            "without violence or immediate displacement risk warrant standard "
            "queue processing."
        ),
    },
    "General Civil": {
        "primary_articles": ["Article 14"],
        "secondary_articles": ["Article 21"],
        "doctrines": [
            "Doctrine of Proportionality",
            "Principle of Natural Justice — Audi Alteram Partem",
        ],
        "state_duty": (
            "The State must ensure that all civil disputes are adjudicated fairly, "
            "transparently, and within a reasonable time. Under Article 14, the "
            "state guarantees equal access to justice — all litigants are entitled "
            "to a fair hearing. The principle of speedy trial (derived from "
            "Article 21) requires that even ordinary civil matters be resolved "
            "without inordinate delay, though they yield priority to cases "
            "involving life and liberty."
        ),
        "priority_rationale": (
            "General civil matters — contracts, consumer disputes, family law, "
            "succession — typically engage Article 14's equality guarantee and "
            "the right to a fair hearing, but do not involve threats to life, "
            "physical safety, or fundamental constitutional rights. They should "
            "be processed fairly and without delay, but in regular queue order "
            "after more urgent constitutional matters."
        ),
    },
}


# ---------------------------------------------------------------------------
# VULNERABILITY & INFLUENCE ASSESSMENT
# ---------------------------------------------------------------------------

VULNERABILITY_FACTORS = {
    "High": {
        "groups": [
            "Minors / Children", "Pregnant Women", "Elderly / Senior Citizens",
            "Disabled Persons", "Scheduled Castes (SC)", "Scheduled Tribes (ST)",
            "Other Backward Classes (OBC)", "Adivasis / Tribals", "Dalits",
            "Economically Weaker Sections (EWS)", "Below Poverty Line (BPL)",
            "Daily Wage Workers", "Agricultural Labourers", "Domestic Workers",
            "Migrant Workers", "Unorganised Sector Workers", "Bonded Labourers",
            "Sex Workers", "Human Trafficking Survivors", "Refugees / Asylum Seekers",
            "Homeless Persons", "Orphans", "Single Mothers / Widows",
            "Persons in Custody", "Victims of Domestic Violence",
            "Victims of Sexual Assault", "Victims of Torture",
        ],
        "constitutional_protection": (
            "Articles 14, 15, 15(3), 15(4), 15(5), 16(4), 17, 23, 24, 39, 39A, "
            "41, 46, and the Directive Principles under Part IV mandate special "
            "protection for vulnerable groups. The Doctrine of Parens Patriae "
            "obligates the state to act as guardian for those who cannot protect "
            "themselves."
        ),
        "judicial_duty": (
            "The court must adopt a protective, sensitised approach. Vulnerable "
            "litigants are entitled to: (a) in-camera proceedings where appropriate, "
            "(b) assistance of counsel if unrepresented, (c) protection from "
            "intimidation, (d) expedited hearings to prevent secondary trauma, "
            "and (e) rehabilitation and compensation directions where applicable."
        ),
    },
    "Medium": {
        "groups": [
            "Women (in non-DV contexts)", "Socio-economically disadvantaged",
            "Small farmers", "Petty traders / shopkeepers", "Artisans",
            "Persons with temporary illness", "Students", "Unemployed youth",
        ],
        "constitutional_protection": (
            "Articles 14, 15, and 21 provide general protection. While not "
            "requiring the heightened protection afforded to the most vulnerable "
            "groups, the state must still ensure procedural fairness and non-"
            "discrimination."
        ),
        "judicial_duty": (
            "The court should remain mindful of any power or resource asymmetry "
            "between the parties and ensure that the weaker party is not "
            "disadvantaged solely by economic or social position."
        ),
    },
    "Low": {
        "groups": [
            "Corporate entities", "Well-established businesses",
            "Government bodies", "Public sector undertakings",
            "High net-worth individuals", "Professional litigants",
        ],
        "constitutional_protection": (
            "Article 14 guarantees equal protection of laws. These parties are "
            "expected to have access to legal representation and the ability to "
            "present their case effectively."
        ),
        "judicial_duty": (
            "Standard procedural fairness applies. No special accommodation "
            "beyond ordinary courtesies is required."
        ),
    },
}

INFLUENCE_LEVELS = {
    "High": {
        "description": "Government bodies, large corporations, regulatory authorities, or politically powerful individuals",
        "constitutional_concern": (
            "Article 14 requires equality before law. A significant power imbalance "
            "can undermine the fairness of proceedings if the influential party is "
            "able to use its resources to delay, intimidate, or out-litigate the "
            "weaker party. The court must actively ensure a level playing field."
        ),
        "countermeasure": (
            "Where there is a power imbalance, the court should: (a) ensure the "
            "weaker party has access to legal aid if needed, (b) prevent "
            "unnecessary adjournments sought by the influential party, (c) "
            "expedite proceedings to minimise the risk of witness tampering or "
            "intimidation, and (d) consider appointing a court monitor or "
            "receiver where appropriate."
        ),
    },
    "Low": {
        "description": "Individuals, small businesses, or parties of comparable standing",
        "constitutional_concern": (
            "Parties are of broadly comparable standing. Article 14 equality "
            "concerns are less acute, though the court must still ensure "
            "procedural fairness."
        ),
        "countermeasure": (
            "Standard procedural safeguards apply. The court should proceed with "
            "the matter in regular course, without special countermeasures."
        ),
    },
}


# ---------------------------------------------------------------------------
# SEVERITY & RIGHT-TO-LIFE ANALYSIS
# ---------------------------------------------------------------------------

SEVERITY_CONSTITUTIONAL_IMPACT = {
    "Fatal": {
        "article": "Article 21",
        "analysis": (
            "The right to life — the most fundamental of all constitutional rights — "
            "has been extinguished. When a death results from an unlawful act, the "
            "State has a constitutional obligation under Article 21 read with "
            "Articles 14 and 22 to: (a) investigate the death promptly and "
            "thoroughly, (b) prosecute those responsible, (c) provide compensation "
            "to the legal heirs, and (d) ensure that the family's right to access "
            "justice is not defeated by delay. Delay in fatal cases undermines "
            "the very foundation of Article 21."
        ),
        "urgency": "Highest — the right to life has been violated irreversibly.",
    },
    "Major": {
        "article": "Article 21",
        "analysis": (
            "The right to life under Article 21 includes the right to live with "
            "dignity and the right to health. Major injuries — especially those "
            "requiring hospitalisation, causing permanent disability, or posing "
            "life-threatening complications — constitute a serious interference "
            "with personal liberty and bodily integrity. The State must ensure "
            "prompt access to medical care, investigation of the incident, and "
            "accountability. Each day of delay risks permanent aggravation of "
            "the harm."
        ),
        "urgency": "High — bodily integrity and dignity are seriously compromised.",
    },
    "Minor": {
        "article": "Article 21",
        "analysis": (
            "Even minor injuries engage the right to bodily integrity under "
            "Article 21. While the urgency is less acute than fatal or major "
            "cases, the State must still ensure that the injured person receives "
            "medical attention and that the matter is investigated without "
            "unreasonable delay. Article 21's guarantee of a dignified existence "
            "extends to freedom from physical harm."
        ),
        "urgency": "Moderate — bodily integrity is affected but not critically.",
    },
    "No Injury": {
        "article": "Article 14 / Article 19 / Article 300A (as applicable)",
        "analysis": (
            "Where no physical injury is involved, the primary constitutional "
            "concern shifts from Article 21 (life and liberty) to other "
            "guarantees such as Article 14 (equality), Article 19 (freedom of "
            "profession/trade), and Article 300A (property). While these rights "
            "are fundamental and must be protected, the urgency is generally "
            "lower than cases involving threats to life or physical safety."
        ),
        "urgency": "Standard — rights are engaged but no immediate physical harm.",
    },
}


# ---------------------------------------------------------------------------
# MAIN ANALYSIS FUNCTIONS
# ---------------------------------------------------------------------------


def analyze_constitutional_rights(features: dict) -> dict:
    """
    Analyzes which constitutional rights are engaged by a case based on its
    extracted features.

    Returns a structured dictionary of engaged rights with article references
    and explanations.
    """
    category = features.get("case_category", "General Civil")
    severity = features.get("severity", "No Injury")
    vulnerability = features.get("vulnerability", "Low")
    influence = features.get("influence", "Low")

    category_info = CATEGORY_CONSTITUTIONAL_MAP.get(
        category, CATEGORY_CONSTITUTIONAL_MAP["General Civil"]
    )

    # Collect primary & secondary articles with full details
    engaged_rights = []

    for article_key in category_info["primary_articles"]:
        if article_key in CONSTITUTIONAL_ARTICLES:
            info = CONSTITUTIONAL_ARTICLES[article_key]
            engaged_rights.append({
                "article": article_key,
                "title": info["title"],
                "text": info["text"],
                "principles": info["key_principles"],
                "primary": True,
            })

    for article_key in category_info["secondary_articles"]:
        if article_key not in [
            a["article"] for a in engaged_rights
        ] and article_key in CONSTITUTIONAL_ARTICLES:
            info = CONSTITUTIONAL_ARTICLES[article_key]
            engaged_rights.append({
                "article": article_key,
                "title": info["title"],
                "text": info["text"],
                "principles": info["key_principles"],
                "primary": False,
            })

    # Add severity-specific Article 21 analysis
    severity_analysis = SEVERITY_CONSTITUTIONAL_IMPACT.get(
        severity, SEVERITY_CONSTITUTIONAL_IMPACT["No Injury"]
    )

    # Add vulnerability-specific analysis if relevant
    vulnerability_analysis = VULNERABILITY_FACTORS.get(
        vulnerability, VULNERABILITY_FACTORS["Low"]
    )

    # Add influence analysis
    influence_analysis = INFLUENCE_LEVELS.get(
        influence, INFLUENCE_LEVELS["Low"]
    )

    # Collect doctrines
    applicable_doctrines = []
    for doctrine_name in category_info["doctrines"]:
        if doctrine_name in DOCTRINES:
            applicable_doctrines.append({
                "name": doctrine_name,
                "description": DOCTRINES[doctrine_name]["description"],
                "application": DOCTRINES[doctrine_name]["application"],
            })

    return {
        "engaged_rights": engaged_rights,
        "primary_articles": category_info["primary_articles"],
        "secondary_articles": category_info["secondary_articles"],
        "severity_analysis": severity_analysis,
        "vulnerability_analysis": vulnerability_analysis,
        "influence_analysis": influence_analysis,
        "applicable_doctrines": applicable_doctrines,
        "state_duty": category_info["state_duty"],
        "priority_rationale": category_info["priority_rationale"],
    }


def generate_balancing_analysis(features: dict, priority: str) -> str:
    """
    Generates a nuanced balancing analysis of competing constitutional
    interests, explaining why the assigned priority is appropriate from
    an unbiased state perspective.
    """
    severity = features.get("severity", "No Injury")
    vulnerability = features.get("vulnerability", "Low")
    influence = features.get("influence", "Low")
    category = features.get("case_category", "General Civil")

    parts = []

    # Severity vs. competing interests
    if severity in ("Fatal", "Major"):
        parts.append(
            "**Primary Interest — Right to Life & Bodily Integrity (Article 21):** "
            f"The severity level '{severity}' indicates that the right to life or "
            "physical integrity has been seriously compromised. Under Article 21, "
            "this is the weightiest constitutional interest and must take precedence "
            "over all other considerations. The state's duty to protect life is "
            "non-derogable and non-delegable."
        )
        if priority != "High":
            parts.append(
                "**Assessment:** Despite the engagement of Article 21 at a high "
                f"severity level, the overall priority assigned is '{priority}'. "
                "This may be because other factors (low vulnerability, low influence) "
                "or the specific legal category moderate the urgency. However, given "
                "the severity level, the court should verify whether the priority "
                "adequately reflects the gravity of the physical harm involved."
            )
        else:
            parts.append(
                "**Assessment:** The High priority correctly reflects the primacy "
                "of Article 21 rights. This is constitutionally appropriate and "
                "proportionate to the gravity of the harm."
            )
    else:
        parts.append(
            "**Primary Interest — Other Constitutional Rights:** "
            f"With severity '{severity}', the primary constitutional concern shifts "
            "from the right to life (Article 21) to other guarantees such as "
            "equality (Article 14), freedom of trade (Article 19(1)(g)), or "
            "property rights (Article 300A) as applicable. While these rights are "
            "fundamental, they permit greater flexibility in prioritisation."
        )

    # Vulnerability factor
    if vulnerability == "High":
        parts.append(
            "**Vulnerability Analysis — Special State Obligation:** "
            "A vulnerable party is involved. The Doctrine of Parens Patriae and "
            "Articles 15(3), 15(4), 39, and 39A impose a heightened duty on the "
            f"state to protect the vulnerable. This factor strongly supports {'High' if priority == 'High' else 'elevated'} "
            "priority to prevent further harm or injustice."
        )
    elif vulnerability == "Medium":
        parts.append(
            "**Vulnerability Analysis:** Some vulnerability factors are present. "
            "While the state must remain mindful of power imbalances, the level of "
            "special protection required is moderate, consistent with a Medium or "
            "standard priority approach."
        )

    # Influence / Power imbalance
    if influence == "High":
        parts.append(
            "**Power Imbalance — Article 14 Equality Concern:** "
            "There is a significant power imbalance between the parties. Article 14 "
            "requires the state to ensure equality before the law. Where one party "
            "is a government body, large corporation, or influential entity, the "
            "court must guard against the risk that institutional power could "
            "subvert the fairness of proceedings. "
            + (
                "The assigned priority adequately accounts for this concern."
                if priority in ("High", "Medium")
                else "The assigned priority may not fully reflect the equality concern raised by this power imbalance."
            )
        )

    # Category-specific balancing
    if category == "Criminal/Violent":
        parts.append(
            "**Category-Specific Analysis — Criminal/Violent:** "
            "This category involves the most serious engagement of constitutional "
            "rights — the right to life, liberty, and safety of persons. The "
            + (
                "High priority assigned is constitutionally mandated."
                if priority == "High"
                else f"'{priority}' priority may understate the constitutional gravity of violent criminal cases."
            )
        )
    elif category in ("Excise/Tax", "Customs/Import-Export", "Company/Winding Up"):
        parts.append(
            f"**Category-Specific Analysis — {category}:** "
            "This is primarily a regulatory/commercial matter. While Article 14 "
            "equality and Article 300A property rights are engaged, the case does "
            "not involve the same constitutional urgency as life-and-liberty cases. "
            "The assigned priority appropriately reflects this proportionally."
        )
    elif category == "Property/Land":
        parts.append(
            "**Category-Specific Analysis — Property/Land:** "
            "Property rights under Article 300A are constitutional but not absolute. "
            "The priority should consider whether the dispute involves livelihood "
            "(Article 21) or mere property entitlement."
        )
    elif category == "Constitutional/Writ":
        parts.append(
            "**Category-Specific Analysis — Constitutional/Writ:** "
            "Writ matters directly engage the court's constitutional jurisdiction "
            "under Articles 32 and 226. The priority should reflect the nature of "
            "the right sought to be enforced — habeas corpus (life/liberty) cases "
            "require the highest priority."
        )

    return "\n\n".join(parts)


def generate_state_perspective_opinion(features: dict, priority: str) -> str:
    """
    Generates a comprehensive, narrative 'State's Perspective' opinion that
    reads like a constitutional court's internal memorandum, providing a
    holistic, unbiased assessment of the case priority.
    """
    category = features.get("case_category", "General Civil")
    severity = features.get("severity", "No Injury")
    vulnerability = features.get("vulnerability", "Low")
    influence = features.get("influence", "Low")
    parties = features.get("main_parties", "the parties")
    summary = features.get("plain_summary", "")

    analysis = analyze_constitutional_rights(features)

    # Build opinion
    opinion_parts = []

    # 1. Overview
    opinion_parts.append(
        "## STATE'S CONSTITUTIONAL ASSESSMENT\n"
        "(Neutral, Unbiased Analysis from the Perspective of the Judiciary)\n\n"
        "This assessment is prepared from the standpoint of an impartial state "
        "adjudicating disputes under the Constitution of India. The analysis "
        "identifies the constitutional rights engaged, the state's corresponding "
        "duties, and the appropriate priority that a fair and unbiased judiciary "
        "should accord to this matter."
    )

    # 2. Case summary
    opinion_parts.append(
        "### I. SUBJECT MATTER\n\n"
        f"**Parties:** {parties}\n\n"
        f"**Legal Category:** {category}\n\n"
        f"**Brief Description:** {summary}\n\n"
        f"**Extracted Parameters:** Severity = {severity}, "
        f"Vulnerability = {vulnerability}, Influence/ Power Imbalance = {influence}"
    )

    # 3. Constitutional rights engaged
    rights_text = "### II. CONSTITUTIONAL RIGHTS ENGAGED\n\n"
    if analysis["engaged_rights"]:
        rights_text += "The following constitutional provisions are relevant to this matter:\n\n"
        for right in analysis["engaged_rights"]:
            primary_tag = "**[PRIMARY]** " if right["primary"] else "**[SECONDARY]** "
            rights_text += f"- **{primary_tag}{right['article']} — {right['title']}**: {right['text']}\n"
            if right["principles"]:
                rights_text += "  - Key principles: " + ", ".join(right["principles"]) + "\n"
        rights_text += "\n"
    opinion_parts.append(rights_text)

    # 4. Severity & urgency assessment
    sev = analysis["severity_analysis"]
    opinion_parts.append(
        "### III. SEVERITY & URGENCY ASSESSMENT\n\n"
        f"**Primary Article:** {sev['article']}\n\n"
        f"**Analysis:** {sev['analysis']}\n\n"
        f"**Urgency Classification:** {sev['urgency']}"
    )

    # 5. State's duty
    opinion_parts.append(
        "### IV. STATE'S DUTY UNDER THE CONSTITUTION\n\n"
        f"{analysis['state_duty']}"
    )

    # 6. Vulnerability & Influence
    opinion_parts.append(
        "### V. VULNERABILITY & POWER BALANCE ASSESSMENT\n\n"
        f"**Vulnerability Level:** {vulnerability}\n"
        f"This indicates: {analysis['vulnerability_analysis']['groups']}\n\n"
        f"**Constitutional Protection:** {analysis['vulnerability_analysis']['constitutional_protection']}\n\n"
        f"**Judicial Duty:** {analysis['vulnerability_analysis']['judicial_duty']}\n\n"
        f"**Influence Level:** {influence}\n"
        f"{analysis['influence_analysis']['description']}\n\n"
        f"**Constitutional Concern:** {analysis['influence_analysis']['constitutional_concern']}\n\n"
        f"**Recommended Countermeasure:** {analysis['influence_analysis']['countermeasure']}"
    )

    # 7. Applicable Doctrines
    if analysis["applicable_doctrines"]:
        doctrines_text = "### VI. APPLICABLE CONSTITUTIONAL DOCTRINES & PRINCIPLES\n\n"
        for doc in analysis["applicable_doctrines"]:
            doctrines_text += f"- **{doc['name']}**: {doc['description']}\n"
            doctrines_text += f"  - Application to this case: {doc['application']}\n\n"
        opinion_parts.append(doctrines_text)

    # 8. Priority rationale
    opinion_parts.append(
        "### VII. PRIORITY ASSESSMENT & JUSTIFICATION\n\n"
        f"**Assigned Priority:** {priority}\n\n"
        f"**Category Rationale:** {analysis['priority_rationale']}\n\n"
    )

    # 9. Final recommendation
    opinion_parts.append(
        "### VIII. FINAL OBSERVATION\n\n"
        f"From the perspective of an unbiased state adjudicating under the "
        f"Constitution of India, this matter has been assigned **{priority} Priority**. "
    )

    if priority == "High":
        opinion_parts.append(
            "This is constitutionally appropriate and reflects the gravity of "
            "the rights engaged. The court is directed to list this matter "
            "expeditiously, ensuring that no procedural delay undermines the "
            "constitutional rights at stake. The State must accord this case "
            "the attention and resources commensurate with its priority level."
        )
    elif priority == "Medium":
        opinion_parts.append(
            "The case presents meaningful legal or constitutional issues that "
            "warrant attentive but not extraordinary expedition. The court "
            "should monitor the progress of this matter to ensure it does not "
            "languish, while recognising that cases involving imminent threats "
            "to life or liberty must take precedence."
        )
    else:
        opinion_parts.append(
            "No urgent constitutional concern is identified. The matter should "
            "proceed in regular course. The court remains obligated under "
            "Article 14 to ensure that this matter is adjudicated fairly and "
            "without inordinate delay, even if it does not warrant special "
            "expedition."
        )

    return "\n\n".join(opinion_parts)


def generate_priority_rules_detailed(features: dict, priority: str) -> str:
    """
    Generates a detailed, structured explanation of the specific rules and
    factors that led to the assigned priority, from a constitutional perspective.
    """
    category = features.get("case_category", "General Civil")
    crime_type = features.get("crime_type", "Non-Violent")
    severity = features.get("severity", "No Injury")
    vulnerability = features.get("vulnerability", "Low")
    influence = features.get("influence", "Low")

    rules = []

    # Rule 1: Severity-based
    if severity == "Fatal":
        rules.append("**RULE 1 — Fatal Injury → High Priority (Article 21):** "
                     "The right to life has been violated. The Constitution mandates "
                     "the highest priority for any matter involving loss of life.")
    elif severity == "Major":
        rules.append("**RULE 1 — Major Injury → High Priority (Article 21):** "
                     "Bodily integrity and the right to health under Article 21 are "
                     "seriously compromised. Strong urgency is constitutionally required.")
    elif severity == "Minor":
        rules.append("**RULE 1 — Minor Injury → Medium Priority (Article 21):** "
                     "Physical integrity is affected. While less urgent than fatal/major "
                     "cases, Article 21 still requires timely adjudication.")
    else:
        rules.append("**RULE 1 — No Physical Injury → Standard Priority:** "
                     "Article 21 (right to life) is not directly engaged through physical "
                     "harm. Priority is determined by other factors.")

    # Rule 2: Vulnerability-based
    if vulnerability == "High":
        rules.append("**RULE 2 — High Vulnerability → Elevated Priority (Doctrine of Parens Patriae):** "
                     "The state has a special duty to protect vulnerable persons. "
                     "Articles 15, 39, and 39A require the court to ensure that "
                     "vulnerable litigants are not disadvantaged by delay.")
    elif vulnerability == "Medium":
        rules.append("**RULE 2 — Medium Vulnerability → Moderate Priority Consideration:** "
                     "Some vulnerability factors exist. The court should be mindful "
                     "but extraordinary expedition is not required.")

    # Rule 3: Influence-based
    if influence == "High":
        rules.append("**RULE 3 — Power Imbalance → Ensure Level Playing Field (Article 14):** "
                     "A significant power imbalance between parties triggers Article 14's "
                     "equality guarantee. The court must take active measures to prevent "
                     "the influential party from exploiting its position.")

    # Rule 4: Category-based
    if category == "Criminal/Violent":
        rules.append("**RULE 4 — Violent Crime → Article 21 Primacy:** "
                     "Criminal matters involving violence directly implicate the right "
                     "to life and personal liberty. The state's duty under Article 21 "
                     "requires urgent judicial attention.")
    elif category in ("Insolvency/Debt", "Excise/Tax", "Customs/Import-Export",
                      "Company/Winding Up"):
        rules.append("**RULE 4 — Regulatory/Commercial Matter → Property & Economic Rights:** "
                     "Articles 14, 19(1)(g), and 300A govern this matter. Priority is "
                     "based on economic impact and procedural fairness concerns, not "
                     "life-and-liberty urgency.")
    elif category == "Property/Land":
        rules.append("**RULE 4 — Property/Land Dispute → Article 300A & Livelihood:** "
                     "Article 300A protects property rights. If livelihood (Article 21) "
                     "is affected, priority should be elevated accordingly.")
    elif category == "Constitutional/Writ":
        rules.append("**RULE 4 — Constitutional/Writ Matter → Article 32/226 Jurisdiction:** "
                     "The court's constitutional writ jurisdiction is engaged. Priority "
                     "depends on the nature of the right sought to be enforced.")

    # Final summary
    rules.append(
        f"\n**FINAL DETERMINATION:** Based on the above constitutional rules and "
        f"the extracted case features, the priority assigned is **{priority}**. "
        "This determination represents the impartial state's assessment of the "
        "urgency required to ensure that constitutional rights are protected "
        "and justice is delivered without undue delay."
    )

    return "\n\n".join(rules)


# ---------------------------------------------------------------------------
# COMPREHENSIVE ANALYSIS — SINGLE ENTRY POINT
# ---------------------------------------------------------------------------


def get_comprehensive_constitutional_analysis(features: dict, priority: str) -> dict:
    """
    Main entry point. Returns a complete constitutional analysis dictionary
    that can be consumed by the API, dashboard, and Excel report.
    """
    rights_analysis = analyze_constitutional_rights(features)

    return {
        "constitutional_rights_engaged": [
            {
                "article": r["article"],
                "title": r["title"],
                "primary": r["primary"],
            }
            for r in rights_analysis["engaged_rights"]
        ],
        "constitutional_rights_detail": rights_analysis["engaged_rights"],
        "state_duty_analysis": rights_analysis["state_duty"],
        "priority_rationale": rights_analysis["priority_rationale"],
        "severity_constitutional_analysis": rights_analysis["severity_analysis"],
        "vulnerability_constitutional_analysis": rights_analysis["vulnerability_analysis"],
        "influence_constitutional_analysis": rights_analysis["influence_analysis"],
        "applicable_doctrines": rights_analysis["applicable_doctrines"],
        "balancing_analysis": generate_balancing_analysis(features, priority),
        "state_perspective_opinion": generate_state_perspective_opinion(
            features, priority
        ),
        "priority_rules_detailed": generate_priority_rules_detailed(features, priority),
    }
