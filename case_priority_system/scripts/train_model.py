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
import time

try:
    from case_priority_system.scripts.inference_pipeline import (
        extract_text_from_pdf,
        fast_extract_features,
        tune_case_features,
    )
except ImportError:
    from inference_pipeline import extract_text_from_pdf, fast_extract_features, tune_case_features

SYNTHETIC_DATA_PATH = 'case_priority_system/data/synthetic_cases.csv'
REAL_TRAINING_DATA_PATH = 'case_priority_system/data/real_report_training_cases.csv'
CONSTITUTIONAL_DATA_PATH = 'case_priority_system/data/constitutional_training_cases.csv'
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

def safe_encode(encoder, value, default=0):
    """Transforms a categorical value with a LabelEncoder, defaulting on unseen values."""
    if value in encoder.classes_:
        return encoder.transform([value])[0]
    return default


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
    """Turns real PDF reports into labelled training rows using tuned extraction rules.

    MERGES into the existing CSV (which also contains the downloaded real-judgment
    rows from `build_real_judgment_dataset.py`) instead of overwriting it, and
    returns the full merged frame.
    """
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

        features = tune_case_features(fast_extract_features(text, os.path.basename(pdf_path)), text)
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

    pdf_df = pd.DataFrame(rows)

    # Load any existing corpus (downloaded judgments from the HF/S3 builder).
    existing = pd.DataFrame()
    if os.path.exists(REAL_TRAINING_DATA_PATH):
        existing = pd.read_csv(REAL_TRAINING_DATA_PATH)

    combined = pd.concat([existing, pdf_df], ignore_index=True)
    if not combined.empty and 'source_file' in combined.columns:
        combined = combined.drop_duplicates(subset=['source_file'], keep='last')
    combined = combined.reset_index(drop=True)

    os.makedirs(os.path.dirname(REAL_TRAINING_DATA_PATH), exist_ok=True)
    combined.to_csv(REAL_TRAINING_DATA_PATH, index=False)
    return combined


def load_constitutional_training_data():
    """Loads the constitutional training corpus and derives priority labels with
    the same court-priority policy used everywhere else.

    This CSV was built for LLM fine-tuning (category reasoning summaries), but its
    `description` + categorical features are valuable out-of-domain training text
    for the Decision Tree too.
    """
    if not os.path.exists(CONSTITUTIONAL_DATA_PATH):
        return pd.DataFrame()
    df = pd.read_csv(CONSTITUTIONAL_DATA_PATH)
    if df.empty or 'priority' in df.columns:
        return df

    # Truncate long judgment texts to match the PDF-row convention (~2500 chars)
    # so TF-IDF stays tractable.
    if 'description' in df.columns:
        df['description'] = df['description'].fillna('').astype(str).str[:2500]

    priorities = []
    for _, row in df.iterrows():
        features = {
            'crime_type': row.get('crime_type', 'Non-Violent'),
            'severity': row.get('severity', 'No Injury'),
            'vulnerability': row.get('vulnerability', 'Low'),
            'influence': row.get('influence', 'Low'),
            'case_category': row.get('case_category', 'General Civil'),
            'plain_summary': row.get('plain_summary', ''),
            'description': row.get('description', ''),
        }
        priorities.append(infer_priority_label(features))
    df['priority'] = priorities
    return df

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

def stage(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)

