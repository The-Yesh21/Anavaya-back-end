import os
try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None
import pandas as pd
import numpy as np
import pickle
import re
import json

try:
    import requests
except ImportError:
    requests = None

try:
    from tqdm import tqdm
except ImportError:
    def tqdm(iterable):
        return iterable

# Constants
MODEL_PATH = 'case_priority_system/models/priority_classifier.pkl'
DATA_DIR = '.'  # Root directory where PDFs are located
OUTPUT_EXCEL = 'case_priority_system/case_results.xlsx'
DECISION_GRAPH_DIR = 'case_priority_system/decision_graphs'
API_KEY = os.getenv(
    "NVIDIA_API_KEY",
    "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"
)
API_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
GEMMA_MODEL = "google/gemma-4-31b-it"

ALLOWED_FEATURES = {
    "crime_type": ["Violent", "Financial", "Property", "Non-Violent"],
    "severity": ["Fatal", "Major", "Minor", "No Injury"],
    "vulnerability": ["High", "Medium", "Low"],
    "influence": ["High", "Low"],
}

ALLOWED_LEGAL_CATEGORIES = [
    "Excise/Tax",
    "Customs/Import-Export",
    "Company/Winding Up",
    "Insolvency/Debt",
    "Constitutional/Writ",
    "Property/Land",
    "Criminal/Violent",
    "General Civil",
]

LEGAL_CATEGORIES = {
    "Excise/Tax": [
        "central excise", "excise duty", "excises and salt act", "collector of central excise",
        "centralexcise", "exciseduty", "excisesand salt act", "central excises",
        "assistant collector of central excise", "tariff item", "classification list", "assessable value",
        "tax assessment", "taxable value", "refund of excise", "pre-deposit", "elt",
        "ecc", "excisable goods", "central excise act"
    ],
    "Customs/Import-Export": [
        "customs", "import", "export", "advance licence", "d.r.i", "directorate of revenue",
        "seized", "seizure", "bales", "raw silk", "notification"
    ],
    "Company/Winding Up": [
        "companies act", "company petition", "winding up", "official liquidator",
        "board of directors", "shareholder", "shares", "secured creditor", "company in liquidation",
        "company petition", "private ltd", "private limited", "com pcas", "compcas",
        "sections 397", "section 397", "section 398", "section 433", "liquidation"
    ],
    "Insolvency/Debt": [
        "provincial insolvency act", "insolvency", "insolvent", "unable to pay", "debt",
        "creditor", "debtor", "decree"
    ],
    "Constitutional/Writ": [
        "article 226", "article 227", "writ petition", "writ of mandamus",
        "writ of prohibition", "constitutional validity", "constitution"
    ],
    "Property/Land": [
        "land", "possession", "tenant", "premises", "lease", "mortgage", "property"
    ],
    "Criminal/Violent": [
        "murder", "rape", "assault", "weapon", "killed", "grievous hurt",
        "bodily injury", "victim"
    ],
    "General Civil": [
        "contract", "civil", "appeal", "dispute", "petition", "judgment", "order"
    ],
}

LEGAL_TO_MODEL_CATEGORY = {
    "Criminal/Violent": "Violent",
    "Insolvency/Debt": "Financial",
    "Excise/Tax": "Non-Violent",
    "Customs/Import-Export": "Non-Violent",
    "Company/Winding Up": "Non-Violent",
    "Constitutional/Writ": "Non-Violent",
    "Property/Land": "Property",
    "General Civil": "Non-Violent",
}

FEATURE_DEFAULTS = {
    "main_parties": "Unknown",
    "crime_type": "Non-Violent",
    "case_category": "General Civil",
    "severity": "No Injury",
    "vulnerability": "Low",
    "influence": "Low",
    "plain_summary": "Summary unavailable.",
}

def load_model():
    print(f"Loading model from {MODEL_PATH}...")
    with open(MODEL_PATH, 'rb') as f:
        return pickle.load(f)

def extract_text_from_pdf(pdf_path):
    """Extracts the first few pages of a PDF to avoid token limits while getting key facts."""
    text = ""
    try:
        if fitz:
            doc = fitz.open(pdf_path)
            # Usually, facts and parties are in the first few pages.
            for i in range(min(6, len(doc))):
                text += doc[i].get_text()
            doc.close()
        elif PdfReader:
            reader = PdfReader(pdf_path)
            for page in reader.pages[:6]:
                text += page.extract_text() or ""
        else:
            raise ImportError("Install PyMuPDF or pypdf to read PDF files.")
    except Exception as e:
        print(f"Error reading {pdf_path}: {e}")
    return text

