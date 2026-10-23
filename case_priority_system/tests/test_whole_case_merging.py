import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from case_priority_system.scripts.case_manager import Case, CaseDocument
from case_priority_system.scripts.whole_case_analysis import merge_case_features

class TestWholeCaseMerging(unittest.TestCase):
    def test_severity_escalation(self):
        case = Case(
            case_id="ANV-2026-TEST",
            title="Test Merging",
            created_at="2026-10-23T00:00:00",
            created_by="Tester",
            source="TEST"
        )
        doc1 = CaseDocument(doc_id="D1", filename="doc1.pdf", path="doc1.pdf", doc_type="FIR", uploaded_at="2026-10-23T00:00:00")
        doc1.analysis = {"severity": "Minor", "vulnerability": "Low", "crime_type": "Property", "case_category": "Property/Land", "plain_summary": "Property damage"}
        doc2 = CaseDocument(doc_id="D2", filename="doc2.pdf", path="doc2.pdf", doc_type="Post-Mortem", uploaded_at="2026-10-23T00:00:00")
        doc2.analysis = {"severity": "Fatal", "vulnerability": "High", "crime_type": "Violent", "case_category": "Criminal/Violent", "plain_summary": "Fatal assault"}
        case.documents = [doc1, doc2]
        
        merged, merge_info = merge_case_features(case)
        self.assertEqual(merged["severity"], "Fatal")
        self.assertEqual(merged["vulnerability"], "High")
        self.assertEqual(merged["crime_type"], "Violent")

if __name__ == "__main__":
    unittest.main()
