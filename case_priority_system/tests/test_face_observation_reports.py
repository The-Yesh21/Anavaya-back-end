import tempfile
import unittest

from case_priority_system.scripts.courtroom_manager import CourtroomManager, room_to_markdown
from case_priority_system.scripts.face_observation_report import observation_description
from case_priority_system.scripts.courtroom_deception import session_report_markdown


class FaceObservationReports(unittest.TestCase):
    def test_new_measurements_survive_reload_without_stress_claims(self):
        with tempfile.TemporaryDirectory() as directory:
            manager = CourtroomManager(storage_dir=directory)
            room = manager.create_room("Synthetic observation test", "Test")
            summary = manager.record_face_summary(room.room_id, {
                "subject": "Synthetic participant", "measurements_version": 2,
                "visible_sec": 10.5, "cue_observed_sec": 1.2, "blink_count": 3,
                "time_speaking_sec": 0.75,
                "counters": {"brow_raise": 1.2},
            })
            self.assertEqual(summary.blink_count, 3)
            restored = CourtroomManager(storage_dir=directory).get_room(room.room_id)
            self.assertEqual(restored.face_summaries[0].visible_sec, 10.5)
            self.assertEqual(restored.face_summaries[0].time_speaking_sec, 0.75)
            text = room_to_markdown(restored)
            self.assertIn("completed blinks: 3", text)
            self.assertIn("were not assessed", text)
            self.assertNotIn("peak index", text)

    def test_legacy_record_is_explicitly_unvalidated(self):
        text = observation_description({"peak_index": 99, "mean_index": 80})
        self.assertIn("Legacy", text)
        self.assertIn("unvalidated", text)
        self.assertNotIn("99%", text)

    def test_session_report_does_not_relabel_legacy_indices_or_cues(self):
        text = session_report_markdown({}, face_summaries=[{
            "peak_index": 99, "dominant_emotion": "Fear", "counters": {"fabrication": 12},
        }, {
            "measurements_version": 2, "blink_count": 2, "visible_sec": 5.5,
            "counters": {"brow_raise": 1.2},
        }])
        self.assertIn("unvalidated", text)
        self.assertIn("completed blinks: 2", text)
        self.assertNotIn("fabrication", text)
        self.assertNotIn("Fear", text)
        self.assertNotIn("99%", text)


if __name__ == "__main__":
    unittest.main()
