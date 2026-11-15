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
  "generatedAt": "2026-11-14T06:22:31+00:00",
  "model": {
    "type": "DecisionTreeClassifier (CART)",
    "max_depth": 8,
    "actual_depth": 7,
    "leaves": 17,
    "n_features": 241,
    "classes": [
      "High",
      "Low",
      "Medium"
    ]
  },
  "corpus": {
    "total_rows": 4177,
    "synthetic_and_templates": 2580,
    "real_judgments": 426,
    "constitutional": 1532,
    "class_distribution": {
      "Medium": 2169,
      "High": 1146,
      "Low": 862
    }
  },
  "headline": {
    "holdoutAccuracy": 0.9741784037558685,
    "holdoutRows": 426,
    "holdoutMacroF1": 0.9366273386019507,
    "cvMeanAccuracy": 0.9980852648769447,
    "cvStd": 0.001219917853576649,
    "cvFolds": 5,
    "policyFidelity": 0.999281781182667,
    "policyMacroF1": 0.9992853223724282,
    "baselineAccuracy": 0.5192722049317692,
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
        1145,
        0,
        1
      ],
      [
        0,
        862,
        0
      ],
      [
        1,
        1,
        2167
      ]
    ]
  },
  "perClass": [
    {
      "label": "High",
      "precision": 0.9991273996509599,
      "recall": 0.9991273996509599,
      "f1": 0.9991273996509599,
      "support": 1146
    },
    {
      "label": "Low",
      "precision": 0.9988412514484357,
      "recall": 1.0,
      "f1": 0.9994202898550725,
      "support": 862
    },
    {
      "label": "Medium",
      "precision": 0.9995387453874539,
      "recall": 0.9990779160903642,
      "f1": 0.9993082776112521,
      "support": 2169
    }
  ],
  "holdoutPerClass": [
    {
      "label": "High",
      "precision": 0.7878787878787878,
      "recall": 0.8666666666666667,
      "f1": 0.8253968253968254,
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
      "precision": 0.9886685552407932,
      "recall": 0.9803370786516854,
      "f1": 0.9844851904090268,
      "support": 356
    }
  ],
  "cvPerFold": [
    0.9976076555023924,
    0.9964114832535885,
    0.9988023952095808,
    1.0,
    0.9976047904191617
  ],
  "caveat": "Ground-truth labels are produced by infer_priority_label(), a codified court-priority policy derived from CONSTITUTION_GUIDELINES.md - not by human judicial annotation. These scores therefore measure how faithfully the tree reproduces that written policy, which is exactly the auditability property the system is designed for. They are not a claim about agreement with judges."
};
