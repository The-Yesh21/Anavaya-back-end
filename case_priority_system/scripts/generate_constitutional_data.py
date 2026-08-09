"""
Generate the STAGE-2 training dataset: classification-reasoning examples.

For every case (synthetic + real), the deterministic rule-based classifier
(`inference_pipeline.classify_legal_category`) is used as ground truth for the
legal category — the same classifier the production pipeline uses to tune the
LLM's output. Each row then gets a `plain_summary` that EXPLAINS and defends
the category choice: it cites the concrete keywords from the text that support
the classification and the primary constitutional articles engaged.

This teaches the fine-tuned model to justify its `case_category` in plain
language instead of just echoing a label.

Output: case_priority_system/data/constitutional_training_cases.csv
"""
import os
import sys

import pandas as pd

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from case_priority_system.scripts.inference_pipeline import (
    classify_legal_category,
    LEGAL_CATEGORIES,
)
from case_priority_system.scripts.constitutional_analysis import (
    CATEGORY_CONSTITUTIONAL_MAP,
)

OUTPUT = "case_priority_system/data/constitutional_training_cases.csv"

# Curated, realistic case descriptions for categories that are under-
# represented in the synthetic corpus (esp. Constitutional/Writ, Customs).
# Texts are written with the same vocabulary the rule-based classifier keys on,
# so the model's stated category always matches what the pipeline re-derives.
# Each: (description, case_category, crime_type, severity, vulnerability, influence)
CURATED_CASES = [
    # ---- Constitutional / Writ ----
    ("The petitioner has filed a writ petition under Article 226 of the Constitution challenging the detention order as violative of fundamental rights under Article 21. The petitioner seeks a writ of habeas corpus and immediate release, arguing that the detention is illegal and without authority of law. The High Court has been moved for interim relief and judicial review of the state action.", "Constitutional/Writ", "Non-Violent", "No Injury", "Medium", "High"),
    ("A writ of certiorari has been sought against the order of the tribunal on grounds of violation of natural justice and breach of Article 14. The petitioner contends that the administrative action is arbitrary and discriminatory. The matter raises questions of constitutional validity of the impugned notification and the petitioner seeks quashing of the order and a stay order.", "Constitutional/Writ", "Non-Violent", "No Injury", "Low", "High"),
    ("The petitioner, a prisoner, has invoked Article 32 of the Constitution seeking enforcement of his fundamental rights. The petition alleges illegal detention and cruel treatment, violating Article 21. The Supreme Court is moved for a writ of habeas corpus and directions for a speedy trial.", "Constitutional/Writ", "Non-Violent", "No Injury", "High", "High"),
    ("A writ petition under Article 226 of the Constitution challenges the termination order passed without following the principle of natural justice. The petitioner, a government employee, alleges violation of Articles 14 and 21 and seeks reinstatement. The court is moved for judicial review of the executive action.", "Constitutional/Writ", "Non-Violent", "No Injury", "Medium", "High"),
    ("The petitioners have approached the High Court under Article 226 seeking a writ of mandamus against the authorities for failing to enforce a statutory duty, causing violation of their fundamental rights. The petition alleges discrimination under Article 14 and seeks directions for enforcement of the rights guaranteed by the Constitution.", "Constitutional/Writ", "Non-Violent", "No Injury", "Low", "High"),
    ("A PIL has been filed before the High Court challenging the constitutional validity of the state notification on the ground that it infringes the fundamental rights of the citizens. The petitioner seeks a writ of prohibition against its enforcement and interim relief pending hearing.", "Constitutional/Writ", "Non-Violent", "No Injury", "Low", "High"),
    # ---- Customs / Import-Export ----
    ("The Directorate of Revenue Intelligence seized 51 bales of imported mulberry raw silk from the petitioner's customs house under the Customs Act. The goods were imported under an advance licence issued by the DGFT under the Foreign Trade Policy. The seizure was made alleging misdeclaration of value in the bill of entry and smuggling. The petitioner seeks release of the confiscated goods and re-export of the goods or drawback of the duties paid.", "Customs/Import-Export", "Non-Violent", "No Injury", "Low", "High"),
    ("The customs authorities confiscated prohibited goods imported without a valid import license. The petitioner, an exporter, had filed a shipping bill for goods under the duty drawback scheme. The department alleged that the goods were smuggled and liable to confiscation under the Customs Act and FEMA provisions relating to foreign exchange. The petitioner seeks clearance of the goods and quashing of the penalty order.", "Customs/Import-Export", "Non-Violent", "No Injury", "Low", "High"),
    ("The petitioner's consignment of imported goods was detained at the seaport by the customs house on suspicion of misdeclaration. The bill of entry was questioned and a show cause notice for confiscation was issued. The petitioner, an importer holding an import license under the Foreign Trade Policy, seeks release of the goods and drawback of the duties paid.", "Customs/Import-Export", "Non-Violent", "No Injury", "Low", "High"),
    ("The customs department alleged that the export consignment contained contraband and sought confiscation under the Customs Act. The exporter challenged the seizure of the goods at the customs house, claiming compliance with the shipping bill and the foreign trade regulations. The petitioner seeks re-import of the consignment and damages.", "Customs/Import-Export", "Non-Violent", "No Injury", "Low", "High"),
    # ---- Company / Winding Up ----
    ("The petitioners, minority shareholders of the private limited company, filed a company petition under Sections 397 and 398 of the Companies Act alleging oppression and mismanagement by the majority shareholders and the board of directors. The petition seeks the removal of the managing director and directions for the conduct of the annual general meeting. The matter is pending before the NCLT.", "Company/Winding Up", "Non-Violent", "No Injury", "Low", "High"),
    ("A winding up petition was filed by a secured creditor against the company under the Companies Act. The official liquidator was appointed and the company is now in liquidation. The petition relates to the inability of the company to pay its debts and the protection of the interests of the shareholders and creditors.", "Company/Winding Up", "Non-Violent", "No Injury", "Low", "High"),
    ("The company petition before the NCLT alleges oppression and mismanagement by the directors of the private limited company. The majority shareholder is accused of diverting funds and calling board meetings without proper resolution. The minority shareholder seeks relief under Sections 397 and 398 of the Companies Act.", "Company/Winding Up", "Non-Violent", "No Injury", "Low", "High"),
    ("The company, unable to pay its dues, faced a winding up petition by its creditors. The official liquidator has taken charge and the company is in liquidation. The dispute involves the rights of the shareholders and the secured creditor under the Companies Act.", "Company/Winding Up", "Non-Violent", "No Injury", "Low", "High"),
    # ---- Insolvency / Debt ----
    ("The petitioner filed an insolvency petition under the Insolvency and Bankruptcy Code against the debtor who is unable to pay his debts. The financial creditor sought initiation of the corporate insolvency process before the adjudicating authority. A moratorium was declared and a revival plan is being considered. The debtor's assets have been declared NPA by the bank and the matter is also before the Debt Recovery Tribunal.", "Insolvency/Debt", "Financial", "No Injury", "Low", "High"),
    ("A suit for recovery of the outstanding loan amount was decreed by the court. The debtor defaulted on repayment and the bank initiated proceedings under the SARFAESI Act against the secured assets. The guarantor was also made liable. The creditor seeks execution of the decree and recovery of the principal with interest arrears.", "Insolvency/Debt", "Financial", "No Injury", "Low", "High"),
    ("The operational creditor filed an insolvency petition under the Insolvency and Bankruptcy Code alleging default in payment by the corporate debtor. The debtor company is unable to pay its debts and the petition seeks initiation of the insolvency process for the benefit of all creditors.", "Insolvency/Debt", "Financial", "No Injury", "Low", "High"),
    ("The bank declared the loan account of the debtor as a non-performing asset and issued a notice under the SARFAESI Act for recovery of the secured debt. The debtor filed a petition challenging the recovery proceedings before the Debt Recovery Tribunal, claiming that the outstanding amount was already repaid.", "Insolvency/Debt", "Financial", "No Injury", "Low", "High"),
    # ---- Excise / Tax ----
    ("The assessee challenged the show cause notice issued by the Assistant Collector of Central Excise demanding excise duty on the assessable value of the goods. The dispute relates to the classification list and tariff item under the Central Excise Act. The petitioner seeks refund of the pre-deposit and quashing of the assessment order.", "Excise/Tax", "Non-Violent", "No Injury", "Low", "High"),
    ("The dispute relates to the levy of central excise duty on the goods manufactured by the petitioner and the denial of the CENVAT credit. The excise authorities issued a demand notice alleging short payment of duty. The petitioner contests the assessable value and seeks a refund of the duty paid under protest.", "Excise/Tax", "Non-Violent", "No Injury", "Low", "High"),
]