def train_model():
    # ---- Assemble the full training corpus ----
    stage('assemble corpus: synthetic + legal templates')
    df = pd.read_csv(SYNTHETIC_DATA_PATH)
    if 'case_category' not in df.columns:
        df['case_category'] = 'General Civil'

    df = enrich_synthetic_data(df)

    # Real judgments (downloaded HC PDFs + root PDFs) — kept once (no naive
    # repetition): their value is genuine out-of-domain language, and the honest
    # evaluation below proves whether the tree generalizes to them.
    stage('assemble corpus: real judgments (root PDFs + downloaded HC)')
    real_df = build_real_report_training_data('.')
    n_real = len(real_df)
    if not real_df.empty:
        df = pd.concat([df, real_df], ignore_index=True)
        print(f"Added {n_real} real judgment rows (root PDFs + downloaded HC judgments).")
    else:
        print("No real judgment rows found; trained with synthetic/legal template data only.")

    # Constitutional training corpus (category-reasoning texts) — derives labels
    # with the same priority policy, adding more realistic legal vocabulary.
    stage('assemble corpus: constitutional')
    const_df = load_constitutional_training_data()
    n_const = len(const_df)
    if not const_df.empty:
        df = pd.concat([df, const_df], ignore_index=True)
        print(f"Added {n_const} constitutional training rows (labels derived by policy).")

    # Defensive: cap every description at the PDF-row convention (~2500 chars)
    # so TF-IDF stays bounded regardless of corpus origin.
    if 'description' in df.columns:
        df['description'] = df['description'].fillna('').astype(str).str[:2500]

    stage(f'full corpus shape: {df.shape}')

    # ---- Feature engineering helpers ----
    STRUCTURED_COLS = ['case_category', 'crime_type', 'severity', 'vulnerability', 'influence']
    ENC_KEYS = {'case_category': 'category', 'crime_type': 'crime', 'severity': 'severity',
                'vulnerability': 'vulnerability', 'influence': 'influence'}

    def encode_frame(data):
        """Encodes categorical columns + TF-IDF text into the model feature frame."""
        local = {}
        for col in STRUCTURED_COLS:
            le = LabelEncoder()
            data[col + '_enc'] = le.fit_transform(data[col])
            local[ENC_KEYS[col]] = le
        le_prio = LabelEncoder()
        data['priority_enc'] = le_prio.fit_transform(data['priority'])
        local['priority'] = le_prio

        tfidf = TfidfVectorizer(max_features=220, stop_words='english', ngram_range=(1, 2), min_df=1)
        text_features = tfidf.fit_transform(data['description']).toarray()
        text_df = pd.DataFrame(text_features, columns=tfidf.get_feature_names_out())

        X = pd.concat([
            data[[c + '_enc' for c in STRUCTURED_COLS]],
            text_df
        ], axis=1)
        return X, data['priority_enc'], local, tfidf

    def build_tree():
        return DecisionTreeClassifier(
            max_depth=8,
            min_samples_leaf=3,
            class_weight='balanced',
            random_state=42
        )

    # Real-judgment rows are the ones with a source_file (root PDFs + downloaded HC).
    is_real = df['source_file'].notna() if 'source_file' in df.columns else pd.Series(False, index=df.index)
    n_real = int(is_real.sum())

    # ---- HONEST EVALUATION 1: out-of-domain real-judgment holdout ----
    # Train on everything EXCEPT the real judgments; test on real judgments only.
    print("\n===== HONEST EVALUATION: real-judgment holdout =====")
    train_df = df[~is_real].copy().reset_index(drop=True)
    test_df = df[is_real].copy().reset_index(drop=True)

    stage(f'holdout: train on {len(train_df)} rows, test on {len(test_df)} real rows')
    X_train_h, y_train_h, enc_h, tfidf_h = encode_frame(train_df)
    clf_h = build_tree()
    clf_h.fit(X_train_h, y_train_h)
    stage('holdout: fit done, predicting')

    # Build the holdout feature frame with the TRAIN-fitted transformers.
    X_test_h = pd.DataFrame(index=test_df.index)
    for col in STRUCTURED_COLS:
        X_test_h[col + '_enc'] = test_df[col].apply(
            lambda v: safe_encode(enc_h[ENC_KEYS[col]], v)
        )
    test_text = tfidf_h.transform(test_df['description']).toarray()
    test_text_df = pd.DataFrame(
        test_text, columns=tfidf_h.get_feature_names_out(), index=test_df.index
    )
    X_test_h = pd.concat([X_test_h, test_text_df], axis=1)
    # Align columns to the training frame (missing text cols default to 0).
    for col in X_train_h.columns:
        if col not in X_test_h.columns:
            X_test_h[col] = 0
    X_test_h = X_test_h[X_train_h.columns]

    y_test_h = test_df['priority'].apply(lambda v: safe_encode(enc_h['priority'], v))
    y_pred_h = clf_h.predict(X_test_h)

    holdout_accuracy = accuracy_score(y_test_h, y_pred_h)
    holdout_report = classification_report(
        y_test_h, y_pred_h,
        target_names=enc_h['priority'].classes_,
        zero_division=0,
    )
    print(f"Real-judgment holdout rows: {len(test_df)}")
    print(f"Holdout accuracy (honest): {holdout_accuracy:.4f}")
    print(holdout_report)

    # ---- HONEST EVALUATION 2: stratified k-fold cross-validation on full corpus ----
    print("\n===== HONEST EVALUATION: 5-fold stratified CV =====")
    from sklearn.model_selection import StratifiedKFold, cross_val_score
    stage('CV: encoding full corpus')
    X_all, y_all, _, _ = encode_frame(df.copy())
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    stage('CV: running 5 folds')
    cv_scores = cross_val_score(build_tree(), X_all, y_all, cv=skf, scoring='accuracy')
    cv_mean = float(np.mean(cv_scores))
    stage('CV: done')
    print(f"CV accuracy per fold: {[f'{s:.4f}' for s in cv_scores]}")
    print(f"CV mean accuracy: {cv_mean:.4f}")

    # ---- Final model: train on the FULL corpus (incl. real judgments) ----
    stage('final: encoding full corpus')
    X, y, le_dict, tfidf = encode_frame(df.copy())
    le_priority = le_dict['priority']

    # In-distribution random split for continuity with earlier reports.
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    clf = build_tree()
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    report = classification_report(y_test, y_pred, target_names=le_priority.classes_)
    print("\nModel Evaluation (in-distribution split):")
    print(f"Accuracy: {accuracy:.4f}")
    print(report)

    tree_rules = export_text(clf, feature_names=list(X.columns))
    print("\nDecision Tree Rules:")
    print(tree_rules)

    with open(TRAINING_REPORT_PATH, 'w', encoding='utf-8') as f:
        f.write(f"Training rows: {len(df)}\n")
        f.write(f"  synthetic + legal templates: {int((~is_real).sum() - n_const)}\n")
        f.write(f"  constitutional training rows: {n_const}\n")
        f.write(f"  real judgment rows: {n_real} (root PDFs + downloaded High Court judgments)\n\n")
        f.write("===== HONEST EVALUATION: out-of-domain real-judgment holdout =====\n")
        f.write(f"Holdout rows: {len(test_df)} | Accuracy: {holdout_accuracy:.4f}\n")
        f.write(holdout_report + "\n\n")
        f.write("===== HONEST EVALUATION: 5-fold stratified CV =====\n")
        f.write(f"CV per-fold accuracy: {[f'{s:.4f}' for s in cv_scores]}\n")
        f.write(f"CV mean accuracy: {cv_mean:.4f}\n\n")
        f.write("===== In-distribution split (for continuity) =====\n")
        f.write(f"Accuracy: {accuracy:.4f}\n")
        f.write(report + "\n\n")
        f.write("===== Decision Tree Rules =====\n")
        f.write(tree_rules)

    # Save models and encoders
    os.makedirs('case_priority_system/models', exist_ok=True)
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump({
            'model': clf,
            'tfidf': tfidf,
            'encoders': {
                'category': le_dict['category'],
                'crime': le_dict['crime'],
                'severity': le_dict['severity'],
                'vulnerability': le_dict['vulnerability'],
                'influence': le_dict['influence'],
                'priority': le_priority
            },
            'feature_names': list(X.columns)
        }, f)
    print(f"\nModel saved to {MODEL_PATH}")
    print(f"Training report saved to {TRAINING_REPORT_PATH}")

if __name__ == "__main__":
    train_model()
