import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.preprocessing import LabelEncoder
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import classification_report, accuracy_score
import pickle
import os
import glob
import re

try:
    from case_priority_system.scripts.inference_pipeline import (
        extract_text_from_pdf,
        fallback_extract_features,
        tune_case_features,
    )
except ImportError:
    from inference_pipeline import extract_text_from_pdf, fallback_extract_features, tune_case_features

SYNTHETIC_DATA_PATH = 'case_priority_system/data/synthetic_cases.csv'
REAL_TRAINING_DATA_PATH = 'case_priority_system/data/real_report_training_cases.csv'
MODEL_PATH = 'case_priority_system/models/priority_classifier.pkl'
TRAINING_REPORT_PATH = 'case_priority_system/models/training_report.txt'

LEGAL_CATEGORY_TO_TEXT = {
    "Excise/Tax": (
        "central excise excise duty tariff assessable value refund tax "
        "cenvat modvat gst service tax income tax customs duty penalty "
        "demand notice show cause adjudication classification exemption rebate"
    ),
    "Customs/Import-Export": (
        "customs import export seizure confiscation smuggling licence "
        "bill of entry shipping bill foreign trade drawback clearance "
        "fema foreign exchange prohibited goods contraband"
    ),
    "Company/Winding Up": (
        "company winding up liquidation shareholders directors nclt board "
        "oppression mismanagement merger amalgamation takeover shares "
        "articles of association memorandum official liquidator"
    ),
    "Insolvency/Debt": (
        "insolvency debt creditor debtor unable to pay decree bankruptcy "
        "ibc cirp resolution professional npa default recovery drt sarfaesi "
        "financial creditor operational creditor moratorium liquidation"
    ),
    "Constitutional/Writ": (
        "writ petition constitutional validity jurisdiction state action "
        "fundamental rights article 226 habeas corpus mandamus certiorari "
        "natural justice judicial review interim relief injunction"
    ),
    "Property/Land": (
        "property land possession tenancy mortgage premises eviction lease "
        "title deed encroachment adverse possession mutation ownership "
        "land acquisition compensation rent"
    ),
    "Criminal/Violent": (
        "violent criminal assault murder injury victim weapon homicide "
        "rape dacoity robbery kidnapping abduction dowry death cruelty "
        "sexual assault domestic violence human trafficking culpable homicide"
    ),
    "General Civil": (
        "civil dispute contract petition order judgment arbitration "
        "breach of contract damages negligence defamation consumer protection "
        "specific performance divorce maintenance succession will probate"
    ),
}

def infer_priority_label(features):
    """Creates training labels using the same court-priority policy used for explanations."""
    crime_type = features.get('crime_type', 'Non-Violent')
    severity = features.get('severity', 'No Injury')
    vulnerability = features.get('vulnerability', 'Low')
    influence = features.get('influence', 'Low')
    category = features.get('case_category', 'General Civil')
    text_content = (features.get('plain_summary', '') + ' ' + features.get('main_parties', '') + ' ' + features.get('description', '')).lower()

    # HIGH priority: life, liberty, severe violence, sexual offenses, fatal harm
    if any(kw in text_content for kw in [
        'rape', 'sexual assault', 'molest', 'sexual abuse',
        'human trafficking', 'child labour', 'child abuse',
    ]):
        return 'High'

    if crime_type == 'Violent' and severity in ['Fatal', 'Major']:
        return 'High'
    if severity in ['Fatal', 'Major'] and vulnerability == 'High':
        return 'High'
    if severity == 'Fatal':
        return 'High'

    # MEDIUM priority: any violence, high vulnerability, high influence,
    # or categories with vulnerable victims
    if crime_type == 'Violent' or vulnerability == 'High' or influence == 'High':
        return 'Medium'
    if category in ['Property/Land', 'Insolvency/Debt'] and vulnerability in ['Medium', 'High']:
        return 'Medium'
    if category == 'Criminal/Violent':
        return 'Medium'
    if severity in ['Major', 'Minor']:
        return 'Medium'

    return 'Low'

