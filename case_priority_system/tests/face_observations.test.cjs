const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync('case_priority_system/static/face-observations.js', 'utf8'), ctx);
const { Engine, usableLandmarks } = ctx.module.exports;
const signals = { ear: 0.30, lipOpen: 0.03, gazeX: 0 };
const blend = { eyeBlinkLeft: 0, eyeBlinkRight: 0, browDownLeft: 0, browDownRight: 0 };
function driver(fps = 20) {
    const engine = new Engine(); let timestamp = 0;
    const step = (options = {}) => engine.update({ timestamp: timestamp += 1000 / fps, signals, blendshapes: blend, ...options });
    const run = (ms, options = {}) => { let out; for (let i = 0; i < Math.ceil(ms * fps / 1000); i++) out = step(options); return out; };
    return { engine, step, run, now: () => timestamp };
}
test('calibration is time-based, reports uncertainty and excludes speaking', () => {
    const d = driver();
    assert.equal(d.run(3000, { speaking: true }).status, 'calibrating');
    assert.equal(d.run(1000).status, 'calibrating');
    assert.equal(d.run(1200).status, 'ready');
    assert.equal(d.engine.lastOutput.stress, null);
    assert.equal(d.engine.lastOutput.emotion, null);
});
test('ordinary articulation cannot become a stress or negative-emotion score', () => {
    const d = driver(); d.run(2500);
    for (let i = 0; i < 400; i++) {
        const out = d.step({ speaking: true, signals: { ...signals, lipOpen: 0.03 + Math.abs(Math.sin(i)) * 0.2 },
            blendshapes: { ...blend, jawOpen: 0.9, mouthPressLeft: 0.9, mouthPressRight: 0.9, mouthFrownLeft: 0.8, mouthFrownRight: 0.8 } });
        assert.equal(out.stress, null); assert.equal(out.emotion, null);
        assert.equal(out.activity, 0); assert.equal(out.actions.lip_press, null);
    }
});
test('sustained simultaneous facial actions remain independent observations', () => {
    const d = driver(); d.run(2500);
    const out = d.run(1200, { blendshapes: { ...blend, browDownLeft: 0.85, browDownRight: 0.85, eyeWideLeft: 0.8, eyeWideRight: 0.8 } });
    assert.ok(out.active.includes('brow_lower')); assert.ok(out.active.includes('eye_wide'));
    assert.ok(out.actions.brow_lower + out.actions.eye_wide > 100, 'not a probability distribution');
    assert.ok(d.engine.summary().cue_observed_sec < Object.values(d.engine.summary().counters).reduce((a,b) => a+b, 0), 'overlaps counted once');
});
test('blink hysteresis counts completed bilateral blinks, not winks or prolonged closures', () => {
    const d = driver(); d.run(2500);
    d.run(100, { blendshapes: { ...blend, eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9 } }); d.step();
    assert.equal(d.engine.blinks, 1);
    d.run(200, { blendshapes: { ...blend, eyeBlinkLeft: 0.9 } }); d.step();
    assert.equal(d.engine.blinks, 1);
    d.run(900, { blendshapes: { ...blend, eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9 } }); d.step();
    assert.equal(d.engine.blinks, 1);
    assert.equal(d.engine.lastOutput.blinkRate, null);
    d.run(10000); assert.ok(Number.isFinite(d.engine.lastOutput.blinkRate));
});
test('lost/invalid tracking clears readings and never adds missing time to observations', () => {
    const d = driver(); d.run(2500);
    d.run(1000, { blendshapes: { ...blend, browDownLeft: 0.9, browDownRight: 0.9 } });
    const before = d.engine.visibleMs;
    const out = d.run(3000, { valid: false });
    assert.equal(out.status, 'unavailable'); assert.equal(out.activity, null); assert.equal(out.active.length, 0);
    assert.equal(d.engine.visibleMs, before);
    assert.equal(d.step().status, 'calibrating');
    assert.equal(d.step({ signals: { ...signals, ear: NaN } }).status, 'unavailable');
});
test('gaze direction has no recall, deception or credibility interpretation', () => {
    const d = driver(); d.run(2500);
    assert.match(d.step({ signals: { ...signals, gazeX: 0.3 } }).gaze, /Image-right/);
    assert.match(d.step({ signals: { ...signals, gazeX: -0.3 } }).gaze, /Image-left/);
    assert.equal(d.engine.lastOutput.activity, 0);
});
test('missing blendshapes abstain from expression readings', () => {
    const d = driver(); d.run(2500);
    const out = d.step({ blendshapes: {} });
    assert.equal(out.activity, null); assert.equal(out.actions.smile, null);
    const partial = d.step({ blendshapes: { ...blend, mouthSmileLeft: 0.9, jawOpen: NaN } });
    assert.equal(partial.actions.smile, null, 'one missing side is not a zero-strength measurement');
    assert.equal(partial.actions.mouth_open, null);
});
test('time-based filtering and totals are consistent at 10, 20 and 30 FPS', () => {
    const durations = [10, 20, 30].map(fps => {
        const d = driver(fps); d.run(2600);
        const out = d.run(3000, { blendshapes: { ...blend, browDownLeft: 0.9, browDownRight: 0.9 } });
        assert.ok(out.active.includes('brow_lower'));
        return d.engine.summary().cue_observed_sec;
    });
    assert.ok(Math.max(...durations) - Math.min(...durations) < 0.25);
});
test('malformed, tiny and severely turned faces fail the geometry gate', () => {
    assert.equal(usableLandmarks([]), false);
    const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    assert.equal(usableLandmarks(lm), false);
    lm[33].x = 0.3; lm[133].x = 0.4; lm[263].x = 0.7; lm[362].x = 0.6;
    assert.equal(usableLandmarks(lm), true);
    lm[362].x = 0.68; assert.equal(usableLandmarks(lm), false);
});
test('reset discards prior participant calibration and measurements', () => {
    const d = driver(); d.run(2500); d.engine.reset();
    assert.equal(d.engine.baseline, null); assert.equal(d.engine.blinks, 0);
    assert.equal(d.engine.summary().visible_sec, 0);
});
test('fully closed eyes do not calibrate but can complete a blink after calibration', () => {
    const d = driver();
    assert.equal(d.run(2500, { signals: { ...signals, ear: 0 } }).status, 'calibrating');
    d.run(2500);
    d.run(100, { signals: { ...signals, ear: 0 }, blendshapes: { ...blend, eyeBlinkLeft: 1, eyeBlinkRight: 1 } });
    d.step(); assert.equal(d.engine.blinks, 1);
});
test('repeated timestamps and long frame gaps cannot manufacture blinks or cue time', () => {
    const d = driver(); d.run(2500);
    const before = d.engine.visibleMs;
    d.engine.update({ timestamp: d.now(), signals, blendshapes: blend });
    assert.equal(d.engine.visibleMs, before);
    d.run(100, { blendshapes: { ...blend, eyeBlinkLeft: 1, eyeBlinkRight: 1 } });
    d.engine.update({ timestamp: d.now() + 900, signals, blendshapes: blend });
    assert.equal(d.engine.blinks, 0);
});
