import unittest
import os
import sys

# Repo root path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from case_priority_system.scripts.inference_pipeline import load_model, predict_priority

class TestModelInference(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model_data = load_model()

    def test_model_loaded(self):
        self.assertIsNotNone(self.model_data)
        self.assertIn("model", self.model_data)
        self.assertIn("encoders", self.model_data)

    def test_high_priority_prediction(self):
        features = {
            "crime_type": "Violent",
            "severity": "Fatal",
            "vulnerability": "High",
            "influence": "Low",
            "case_category": "Criminal/Violent",
        }
        text = "Murder and assault case involving vulnerable victims"
        priority = predict_priority(self.model_data, features, text)
        self.assertEqual(priority, "High")

    def test_low_priority_prediction(self):
        features = {
            "crime_type": "Non-Violent",
            "severity": "No Injury",
            "vulnerability": "Low",
            "influence": "Low",
            "case_category": "General Civil",
        }
        text = "Minor boundary adjustment inquiry between two neighbors"
        priority = predict_priority(self.model_data, features, text)
        self.assertEqual(priority, "Low")

if __name__ == "__main__":
    unittest.main()