def build_real_report_training_data(pdf_dir='.'):
    """Turns real PDF reports into labelled training rows using tuned extraction rules."""
    rows = []
    pdf_paths = sorted({
        os.path.abspath(path)
        for pattern in ['*.PDF', '*.pdf']
        for path in glob.glob(os.path.join(pdf_dir, pattern))
    })
    for pdf_path in pdf_paths:
        text = extract_text_from_pdf(pdf_path)
        if not text.strip():
            continue

        features = tune_case_features(fallback_extract_features(text, os.path.basename(pdf_path)), text)
        category_text = LEGAL_CATEGORY_TO_TEXT.get(features.get('case_category'), '')
        description = ' '.join([
            features.get('plain_summary', ''),
            category_text,
            re.sub(r'\s+', ' ', text[:2500]),
        ]).strip()

        priority = infer_priority_label(features)
        rows.append({
            'case_id': f"REAL_{len(rows):04d}",
            'description': description,
            'case_category': features.get('case_category', 'General Civil'),
            'crime_type': features.get('crime_type', 'Non-Violent'),
            'severity': features.get('severity', 'No Injury'),
            'vulnerability': features.get('vulnerability', 'Low'),
            'influence': features.get('influence', 'Low'),
            'priority': priority,
            'source_file': os.path.basename(pdf_path),
        })

    real_df = pd.DataFrame(rows)
    if not real_df.empty:
        os.makedirs(os.path.dirname(REAL_TRAINING_DATA_PATH), exist_ok=True)
        real_df.to_csv(REAL_TRAINING_DATA_PATH, index=False)
    return real_df

