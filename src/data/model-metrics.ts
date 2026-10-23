// GENERATED FILE - DO NOT EDIT BY HAND.
// Written by case_priority_system/scripts/evaluate_model.py from the shipped
// models/priority_classifier.pkl. Re-run that script to refresh:
//     python case_priority_system/scripts/evaluate_model.py
// Every figure the landing page publishes comes from here, so the site can
// never quote an accuracy the model did not actually score.

export type ClassMetric = {
  label: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
};

export type ModelMetrics = {
  generatedAt: string;
  model: {
    type: string;
    max_depth: number | null;
    actual_depth: number;
    leaves: number;
    n_features: number;
    classes: string[];
  };
  corpus: {
    total_rows: number;
    synthetic_and_templates: number;
    real_judgments: number;
    constitutional: number;
    class_distribution: Record<string, number>;
  };
  headline: {
    holdoutAccuracy: number;
    holdoutRows: number;
    holdoutMacroF1: number;
    cvMeanAccuracy: number;
    cvStd: number;
    cvFolds: number;
    policyFidelity: number;
    policyMacroF1: number;
    baselineAccuracy: number;
    baselineClass: string;
  };
  confusionMatrix: { labels: string[]; matrix: number[][] };
  perClass: ClassMetric[];
  holdoutPerClass: ClassMetric[];
  cvPerFold: number[];
  caveat: string;
};

export const MODEL_METRICS: ModelMetrics = {
  "generatedAt": "2026-10-23T13:20:34+00:00",
  "model": {
    "type": "DecisionTreeClassifier (CART)",
    "max_depth": 8,
    "actual_depth": 7,
    "leaves": 12,
    "n_features": 225,
    "classes": [
      "High",
      "Low",
      "Medium"
    ]
  },
  "corpus": {
    "total_rows": 4538,
    "synthetic_and_templates": 2580,
    "real_judgments": 426,
    "constitutional": 1532,
    "class_distribution": {
      "Medium": 2198,
      "High": 1466,
      "Low": 874
    }
  },
  "headline": {
    "holdoutAccuracy": 0.9835680751173709,
    "holdoutRows": 426,
    "holdoutMacroF1": 0.961864436681839,
    "cvMeanAccuracy": 0.9980168925974677,
    "cvStd": 0.0008240243633486447,
    "cvFolds": 5,
    "policyFidelity": 0.99889819303658,
    "policyMacroF1": 0.998898767856263,
    "baselineAccuracy": 0.48435434111943587,
    "baselineClass": "Medium"
  },
  "confusionMatrix": {
    "labels": [
      "High",
      "Low",
      "Medium"
    ],
    "matrix": [
      [
        1466,
        0,
        0
      ],
      [
        0,
        874,
        0
      ],
      [
        3,
        2,
        2193
      ]
    ]
  },
  "perClass": [
    {
      "label": "High",
      "precision": 0.9979577944179714,
      "recall": 1.0,
      "f1": 0.9989778534923339,
      "support": 1466
    },
    {
      "label": "Low",
      "precision": 0.997716894977169,
      "recall": 1.0,
      "f1": 0.9988571428571429,
      "support": 874
    },
    {
      "label": "Medium",
      "precision": 1.0,
      "recall": 0.9977252047315741,
      "f1": 0.9988613072193122,
      "support": 2198
    }
  ],
  "holdoutPerClass": [
    {
      "label": "High",
      "precision": 0.8108108108108109,
      "recall": 1.0,
      "f1": 0.8955223880597015,
      "support": 30
    },
    {
      "label": "Low",
      "precision": 1.0,
      "recall": 1.0,
      "f1": 1.0,
      "support": 40
    },
    {
      "label": "Medium",
      "precision": 1.0,
      "recall": 0.9803370786516854,
      "f1": 0.9900709219858156,
      "support": 356
    }
  ],
  "cvPerFold": [
    0.998898678414097,
    0.9966960352422908,
    0.9977973568281938,
    0.9988974641675854,
    0.9977949283351709
  ],
  "caveat": "Ground-truth labels are produced by infer_priority_label(), a codified court-priority policy derived from CONSTITUTION_GUIDELINES.md - not by human judicial annotation. These scores therefore measure how faithfully the tree reproduces that written policy, which is exactly the auditability property the system is designed for. They are not a claim about agreement with judges."
};
