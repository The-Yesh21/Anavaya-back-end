import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from case_priority_system.scripts.constitutional_analysis import get_comprehensive_constitutional_analysis

class TestConstitutionalAnalysis(unittest.TestCase):
    def test_article_21_engagement(self):
        features = {
            "case_category": "Criminal/Violent",
            "severity": "Fatal",
            "vulnerability": "High",
            "crime_type": "Violent",
            "plain_summary": "Assault and kidnapping of minor victim"
        }
        analysis = get_comprehensive_constitutional_analysis(features, "High")
        rights = analysis.get("constitutional_rights_engaged", [])
        article_names = [r["article"] for r in rights if isinstance(r, dict) and r.get("why_applies")]
        self.assertTrue(any("Article 21" in a for a in article_names))
        self.assertIn("state_perspective_opinion", analysis)
        self.assertTrue(len(analysis["state_perspective_opinion"]) > 50)

    def test_article_300a_property_engagement(self):
        features = {
            "case_category": "Property/Land",
            "severity": "No Injury",
            "vulnerability": "Low",
            "crime_type": "Property",
            "plain_summary": "Civil land demarcation and boundary suit"
        }
        analysis = get_comprehensive_constitutional_analysis(features, "Low")
        rights = analysis.get("constitutional_rights_engaged", [])
        article_names = [r["article"] for r in rights if isinstance(r, dict) and r.get("why_applies")]
        self.assertTrue(any("Article 300A" in a for a in article_names))

if __name__ == "__main__":
    unittest.main()