def enrich_synthetic_data(df):
    """Adds legal-domain style samples so the tree learns the real report categories."""
    templates = [
        # Category, crime_type, severity, vulnerability, influence, priority, description
        ("Excise/Tax", "Non-Violent", "No Injury", "Low", "High", "Medium",
         "A manufacturer challenges central excise duty, tariff classification, cenvat credit denial, refund claim, and assessable value fixed by a public authority."),
        ("Excise/Tax", "Non-Violent", "No Injury", "Low", "High", "Medium",
         "A taxpayer disputes GST assessment, input tax credit reversal, penalty order, and demand notice issued by the tax department."),
        ("Excise/Tax", "Non-Violent", "No Injury", "Low", "High", "Medium",
         "An assessee appeals against service tax demand, interest, and penalty for alleged short payment of service tax on taxable services."),
        ("Customs/Import-Export", "Non-Violent", "No Injury", "Low", "High", "Medium",
         "An importer challenges customs seizure of goods, bill of entry rejection, duty drawback denial, and release of seized goods by DRI."),
        ("Customs/Import-Export", "Non-Violent", "No Injury", "Low", "High", "Medium",
         "A trader appeals against confiscation of imported goods, penalty under Customs Act, and valuation of goods by customs authorities."),
        ("Customs/Import-Export", "Non-Violent", "No Injury", "Low", "High", "Medium",
         "An exporter claims duty drawback, rebate, and advance authorization benefits for export of goods under foreign trade policy."),
        ("Company/Winding Up", "Non-Violent", "No Injury", "Low", "Low", "Low",
         "A company petition concerns winding up, liquidation, shareholders, directors, creditors, and distribution of company assets."),
        ("Company/Winding Up", "Non-Violent", "No Injury", "Low", "High", "Medium",
         "A company dispute involves a public institution, official liquidator, secured creditor, shareholders, and company management rights."),
        ("Company/Winding Up", "Non-Violent", "No Injury", "Medium", "High", "Medium",
         "A petition under sections 397 and 398 Companies Act alleging oppression and mismanagement by majority shareholders against minority."),
        ("Company/Winding Up", "Non-Violent", "No Injury", "Low", "High", "Medium",
         "An NCLT petition for corporate insolvency resolution process against a corporate debtor by a financial creditor."),
        ("Insolvency/Debt", "Financial", "No Injury", "Low", "Low", "Low",
         "An insolvency petition concerns unpaid debt, creditor claims, debtor inability to pay, and decree enforcement."),
        ("Insolvency/Debt", "Financial", "No Injury", "Medium", "High", "Medium",
         "An insolvency matter involves significant debt, creditors, institutional influence, livelihood pressure, and debtor fairness."),
        ("Insolvency/Debt", "Financial", "No Injury", "Low", "Low", "Low",
         "A debt recovery application filed before DRT for recovery of loan amount, interest, and costs against guarantor and borrower."),
        ("Insolvency/Debt", "Financial", "No Injury", "Low", "Low", "Low",
         "A SARFAESI proceeding initiated by secured creditor for enforcement of security interest against defaulting borrower's assets."),
        ("Property/Land", "Property", "No Injury", "Medium", "Low", "Medium",
         "A property dispute concerns land possession, tenancy, mortgage, premises, livelihood, and lawful ownership."),
        ("Property/Land", "Property", "No Injury", "Medium", "High", "Medium",
         "An eviction petition filed by landlord against tenant for arrears of rent and bonafide requirement of premises."),
        ("Property/Land", "Property", "No Injury", "High", "Low", "Medium",
         "A land acquisition matter where poor farmers seek enhanced compensation for acquired agricultural land."),
        ("Property/Land", "Property", "No Injury", "High", "High", "Medium",
         "An encroachment dispute involving government land, scheduled tribe families facing eviction from ancestral property."),
        ("Criminal/Violent", "Violent", "Fatal", "High", "Low", "High",
         "A violent criminal case involves assault, murder, fatal injury, vulnerable victim, weapon, and immediate life risk."),
        ("Criminal/Violent", "Violent", "Fatal", "High", "High", "High",
         "A murder case involving a politically influential accused, fatal stabbing, vulnerable victim from marginalized community."),
        ("Criminal/Violent", "Violent", "Major", "High", "Low", "High",
         "A case involving sexual assault or rape. The victim was subjected to assault without consent. Constitutional rights against exploitation apply."),
        ("Criminal/Violent", "Violent", "Major", "High", "Low", "High",
         "A domestic violence case where a woman was subjected to cruelty by husband and in-laws, causing grievous injury and mental trauma."),
        ("Criminal/Violent", "Violent", "Minor", "Medium", "High", "Medium",
         "A criminal intimidation and assault case where a powerful person threatened and physically attacked a complainant."),
        ("Criminal/Violent", "Violent", "Fatal", "High", "Low", "High",
         "A dacoity and robbery case where armed assailants killed the victim and looted property. Life risk and public safety concern."),
        ("Criminal/Violent", "Violent", "Major", "High", "Low", "High",
         "A kidnapping and abduction case. The victim was taken forcibly and held for ransom. Mental trauma and life threat involved."),
        ("Constitutional/Writ", "Non-Violent", "No Injury", "Low", "High", "Medium",
         "A writ petition under Article 226 challenging the constitutional validity of a government notification affecting fundamental rights."),
        ("Constitutional/Writ", "Non-Violent", "No Injury", "Low", "High", "Medium",
         "A habeas corpus petition filed seeking production of a person illegally detained by state authorities."),
        ("Constitutional/Writ", "Non-Violent", "No Injury", "Medium", "High", "Medium",
         "A PIL filed in public interest alleging violation of environmental laws affecting health and livelihood of poor communities."),
        ("General Civil", "Non-Violent", "No Injury", "Low", "Low", "Low",
         "An ordinary civil dispute concerns contract interpretation, petition, order, judgment, and no urgent harm."),
        ("General Civil", "Non-Violent", "No Injury", "Low", "Low", "Low",
         "A consumer complaint alleging deficiency in service and unfair trade practice against a company."),
        ("General Civil", "Non-Violent", "No Injury", "Low", "Low", "Low",
         "A civil suit for specific performance of contract, claiming damages and breach of agreement."),
        ("General Civil", "Non-Violent", "No Injury", "Low", "Low", "Low",
         "An arbitration application seeking appointment of arbitrator and enforcement of arbitration agreement between parties."),
        ("General Civil", "Non-Violent", "No Injury", "Medium", "Low", "Medium",
         "A family law dispute concerning divorce, child custody, maintenance, and alimony. Vulnerability of spouse and children considered."),
    ]

    rows = []
    for idx in range(80):
        category, crime, severity, vulnerability, influence, priority, description = templates[idx % len(templates)]
        rows.append({
            'case_id': f"LEGAL_SYN_{idx:04d}",
            'description': description,
            'case_category': category,
            'crime_type': crime,
            'severity': severity,
            'vulnerability': vulnerability,
            'influence': influence,
            'priority': priority,
        })

    enriched_df = pd.DataFrame(rows)
    return pd.concat([df, enriched_df], ignore_index=True)

