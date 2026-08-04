"""
Update all cases in case_results.xlsx with enhanced constitutional analysis.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

import pandas as pd
from constitutional_analysis import get_comprehensive_constitutional_analysis

EXCEL_PATH = 'case_priority_system/case_results.xlsx'

def main():
    df = pd.read_excel(EXCEL_PATH)
    print(f"Loaded {len(df)} cases")

    new_cols = [
        'Constitutional_Rights_Engaged', 'State_Duty_Analysis',
        'Applicable_Doctrines', 'Rights_Balancing_Analysis'
    ]
    for col in new_cols:
        if col not in df.columns:
            df[col] = ''

    updated_count = 0
    for idx, row in df.iterrows():
        existing = str(row.get('State_Duty_Analysis', ''))
        if existing and len(existing) > 50:
            continue

        features = {
            'case_category': str(row.get('Category', 'General Civil')),
            'crime_type': str(row.get('Broad_Model_Category', 'Non-Violent')),
            'severity': str(row.get('Severity', 'No Injury')),
            'vulnerability': str(row.get('Vulnerability', 'Low')),
            'influence': str(row.get('Influence', 'Low')),
            'main_parties': str(row.get('Main_Parties', 'Unknown')),
            'plain_summary': str(row.get('Plain_Language_Summary', '')),
        }
        priority = str(row.get('Predicted_Priority', 'Medium'))

        analysis = get_comprehensive_constitutional_analysis(features, priority)

        rights_str = ', '.join(
            r['article'] + (' (Primary)' if r['primary'] else ' (Secondary)')
            for r in analysis['constitutional_rights_engaged']
        )
        doctrines_str = '; '.join(
            d['name'] for d in analysis['applicable_doctrines']
        )

        df.at[idx, 'Constitutional_Justification'] = analysis['state_perspective_opinion']
        df.at[idx, 'Priority_Rules_Applied'] = analysis['priority_rules_detailed']
        df.at[idx, 'Constitutional_Rights_Engaged'] = rights_str
        df.at[idx, 'State_Duty_Analysis'] = analysis['state_duty_analysis']
        df.at[idx, 'Applicable_Doctrines'] = doctrines_str
        df.at[idx, 'Rights_Balancing_Analysis'] = analysis['balancing_analysis']
        updated_count += 1
        print(f"[{updated_count}] {str(row.get('Case_File', '?'))[:45]:45s} -> Rights: {rights_str[:40]}")

    df.to_excel(EXCEL_PATH, index=False)
    print(f"\nDone! Updated {updated_count} cases.")


if __name__ == '__main__':
    main()
