import pickle
import pandas as pd
import numpy as np

def predict_priority(description, crime_type, severity, vulnerability, influence):
    # Load model and artifacts
    with open('case_priority_system/models/priority_classifier.pkl', 'rb') as f:
        data = pickle.load(f)
    
    clf = data['model']
    tfidf = data['tfidf']
    encoders = data['encoders']
    feature_names = data['feature_names']
    
    # Preprocess inputs
    crime_enc = encoders['crime'].transform([crime_type])[0]
    sev_enc = encoders['severity'].transform([severity])[0]
    vul_enc = encoders['vulnerability'].transform([vulnerability])[0]
    inf_enc = encoders['influence'].transform([influence])[0]
    
    # NLP Features
    text_feat = tfidf.transform([description]).toarray()
    text_df = pd.DataFrame(text_feat, columns=tfidf.get_feature_names_out())
    
    # Combine
    structured_data = pd.DataFrame([[crime_enc, sev_enc, vul_enc, inf_enc]], 
                                   columns=['crime_type_enc', 'severity_enc', 'vulnerability_enc', 'influence_enc'])
    X = pd.concat([structured_data, text_df], axis=1)
    
    # Predict
    pred_idx = clf.predict(X)[0]
    priority = encoders['priority'].inverse_transform([pred_idx])[0]
    
    # Get Decision Path (Explanation)
    node_indicator = clf.decision_path(X)
    leaf_id = clf.apply(X)[0]
    
    # For simplicity, just return the priority and class
    return priority

if __name__ == "__main__":
    # Example 1: High Priority Case
    desc1 = "The accused attacked the victim with a knife. The victim was killed and suffered fatal injuries. There was a murder during the incident."
    p1 = predict_priority(desc1, "Violent", "Fatal", "High", "Low")
    print(f"Case 1 Priority: {p1}")
    
    # Example 2: Low Priority Case
    desc2 = "A case of financial dispute has been reported. The dispute is over a contract involving debt. No physical harm was reported."
    p2 = predict_priority(desc2, "Financial", "No Injury", "Low", "Low")
    print(f"Case 2 Priority: {p2}")