def normalize_llm_data(raw_data):
    """Normalizes Gemma output so the local priority model receives known labels."""
    normalized = FEATURE_DEFAULTS.copy()
    if not isinstance(raw_data, dict):
        return normalized

    normalized.update({key: raw_data.get(key, normalized[key]) for key in normalized})

    for key, allowed_values in ALLOWED_FEATURES.items():
        value = str(normalized.get(key, "")).strip()
        match = next((allowed for allowed in allowed_values if allowed.lower() == value.lower()), None)
        normalized[key] = match or FEATURE_DEFAULTS[key]

    category = str(normalized.get("case_category", "")).strip()
    category_match = next(
        (allowed for allowed in ALLOWED_LEGAL_CATEGORIES if allowed.lower() == category.lower()),
        None
    )
    normalized["case_category"] = category_match or FEATURE_DEFAULTS["case_category"]

    main_parties = normalized.get("main_parties", "Unknown")
    if isinstance(main_parties, list):
        normalized["main_parties"] = ", ".join(str(party).strip() for party in main_parties if str(party).strip())
    else:
        normalized["main_parties"] = str(main_parties).strip() or "Unknown"

    normalized["plain_summary"] = str(normalized.get("plain_summary", "")).strip() or FEATURE_DEFAULTS["plain_summary"]
    return normalized

def parse_gemma_json(content):
    """Parses Gemma JSON, repairing common malformed response fragments when possible."""
    json_match = re.search(r'\{.*\}', content, re.DOTALL)
    json_text = json_match.group() if json_match else content
    json_text = json_text.strip()

    repair_attempts = [
        json_text,
        re.sub(r'\n\s*",\s*\n', '\n', json_text),
        re.sub(r':\s*"Non-Non-Violent"', ': "Non-Violent"', json_text),
    ]

    repaired = re.sub(r'\n\s*",\s*\n', '\n', json_text)
    repaired = re.sub(r':\s*"Non-Non-Violent"', ': "Non-Violent"', repaired)
    repair_attempts.append(repaired)

    last_error = None
    for attempt in repair_attempts:
        try:
            return json.loads(attempt)
        except json.JSONDecodeError as e:
            last_error = e

    raise last_error or ValueError("Gemma response did not contain valid JSON")

def classify_legal_category(text, features=None):
    """Classifies the legal domain with keyword scores tuned for Indian case PDFs."""
    features = features or {}
    combined = " ".join([
        text or "",
        str(features.get("main_parties", "")),
        str(features.get("plain_summary", "")),
    ]).lower()

    scores = {}
    for category, keywords in LEGAL_CATEGORIES.items():
        scores[category] = sum(combined.count(keyword) for keyword in keywords)

    # Prefer specific legal domains. "General Civil" is only a fallback because
    # words like petition/order/appeal appear in almost every judgment.
    if scores.get("Criminal/Violent", 0) >= 3:
        return "Criminal/Violent"

    if scores.get("Customs/Import-Export", 0) >= 10:
        return "Customs/Import-Export"

    if scores.get("Excise/Tax", 0) >= 2:
        return "Excise/Tax"

    if scores.get("Company/Winding Up", 0) >= 2:
        return "Company/Winding Up"

    if scores.get("Insolvency/Debt", 0) >= 2:
        return "Insolvency/Debt"

    if scores.get("Property/Land", 0) >= 3:
        return "Property/Land"

    if scores.get("Constitutional/Writ", 0) >= 2:
        return "Constitutional/Writ"

    return "General Civil"

def tune_case_features(features, text):
    """Tunes Gemma's extracted labels into consistent legal categories for the report and model."""
    tuned = normalize_llm_data(features)
    legal_category = classify_legal_category(text, tuned)
    tuned["case_category"] = legal_category
    tuned["crime_type"] = LEGAL_TO_MODEL_CATEGORY.get(legal_category, tuned.get("crime_type", "Non-Violent"))

    lower_text = text.lower()
    no_injury_legal_categories = {
        "Excise/Tax",
        "Customs/Import-Export",
        "Company/Winding Up",
        "Insolvency/Debt",
        "Constitutional/Writ",
        "General Civil",
    }
    if legal_category in no_injury_legal_categories:
        tuned["severity"] = "No Injury"
        if not any(term in lower_text for term in ["minor", "child", "widow", "elderly", "disabled", "worker", "labour", "tenant"]):
            tuned["vulnerability"] = "Low"

    influence_terms = [
        "union of india", "state of", "government", "collector", "assistant director",
        "assistant collector", "tribunal", "authority", "commissioner", "department"
    ]
    if any(term in lower_text or term in str(tuned.get("main_parties", "")).lower() for term in influence_terms):
        tuned["influence"] = "High"

    return tuned

