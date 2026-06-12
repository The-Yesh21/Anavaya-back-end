import pandas as pd
import numpy as np
import random

def generate_synthetic_data(n_samples=500):
    data = []
    
    crime_types = ['Violent', 'Non-Violent', 'Financial', 'Property', 'Cyber']
    severities = ['No Injury', 'Minor', 'Major', 'Fatal']
    vulnerabilities = ['Low', 'Medium', 'High']
    influences = ['Low', 'High']
    
    violent_keywords = ['attacked', 'killed', 'murder', 'rape', 'assault', 'weapon', 'threat', 'blood', 'injury']
    non_violent_keywords = ['theft', 'fraud', 'contract', 'dispute', 'debt', 'insolvency', 'tax', 'land']
    
    for i in range(n_samples):
        case_id = f"CASE_{i:04d}"
        
        # Decide if it's high priority based on some logic to make it learnable
        is_violent = random.random() < 0.4
        has_vulnerable_victim = random.random() < 0.3
        high_influence_accused = random.random() < 0.2
        
        if is_violent:
            crime_type = 'Violent'
            severity = random.choice(['Major', 'Fatal'])
            num_keywords = random.randint(3, 4)
            keywords = random.sample(violent_keywords, k=num_keywords)
            text = f"The accused {keywords[0]} the victim with a {random.choice(['knife', 'gun', 'stick'])}. The victim was {keywords[1]} and suffered {severity.lower()} injuries. There was a {keywords[2]} during the incident."
        else:
            crime_type = random.choice(['Non-Violent', 'Financial', 'Property', 'Cyber'])
            severity = random.choice(['No Injury', 'Minor'])
            num_keywords = random.randint(3, 4)
            keywords = random.sample(non_violent_keywords, k=num_keywords)
            text = f"A case of {crime_type.lower()} has been reported. The dispute is over a {keywords[0]} involving {keywords[1]}. No physical harm was reported, but it involves {keywords[2]} issues."
        
        vulnerability = 'High' if has_vulnerable_victim else random.choice(['Low', 'Medium'])
        influence = 'High' if high_influence_accused else 'Low'
        
        # Priority Logic (Ground Truth)
        if crime_type == 'Violent' and (severity == 'Fatal' or vulnerability == 'High'):
            priority = 'High'
        elif crime_type == 'Violent' or influence == 'High' or vulnerability == 'High':
            priority = 'Medium'
        else:
            priority = 'Low'
            
        data.append({
            'case_id': case_id,
            'description': text,
            'crime_type': crime_type,
            'severity': severity,
            'vulnerability': vulnerability,
            'influence': influence,
            'priority': priority
        })
        
    return pd.DataFrame(data)

if __name__ == "__main__":
    df = generate_synthetic_data(1000)
    df.to_csv('case_priority_system/data/synthetic_cases.csv', index=False)
    print(f"Generated {len(df)} synthetic cases.")
    print(df['priority'].value_counts())
