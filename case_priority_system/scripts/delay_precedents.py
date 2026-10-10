"""
Historical Delay & Cost-of-Ignorance Precedents Module
======================================================
Provides historical Indian judicial precedents and benchmark case citations where
systemic delay, administrative ignorance, or procedural deprioritization resulted
in catastrophic human toll (loss of life/liberty/youth) or immense economic ruin
(destruction of enterprises/fortunes/livelihoods).

This module answers the judicial officer's critical question:
"What has history taught us when cases of this priority level were delayed or ignored?"

Invariant preserved:
Deterministic rule-based mapping based on priority tier, category, and severity.
No LLM involved in precedent selection.
"""

from typing import Dict, List, Any


# Master Knowledge Base of Historical Delay Precedents
HISTORICAL_DELAY_PRECEENTS: List[Dict[str, Any]] = [
    # -------------------------------------------------------------------------
    # HIGH PRIORITY — Life, Personal Liberty, Custody, Violence, Severe Injury
    # -------------------------------------------------------------------------
    {
        "id": "rudal_sah_1983",
        "case_title": "Rudal Sah v. State of Bihar",
        "citation": "(1983) 4 SCC 141; AIR 1983 SC 1086",
        "court": "Supreme Court of India (Constitution Bench)",
        "year": 1983,
        "priority_level": "High",
        "applicable_categories": ["Criminal/Violent", "Constitutional/Writ", "General Civil"],
        "cost_category": "Loss of Human Liberty & 14 Years of Life",
        "toll_type": "life_liberty",
        "delay_period": "14 Years Post-Acquittal Custody",
        "factual_delay": (
            "The petitioner was formally acquitted of criminal charges by the Sessions Court in 1968, "
            "yet remained languishing in prison for an additional 14 years due to bureaucratic ignorance, "
            "procedural inertia, and the trial court's failure to audit release warrants."
        ),
        "human_or_economic_toll": (
            "An innocent man was robbed of 14 prime years of his life, youth, family ties, and sanity. "
            "By the time the Supreme Court intervened via habeas corpus, the petitioner was physically "
            "and psychologically devastated."
        ),
        "judicial_ruling": (
            "Chief Justice Y.V. Chandrachud pioneered constitutional tort damages under Article 32, ruling that "
            "the State cannot plead procedural administrative backlog when Article 21 personal liberty is "
            "annihilated. The Court ordered exemplary monetary compensation."
        ),
        "priority_mandate": (
            "Mandates immediate High Priority triage for cases involving detention, liberty, or severe physical harm: "
            "procedural ignorance in liberty matters cannot be undone, and post-facto compensation can never restore stolen years."
        ),
    },
    {
        "id": "hussainara_khatoon_1979",
        "case_title": "Hussainara Khatoon & Ors. v. Home Secretary, State of Bihar",
        "citation": "(1980) 1 SCC 81; AIR 1979 SC 1360",
        "court": "Supreme Court of India (P.N. Bhagwati, J.)",
        "year": 1979,
        "priority_level": "High",
        "applicable_categories": ["Criminal/Violent", "Constitutional/Writ"],
        "cost_category": "Thousands of Lives Extinguished in Prison",
        "toll_type": "life_liberty",
        "delay_period": "Decades of Undertrial Incarceration",
        "factual_delay": (
            "A series of investigative reports uncovered thousands of impoverished undertrials who had been kept "
            "in detention for 5 to 12 years awaiting trial — periods far exceeding the maximum statutory prison "
            "terms they could have received even if convicted."
        ),
        "human_or_economic_toll": (
            "Mass destruction of human potential: thousands of citizens died, lost sanity, or contracted chronic illnesses "
            "behind bars simply because court dockets were backlogged and their cases were never listed for hearing."
        ),
        "judicial_ruling": (
            "Justice Bhagwati held that the Right to a Speedy Trial is an integral fundamental right under Article 21. "
            "The Court ruled that an overburdened judicial system has a constitutional obligation to triage and release "
            "those whose trials are unreasonably delayed."
        ),
        "priority_mandate": (
            "Affirms why criminal matters and fundamental liberty deprivations demand top-tier prioritization: "
            "allowing a matter touching liberty to drift in the queue turns the justice system into an engine of punishment without guilt."
        ),
    },
    {
        "id": "bhim_singh_1985",
        "case_title": "Bhim Singh, MLA v. State of Jammu & Kashmir",
        "citation": "(1985) 4 SCC 677; AIR 1986 SC 494",
        "court": "Supreme Court of India (O. Chinnappa Reddy, J.)",
        "year": 1985,
        "priority_level": "High",
        "applicable_categories": ["Constitutional/Writ", "Criminal/Violent"],
        "cost_category": "Deprivation of Constitutional Office & Liberty",
        "toll_type": "liberty",
        "delay_period": "Deliberate 4-Day Procedural Delay",
        "factual_delay": (
            "An opposition MLA on his way to attend the legislative assembly was illegally detained and shifted "
            "between police posts without production before a magistrate, deliberately delaying his release until the vote concluded."
        ),
        "human_or_economic_toll": (
            "A democratic mandate and constitutional right to represent citizens was thwarted by weaponizing procedural delay."
        ),
        "judicial_ruling": (
            "The Supreme Court awarded exemplary damages of Rs. 50,000, holding that constitutional authorities cannot "
            "use administrative delay or procedural hurdles to extinguish liberty and democratic duties."
        ),
        "priority_mandate": (
            "Illustrates that even days of judicial delay in urgent writ and liberty matters can cause irreversible constitutional injury."
        ),
    },
    {
        "id": "nirbhaya_case_2017",
        "case_title": "Mukesh & Ors. v. State (NCT of Delhi)",
        "citation": "(2017) 6 SCC 1 (Nirbhaya Case)",
        "court": "Supreme Court of India (Dipak Misra, J.)",
        "year": 2017,
        "priority_level": "High",
        "applicable_categories": ["Criminal/Violent"],
        "cost_category": "Agony to Victims & Erosion of Deterrence",
        "toll_type": "life_safety",
        "delay_period": "Years of Dilatory Appeal Maneuvers",
        "factual_delay": (
            "Despite brutal sexual assault and fatal violence that shook the nation's conscience, multi-layered appellate delays, "
            "serial review petitions, and last-minute mercy petitions delayed final resolution over several years."
        ),
        "human_or_economic_toll": (
            "Protracted anguish for the grieving family and a dangerous signal of judicial helplessness in deterring heinous violence."
        ),
        "judicial_ruling": (
            "The Supreme Court affirmed that crimes of extreme barbarity involving fatal outcomes and brutal degradation "
            "demand prioritized fast-track disposal to safeguard societal conscience and the deterrent efficacy of criminal law."
        ),
        "priority_mandate": (
            "Confirms that cases involving severe physical violence, fatal injury, or brutal exploitation require unambiguous High Priority "
            "so evidence does not degrade and deterrence remains credible."
        ),
    },

    # -------------------------------------------------------------------------
    # MEDIUM PRIORITY — Economic Fraud, Insolvency, Property, Commercial, Tax
    # -------------------------------------------------------------------------
    {
        "id": "innoventive_swiss_ribbons",
        "case_title": "Innoventive Industries (2018) & Swiss Ribbons (2019)",
        "citation": "(2018) 1 SCC 407 / (2019) 4 SCC 17",
        "court": "Supreme Court of India (R.F. Nariman, J.)",
        "year": 2019,
        "priority_level": "Medium",
        "applicable_categories": ["Insolvency/Debt", "Company/Winding Up", "Excise/Tax"],
        "cost_category": "Destruction of Enterprise Value & Millions in Bad Debt",
        "toll_type": "economic_fortune",
        "delay_period": "Decade-Long SICA & High Court Winding-Up Litigations",
        "factual_delay": (
            "Prior to modern insolvency triage, corporate winding-up petitions and debt recovery suits dragged in courts "
            "for 10 to 15 years on average. Debtor promoters exploited procedural stays while factories rusted and books were cooked."
        ),
        "human_or_economic_toll": (
            "Complete destruction of going-concern value: thousands of workers lost employment, public sector banks wrote off "
            "hundreds of thousands of crores in public funds, and viable companies were turned into scrap metal."
        ),
        "judicial_ruling": (
            "Justice Nariman underscored that 'Time is of the essence in commercial disputes. Delay leads to enterprise death.' "
            "The Supreme Court affirmed that delayed judicial intervention destroys the asset base and punishes honest creditors."
        ),
        "priority_mandate": (
            "Demonstrates why major economic fraud, insolvency, and corporate disputes cannot be deferred: while courts deliberate, "
            "fraudulent assets are siphoned, bank accounts are emptied, and workers' livelihoods are permanently obliterated."
        ),
    },
    {
        "id": "bhopal_gas_disaster_1989",
        "case_title": "Union Carbide Corporation v. Union of India",
        "citation": "(1989) 1 SCC 674; AIR 1990 SC 273",
        "court": "Supreme Court of India (Pathak, C.J.)",
        "year": 1989,
        "priority_level": "Medium",
        "applicable_categories": ["General Civil", "Property/Land", "Criminal/Violent"],
        "cost_category": "Decades of Impoverishment & Mass Human Suffering",
        "toll_type": "health_fortune",
        "delay_period": "Decades of Procedural & Evidentiary Skirmishes",
        "factual_delay": (
            "Procedural battles over jurisdiction, discovery, and interlocutory appeals delayed liability adjudication "
            "and interim compensation while toxic gas survivors died without access to basic medical care or clean water."
        ),
        "human_or_economic_toll": (
            "Over 15,000 dead, over 500,000 permanently debilitated; entire communities forced into intergenerational debt "
            "and destitution while corporate defendants tied the courts up in endless legal technicalities."
        ),
        "judicial_ruling": (
            "The Supreme Court recognized that conventional judicial delays in mass torts and corporate negligence compound the tragedy, "
            "forcing the Court to devise innovative procedural mechanisms to prevent total social catastrophe."
        ),
        "priority_mandate": (
            "Shows that cases involving broad public harm, toxic liability, or commercial exploitation demand timely priority "
            "before the injured parties are financially starved out of their legal remedies."
        ),
    },
    {
        "id": "tukaram_kana_joshi_2013",
        "case_title": "Tukaram Kana Joshi v. MIDC",
        "citation": "(2013) 1 SCC 353; AIR 2013 SC 565",
        "court": "Supreme Court of India (P. Sathasivam, J.)",
        "year": 2013,
        "priority_level": "Medium",
        "applicable_categories": ["Property/Land", "Constitutional/Writ", "General Civil"],
        "cost_category": "Generational Land Dispossession & Destitution",
        "toll_type": "economic_property",
        "delay_period": "35 Years to Adjudicate Land Compensation",
        "factual_delay": (
            "Illiterate farmers' agricultural lands were taken by the state for industrial development in 1964. For over 35 years, "
            "no formal award was passed, and the state repeatedly told the impoverished owners that their claims were 'under process'."
        ),
        "human_or_economic_toll": (
            "Families that owned valuable ancestral land were reduced to poverty-stricken day laborers while high-value industrial "
            "parks flourished on their property without a single rupee paid in compensation."
        ),
        "judicial_ruling": (
            "The Supreme Court rebuked the state, holding that Article 300A right to property is a human right. "
            "The Court ruled that the state cannot acquire property, delay compensation for decades, and then plead procedural delay."
        ),
        "priority_mandate": (
            "Mandates timely priority for property and land disputes: delayed adjudication of title or compensation allows the stronger "
            "party to exploit possession while the rightful claimant is bled dry by court expenses."
        ),
    },
    {
        "id": "antulay_1992",
        "case_title": "Abdul Rehman Antulay v. R.S. Nayak",
        "citation": "(1992) 1 SCC 225; AIR 1992 SC 1701",
        "court": "Supreme Court of India (Constitution Bench)",
        "year": 1992,
        "priority_level": "Medium",
        "applicable_categories": ["Company/Winding Up", "Criminal/Violent", "General Civil"],
        "cost_category": "Massive Public Funds Expended on Dragged Litigation",
        "toll_type": "economic_governance",
        "delay_period": "Over 10 Years in Preliminary & Interlocutory Stages",
        "factual_delay": (
            "High-stakes corruption and public property dispute remained mired in procedural objections and jurisdiction wrangles "
            "for more than a decade before trial could proceed in earnest."
        ),
        "human_or_economic_toll": (
            "Severe systemic paralysis, millions spent in public prosecutorial expenditure, and public cynicism over whether "
            "the legal system could ever bring powerful economic actors to timely account."
        ),
        "judicial_ruling": (
            "A Constitution Bench of the Supreme Court formulated comprehensive guidelines for the constitutional right to speedy trial, "
            "ruling that prolonged proceedings inflict social stigma, financial ruin, and emotional exhaustion on all stakeholders."
        ),
        "priority_mandate": (
            "Proves that financial crimes and high-influence economic cases must not be allowed to linger: influence thrives on delay."
        ),
    },

    # -------------------------------------------------------------------------
    # LOW PRIORITY — Minor Regulatory, Technical Writs, Petty Civil Disputes
    # -------------------------------------------------------------------------
    {
        "id": "babu_singh_1978",
        "case_title": "Babu Singh v. State of Uttar Pradesh",
        "citation": "(1978) 1 SCC 579; AIR 1978 SC 527",
        "court": "Supreme Court of India (V.R. Krishna Iyer, J.)",
        "year": 1978,
        "priority_level": "Low",
        "applicable_categories": ["General Civil", "Customs/Import-Export", "Excise/Tax"],
        "cost_category": "Docket Clogging Starving Urgent Matters of Judicial Time",
        "toll_type": "systemic_resource",
        "delay_period": "Routine Interlocutory Delay Crowding Out True Urgency",
        "factual_delay": (
            "Courts spent countless days hearing repetitive, technical procedural motions from well-heeled civil and commercial litigants, "
            "while urgent matters involving life and survival sat unattended at the bottom of the registry."
        ),
        "human_or_economic_toll": (
            "Indirect human tragedy: desperate, life-or-death cases could not get a single minute of judicial time because court hours "
            "were consumed by minor regulatory and technical paperwork."
        ),
        "judicial_ruling": (
            "Justice Krishna Iyer highlighted that the court's time is a scarce public trust resource: "
            "'Our judicial system must not allow the wealthy to monopolize court time with trivial procedural delays while the poor wait in vain.'"
        ),
        "priority_mandate": (
            "Justifies assigning Low Priority to minor technical/procedural disputes: keeping low-risk matters at appropriate priority "
            "preserves precious judicial bandwidth for the urgent High and Medium priority cases where lives and fortunes are genuinely at stake."
        ),
    },
    {
        "id": "common_cause_1996",
        "case_title": "Common Cause v. Union of India",
        "citation": "(1996) 4 SCC 33 & (1996) 6 SCC 775",
        "court": "Supreme Court of India",
        "year": 1996,
        "priority_level": "Low",
        "applicable_categories": ["General Civil", "Customs/Import-Export", "Excise/Tax"],
        "cost_category": "Paralysis of Trial Courts by Trivial Regulatory Dockets",
        "toll_type": "systemic_resource",
        "delay_period": "Decades of Accumulating Petty Technical Cases",
        "factual_delay": (
            "Over 20 million petty technical, traffic, and minor infractions remained pending in magistrate courts for decades, "
            "treating trivial regulatory non-compliance with the same administrative weight as serious fraud or violent crimes."
        ),
        "human_or_economic_toll": (
            "Complete gridlock of the subordinate judiciary, causing critical criminal and commercial trials to stall indefinitely."
        ),
        "judicial_ruling": (
            "The Supreme Court issued nationwide directions to weed out and close minor stale regulatory infractions, "
            "holding that judicial triage is a constitutional necessity to prevent systemic collapse."
        ),
        "priority_mandate": (
            "Reinforces the purpose of Anavaya's Low Priority triage: minor technical non-injuries must not congest the docket, "
            "ensuring the judicial system functions efficiently for matters of real urgency."
        ),
    },
]


