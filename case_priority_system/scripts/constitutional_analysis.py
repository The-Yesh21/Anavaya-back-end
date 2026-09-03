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
    "Article 16": {
        "title": "Equality of Opportunity in Matters of Public Employment",
        "text": "There shall be equality of opportunity for all citizens in matters relating to employment or appointment to any office under the State. No citizen shall be discriminated against on grounds only of religion, race, caste, sex, descent, place of birth, or residence.",
        "type": "fundamental_right",
        "category": "equality",
        "key_principles": [
            "Equal opportunity in public employment",
            "No discrimination in State service",
            "Reservations for backward classes under clause (4)",
        ],
    },
    "Article 17": {
        "title": "Abolition of Untouchability",
        "text": "Untouchability is abolished and its practice in any form is forbidden. The enforcement of any disability arising out of untouchability shall be an offence punishable in accordance with law.",
        "type": "fundamental_right",
        "category": "equality",
        "key_principles": [
            "Abolition of untouchability",
            "Enforcement of disabilities is an offence",
            "Protection of SC/ST communities",
        ],
    },
    "Article 18": {
        "title": "Abolition of Titles",
        "text": "No title, not being a military or academic distinction, shall be conferred by the State. No citizen of India shall accept any title from any foreign State.",
        "type": "fundamental_right",
        "category": "equality",
        "key_principles": [
            "No titles except military/academic",
            "No acceptance of foreign titles by citizens",
        ],
    },
    "Article 19(1)(g)": {
        "title": "Right to Practise Any Profession or Carry On Occupation, Trade or Business",
        "text": "All citizens shall have the right to practise any profession, or to carry on any occupation, trade or business, subject to reasonable restrictions in the interests of the general public.",
        "type": "fundamental_right",
        "category": "liberty",
        "key_principles": [
            "Right to trade, occupation and profession",
            "Reasonable restrictions in public interest",
            "Licensing and regulatory controls",
        ],
    },
    "Article 20": {
        "title": "Protection in Respect of Conviction for Offences",
        "text": "No person shall be convicted of any offence except for violation of a law in force at the time of the act. No person shall be prosecuted and punished for the same offence more than once. No person accused of any offence shall be compelled to be a witness against himself.",
        "type": "fundamental_right",
        "category": "criminal",
        "key_principles": [
            "No ex post facto criminal law",
            "No double jeopardy",
            "Protection against self-incrimination",
        ],
    },
    "Article 21A": {
        "title": "Right to Education",
        "text": "The State shall provide free and compulsory education to all children of the age of six to fourteen years in such manner as the State may, by law, determine.",
        "type": "fundamental_right",
        "category": "education",
        "key_principles": [
            "Free and compulsory education for ages 6-14",
            "Right to elementary education",
        ],
    },
    "Article 22": {
        "title": "Protection Against Arrest and Detention",
        "text": "No person who is arrested shall be detained in custody without being informed of the grounds of arrest, nor shall he be denied the right to consult and be defended by a legal practitioner of his choice. Every person detained under preventive detention must be informed of the grounds of detention.",
        "type": "fundamental_right",
        "category": "criminal",
        "key_principles": [
            "Right to be informed of grounds of arrest",
            "Right to consult a lawyer",
            "Safeguards against arbitrary detention",
            "Preventive detention procedural safeguards",
        ],
    },
    "Article 23": {
        "title": "Prohibition of Traffic in Human Beings and Forced Labour",
        "text": "Traffic in human beings and begar and other similar forms of forced labour are prohibited. Any contravention of this provision shall be an offence punishable in accordance with law.",
        "type": "fundamental_right",
        "category": "exploitation",
        "key_principles": [
            "Prohibition of human trafficking",
            "Prohibition of forced labour and begar",
        ],
    },
    "Article 24": {
        "title": "Prohibition of Employment of Children in Factories",
        "text": "No child below the age of fourteen years shall be employed to work in any factory or mine or engaged in any other hazardous employment.",
        "type": "fundamental_right",
        "category": "exploitation",
        "key_principles": [
            "No child labour below 14 in hazardous work",
            "Protection of children from exploitation",
        ],
    },
    "Article 25": {
        "title": "Freedom of Conscience and Free Profession, Practice and Propagation of Religion",
        "text": "Subject to public order, morality and health, all persons are equally entitled to freedom of conscience and the right freely to profess, practise and propagate religion.",
        "type": "fundamental_right",
        "category": "religion",
        "key_principles": [
            "Freedom of conscience",
            "Freedom to profess, practise, propagate religion",
            "Reasonable restrictions: public order, morality, health",
        ],
    },
    "Article 26": {
        "title": "Freedom to Manage Religious Affairs",
        "text": "Subject to public order, morality and health, every religious denomination shall have the right to manage its own affairs in matters of religion, and to own and acquire movable and immovable property.",
        "type": "fundamental_right",
        "category": "religion",
        "key_principles": [
            "Religious denominations manage own affairs",
            "Right to own religious property",
        ],
    },
    "Article 29": {
        "title": "Protection of Interests of Minorities",
        "text": "Any section of the citizens residing in India having a distinct language, script or culture of its own shall have the right to conserve the same. No citizen shall be denied admission into any educational institution maintained by the State on grounds only of religion, race, caste, language or any of them.",
        "type": "fundamental_right",
        "category": "minorities",
        "key_principles": [
            "Right of minorities to conserve language, script, culture",
            "No denial of admission on discriminatory grounds",
        ],
    },
    "Article 30": {
        "title": "Right of Minorities to Establish Educational Institutions",
        "text": "All minorities, whether based on religion or language, shall have the right to establish and administer educational institutions of their choice.",
        "type": "fundamental_right",
        "category": "minorities",
        "key_principles": [
            "Minorities may establish and administer educational institutions",
            "Protection from discrimination in aid",
        ],
    },
    "Article 38": {
        "title": "State to Secure a Social Order for the Promotion of Welfare",
        "text": "The State shall strive to promote the welfare of the people by securing and protecting a social order in which justice, social, economic and political, shall inform all the institutions of the national life.",
        "type": "directive_principle",
        "category": "social_welfare",
        "key_principles": [
            "Social, economic and political justice",
            "Minimise inequalities of income and status",
        ],
    },
    "Article 39": {
        "title": "Certain Principles of Policy to be Followed by the State",
        "text": "The State shall direct its policy towards securing equal rights to an adequate means of livelihood, and that the ownership and control of material resources are so distributed as best to subserve the common good.",
        "type": "directive_principle",
        "category": "social_welfare",
        "key_principles": [
            "Adequate means of livelihood",
            "Distribution of material resources for common good",
            "Prevention of concentration of wealth",
            "Protection of workers, children and women",
        ],
    },
    "Article 39A": {
        "title": "Equal Justice and Free Legal Aid",
        "text": "The State shall secure that the operation of the legal system promotes justice on a basis of equal opportunity, and shall provide free legal aid to ensure that no citizen is denied opportunities to secure justice due to economic or other disability.",
        "type": "directive_principle",
        "category": "access_to_justice",
        "key_principles": [
            "Free legal aid",
            "Equal opportunity in the legal system",
            "Justice for the economically disadvantaged",
        ],
    },
    "Article 41": {
        "title": "Right to Work, to Education and to Public Assistance",
        "text": "The State shall, within the limits of its economic capacity and development, make effective provision for securing the right to work, to education and to public assistance in cases of unemployment, old age, sickness and disablement.",
        "type": "directive_principle",
        "category": "social_welfare",
        "key_principles": [
            "Right to work and education",
            "Public assistance for unemployment, old age, sickness",
        ],
    },
    "Article 42": {
        "title": "Just and Humane Conditions of Work and Maternity Relief",
        "text": "The State shall make provision for securing just and humane conditions of work and for maternity relief.",
        "type": "directive_principle",
        "category": "labour",
        "key_principles": [
            "Just and humane working conditions",
            "Maternity relief",
        ],
    },
    "Article 43": {
        "title": "Living Wage for Workers",
        "text": "The State shall endeavour to secure to all workers a living wage, conditions of work ensuring a decent standard of life, and full enjoyment of leisure and social and cultural opportunities.",
        "type": "directive_principle",
        "category": "labour",
        "key_principles": [
            "Living wage for workers",
            "Decent standard of life",
        ],
    },
    "Article 44": {
        "title": "Uniform Civil Code",
        "text": "The State shall endeavour to secure for the citizens a uniform civil code throughout the territory of India.",
        "type": "directive_principle",
        "category": "civil",
        "key_principles": [
            "Uniform civil code for citizens",
        ],
    },
    "Article 45": {
        "title": "Provision for Early Childhood Care and Education",
        "text": "The State shall endeavour to provide early childhood care and education for all children until they complete the age of six years.",
        "type": "directive_principle",
        "category": "education",
        "key_principles": [
            "Early childhood care and education",
        ],
    },
    "Article 46": {
        "title": "Promotion of Educational and Economic Interests of Weaker Sections",
        "text": "The State shall promote with special care the educational and economic interests of the weaker sections of the people, and in particular of the Scheduled Castes and Scheduled Tribes, and shall protect them from social injustice and all forms of exploitation.",
        "type": "directive_principle",
        "category": "social_welfare",
        "key_principles": [
            "Special care for weaker sections",
            "Protection of SC/ST from social injustice and exploitation",
        ],
    },
    "Article 47": {
        "title": "Duty of the State to Raise the Level of Nutrition and Public Health",
        "text": "The State shall regard the raising of the level of nutrition and the standard of living of its people and the improvement of public health as among its primary duties.",
        "type": "directive_principle",
        "category": "health",
        "key_principles": [
            "Improvement of public health",
            "Raising nutrition and standard of living",
        ],
    },
    "Article 48A": {
        "title": "Protection and Improvement of Environment",
        "text": "The State shall endeavour to protect and improve the environment and to safeguard the forests and wild life of the country.",
        "type": "directive_principle",
        "category": "environment",
        "key_principles": [
            "Protection of the environment",
            "Safeguarding forests and wildlife",
        ],
    },
    "Article 49": {
        "title": "Protection of Monuments and Places of Artistic or Historic Interest",
        "text": "The State shall protect every monument or place or object of artistic or historic interest, declared to be of national importance, from spoliation, disfigurement, destruction, removal, disposal or export.",
        "type": "directive_principle",
        "category": "heritage",
        "key_principles": [
            "Protection of national monuments",
            "Prevention of export of national treasures",
        ],
    },
    "Article 50": {
        "title": "Separation of Judiciary from Executive",
        "text": "The State shall take steps to separate the judiciary from the executive in the public services of the State.",
        "type": "directive_principle",
        "category": "governance",
        "key_principles": [
            "Separation of judiciary from executive",
            "Independence of the judiciary",
        ],
    },
    "Article 51A": {
        "title": "Fundamental Duties",
        "text": "It shall be the duty of every citizen of India to abide by the Constitution and respect its ideals and institutions, to uphold and protect the sovereignty, unity and integrity of India, and to promote harmony and the spirit of common brotherhood.",
        "type": "fundamental_duty",
        "category": "duties",
        "key_principles": [
            "Respect for the Constitution and its institutions",
            "Promotion of harmony and common brotherhood",
            "Protection of public property",
        ],
    },
    "Article 227": {
        "title": "Power of Superintendence of High Courts",
        "text": "Every High Court shall have superintendence over all courts and tribunals within its jurisdiction, and may call for returns, make rules, and settle forms to secure the proper administration of justice.",
        "type": "constitutional_remedy",
        "category": "remedial",
        "key_principles": [
            "Superintendence over subordinate courts and tribunals",
            "Administration of justice",
        ],
    },
    "Article 243G": {
        "title": "Powers and Responsibilities of Panchayats",
        "text": "The State legislature may endow Panchayats with such powers and authority as may be necessary to enable them to function as institutions of self-government, including in matters of land, water, agriculture and rural development.",
        "type": "local_governance",
        "category": "governance",
        "key_principles": [
            "Local self-government",
            "Panchayat powers over land, water, agriculture",
        ],
    },
    "Article 301": {
        "title": "Freedom of Trade, Commerce and Intercourse",
        "text": "Subject to the other provisions of this Part, trade, commerce and intercourse throughout the territory of India shall be free.",
        "type": "constitutional_principle",
        "category": "trade",
        "key_principles": [
            "Free trade and commerce across India",
            "No barriers to inter-state trade",
        ],
    },
    "Article 323A": {
        "title": "Administrative Tribunals",
        "text": "Parliament may by law provide for the adjudication or trial by administrative tribunals of disputes relating to recruitment and conditions of service of persons appointed to public services and posts under the State.",
        "type": "constitutional_principle",
        "category": "tribunals",
        "key_principles": [
            "Administrative tribunals for service disputes",
            "Expeditious adjudication",
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
    "Doctrine of Legitimate Expectation": {
        "description": "A person who has a legitimate expectation based on a promise, practice or policy of the State is entitled to procedural fairness before that expectation is defeated.",
        "application": "Applicable where administrative decisions frustrate settled practices, licences, or policies.",
    },
    "Doctrine of Pith and Substance": {
        "description": "Legislation is judged by its true nature and purpose rather than its incidental encroachment on another sphere.",
        "application": "Used in federal disputes over legislative competence between Union and State laws.",
    },
    "Doctrine of Colourable Legislation": {
        "description": "If the legislature lacks the competence to enact a law directly, it cannot do indirectly what it cannot do directly — such camouflage is struck down.",
        "application": "Applicable where a statute purports to do one thing but in substance does another outside legislative competence.",
    },
    "Doctrine of Harmonious Construction": {
        "description": "Where two constitutional provisions conflict, they should be interpreted so that both are given effect rather than one nullifying the other.",
        "application": "Used when Articles or statutory provisions appear to overlap or clash.",
    },
    "Doctrine of Prospective Overruling": {
        "description": "A court may declare a new legal principle to operate only prospectively so that past transactions are not disturbed.",
        "application": "Relevant where a change in law would unfairly unsettle completed actions.",
    },
    "Principle of Audi Alteram Partem": {
        "description": "The heart of natural justice: no one shall be judged without a fair hearing. Both sides must be heard before a decision affecting rights is made.",
        "application": "Applies to all adjudicatory, quasi-judicial and administrative decisions affecting rights.",
    },
    "Rule of Law": {
        "description": "Every person, including the State, is subject to the law; no one is above it. Government action must have legal authority.",
        "application": "Foundational principle engaged in every challenge to executive or legislative action.",
    },
    "Doctrine of Strict Responsibility / Absolute Liability": {
        "description": "An enterprise engaged in hazardous or inherently dangerous activity is absolutely liable to compensate victims, regardless of fault.",
        "application": "Applied in industrial accidents, environmental harm and public nuisance cases.",
    },
    "Doctrine of Reasonable Classification": {
        "description": "Article 14 permits classification of persons if it is based on intelligible differentia having a rational nexus with the object sought to be achieved.",
        "application": "Used to test whether differential treatment of litigants or groups is constitutional.",
    },
}

# Type of case → which Articles & Doctrines apply
CATEGORY_CONSTITUTIONAL_MAP = {
    "Criminal/Violent": {
        "primary_articles": ["Article 21", "Article 22", "Article 20"],
        "secondary_articles": [
            "Article 14", "Article 17", "Article 23", "Article 24", "Article 39A",
        ],
        "doctrines": [
            "Doctrine of Proportionality",
            "Doctrine of Parens Patriae",
            "Rule of Law",
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
        "primary_articles": ["Article 14", "Article 300A", "Article 19(1)(g)"],
        "secondary_articles": ["Article 21", "Article 39", "Article 39A"],
        "doctrines": [
            "Doctrine of Proportionality",
            "Principle of Natural Justice — Audi Alteram Partem",
            "Doctrine of Legitimate Expectation",
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
        "primary_articles": ["Article 265", "Article 14", "Article 19(1)(g)"],
        "secondary_articles": ["Article 300A", "Article 301", "Article 21"],
        "doctrines": [
            "Doctrine of Proportionality",
            "Principle of Natural Justice — Audi Alteram Partem",
            "Rule of Law",
            "Doctrine of Reasonable Classification",
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
        "secondary_articles": ["Article 265", "Article 301", "Article 21"],
        "doctrines": [
            "Doctrine of Proportionality",
            "Principle of Natural Justice — Audi Alteram Partem",
            "Doctrine of Legitimate Expectation",
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
        "primary_articles": ["Article 14", "Article 300A", "Article 19(1)(g)"],
        "secondary_articles": ["Article 21", "Article 39", "Article 39A"],
        "doctrines": [
            "Doctrine of Proportionality",
            "Principle of Natural Justice — Audi Alteram Partem",
            "Rule of Law",
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
        "secondary_articles": ["Article 227", "Article 22", "Article 20", "Article 51A"],
        "doctrines": [
            "Doctrine of Basic Structure",
            "Doctrine of Proportionality",
            "Principle of Natural Justice — Audi Alteram Partem",
            "Rule of Law",
            "Doctrine of Colourable Legislation",
            "Doctrine of Harmonious Construction",
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
        "primary_articles": ["Article 300A", "Article 14", "Article 21"],
        "secondary_articles": ["Article 39", "Article 46", "Article 243G"],
        "doctrines": [
            "Doctrine of Proportionality",
            "Principle of Natural Justice — Audi Alteram Partem",
            "Doctrine of Legitimate Expectation",
            "Rule of Law",
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
        "primary_articles": ["Article 14", "Article 21"],
        "secondary_articles": ["Article 39A", "Article 44", "Article 51A"],
        "doctrines": [
            "Doctrine of Proportionality",
            "Principle of Natural Justice — Audi Alteram Partem",
            "Rule of Law",
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

    return "\n\n".join(rules)# ---------------------------------------------------------------------------
# PLAIN-LANGUAGE "WHY THIS APPLIES" EXPLANATIONS
# ---------------------------------------------------------------------------

def _generate_why_applies(article: str, features: dict, priority: str) -> str:
    """Generate a plain-language explanation of why a specific constitutional
    article applies to THIS case, based on the extracted features.

    This is the key function that turns legal jargon into something a
    non-lawyer can understand: "Article X applies because the case involves Y,"
    "which means Z for the people involved."
    """
    severity = features.get("severity", "No Injury")
    vulnerability = features.get("vulnerability", "Low")
    influence = features.get("influence", "Low")
    category = features.get("case_category", "General Civil")
    crime_type = features.get("crime_type", "Non-Violent")
    parties = features.get("main_parties", "the parties")

    explanations = {
        "Article 14": {
            "Criminal/Violent": (
                "This is a criminal case. Article 14 says everyone must be treated "
                "the same way by the law — the person accused and the victim both "
                "deserve to be treated fairly. The court cannot take sides based on "
                "who someone is."
            ),
            "_default": (
                "Article 14 means the law must treat everyone equally. This case "
                "involves a disagreement between two sides, and both sides deserve "
                "a fair chance to be heard. The judge must not favour one over the other."
            ),
        },
        "Article 15": (
            "This case involves someone the Constitution specially protects — like "
                "women, children, or people from weaker communities. Article 15 says "
                "the law cannot treat them unfairly, and the government must go out of "
                "its way to look after their interests."
        ),
        "Article 19": (
            "This case is about someone's right to run a business, practice a "
                "trade, or do a job. Article 19(1)(g) protects that right, but the "
                "government can put fair limits on it if the public interest requires "
                "it. The court must decide if those limits were reasonable."
        ),
        "Article 19(1)(g)": (
            "This case is about someone's right to run a business, practice a "
                "trade, or do a job. Article 19(1)(g) protects that right, but the "
                "government can put fair limits on it if the public interest requires "
                "it. The court must decide if those limits were reasonable."
        ),
        "Article 21": {
            "Fatal": (
                "Someone has died. Article 21 is the right to life — the most "
                "important right in the whole Constitution. When a life is lost, the "
                "government must investigate, punish whoever is responsible, and make "
                "sure it does not happen again. This is why the case is given the "
                "highest priority."
            ),
            "Major": (
                "Someone has been badly hurt or their life is in danger. Article 21 "
                "says every person has the right to live with dignity. When someone "
                "is seriously injured, the government must act fast — make sure they "
                "get medical help and hold the person responsible for the harm."
            ),
            "Minor": (
                "Someone has been hurt, though it is not life-threatening. Article 21 "
                "says even a small injury to someone's body is serious. The government "
                "must make sure the injured person gets justice without unnecessary delay."
            ),
            "_default": (
                "Article 21 protects every person's right to life and freedom. It "
                "applies here because this case could affect someone's safety, freedom, "
                "or basic dignity. Even without physical harm, the court must make sure "
                "no one is deprived of their freedom without a valid reason."
            ),
        },
        "Article 20": (
            "This is a criminal case. Article 20 protects the accused person from "
                "being treated unfairly. It says: you cannot be punished for something "
                "that was not a crime when you did it, you cannot be tried twice for "
                "the same offence, and you cannot be forced to confess."
        ),
        "Article 22": (
            "Someone has been arrested. Article 22 says they must be told why, "
                "allowed to talk to a lawyer, and not kept in jail forever without a "
                "proper hearing. It protects people from being locked up without reason."
        ),
        "Articles 23 & 24": (
            "This case involves exploitation — like trafficking, forced labour, or "
                "child labour. The Constitution bans all of these completely. Articles "
                "23 and 24 say the government must protect people who cannot protect "
                "themselves from being used by others."
        ),
        "Article 32": (
            "This case has been filed directly in the Supreme Court. Article 32 "
                "gives every citizen the right to go to the Supreme Court if their "
                "basic rights are being taken away. It is the tool that makes sure all "
                "the other rights actually work."
        ),
        "Article 226": (
            "This case has been filed in a High Court. Article 226 gives High "
                "Courts the power to order the government to follow the law. If a "
                "government body does something illegal, this article lets citizens "
                "ask the court to step in and fix it."
        ),
        "Article 265": (
            "This is a tax case. Article 265 says the government cannot collect "
                "any tax unless a law specifically allows it. If the tax was charged "
                "without proper legal backing, it must be given back."
        ),
        "Article 300A": {
            "Property/Land": (
                "This case is about property or land. Article 300A says no one can "
                "take away your property unless the law specifically allows it. If "
                "someone's land or property is being taken, the government must follow "
                "a proper process and pay fair compensation."
            ),
            "_default": (
                "This case involves property or money. Article 300A protects people "
                "from losing their property without a lawful reason. The court must "
                "check that the proper legal process was followed."
            ),
        },
    }

    # Look up the explanation for this article
    article_expl = explanations.get(article)
    if article_expl is None:
        return ""

    # If the explanation is a dict (has category/severity variants), pick the right one
    if isinstance(article_expl, dict):
        # For Article 21, use severity-specific explanation
        if article == "Article 21":
            expl = article_expl.get(severity, article_expl.get("_default", ""))
        else:
            expl = article_expl.get(category, article_expl.get("_default", ""))
    else:
        expl = article_expl

    # Add context about vulnerability and influence if relevant
    extras = []
    if vulnerability == "High" and article in ("Article 14", "Article 15", "Article 21"):
        extras.append(
            "A vulnerable person is involved — like a child, an elderly person, "
            "or someone from a disadvantaged community. The government has a special "
            "duty to protect them."
        )
    if influence == "High" and article == "Article 14":
        extras.append(
            "One side is much more powerful than the other — a government body, "
            "a large company, or someone with political influence. Article 14 "
            "requires the court to make sure the weaker party is not overpowered."
        )

    if extras:
        expl = expl + " " + " ".join(extras)

    return expl


# ---------------------------------------------------------------------------
# COMPREHENSIVE ANALYSIS — SINGLE ENTRY POINT
# ---------------------------------------------------------------------------

def get_comprehensive_constitutional_analysis(features: dict, priority: str) -> dict:
    """
    Main entry point. Returns a complete constitutional analysis dictionary
    that can be consumed by the API, dashboard, and Excel report.
    """
    rights_analysis = analyze_constitutional_rights(features)

    # Precedent citations from the LLM (may be None if LLM didn't produce them)
    llm_precedents = features.get("precedent_citations") or {}

    def _merge_precedents(article: str, right: dict) -> dict:
        """Attach LLM-generated precedent citations to a constitutional right."""
        result = {
            "article": right["article"],
            "title": right["title"],
            "primary": right["primary"],
            "why_applies": _generate_why_applies(right["article"], features, priority),
            "precedents": [],
        }
        # Merge: LLM citations take priority; fall back to empty list
        result["precedents"] = llm_precedents.get(article, [])
        return result

    return {
        "constitutional_rights_engaged": [
            _merge_precedents(r["article"], r)
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
