/**
 * Chakshu AI — Real-Time Courtroom Trial Emotion & Cognitive State Inference Engine
 *
 * Evaluates 8 forensic courtroom affective states:
 *   1. composed_baseline       - Relaxed, cooperative, truthful baseline
 *   2. cognitive_strain        - Overthinking, mental calculation, fabrication effort
 *   3. acute_anxiety_stress    - Autonomic sympathetic arousal, apprehension
 *   4. contempt_defiance       - Unilateral smirk, dismissive defiance, sneer
 *   5. hostile_defensive       - Corrugator contraction, hostile glare, confrontation
 *   6. grief_remorse           - Inner brow raise, lip depression, sadness, regret
 *   7. startle_caught_offguard - Sudden shock / surprise upon contradiction
 *   8. deceptive_evasion       - Incongruent masking (fake smile + brow tension), leakage
 *
 * Runs client-side MLP neural forward pass at 30+ FPS (<1ms per frame).
 */

(function (root) {
  "use strict";

  const EMOTION_META = {
    composed_baseline: {
      label: "Composed / Baseline",
      category: "Truthful / Calm",
      color: "#10b981", // Emerald
      bg: "rgba(16, 185, 129, 0.15)",
      valence: 0.6,
      arousal: 0.15,
      description: "Relaxed facial musculature, steady eye contact, steady baseline blinks.",
    },
    cognitive_strain: {
      label: "Cognitive Strain",
      category: "High Mental Load",
      color: "#f59e0b", // Amber
      bg: "rgba(245, 158, 11, 0.15)",
      valence: -0.2,
      arousal: 0.65,
      description: "Mental calculation, fabrication latency, brow knitting (AU4) with gaze averted.",
    },
    acute_anxiety_stress: {
      label: "Acute Stress / Panic",
      category: "Autonomic Activation",
      color: "#ef4444", // Crimson
      bg: "rgba(239, 68, 68, 0.15)",
      valence: -0.75,
      arousal: 0.90,
      description: "Rapid blink burst, lip compression (AU24), nostril flare, sympathetic arousal.",
    },
    contempt_defiance: {
      label: "Contempt / Defiance",
      category: "Adversarial Affect",
      color: "#a855f7", // Purple
      bg: "rgba(168, 85, 247, 0.15)",
      valence: -0.55,
      arousal: 0.50,
      description: "Asymmetric unilateral smirk (AU12/AU14), head tilt back, dismissive tone.",
    },
    hostile_defensive: {
      label: "Hostile / Defensive",
      category: "Confrontational",
      color: "#dc2626", // Deep Red
      bg: "rgba(220, 38, 38, 0.15)",
      valence: -0.85,
      arousal: 0.85,
      description: "Heavy corrugator tension (AU4), tightened eyelids (AU7), jaw clench, intense glare.",
    },
    grief_remorse: {
      label: "Grief / Remorse",
      category: "Emotional Distress",
      color: "#06b6d4", // Cyan
      bg: "rgba(6, 182, 212, 0.15)",
      valence: -0.70,
      arousal: 0.40,
      description: "Inner brow raise (AU1), lip corner depression (AU15), chin raise, downcast gaze.",
    },
    startle_caught_offguard: {
      label: "Startled / Shocked",
      category: "Contradiction Reaction",
      color: "#eab308", // Yellow
      bg: "rgba(234, 179, 8, 0.15)",
      valence: -0.10,
      arousal: 0.95,
      description: "Sudden eye widening (AU5), raised brows (AU1+AU2), jaw drop upon contradiction.",
    },
    deceptive_evasion: {
      label: "Deceptive Evasion",
      category: "Concealment Tension",
      color: "#f97316", // Orange
      bg: "rgba(249, 115, 22, 0.15)",
      valence: -0.65,
      arousal: 0.75,
      description: "Incongruent masking (fake smile without eye crinkle while brow is tense), leakage.",
    },
  };

  class TrialEmotionClassifierEngine {
    constructor() {
      this.model = null;
      this.isLoaded = false;
      this.history = [];
      this.lastInferenceTime = 0;
      this.leakageAlerts = [];
      this.previousEmotion = null;
      this.previousEmotionTime = 0;
    }

    /**
     * Load JSON weights from endpoint or embedded object.
     */
    async loadModel(url = "/trial_emotion_classifier.json") {
      if (this.isLoaded) return true;
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        this.model = await resp.json();
        this.isLoaded = true;
        return true;
      } catch (err) {
        console.warn("Chakshu: Failed to fetch external model JSON, using robust fallback classifier:", err);
        this.model = null;
        this.isLoaded = false;
        return false;
      }
    }

    setWeights(modelData) {
      this.model = modelData;
      this.isLoaded = true;
    }

    /**
     * Extract the 40-dimensional feature vector from MediaPipe blendshapes + signals.
     */
    extractFeatureVector(blendshapes = {}, signals = {}, blinkRate = 18, gazeX = 0, previousVector = null) {
      const b = (k) => {
        const val = blendshapes[k];
        return typeof val === "number" && Number.isFinite(val) ? Math.max(0, Math.min(1, val)) : 0;
      };

      const vec = [
        b("browDownLeft"), b("browDownRight"), b("browInnerUp"), b("browOuterUpLeft"), b("browOuterUpRight"),
        b("eyeBlinkLeft"), b("eyeBlinkRight"), b("eyeWideLeft"), b("eyeWideRight"), b("eyeSquintLeft"), b("eyeSquintRight"),
        b("cheekPuff"), b("cheekSquintLeft"), b("cheekSquintRight"), b("noseSneerLeft"), b("noseSneerRight"),
        b("mouthSmileLeft"), b("mouthSmileRight"), b("mouthFrownLeft"), b("mouthFrownRight"),
        b("mouthDimpleLeft"), b("mouthDimpleRight"), b("mouthPressLeft"), b("mouthPressRight"),
        b("mouthStretchLeft"), b("mouthStretchRight"), b("mouthRollLower"), b("mouthRollUpper"),
        b("mouthShrugLower"), b("mouthShrugUpper"), b("jawOpen"), b("jawForward")
      ];

      // Derived Forensic & Bio-Kinematic Features
      const leftMouth = b("mouthSmileLeft") + b("mouthDimpleLeft") + b("mouthFrownLeft");
      const rightMouth = b("mouthSmileRight") + b("mouthDimpleRight") + b("mouthFrownRight");
      const asymmetryIndex = Math.min(1, Math.abs(leftMouth - rightMouth));

      const avgSmile = (b("mouthSmileLeft") + b("mouthSmileRight")) / 2.0;
      const avgSquint = (b("cheekSquintLeft") + b("cheekSquintRight")) / 2.0;
      const duchenneMarker = Math.max(-1, Math.min(1, avgSmile - avgSquint));

      const avgBrowDown = (b("browDownLeft") + b("browDownRight")) / 2.0;
      const conflictIndex = Math.min(1, avgSmile * avgBrowDown);

      const avgPress = (b("mouthPressLeft") + b("mouthPressRight")) / 2.0;
      const lipCompressionIndex = Math.min(1, avgPress + (b("mouthRollLower") + b("mouthRollUpper")) / 2.0);

      const ear = typeof signals.ear === "number" && Number.isFinite(signals.ear) ? signals.ear : 0.28;
      const eyeAspectRatio = Math.max(0, Math.min(1, ear));

      const blinkRateNorm = Math.max(0, Math.min(1, (blinkRate || 18) / 60.0));
      const gazeDiv = Math.max(0, Math.min(1, Math.abs(gazeX || 0)));

      // Micro-velocity: delta from previous frame
      let microVelocity = 0.05;
      if (previousVector && previousVector.length === 40) {
        let diffSum = 0;
        for (let i = 0; i < 32; i++) {
          diffSum += Math.abs(vec[i] - previousVector[i]);
        }
        microVelocity = Math.min(1, diffSum * 3.0);
      }

      vec.push(
        asymmetryIndex,
        duchenneMarker,
        conflictIndex,
        lipCompressionIndex,
        eyeAspectRatio,
        blinkRateNorm,
        gazeDiv,
        microVelocity
      );

      return vec;
    }

    /**
     * Run inference on the input feature vector.
     */
    predict(blendshapes = {}, signals = {}, blinkRate = 18, gazeX = 0) {
      const now = performance.now();
      const prevVec = this.history.length > 0 ? this.history[this.history.length - 1].vector : null;
      const x = this.extractFeatureVector(blendshapes, signals, blinkRate, gazeX, prevVec);

      let probs = {};
      let topClass = "composed_baseline";
      let topConfidence = 0.50;

      if (this.isLoaded && this.model) {
        // Fast Neural Forward Pass (MLP)
        const scaled = this.scaleFeatures(x);
        const logits = this.forwardMLP(scaled);
        probs = this.softmax(logits);
      } else {
        // Heuristic Probabilistic Fallback (Analytical Bayes)
        probs = this.analyticalInference(x);
      }

      // Find top prediction
      let maxP = -1;
      for (const [cls, p] of Object.entries(probs)) {
        if (p > maxP) {
          maxP = p;
          topClass = cls;
          topConfidence = p;
        }
      }

      const meta = EMOTION_META[topClass] || EMOTION_META.composed_baseline;

      // Cognitive Stress & Autonomic Tension Index (0–100%)
      const rawStress = (
        (probs.acute_anxiety_stress || 0) * 85 +
        (probs.cognitive_strain || 0) * 55 +
        (probs.hostile_defensive || 0) * 75 +
        (probs.deceptive_evasion || 0) * 70 +
        (probs.startle_caught_offguard || 0) * 60 +
        (probs.grief_remorse || 0) * 45
      );
      // Dampen stress index proportionally when composed_baseline is high
      const composedDiscount = Math.min(0.60, (probs.composed_baseline || 0) * 0.50);
      const stressIndex = Math.max(
        5,
        Math.min(100, Math.round(rawStress * (1.0 - composedDiscount)))
      );

      // Micro-expression leakage detection: transient emotion lasting 40ms to 280ms
      let leakageDetected = false;
      let leakageType = null;
      if (this.previousEmotion && this.previousEmotion !== topClass) {
        const duration = now - this.previousEmotionTime;
        if (duration >= 40 && duration <= 280 && this.previousEmotion !== "composed_baseline") {
          leakageDetected = true;
          leakageType = this.previousEmotion;
          this.leakageAlerts.push({
            type: leakageType,
            duration: Math.round(duration),
            timestamp: Date.now(),
          });
          if (this.leakageAlerts.length > 10) this.leakageAlerts.shift();
        }
      }

      if (this.previousEmotion !== topClass) {
        this.previousEmotion = topClass;
        this.previousEmotionTime = now;
      }

      const result = {
        emotion: topClass,
        confidence: Math.round(topConfidence * 100),
        label: meta.label,
        category: meta.category,
        color: meta.color,
        bg: meta.bg,
        valence: meta.valence,
        arousal: meta.arousal,
        stressIndex,
        probabilities: probs,
        leakage: {
          detected: leakageDetected,
          type: leakageType,
          recentCount: this.leakageAlerts.length,
        },
        timestamp: now,
      };

      // Keep small rolling history
      this.history.push({ vector: x, result, timestamp: now });
      if (this.history.length > 30) this.history.shift();

      return result;
    }

    scaleFeatures(x) {
      const mean = this.model.scaler_mean;
      const scale = this.model.scaler_scale;
      const out = new Float32Array(x.length);
      for (let i = 0; i < x.length; i++) {
        out[i] = (x[i] - mean[i]) / (scale[i] || 1e-7);
      }
      return out;
    }

    forwardMLP(x) {
      const W = this.model.weights;
      const b = this.model.biases;

      // Layer 1: ReLU(W0 * x + b0)
      const h1 = new Float32Array(b[0].length);
      for (let j = 0; j < b[0].length; j++) {
        let sum = b[0][j];
        for (let i = 0; i < x.length; i++) {
          sum += x[i] * W[0][i][j];
        }
        h1[j] = Math.max(0, sum); // ReLU
      }

      // Layer 2: ReLU(W1 * h1 + b1)
      const h2 = new Float32Array(b[1].length);
      for (let j = 0; j < b[1].length; j++) {
        let sum = b[1][j];
        for (let i = 0; i < h1.length; i++) {
          sum += h1[i] * W[1][i][j];
        }
        h2[j] = Math.max(0, sum); // ReLU
      }

      // Output Layer: W2 * h2 + b2
      const out = new Float32Array(b[2].length);
      for (let j = 0; j < b[2].length; j++) {
        let sum = b[2][j];
        for (let i = 0; i < h2.length; i++) {
          sum += h2[i] * W[2][i][j];
        }
        out[j] = sum;
      }

      return out;
    }

    softmax(logits) {
      let maxL = -Infinity;
      for (let i = 0; i < logits.length; i++) {
        if (logits[i] > maxL) maxL = logits[i];
      }

      let sumExp = 0;
      const exp = new Float32Array(logits.length);
      for (let i = 0; i < logits.length; i++) {
        exp[i] = Math.exp(logits[i] - maxL);
        sumExp += exp[i];
      }

      const classes = this.model.classes;
      const probs = {};
      for (let i = 0; i < classes.length; i++) {
        probs[classes[i]] = Math.round((exp[i] / (sumExp || 1)) * 1000) / 1000;
      }
      return probs;
    }

    analyticalInference(x) {
      // Robust analytical fall-back
      const browDown = (x[0] + x[1]) / 2;
      const browInnerUp = x[2];
      const eyeWide = (x[7] + x[8]) / 2;
      const eyeSquint = (x[9] + x[10]) / 2;
      const smile = (x[16] + x[17]) / 2;
      const frown = (x[18] + x[19]) / 2;
      const dimple = (x[20] + x[21]) / 2;
      const press = (x[22] + x[23]) / 2;
      const jawOpen = x[30];
      const asymmetry = x[32];
      const conflict = x[34];
      const blinkRateNorm = x[37];
      const gazeDiv = x[38];

      const raw = {
        composed_baseline: Math.max(0.05, 1.0 - (browDown + eyeWide + frown + press + gazeDiv)),
        cognitive_strain: Math.max(0.01, browDown * 0.7 + gazeDiv * 0.8 + (1.0 - blinkRateNorm) * 0.4),
        acute_anxiety_stress: Math.max(0.01, blinkRateNorm * 0.9 + press * 0.7 + eyeSquint * 0.5),
        contempt_defiance: Math.max(0.01, asymmetry * 0.9 + dimple * 0.8 + smile * 0.4),
        hostile_defensive: Math.max(0.01, browDown * 0.9 + eyeSquint * 0.8 + (1.0 - gazeDiv) * 0.5),
        grief_remorse: Math.max(0.01, browInnerUp * 0.9 + frown * 0.8 + gazeDiv * 0.5),
        startle_caught_offguard: Math.max(0.01, eyeWide * 0.9 + browInnerUp * 0.6 + jawOpen * 0.7),
        deceptive_evasion: Math.max(0.01, conflict * 0.9 + gazeDiv * 0.6 + (press > 0.3 ? 0.4 : 0)),
      };

      let sum = 0;
      for (const k in raw) sum += raw[k];
      const probs = {};
      for (const k in raw) probs[k] = Math.round((raw[k] / sum) * 1000) / 1000;
      return probs;
    }
  }

  root.TrialEmotionInference = new TrialEmotionClassifierEngine();
  root.TRIAL_EMOTION_META = EMOTION_META;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      TrialEmotionInference: root.TrialEmotionInference,
      TRIAL_EMOTION_META: EMOTION_META,
    };
  }
})(typeof window !== "undefined" ? window : globalThis);
