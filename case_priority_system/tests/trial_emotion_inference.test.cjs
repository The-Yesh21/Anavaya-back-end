const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptPath = path.join(__dirname, '../static/trial-emotion-inference.js');
const jsonPath = path.join(__dirname, '../models/trial_emotion_classifier.json');

const ctx = { module: { exports: {} }, performance, Float32Array, Math };
vm.runInNewContext(fs.readFileSync(scriptPath, 'utf8'), ctx);
const { TrialEmotionInference, TRIAL_EMOTION_META } = ctx.module.exports;

test('Trial Emotion Inference Engine loads and runs analytical fallback', () => {
    assert.ok(TrialEmotionInference);
    assert.equal(typeof TrialEmotionInference.predict, 'function');
    
    // Baseline test
    const baseline = TrialEmotionInference.predict({}, { ear: 0.30 }, 16, 0);
    assert.ok(baseline.emotion);
    assert.ok(baseline.confidence > 0);
    assert.equal(baseline.emotion, 'composed_baseline');
    assert.ok(baseline.stressIndex < 35);
});

test('Trial Emotion Inference Engine loads trained JSON weights and runs neural MLP inference', () => {
    const modelData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    TrialEmotionInference.setWeights(modelData);
    assert.equal(TrialEmotionInference.isLoaded, true);

    // Test 1: Acute Stress (High blink burst + heavy lip compression + eye squint)
    const stressBlend = {
        mouthPressLeft: 0.85,
        mouthPressRight: 0.85,
        mouthRollLower: 0.60,
        eyeSquintLeft: 0.50,
        eyeSquintRight: 0.50,
        noseSneerLeft: 0.40,
        noseSneerRight: 0.40
    };
    const stressRes = TrialEmotionInference.predict(stressBlend, { ear: 0.28 }, 45, 0.5);
    assert.equal(stressRes.emotion, 'acute_anxiety_stress');
    assert.ok(stressRes.confidence >= 75);
    assert.ok(stressRes.stressIndex >= 60);

    // Test 2: Contempt / Defiance (Unilateral smirk + dimple)
    const contemptBlend = {
        mouthDimpleRight: 0.85,
        mouthSmileRight: 0.75,
        mouthDimpleLeft: 0.05,
        mouthSmileLeft: 0.05,
        jawForward: 0.40,
        browOuterUpRight: 0.50
    };
    const contemptRes = TrialEmotionInference.predict(contemptBlend, { ear: 0.30 }, 16, 0.2);
    assert.equal(contemptRes.emotion, 'contempt_defiance');
    assert.ok(contemptRes.confidence >= 70);

    // Test 3: Hostile / Defensive (Heavy corrugator AU4 + eye tightening AU7)
    const hostileBlend = {
        browDownLeft: 0.90,
        browDownRight: 0.90,
        eyeSquintLeft: 0.75,
        eyeSquintRight: 0.75,
        jawForward: 0.55,
        mouthFrownLeft: 0.40,
        mouthFrownRight: 0.40
    };
    const hostileRes = TrialEmotionInference.predict(hostileBlend, { ear: 0.25 }, 12, 0.05);
    assert.equal(hostileRes.emotion, 'hostile_defensive');
    assert.ok(hostileRes.confidence >= 65);

    // Test 4: Startle / Shock (Eye widening AU5 + brow raise AU1+AU2 + jaw open AU26)
    const startleBlend = {
        eyeWideLeft: 0.90,
        eyeWideRight: 0.90,
        browInnerUp: 0.85,
        browOuterUpLeft: 0.80,
        browOuterUpRight: 0.80,
        jawOpen: 0.70
    };
    const startleRes = TrialEmotionInference.predict(startleBlend, { ear: 0.45 }, 5, 0.0);
    assert.equal(startleRes.emotion, 'startle_caught_offguard');
    assert.ok(startleRes.confidence >= 75);
});

test('Inference speed is sub-millisecond (< 1.5ms)', () => {
    const runs = 200;
    const start = performance.now();
    for (let i = 0; i < runs; i++) {
        TrialEmotionInference.predict({ browDownLeft: 0.5, mouthPressLeft: 0.4 }, { ear: 0.3 }, 20, 0.1);
    }
    const elapsed = performance.now() - start;
    const perFrame = elapsed / runs;
    assert.ok(perFrame < 1.5, `Inference took ${perFrame.toFixed(3)}ms per frame (target < 1.5ms)`);
});
