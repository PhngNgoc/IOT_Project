import csv
import os
import re
import sys
import unittest
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
import tensorflow as tf
from sklearn.metrics import classification_report


ROOT_DIR = Path(__file__).resolve().parents[1]
MODEL_HEADER = ROOT_DIR / "src" / "dht_anomaly_model.h"
TEST_DATA = ROOT_DIR / "src" / "test_data.csv"


def load_tflite_model_from_header(header_path):
    content = header_path.read_text(encoding="utf-8")
    match = re.search(r"\{([^}]+)\}", content, flags=re.DOTALL)
    if not match:
        raise ValueError(f"No byte array found in {header_path}")

    values = [item.strip() for item in match.group(1).split(",") if item.strip()]
    return bytes(int(value, 16) for value in values)


class DhtAnomalyModelTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        model_bytes = load_tflite_model_from_header(MODEL_HEADER)
        cls.interpreter = tf.lite.Interpreter(model_content=model_bytes)
        cls.interpreter.allocate_tensors()
        cls.input_details = cls.interpreter.get_input_details()[0]
        cls.output_details = cls.interpreter.get_output_details()[0]

    def predict_score(self, temperature, humidity):
        input_data = np.array([[temperature, humidity]], dtype=np.float32)
        self.interpreter.set_tensor(self.input_details["index"], input_data)
        self.interpreter.invoke()
        return float(self.interpreter.get_tensor(self.output_details["index"])[0][0])

    def test_model_input_and_output_contract(self):
        self.assertEqual(self.input_details["shape"].tolist(), [1, 2])
        self.assertEqual(self.input_details["dtype"], np.float32)
        self.assertEqual(self.output_details["shape"].tolist(), [1, 1])
        self.assertEqual(self.output_details["dtype"], np.float32)

    def test_known_dht_outputs(self):
        test_cases = [
            (25.0, 55.0, 0.478108317, 0),
            (30.5, 60.0, 0.404266655, 0),
            (45.0, 20.0, 0.041216280, 0),
            (50.0, 90.0, 0.269422919, 0),
            (0.0, 0.0, 0.515676618, 1),
            (100.0, 100.0, 0.006447076, 0),
        ]

        for temperature, humidity, expected_score, expected_prediction in test_cases:
            with self.subTest(temperature=temperature, humidity=humidity):
                score = self.predict_score(temperature, humidity)
                self.assertGreaterEqual(score, 0.0)
                self.assertLessEqual(score, 1.0)
                self.assertAlmostEqual(score, expected_score, places=5)
                self.assertEqual(int(score > 0.5), expected_prediction)

    def test_print_classification_report_from_csv(self):
        y_true = []
        y_pred = []

        with TEST_DATA.open(newline="", encoding="utf-8") as csv_file:
            for row in csv.DictReader(csv_file):
                temperature = float(row["temperature"])
                humidity = float(row["humidity"])
                label = int(row["label"])
                score = self.predict_score(temperature, humidity)

                y_true.append(label)
                y_pred.append(int(score > 0.5))

        print("\n--- BÁO CÁO PHÂN LOẠI (CLASSIFICATION REPORT) ---")
        print(
            classification_report(
                y_true,
                y_pred,
                target_names=["Normal (0)", "Anomaly (1)"],
                zero_division=0,
            )
        )


if __name__ == "__main__":
    unittest.main()