def fallback_extract_features(text, pdf_file):
    """Creates a basic result when the LLM is unavailable so Excel output is never empty."""
    lowered = text.lower()
    filename_parties = os.path.splitext(pdf_file)[0].replace("_", " ")
    main_parties = re.sub(r"\s+on\s+\d+.*$", "", filename_parties, flags=re.IGNORECASE).strip()

    violent_terms = ["murder", "assault", "attack", "killed", "death", "injury", "weapon", "violence"]
    financial_terms = ["debt", "fraud", "bank", "money", "financial", "insolvency"]
    property_terms = ["property", "land", "tenant", "possession", "estate", "premises"]
    fatal_terms = ["murder", "death", "killed", "fatal"]
    major_terms = ["serious injury", "grievous", "hospital", "major"]
    vulnerable_terms = ["minor", "child", "widow", "elderly", "disabled", "worker", "labour", "poor", "tenant"]
    influence_terms = ["union of india", "state of", "government", "collector", "assistant director", "authority", "commissioner", "limited", "ltd"]

    legal_category = classify_legal_category(text, {"main_parties": main_parties})

    if legal_category in LEGAL_TO_MODEL_CATEGORY:
        crime_type = LEGAL_TO_MODEL_CATEGORY[legal_category]
    elif any(term in lowered for term in violent_terms):
        crime_type = "Violent"
    elif any(term in lowered for term in financial_terms):
        crime_type = "Financial"
    elif any(term in lowered for term in property_terms):
        crime_type = "Property"
    else:
        crime_type = "Non-Violent"

    if any(term in lowered for term in fatal_terms):
        severity = "Fatal"
    elif any(term in lowered for term in major_terms):
        severity = "Major"
    elif "injury" in lowered or "harm" in lowered:
        severity = "Minor"
    else:
        severity = "No Injury"

    vulnerability = "High" if any(term in lowered for term in vulnerable_terms) else "Low"
    influence = "High" if any(term in lowered or term in main_parties.lower() for term in influence_terms) else "Low"

    return normalize_llm_data({
        "main_parties": main_parties or "Unknown",
        "crime_type": crime_type,
        "case_category": legal_category,
        "severity": severity,
        "vulnerability": vulnerability,
        "influence": influence,
        "plain_summary": (
            f"{main_parties or 'The parties'} are involved in this legal dispute. "
            f"The document appears to concern a {crime_type.lower()} matter with {severity.lower()} severity. "
            "This summary was generated locally because the Gemma API response was unavailable."
        ),
    })