def get_delay_precedents(
    priority: str,
    category: str = "",
    crime_type: str = "",
    severity: str = "",
    max_results: int = 3,
) -> List[Dict[str, Any]]:
    """
    Deterministically retrieves the most relevant historical delay precedents
    matching the case's assigned priority tier, category, and severity.

    Args:
        priority: Assessed priority ('High', 'Medium', 'Low')
        category: Case category (e.g. 'Criminal/Violent', 'Insolvency/Debt', 'Property/Land')
        crime_type: Broad crime/dispute type
        severity: Assessed severity ('Fatal', 'Major', 'Minor', 'No Injury')
        max_results: Max precedents to return (default 3)

    Returns:
        List of structured precedent dictionaries with case citations, factual delay,
        human/economic toll, and judicial priority mandates.
    """
    p_norm = str(priority or "Medium").strip().capitalize()
    if p_norm not in ["High", "Medium", "Low"]:
        p_norm = "Medium"

    cat_norm = str(category or "").strip()

    # Filter candidates by priority tier first
    candidates = [p for p in HISTORICAL_DELAY_PRECEENTS if p["priority_level"] == p_norm]
    if not candidates:
        candidates = HISTORICAL_DELAY_PRECEENTS[:max_results]

    # Score candidates based on category, severity, and topic match
    scored: List[Tuple[int, Dict[str, Any]]] = []
    for cand in candidates:
        score = 0
        applicable_cats = cand.get("applicable_categories", [])
        if cat_norm and cat_norm in applicable_cats:
            score += 10
        elif any(c.lower() in cat_norm.lower() for c in applicable_cats if c):
            score += 5

        # Severity boosts
        sev_norm = str(severity or "").lower()
        if p_norm == "High":
            if "fatal" in sev_norm and "nirbhaya" in cand["id"]:
                score += 8
            elif ("liberty" in sev_norm or "unlawful" in sev_norm or "custody" in sev_norm) and "rudal" in cand["id"]:
                score += 8
            elif "undertrial" in cand["id"] or "hussainara" in cand["id"]:
                score += 6
        elif p_norm == "Medium":
            if "insolvency" in cat_norm.lower() or "debt" in cat_norm.lower() or "company" in cat_norm.lower():
                if "innoventive" in cand["id"]:
                    score += 9
            elif "property" in cat_norm.lower() or "land" in cat_norm.lower():
                if "tukaram" in cand["id"]:
                    score += 9
            elif "bhopal" in cand["id"]:
                score += 4
        elif p_norm == "Low":
            if "babu_singh" in cand["id"]:
                score += 5
            elif "common_cause" in cand["id"]:
                score += 4

        scored.append((score, cand))

    # Sort descending by score
    scored.sort(key=lambda x: x[0], reverse=True)
    results = [item for _, item in scored[:max_results]]

    # Fallback to at least one precedent if empty
    if not results:
        results = candidates[:max_results]

    return results
