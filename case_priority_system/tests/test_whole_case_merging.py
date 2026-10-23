import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from case_priority_system.scripts.whole_case_analysis import merge_document_features

class TestWholeCaseMerging(unittest.TestCase):
    def test_severity_escalation(self):
        doc1 = {"severity": "Minor", "vulnerability": "Low", "crime_type": "Property", "case_category": "Property/Land"}
        doc2 = {"severity": "Fatal", "vulnerability": "High", "crime_type": "Violent", "case_category": "Criminal/Violent"}
        merged = merge_document_features([doc1, doc2])
        self.assertEqual(merged["severity"], "Fatal")
        self.assertEqual(merged["vulnerability"], "High")
        self.assertEqual(merged["crime_type"], "Violent")

    def test_single_document_merging(self):
        doc = {"severity": "Major", "vulnerability": "Medium", "crime_type": "Financial", "case_category": "Excise/Tax"}
        merged = merge_document_features([doc])
        self.assertEqual(merged["severity"], "Major")
        self.assertEqual(merged["vulnerability"], "Medium")

if __name__ == "__main__":
    unittest.main()