def train_model():
    # Load synthetic data and augment it with real PDF report examples.
    df = pd.read_csv(SYNTHETIC_DATA_PATH)
    if 'case_category' not in df.columns:
        df['case_category'] = 'General Civil'

    df = enrich_synthetic_data(df)
    real_df = build_real_report_training_data('.')
    if not real_df.empty:
        # Repeat real rows so the small real corpus has enough weight against synthetic examples.
        df = pd.concat([df, real_df, real_df, real_df], ignore_index=True)
        print(f"Added {len(real_df)} real report training rows from PDFs.")
    else:
        print("No real PDF training rows found; trained with synthetic/legal template data only.")
    
    # Preprocess categorical features
    le_category = LabelEncoder()
    le_crime = LabelEncoder()
    le_severity = LabelEncoder()
    le_vulnerability = LabelEncoder()
    le_influence = LabelEncoder()
    le_priority = LabelEncoder()
    
    df['case_category_enc'] = le_category.fit_transform(df['case_category'])
    df['crime_type_enc'] = le_crime.fit_transform(df['crime_type'])
    df['severity_enc'] = le_severity.fit_transform(df['severity'])
    df['vulnerability_enc'] = le_vulnerability.fit_transform(df['vulnerability'])
    df['influence_enc'] = le_influence.fit_transform(df['influence'])
    df['priority_enc'] = le_priority.fit_transform(df['priority'])
    
    # TF-IDF for text description
    tfidf = TfidfVectorizer(max_features=220, stop_words='english', ngram_range=(1, 2), min_df=1)
    text_features = tfidf.fit_transform(df['description']).toarray()
    text_df = pd.DataFrame(text_features, columns=tfidf.get_feature_names_out())
    
    # Combine features
    X = pd.concat([
        df[['case_category_enc', 'crime_type_enc', 'severity_enc', 'vulnerability_enc', 'influence_enc']],
        text_df
    ], axis=1)
    
    y = df['priority_enc']
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # Train Decision Tree
    clf = DecisionTreeClassifier(
        max_depth=8,
        min_samples_leaf=3,
        class_weight='balanced',
        random_state=42
    )
    clf.fit(X_train, y_train)
    
    # Predictions
    y_pred = clf.predict(X_test)
    
    # Evaluation
    print("Model Evaluation:")
    accuracy = accuracy_score(y_test, y_pred)
    report = classification_report(y_test, y_pred, target_names=le_priority.classes_)
    print(f"Accuracy: {accuracy:.4f}")
    print("\nClassification Report:")
    print(report)
    
    # Interpretability: Show tree rules
    tree_rules = export_text(clf, feature_names=list(X.columns))
    print("\nDecision Tree Rules:")
    print(tree_rules)

    with open(TRAINING_REPORT_PATH, 'w', encoding='utf-8') as f:
        f.write(f"Training rows: {len(df)}\n")
        f.write(f"Real report rows: {len(real_df)}\n")
        f.write(f"Accuracy: {accuracy:.4f}\n\n")
        f.write("Classification Report:\n")
        f.write(report)
        f.write("\nDecision Tree Rules:\n")
        f.write(tree_rules)
    
    # Save models and encoders
    os.makedirs('case_priority_system/models', exist_ok=True)
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump({
            'model': clf,
            'tfidf': tfidf,
            'encoders': {
                'category': le_category,
                'crime': le_crime,
                'severity': le_severity,
                'vulnerability': le_vulnerability,
                'influence': le_influence,
                'priority': le_priority
            },
            'feature_names': list(X.columns)
        }, f)
    print(f"\nModel saved to {MODEL_PATH}")
    print(f"Training report saved to {TRAINING_REPORT_PATH}")

if __name__ == "__main__":
    train_model()
