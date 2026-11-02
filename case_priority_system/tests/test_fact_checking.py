import unittest

class TestFactChecking(unittest.TestCase):
    def test_verdict_categories(self):
        allowed_verdicts = ["SUPPORTED", "CONTRADICTED", "UNCORROBORATED", "INCONCLUSIVE"]
        test_verdict = "SUPPORTED"
        self.assertIn(test_verdict, allowed_verdicts)

if __name__ == "__main__":
    unittest.main()