def call_gemma_api(text):
    """Calls the Gemma LLM to extract structured features and a narrative summary."""
    if requests is None:
        print("LLM API Error: requests package is not installed.")
        return None

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    prompt = f"""
    You are extracting facts for a court case triage pipeline.
    Analyze the following legal text and return ONLY valid JSON.
    
    Legal Text:
    {text[:12000]}
    
    Return this exact JSON shape:
    {{
      "main_parties": "comma-separated names of people, companies, government bodies, or courts",
      "case_category": "Excise/Tax | Customs/Import-Export | Company/Winding Up | Insolvency/Debt | Constitutional/Writ | Property/Land | Criminal/Violent | General Civil",
      "crime_type": "Violent | Financial | Property | Non-Violent",
      "severity": "Fatal | Major | Minor | No Injury",
      "vulnerability": "High | Medium | Low",
      "influence": "High | Low",
      "plain_summary": "exactly 3 short sentences in simple language, naming the main parties"
    }}
    
    Rules:
    - Do not include priority, urgency, ranking, or recommendation fields.
    - Use only the allowed label values shown above.
    - For Central Excise Act, excise duty, tariff, refund, assessable value, pre-deposit, or tax assessment cases, use case_category "Excise/Tax", crime_type "Non-Violent", and severity "No Injury".
    - For DRI, customs, import, export, licence, seizure of imported goods, or customs notification cases, use case_category "Customs/Import-Export", crime_type "Non-Violent", and severity "No Injury".
    - For Companies Act, winding up, liquidation, shareholders, directors, or company management disputes, use case_category "Company/Winding Up", crime_type "Non-Violent", and severity "No Injury".
    - For insolvency, unpaid debt, creditor, debtor, or adjudication as insolvent, use case_category "Insolvency/Debt" and crime_type "Financial".
    - If the document is a civil/tax/company/government dispute without physical injury, use crime_type "Non-Violent" and severity "No Injury".
    - Mark influence as "High" when a government department, large company, public authority, or institution is a major party.
    - Mark vulnerability as "High" only when the text clearly involves minors, poor/disabled/elderly people, workers, tenants, victims of violence, or another vulnerable group.
    """
    
    payload = {
        "model": GEMMA_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0,
        "max_tokens": 900
    }

    try:
        response = requests.post(API_URL, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"].strip()
        return normalize_llm_data(parse_gemma_json(content))
    except Exception as e:
        print(f"LLM API Error with {GEMMA_MODEL}: {e}")
        if "response" in locals() and getattr(response, "text", ""):
            print(f"LLM API response: {response.text[:500]}")

    return None

def get_constitutional_justification(features, priority):
    """Provides a rule-based constitutional and legal justification for the model priority."""
    category = features.get("case_category", "General Civil")
    broad_category = features.get("crime_type", "Non-Violent")
    severity = features.get("severity", "No Injury")
    vulnerability = features.get("vulnerability", "Low")
    influence = features.get("influence", "Low")

    reasons = []
    constitutional_basis = []
    legal_rules = []

    if broad_category == "Violent" or severity in ["Fatal", "Major"]:
        reasons.append(f"the case is marked as {broad_category} with {severity} severity")
        constitutional_basis.append("Article 21 protects life, personal liberty, and the right to a speedy trial")
        legal_rules.append("violent matters, fatal harm, or major injury require urgent listing because delay can endanger life, evidence, and witness safety")

    if vulnerability == "High":
        reasons.append("a vulnerable party is involved")
        constitutional_basis.append("Articles 14 and 15 support equal protection and special care for vulnerable groups")
        legal_rules.append("cases involving vulnerable persons are moved up to prevent unequal access to justice")

    if influence == "High":
        reasons.append("there is a power imbalance because a government body, public authority, or large institution is involved")
        constitutional_basis.append("Article 14 requires equality before law and equal protection of laws")
        legal_rules.append("power imbalance cases receive at least medium attention so institutional influence does not defeat fair hearing")

    category_basis = {
        "Excise/Tax": (
            "Article 14 and Article 265",
            "tax and excise disputes must be handled by lawful authority, non-arbitrarily, and only according to valid law"
        ),
        "Customs/Import-Export": (
            "Article 14, Article 19(1)(g), and Article 300A",
            "customs seizures and import-export restrictions affect business activity and property, so legality and procedural fairness matter"
        ),
        "Company/Winding Up": (
            "Article 14 and Article 300A",
            "company, shareholder, creditor, and liquidation disputes affect property and commercial rights but usually do not outrank life or liberty matters"
        ),
        "Insolvency/Debt": (
            "Article 14 and Article 300A",
            "insolvency and debt cases affect property, livelihood, and creditor-debtor fairness, but are usually lower than urgent life and liberty matters"
        ),
        "Property/Land": (
            "Article 300A",
            "property rights deserve lawful protection, especially where possession or livelihood is affected"
        ),
        "Constitutional/Writ": (
            "Article 226/227 read with Article 14",
            "writ matters require review of legality, jurisdiction, and fairness of state action"
        ),
        "General Civil": (
            "Article 14 and the Article 21 speedy-trial principle",
            "ordinary civil disputes should be processed fairly in queue unless risk factors justify acceleration"
        ),
        "Criminal/Violent": (
            "Article 21",
            "violent/criminal matters receive urgent attention because they directly implicate life, liberty, and safety"
        ),
    }

    category_articles, category_rule = category_basis.get(category, category_basis["General Civil"])
    constitutional_basis.append(category_articles)
    legal_rules.append(category_rule)

    if not reasons:
        reasons.append(f"the case is categorized as {category} with {severity} severity, {vulnerability} vulnerability, and {influence} influence")

    if priority == "High":
        priority_reason = "High priority is justified because the extracted factors show an immediate rights risk or serious prejudice if hearing is delayed."
    elif priority == "Medium":
        priority_reason = "Medium priority is justified because the case has meaningful legal impact or power imbalance, but no direct fatal/major physical harm is detected."
    else:
        priority_reason = "Low priority is justified because no urgent life, liberty, vulnerability, or serious harm factor is detected, so regular queue treatment is appropriate."

    unique_basis = []
    for item in constitutional_basis:
        if item not in unique_basis:
            unique_basis.append(item)

    unique_rules = []
    for item in legal_rules:
        if item not in unique_rules:
            unique_rules.append(item)

    return (
        f"{priority_reason} Key factors: {', '.join(reasons)}. "
        f"Constitutional basis: {'; '.join(unique_basis)}. "
        f"Rules applied: {'; '.join(unique_rules)}."
    )

def get_priority_rules_applied(features, priority):
    """Returns the compact rule trace used to explain the model's priority."""
    return (
        f"Priority={priority}; "
        f"Category={features.get('case_category', 'General Civil')}; "
        f"Broad_Model_Category={features.get('crime_type', 'Non-Violent')}; "
        f"Severity={features.get('severity', 'No Injury')}; "
        f"Vulnerability={features.get('vulnerability', 'Low')}; "
        f"Influence={features.get('influence', 'Low')}"
    )

def safe_transform_encoder(encoders, key, value, default=0):
    """Safely transforms a categorical value with a saved LabelEncoder."""
    encoder = encoders.get(key)
    if encoder is None:
        return default
    if value in encoder.classes_:
        return encoder.transform([value])[0]
    return default

def build_model_input(model_data, features, text_description):
    """Builds the exact feature frame expected by the saved Decision Tree."""
    tfidf = model_data['tfidf']
    encoders = model_data['encoders']

    structured_values = {}
    if 'category' in encoders:
        structured_values['case_category_enc'] = safe_transform_encoder(
            encoders, 'category', features.get('case_category', 'General Civil')
        )
    structured_values.update({
        'crime_type_enc': safe_transform_encoder(encoders, 'crime', features.get('crime_type', 'Non-Violent')),
        'severity_enc': safe_transform_encoder(encoders, 'severity', features.get('severity', 'No Injury')),
        'vulnerability_enc': safe_transform_encoder(encoders, 'vulnerability', features.get('vulnerability', 'Low')),
        'influence_enc': safe_transform_encoder(encoders, 'influence', features.get('influence', 'Low')),
    })

    text_feat = tfidf.transform([text_description]).toarray()
    text_df = pd.DataFrame(text_feat, columns=tfidf.get_feature_names_out())

    structured_data = pd.DataFrame([structured_values])
    X = pd.concat([structured_data, text_df], axis=1)

    feature_names = model_data.get('feature_names')
    if feature_names:
        for column in feature_names:
            if column not in X.columns:
                X[column] = 0
        X = X[feature_names]

    return X

def predict_priority(model_data, features, text_description):
    """Uses only the local Decision Tree model to predict case priority."""
    clf = model_data['model']
    encoders = model_data['encoders']
    X = build_model_input(model_data, features, text_description)

    pred_idx = clf.predict(X)[0]
    return encoders['priority'].inverse_transform([pred_idx])[0]

def make_safe_filename(name):
    """Creates a filesystem-safe base name for generated graph files."""
    cleaned = re.sub(r'[^A-Za-z0-9_.-]+', '_', name)
    return cleaned[:120].strip('_') or 'case'

def describe_feature_value(model_data, feature_name, value):
    """Returns a readable value for encoded categorical tree features."""
    encoder_keys = {
        'case_category_enc': 'category',
        'crime_type_enc': 'crime',
        'severity_enc': 'severity',
        'vulnerability_enc': 'vulnerability',
        'influence_enc': 'influence',
    }
    encoder_key = encoder_keys.get(feature_name)
    encoder = model_data.get('encoders', {}).get(encoder_key)
    if encoder is not None:
        encoded_value = int(round(value))
        if 0 <= encoded_value < len(encoder.classes_):
            return f"{encoded_value} ({encoder.classes_[encoded_value]})"
    return f"{value:.4f}"

def display_feature_name(feature_name):
    """Turns model feature names into user-facing labels."""
    labels = {
        'case_category_enc': 'Legal category',
        'crime_type_enc': 'Broad case type',
        'severity_enc': 'Severity',
        'vulnerability_enc': 'Vulnerability',
        'influence_enc': 'Influence / power imbalance',
    }
    return labels.get(feature_name, feature_name.replace('_', ' ').title())

def describe_condition(model_data, feature_name, value, threshold):
    """Builds a readable explanation for a tree condition."""
    encoder_keys = {
        'case_category_enc': 'category',
        'crime_type_enc': 'crime',
        'severity_enc': 'severity',
        'vulnerability_enc': 'vulnerability',
        'influence_enc': 'influence',
    }
    encoder = model_data.get('encoders', {}).get(encoder_keys.get(feature_name))
    went_left = value <= threshold

    if encoder is not None:
        left_values = [
            str(label)
            for index, label in enumerate(encoder.classes_)
            if index <= threshold
        ]
        case_index = int(round(value))
        case_value = str(encoder.classes_[case_index]) if 0 <= case_index < len(encoder.classes_) else str(case_index)
        condition = f"{display_feature_name(feature_name)} is one of: {', '.join(left_values)}"
        result = "Yes" if went_left else "No"
        direction = "left" if went_left else "right"
        return condition, case_value, result, direction

    clean_name = display_feature_name(feature_name)
    condition = f"{clean_name} score <= {threshold:.4f}"
    case_value = f"{value:.4f}"
    result = "Yes" if went_left else "No"
    direction = "left" if went_left else "right"
    return condition, case_value, result, direction

def markdown_escape(text):
    """Escapes text for Markdown table cells."""
    return str(text).replace('|', '\\|').replace('\n', ' ').strip()

def mermaid_escape(text):
    """Escapes text for Mermaid node labels."""
    return str(text).replace('"', "'").replace('\n', '<br/>')

def priority_theme(priority):
    """Returns colors for a priority label."""
    themes = {
        'High': {
            'accent': '#DC2626',
            'soft': '#FEF2F2',
            'text': '#7F1D1D',
            'leaf': '#FEE2E2',
        },
        'Medium': {
            'accent': '#D97706',
            'soft': '#FFFBEB',
            'text': '#78350F',
            'leaf': '#FEF3C7',
        },
        'Low': {
            'accent': '#059669',
            'soft': '#ECFDF5',
            'text': '#064E3B',
            'leaf': '#D1FAE5',
        },
    }
    return themes.get(priority, themes['Medium'])

def build_decision_path_graph(model_data, features, text_description, pdf_file, priority):
    """Creates visual Decision Tree path reports for one case."""
    clf = model_data['model']
    X = build_model_input(model_data, features, text_description)
    feature_names = model_data.get('feature_names', list(X.columns))
    class_names = list(model_data['encoders']['priority'].classes_)

    os.makedirs(DECISION_GRAPH_DIR, exist_ok=True)
    safe_name = make_safe_filename(os.path.splitext(pdf_file)[0])
    dot_path = os.path.join(DECISION_GRAPH_DIR, f"{safe_name}_decision_path.dot")
    md_path = os.path.join(DECISION_GRAPH_DIR, f"{safe_name}_decision_report.md")

    node_indicator = clf.decision_path(X)
    leaf_id = clf.apply(X)[0]
    path_node_ids = node_indicator.indices[
        node_indicator.indptr[0]:node_indicator.indptr[1]
    ]

    trace_parts = []
    report_steps = []
    dot_lines = [
        'digraph DecisionPath {',
        '  rankdir=TB;',
        '  node [shape=box, style="rounded,filled", fillcolor="#F7FBFF", color="#4B5563", fontname="Arial"];',
        '  edge [color="#6B7280", fontname="Arial"];',
    ]

    previous_node = None
    for order, node_id in enumerate(path_node_ids):
        if node_id == leaf_id:
            class_counts = clf.tree_.value[node_id][0]
            predicted_index = int(np.argmax(class_counts))
            predicted_label = class_names[predicted_index]
            label = f"Leaf node {node_id}\\nPredicted priority: {predicted_label}\\nSamples: {int(sum(class_counts))}"
            trace_parts.append(f"Leaf node {node_id} => Predicted Priority = {predicted_label}")
            report_steps.append({
                'node_id': node_id,
                'type': 'leaf',
                'title': f"Final Priority: {predicted_label}",
                'condition': 'The case reached this Decision Tree leaf.',
                'case_value': f"{int(sum(class_counts))} training samples reached this leaf",
                'result': predicted_label,
                'direction': 'final',
            })
        else:
            feature_index = clf.tree_.feature[node_id]
            threshold = clf.tree_.threshold[node_id]
            feature_name = feature_names[feature_index]
            value = float(X.iloc[0, feature_index])
            readable_value = describe_feature_value(model_data, feature_name, value)
            condition, case_value, result, direction = describe_condition(model_data, feature_name, value, threshold)
            went_left = value <= threshold
            operator = "<=" if went_left else ">"
            label = f"Node {node_id}\\n{condition}\\nCase value: {readable_value}\\nDecision: {result}"
            trace_parts.append(f"Node {node_id}: {condition}; case value = {case_value}; result = {result}")
            report_steps.append({
                'node_id': node_id,
                'type': 'decision',
                'title': f"Step {len(report_steps) + 1}: {display_feature_name(feature_name)}",
                'condition': condition,
                'case_value': case_value,
                'result': result,
                'direction': direction,
            })

        dot_lines.append(f'  n{node_id} [label="{label}"];')
        if previous_node is not None:
            dot_lines.append(f'  n{previous_node} -> n{node_id} [label="step {order}"];')
        previous_node = node_id

    dot_lines.append('}')

    with open(dot_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(dot_lines))

    write_decision_markdown_report(
        md_path=md_path,
        pdf_file=pdf_file,
        features=features,
        priority=priority,
        report_steps=report_steps,
        trace=" -> ".join(trace_parts),
        dot_path=dot_path,
    )

    trace = " -> ".join(trace_parts)
    return md_path, trace

def write_decision_markdown_report(md_path, pdf_file, features, priority, report_steps, trace, dot_path):
    """Writes a polished Markdown decision report with Mermaid and HTML timeline."""
    theme = priority_theme(priority)
    mermaid_lines = [
        "```mermaid",
        "%%{init: {'theme': 'base', 'themeVariables': {'fontFamily': 'Inter, Arial', 'primaryColor': '#F8FAFC', 'primaryTextColor': '#0F172A', 'primaryBorderColor': '#64748B', 'lineColor': '#64748B'}} }%%",
        "flowchart TD",
    ]

    for index, step in enumerate(report_steps):
        node_name = f"N{index}"
        if step['type'] == 'leaf':
            label = f"{step['title']}<br/>{step['case_value']}"
            mermaid_lines.append(f'  {node_name}["{mermaid_escape(label)}"]:::leaf')
        else:
            label = (
                f"{step['title']}<br/>"
                f"{step['condition']}<br/>"
                f"Case: {step['case_value']}<br/>"
                f"Answer: {step['result']}"
            )
            mermaid_lines.append(f'  {node_name}["{mermaid_escape(label)}"]:::decision')

        if index > 0:
            mermaid_lines.append(f"  N{index - 1} --> N{index}")

    mermaid_lines.extend([
        f"  classDef decision fill:#EFF6FF,stroke:#2563EB,stroke-width:2px,color:#0F172A;",
        f"  classDef leaf fill:{theme['leaf']},stroke:{theme['accent']},stroke-width:3px,color:{theme['text']};",
        "```",
    ])

    timeline_cards = []
    for index, step in enumerate(report_steps, start=1):
        timeline_cards.append(
            f"""
<div class="step-card">
  <div class="step-index">{index}</div>
  <div class="step-body">
    <div class="step-title">{markdown_escape(step['title'])}</div>
    <div class="step-condition">{markdown_escape(step['condition'])}</div>
    <div class="step-meta">Case value: <strong>{markdown_escape(step['case_value'])}</strong> | Result: <strong>{markdown_escape(step['result'])}</strong></div>
  </div>
</div>""".strip()
        )

    md = f"""# Decision Tree Priority Report

<style>
.decision-hero {{
  border: 1px solid #CBD5E1;
  border-left: 8px solid {theme['accent']};
  background: linear-gradient(135deg, {theme['soft']}, #FFFFFF);
  border-radius: 14px;
  padding: 18px 20px;
  margin: 12px 0 18px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.10);
}}
.priority-badge {{
  display: inline-block;
  padding: 6px 12px;
  border-radius: 999px;
  background: {theme['accent']};
  color: white;
  font-weight: 700;
  letter-spacing: 0.02em;
}}
.metric-grid {{
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin-top: 14px;
}}
.metric {{
  background: rgba(255,255,255,0.78);
  border: 1px solid #E2E8F0;
  border-radius: 10px;
  padding: 10px 12px;
}}
.metric span {{
  display: block;
  color: #64748B;
  font-size: 12px;
}}
.metric strong {{
  color: #0F172A;
}}
.timeline {{
  position: relative;
  margin: 20px 0;
}}
.step-card {{
  display: flex;
  gap: 12px;
  align-items: stretch;
  border: 1px solid #DBEAFE;
  border-radius: 14px;
  background: #FFFFFF;
  padding: 12px;
  margin: 12px 0;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.09);
  animation: slideIn 480ms ease both;
}}
.step-card:nth-child(2) {{ animation-delay: 80ms; }}
.step-card:nth-child(3) {{ animation-delay: 160ms; }}
.step-card:nth-child(4) {{ animation-delay: 240ms; }}
.step-card:nth-child(5) {{ animation-delay: 320ms; }}
.step-index {{
  width: 34px;
  min-width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: {theme['accent']};
  color: #FFFFFF;
  font-weight: 800;
}}
.step-title {{
  font-weight: 800;
  color: #0F172A;
  margin-bottom: 4px;
}}
.step-condition {{
  color: #334155;
  margin-bottom: 4px;
}}
.step-meta {{
  color: #475569;
  font-size: 13px;
}}
@keyframes slideIn {{
  from {{ transform: translateY(12px); opacity: 0; }}
  to {{ transform: translateY(0); opacity: 1; }}
}}
</style>

<div class="decision-hero">
  <div class="priority-badge">{priority} Priority</div>
  <h2>{markdown_escape(pdf_file)}</h2>
  <p>{markdown_escape(features.get('plain_summary', 'Summary unavailable.'))}</p>
  <div class="metric-grid">
    <div class="metric"><span>Legal Category</span><strong>{markdown_escape(features.get('case_category', 'N/A'))}</strong></div>
    <div class="metric"><span>Model Category</span><strong>{markdown_escape(features.get('crime_type', 'N/A'))}</strong></div>
    <div class="metric"><span>Severity</span><strong>{markdown_escape(features.get('severity', 'N/A'))}</strong></div>
    <div class="metric"><span>Vulnerability</span><strong>{markdown_escape(features.get('vulnerability', 'N/A'))}</strong></div>
    <div class="metric"><span>Influence</span><strong>{markdown_escape(features.get('influence', 'N/A'))}</strong></div>
  </div>
</div>

## Flow View

{chr(10).join(mermaid_lines)}

## Animated Step View

<div class="timeline">
{chr(10).join(timeline_cards)}
</div>

## Decision Trace

{markdown_escape(trace)}

## Raw Graph

Raw DOT file: `{markdown_escape(dot_path)}`
"""

    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(md)

def main():
    try:
        model_data = load_model()
    except Exception as e:
        print(f"Error loading model: {e}")
        return

    pdf_files = [f for f in os.listdir(DATA_DIR) if f.lower().endswith('.pdf')]
    print(f"Processing {len(pdf_files)} files using Gemma LLM and Decision Tree...")
    
    results = []
    
    for pdf_file in tqdm(pdf_files):
        try:
            pdf_path = os.path.join(DATA_DIR, pdf_file)
            text = extract_text_from_pdf(pdf_path)
            
            # 1. Extract high-quality features and summary using Gemma LLM.
            llm_data = call_gemma_api(text)

            if not llm_data:
                print(f"Using local fallback extraction for {pdf_file}.")
                llm_data = fallback_extract_features(text, pdf_file)

            llm_data = tune_case_features(llm_data, text)
                
            # 2. Predict priority using the LOCAL model only. Gemma does not assign priority.
            model_text = f"{llm_data.get('plain_summary', '')} {llm_data.get('main_parties', '')}"
            priority = predict_priority(model_data, llm_data, model_text)
            decision_graph_path, decision_path = build_decision_path_graph(
                model_data, llm_data, model_text, pdf_file, priority
            )
            
            # 3. Get justification
            justification = get_constitutional_justification(llm_data, priority)
            rules_applied = get_priority_rules_applied(llm_data, priority)
            
            results.append({
                'Case_File': pdf_file,
                'Main_Parties': llm_data.get('main_parties', 'Unknown'),
                'Plain_Language_Summary': llm_data.get('plain_summary', 'N/A'),
                'Constitutional_Justification': justification,
                'Priority_Rules_Applied': rules_applied,
                'Decision_Report': decision_graph_path,
                'Decision_Path': decision_path,
                'Predicted_Priority': priority,
                'Category': llm_data.get('case_category', 'N/A'),
                'Broad_Model_Category': llm_data.get('crime_type', 'N/A'),
                'Severity': llm_data.get('severity', 'N/A'),
                'Vulnerability': llm_data.get('vulnerability', 'N/A'),
                'Influence': llm_data.get('influence', 'N/A')
            })
        except Exception as e:
            print(f"Error processing {pdf_file}: {e}")
        
    df = pd.DataFrame(results)
    df.to_excel(OUTPUT_EXCEL, index=False)
    print(f"\nFinal prioritized list saved to {OUTPUT_EXCEL}")
    print(df[['Main_Parties', 'Predicted_Priority']].to_string())

if __name__ == "__main__":
    main()
