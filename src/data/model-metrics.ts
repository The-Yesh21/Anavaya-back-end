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
  "generatedAt": "2026-09-03T20:10:36+00:00",
  "model": {
    "type": "DecisionTreeClassifier (CART)",
    "max_depth": 8,
    "actual_depth": 6,
    "leaves": 9,
    "n_features": 225,
    "classes": [
      "High",
      "Low",
      "Medium"
    ]
  },
  "corpus": {
    "total_rows": 3377,
    "synthetic_and_templates": 1580,
    "real_judgments": 265,
    "constitutional": 1532,
    "class_distribution": {
      "Medium": 1656,
      "High": 1089,
      "Low": 632
    }
  },
  "headline": {
    "holdoutAccuracy": 0.9924528301886792,
    "holdoutRows": 265,
    "holdoutMacroF1": 0.9800065552277942,
    "cvMeanAccuracy": 0.9985193951347797,
    "cvStd": 0.001324098031222601,
    "cvFolds": 5,
    "policyFidelity": 0.9988155167308261,
    "policyMacroF1": 0.9987645333778569,
    "baselineAccuracy": 0.4903760734379627,
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
        1089,
        0,
        0
      ],
      [
        0,
        632,
        0
      ],
      [
        2,
        2,
        1652
      ]
    ]
  },
  "perClass": [
    {
      "label": "High",
      "precision": 0.998166819431714,
      "recall": 1.0,
      "f1": 0.9990825688073395,
      "support": 1089
    },
    {
      "label": "Low",
      "precision": 0.9968454258675079,
      "recall": 1.0,
      "f1": 0.9984202211690363,
      "support": 632
    },
    {
      "label": "Medium",
      "precision": 1.0,
      "recall": 0.9975845410628019,
      "f1": 0.9987908101571947,
      "support": 1656
    }
  ],
  "holdoutPerClass": [
    {
      "label": "High",
      "precision": 0.8947368421052632,
      "recall": 1.0,
      "f1": 0.9444444444444444,
      "support": 17
    },
    {
      "label": "Low",
      "precision": 1.0,
      "recall": 1.0,
      "f1": 1.0,
      "support": 21
    },
    {
      "label": "Medium",
      "precision": 1.0,
      "recall": 0.9911894273127754,
      "f1": 0.995575221238938,
      "support": 227
    }
  ],
  "cvPerFold": [
    1.0,
    0.9970414201183432,
    0.997037037037037,
    0.9985185185185185,
    1.0
  ],
  "caveat": "Ground-truth labels are produced by infer_priority_label(), a codified court-priority policy derived from CONSTITUTION_GUIDELINES.md - not by human judicial annotation. These scores therefore measure how faithfully the tree reproduces that written policy, which is exactly the auditability property the system is designed for. They are not a claim about agreement with judges."
};
