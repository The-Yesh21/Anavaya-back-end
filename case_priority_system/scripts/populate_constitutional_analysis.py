"""
Reprocess existing PDFs to populate enhanced constitutional analysis fields
in the Excel results file. This uses the fallback feature extractor (no LLM
required) so it runs quickly on all available PDFs.
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

import pandas as pd
from case_priority_system.scripts.inference_pipeline import (
    extract_text_from_pdf, fallback_extract_features,
    tune_case_features, predict_priority, build_decision_path_graph,
    load_model
)
from case_priority_system.scripts.constitutional_analysis import get_comprehensive_constitutional_analysis

EXCEL_PATH = 'case_priority_system/case_results.xlsx'
DATA_DIR = '.'


def main():
    # Load model
    print("Loading model...")
    model_data = load_model()

    # Find all PDFs
    pdf_files = sorted([
        f for f in os.listdir(DATA_DIR)
        if f.lower().endswith('.pdf')
    ])
    print(f"Found {len(pdf_files)} PDFs to process.")

    all_new_cases = []
    for pdf_file in pdf_files:
        try:
            pdf_path = os.path.join(DATA_DIR, pdf_file)
            print(f"\nProcessing: {pdf_file}...")

            text = extract_text_from_pdf(pdf_path)
            print(f"  Extracted {len(text)} chars")

            features = fallback_extract_features(text, pdf_file)
            features = tune_case_features(features, text)

            model_text = f"{features.get('plain_summary', '')} {features.get('main_parties', '')}"
            priority = predict_priority(model_data, features, model_text)

            # NEW: Generate comprehensive constitutional analysis
            analysis = get_comprehensive_constitutional_analysis(features, priority)
            print(f"  Priority: {priority}")
            print(f"  Rights: {', '.join(r['article'] for r in analysis['constitutional_rights_engaged'])}")
            print(f"  Doctrines: {', '.join(d['name'] for d in analysis['applicable_doctrines'])}")

            md_path, decision_path = build_decision_path_graph(
                model_data, features, model_text, pdf_file, priority
            )

            rights_str = ', '.join(
                r['article'] + (' (Primary)' if r['primary'] else ' (Secondary)')
                for r in analysis['constitutional_rights_engaged']
            )
            doctrines_str = '; '.join(d['name'] for d in analysis['applicable_doctrines'])

            new_case = {
                'Case_File': pdf_file,
                'Main_Parties': features.get('main_parties', 'Unknown'),
                'Plain_Language_Summary': features.get('plain_summary', 'N/A'),
                'Constitutional_Justification': analysis['state_perspective_opinion'],
                'Priority_Rules_Applied': analysis['priority_rules_detailed'],
                'Decision_Report': md_path,
                'Decision_Path': decision_path,
                'Predicted_Priority': priority,
                'Category': features.get('case_category', 'N/A'),
                'Broad_Model_Category': features.get('crime_type', 'N/A'),
                'Severity': features.get('severity', 'N/A'),
                'Vulnerability': features.get('vulnerability', 'N/A'),
                'Influence': features.get('influence', 'N/A'),
                'Constitutional_Rights_Engaged': rights_str,
                'State_Duty_Analysis': analysis['state_duty_analysis'],
                'Applicable_Doctrines': doctrines_str,
                'Rights_Balancing_Analysis': analysis['balancing_analysis'],
            }
            all_new_cases.append(new_case)

        except Exception as e:
            print(f"  ERROR processing {pdf_file}: {e}")

    # Save to Excel
    if all_new_cases:
        new_df = pd.DataFrame(all_new_cases)

        if os.path.exists(EXCEL_PATH):
            existing_df = pd.read_excel(EXCEL_PATH)
            combined = pd.concat([existing_df, new_df], ignore_index=True)
            combined = combined.drop_duplicates(subset=['Case_File'], keep='last')
        else:
            combined = new_df

        combined.to_excel(EXCEL_PATH, index=False)
        print(f"\nSaved {len(all_new_cases)} cases to {EXCEL_PATH}")
    else:
        print("\nNo cases processed successfully.")


if __name__ == '__main__':
    main()