def build_plain_summary(
    text: str, category: str, matched_kws: list, articles: str, doctrines: str = ""
) -> str:
    """Composes a plain-language summary that includes a category-reasoning sentence."""
    kw_phrase = ", ".join(matched_kws[:4]) if matched_kws else "the facts of the dispute"
    reasoning = (
        f"This case is classified as {category} because the document indicates "
        f"{kw_phrase}. Under the Constitution of India, the rights engaged are "
        f"{articles}."
    )
    if doctrines:
        reasoning += f" The governing principles include {doctrines}."
    opening = (
        "The parties are involved in a legal dispute over the matters described "
        "in the case record. "
    )
    return opening + reasoning


def category_articles(category: str) -> str:
    """Primary + secondary articles for a category, joined with commas."""
    info = CATEGORY_CONSTITUTIONAL_MAP.get(category, {})
    articles = info.get("primary_articles", ["Article 14"]) + info.get(
        "secondary_articles", []
    )
    return ", ".join(articles)


def category_doctrines(category: str) -> str:
    """Doctrine names for a category, joined with commas."""
    info = CATEGORY_CONSTITUTIONAL_MAP.get(category, {})
    return ", ".join(info.get("doctrines", []))


def main():
    df_real = pd.read_csv("case_priority_system/data/real_report_training_cases.csv")
    df_synth = pd.read_csv("case_priority_system/data/synthetic_cases.csv")
    df = pd.concat([df_real, df_synth]).dropna(subset=["description"]).reset_index(drop=True)

    rows = []
    for _, row in df.iterrows():
        text = str(row["description"])
        category = classify_legal_category(text, {})
        matched = [kw for kw in LEGAL_CATEGORIES.get(category, []) if kw in text.lower()]
        summary = build_plain_summary(
            text, category, matched, category_articles(category), category_doctrines(category)
        )
        rows.append({
            "case_id": str(row.get("case_id", f"STAGE2_{len(rows):04d}")),
            "description": text,
            "case_category": category,
            "crime_type": str(row.get("crime_type", "Non-Violent")),
            "severity": str(row.get("severity", "No Injury")),
            "vulnerability": str(row.get("vulnerability", "Low")),
            "influence": str(row.get("influence", "Low")),
            "plain_summary": summary,
        })

    # Append curated cases for under-represented categories and verify the
    # rule-based classifier agrees with each curated label.
    for i, (text, category, crime, sev, vuln, inf) in enumerate(CURATED_CASES):
        classifier_label = classify_legal_category(text, {})
        flag = "OK" if classifier_label == category else f"MISMATCH->{classifier_label}"
        print(f"curated[{i}] {category:22s} classifier: {flag}")
        matched = [kw for kw in LEGAL_CATEGORIES.get(category, []) if kw in text.lower()]
        rows.append({
            "case_id": f"CURATED_{i:03d}",
            "description": text,
            "case_category": category,
            "crime_type": crime,
            "severity": sev,
            "vulnerability": vuln,
            "influence": inf,
            "plain_summary": build_plain_summary(
                text, category, matched, category_articles(category), category_doctrines(category)
            ),
        })

    out = pd.DataFrame(rows)
    out.to_csv(OUTPUT, index=False)
    print(f"Wrote {len(out)} stage-2 cases to {OUTPUT}")
    print("\nCategory distribution:")
    print(out["case_category"].value_counts().to_string())
    print("\nDistinct articles cited in training summaries:")
    import re as _re
    cited = set()
    for s in out["plain_summary"]:
        for m in _re.findall(r"Article\s+\d+(?:\(\d?\))?[A-Z]?", str(s)):
            cited.add(m)
    print(sorted(cited))
    print("\n--- sample reasoning ---")
    for _, r in out.head(3).iterrows():
        print(f"[{r['case_category']}] {r['plain_summary'][:260]}")
        print()


if __name__ == "__main__":
    main()
