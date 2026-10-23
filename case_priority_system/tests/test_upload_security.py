import unittest
import os
import re

class TestUploadSecurity(unittest.TestCase):
    def test_filename_sanitization_pattern(self):
        valid_filenames = ["FIR_120_2026.pdf", "Evidence Report (1).pdf", "scan-witness-01.jpg"]
        invalid_filenames = ["../../../etc/passwd", "exploit.exe", "test<script>.pdf", "file;rm -rf /"]
        pattern = r"^[A-Za-z0-9 _\-().]+\.(pdf|jpg|jpeg|png|webp|bmp|tiff)$"
        
        for name in valid_filenames:
            self.assertTrue(bool(re.match(pattern, name, re.IGNORECASE)), f"Failed on valid: {name}")
            
        for name in invalid_filenames:
            base = os.path.basename(name)
            self.assertFalse(bool(re.match(pattern, base, re.IGNORECASE)), f"Failed to reject: {name}")

if __name__ == "__main__":
    unittest.main()
