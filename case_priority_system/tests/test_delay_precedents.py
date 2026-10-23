import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from case_priority_system.scripts.delay_precedents import get_delay_precedents

class TestDelayPrecedents(unittest.TestCase):
    def test_child_endangerment_precedent(self):
        precedents = get_delay_precedents(
            priority="High",
            category="Criminal/Violent",
            severity="Major",
            case_title="FIR 112 Missing Minor Child",
            case_text="Investigation into missing 7 year old child kidnapped near park"
        )
        self.assertTrue(len(precedents) > 0)
        names = [p["case_name"] for p in precedents]
        self.assertTrue(any("Bachpan Bachao Andolan" in n for n in names))
        # Ensure corporate loan precedents do not leak into child matters
        self.assertFalse(any("Innoventive" in n for n in names))

    def test_commercial_dispute_precedent(self):
        precedents = get_delay_precedents(
            priority="Medium",
            category="Insolvency/Debt",
            severity="No Injury",
            case_title="Corporate Debt Default",
            case_text="NCLT liquidation petition regarding corporate loan default"
        )
        self.assertTrue(len(precedents) > 0)
        names = [p["case_name"] for p in precedents]
        self.assertTrue(any("Innoventive" in n or "Bhopal" in n for n in names))

if __name__ == "__main__":
    unittest.main()
