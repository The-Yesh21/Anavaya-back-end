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
    "Excise/Tax": "central excise tax duty refund tariff assessable value lawful levy",
    "Customs/Import-Export": "customs import export seizure licence notification goods release",
    "Company/Winding Up": "company winding up liquidation shareholders directors creditors management",
    "Insolvency/Debt": "insolvency debt creditor debtor unable to pay decree",
    "Constitutional/Writ": "writ petition constitutional validity jurisdiction state action",
    "Property/Land": "property land possession tenancy mortgage premises",
    "Criminal/Violent": "violent criminal assault murder injury victim weapon",
    "General Civil": "civil dispute contract petition order judgment",
}

def infer_priority_label(features):
    """Creates training labels using the same court-priority policy used for explanations."""
    crime_type = features.get('crime_type', 'Non-Violent')
    severity = features.get('severity', 'No Injury')
    vulnerability = features.get('vulnerability', 'Low')
    influence = features.get('influence', 'Low')
    category = features.get('case_category', 'General Civil')

    if crime_type == 'Violent' and (severity in ['Fatal', 'Major'] or vulnerability == 'High'):
        return 'High'
    if severity in ['Fatal', 'Major'] and vulnerability == 'High':
        return 'High'
    if crime_type == 'Violent' or vulnerability == 'High' or influence == 'High':
        return 'Medium'
    if category in ['Property/Land', 'Insolvency/Debt'] and vulnerability in ['Medium', 'High']:
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
        ("Excise/Tax", "Non-Violent", "No Injury", "Low", "High", "Medium",
         "A manufacturer challenges central excise duty, tariff classification, refund denial, and assessable value fixed by a public authority."),
        ("Customs/Import-Export", "Non-Violent", "No Injury", "Low", "High", "Medium",
         "An importer challenges customs seizure of goods, advance licence conditions, import notification, and release of seized goods by DRI."),
        ("Company/Winding Up", "Non-Violent", "No Injury", "Low", "Low", "Low",
         "A company petition concerns winding up, liquidation, shareholders, directors, creditors, and distribution of company assets."),
        ("Company/Winding Up", "Non-Violent", "No Injury", "Low", "High", "Medium",
         "A company dispute involves a public institution, official liquidator, secured creditor, shareholders, and company management rights."),
        ("Insolvency/Debt", "Financial", "No Injury", "Low", "Low", "Low",
         "An insolvency petition concerns unpaid debt, creditor claims, debtor inability to pay, and decree enforcement."),
        ("Insolvency/Debt", "Financial", "No Injury", "Medium", "High", "Medium",
         "An insolvency matter involves significant debt, creditors, institutional influence, livelihood pressure, and debtor fairness."),
        ("Property/Land", "Property", "No Injury", "Medium", "Low", "Medium",
         "A property dispute concerns land possession, tenancy, mortgage, premises, livelihood, and lawful ownership."),
        ("Criminal/Violent", "Violent", "Fatal", "High", "Low", "High",
         "A violent criminal case involves assault, murder, fatal injury, vulnerable victim, weapon, and immediate life risk."),
        ("General Civil", "Non-Violent", "No Injury", "Low", "Low", "Low",
         "An ordinary civil dispute concerns contract interpretation, petition, order, judgment, and no urgent harm."),
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
