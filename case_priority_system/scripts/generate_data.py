import pandas as pd
import numpy as np
import random

def generate_synthetic_data(n_samples=1000):
    data = []
    
    crime_types = ['Violent', 'Non-Violent', 'Financial', 'Property', 'Cyber']
    severities = ['No Injury', 'Minor', 'Major', 'Fatal']
    vulnerabilities = ['Low', 'Medium', 'High']
    influences = ['Low', 'High']
    
    # Expanded keyword pools for richer training data (flat lists)
    violent_keywords = [
        'attacked', 'assaulted', 'killed', 'murdered', 'slain',
        'murder', 'homicide', 'rape', 'sexual assault', 'molested',
        'assault', 'battered', 'weapon', 'deadly weapon', 'firearm',
        'threat', 'threatened', 'blood', 'bleeding',
        'injury', 'injured', 'wounded', 'stabbed', 'stabbing',
        'kidnapped', 'abducted', 'robbed', 'dacoity',
        'beaten', 'strangled', 'choked', 'shot', 'gunshot',
        'fired upon', 'violence', 'violent', 'fatal', 'deadly',
    ]
    non_violent_keywords = [
        'theft', 'stolen', 'misappropriated', 'fraud', 'cheating',
        'deception', 'contract', 'agreement', 'breach',
        'dispute', 'disagreement', 'controversy',
        'debt', 'loan', 'borrowing', 'insolvency', 'bankruptcy',
        'liquidation', 'tax', 'excise', 'gst', 'duty',
        'land', 'property', 'premises', 'estate',
        'eviction', 'possession', 'tenancy',
        'seizure', 'confiscation', 'attachment',
        'refund', 'rebate', 'drawback',
        'winding up', 'dissolution',
    ]
    
    for i in range(n_samples):
        case_id = f"CASE_{i:04d}"
        
        is_violent = random.random() < 0.3
        has_vulnerable_victim = random.random() < 0.3
        high_influence_accused = random.random() < 0.25
        is_sexual = random.random() < 0.08
        
        if is_sexual:
            crime_type = 'Violent'
            severity = 'Major'
            vulnerability = 'High'
            influence = random.choice(['Low', 'High'])
            text = random.choice([
                "The accused committed sexual assault on the victim. The victim was raped and suffered severe mental trauma. A case under relevant criminal provisions was registered.",
                "A case of sexual harassment and molestation was reported. The accused assaulted the victim in a vulnerable situation. The victim requires protection and urgent hearing.",
                "The victim was subjected to sexual abuse and exploitation. The accused used force and intimidation. The matter involves grave violation of personal dignity and safety.",
                "A minor child was sexually abused by the accused. The child victim is traumatized and requires immediate judicial intervention. Constitutional rights against exploitation are attracted.",
            ])
        elif is_violent:
            crime_type = 'Violent'
            severity = random.choice(['Major', 'Fatal'])
            vulnerability = 'High' if has_vulnerable_victim else random.choice(['Low', 'Medium'])
            influence = 'High' if high_influence_accused else 'Low'
            
            num_kw = random.randint(3, 5)
            kws = random.sample(violent_keywords, k=min(num_kw, len(violent_keywords)))
            weapon = random.choice(['knife', 'gun', 'stick', 'iron rod', 'sharp object', 'fists and kicks'])
            
            text = (
                f"The accused {kws[0]} the victim with a {weapon}. "
                f"The victim was {kws[1] if len(kws) > 1 else 'attacked'} and suffered {severity.lower()} injuries. "
                f"There was a {kws[2] if len(kws) > 2 else 'violent'} incident reported to the police. "
                f"A criminal case was registered and investigation is ongoing."
            )
        else:
            # Distribute across legal categories for richer training
            category_choice = random.random()
            if category_choice < 0.2:
                crime_type = 'Financial'
                severity = random.choice(['No Injury', 'Minor'])
                kws = random.sample(non_violent_keywords, k=min(3, len(non_violent_keywords)))
                text = (
                    f"A case of {crime_type.lower()} dispute has been reported. "
                    f"The matter involves {kws[0]} and {kws[1]}. "
                    f"No physical harm was reported, but it involves "
                    f"{kws[2] if len(kws) > 2 else 'financial'} issues requiring legal resolution."
                )
            elif category_choice < 0.4:
                crime_type = 'Property'
                severity = random.choice(['No Injury', 'Minor'])
                kws = random.sample(non_violent_keywords, k=min(3, len(non_violent_keywords)))
                text = (
                    f"A property dispute concerning {kws[0]} and {kws[1]}. "
                    f"The parties claim ownership and possession of the premises. "
                    f"{kws[2] if len(kws) > 2 else 'Legal title'} is in question and court intervention sought."
                )
            else:
                crime_type = random.choice(['Non-Violent', 'Non-Violent', 'Financial', 'Property'])
                severity = random.choice(['No Injury', 'No Injury', 'No Injury', 'Minor'])
                kws = random.sample(non_violent_keywords, k=min(4, len(non_violent_keywords)))
                text = (
                    f"A case of {crime_type.lower()} has been filed. "
                    f"The dispute is over {kws[0]} involving {kws[1]}. "
                    f"No physical harm was reported. The matter involves "
                    f"{kws[2]} and {kws[3] if len(kws) > 3 else 'legal'} issues."
                )
            
            vulnerability = 'High' if has_vulnerable_victim else random.choice(['Low', 'Medium'])
            influence = 'High' if high_influence_accused else 'Low'
        
        # Priority Logic (Ground Truth) - expanded rules
        is_sexual_assault = any(kw in text.lower() for kw in ['rape', 'sexual assault', 'molest', 'sexual abuse', 'sexual harassment'])
        is_fatal_crime = any(kw in text.lower() for kw in ['killed', 'murder', 'homicide', 'death', 'fatal', 'slain', 'strangled'])

        if is_sexual_assault:
            priority = 'High'
        elif is_fatal_crime or (crime_type == 'Violent' and severity == 'Fatal'):
            priority = 'High'
        elif crime_type == 'Violent' and (severity == 'Major' or vulnerability == 'High'):
            priority = 'High'
        elif crime_type == 'Violent' or influence == 'High' or vulnerability == 'High':
            priority = 'Medium'
        elif severity in ['Major', 'Minor']:
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
    df = generate_synthetic_data(1500)
    df.to_csv('case_priority_system/data/synthetic_cases.csv', index=False)
    print(f"Generated {len(df)} synthetic cases.")
    print(df['priority'].value_counts())
