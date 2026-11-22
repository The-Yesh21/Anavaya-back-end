/* Facial actions, not mental-state inference. No stress/emotion probabilities. */
(function (root) {
    "use strict";
    const clamp = (x) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
    const labels = {
        smile: "Lip corners raised", brow_raise: "Brows raised", brow_lower: "Brows lowered",
        eye_wide: "Eyes widened", eye_squint: "Eyes narrowed", nose_wrinkle: "Nose wrinkled",
        lip_press: "Lips pressed", mouth_open: "Mouth open", mouth_frown: "Lip corners lowered",
    };
    const required = ["ear", "lipOpen", "gazeX"];
    class Engine {
        constructor() { this.reset(); }
        reset() {
            this.last = null;
            this.lastValid = null;
            this.samples = [];
            this.calibrationMs = 0;
            this.baseline = null;
            this.smoothed = {};
            this.held = {};
            this.closedAt = null;
            this.blinkTimes = [];
            this.blinks = 0;
            this.visibleMs = 0;
            this.speakingMs = 0;
            this.cueMs = 0;
            this.durations = {};
            this.windows = [];
            this.lastOutput = this.unavailable("Waiting for a clear face");
        }
        unavailable(reason) {
            return { status: "unavailable", reason, stress: null, emotion: null,
                activity: null, actions: {}, active: [], blinkRate: null, gaze: "Unavailable" };
        }
        pause(now, reason = "No clear face") {
            this.last = now;
            this.closedAt = null;
            this.smoothed = {};
            this.held = {};
            this.lastOutput = this.unavailable(reason);
            return this.lastOutput;
        }
        update({ timestamp, signals, blendshapes = {}, speaking = false, valid = true }) {
            if (!Number.isFinite(timestamp) || (this.last !== null && timestamp <= this.last)) {
                return this.lastOutput;
            }
            if (!valid || !signals || !required.every(k => Number.isFinite(signals[k])) ||
                signals.ear < 0 || signals.ear > 1 || signals.lipOpen < 0 || signals.lipOpen > 1 || Math.abs(signals.gazeX) > 1) {
                return this.pause(timestamp, "Tracking unavailable — check framing, lighting and eye visibility");
            }
            const elapsed = this.lastValid === null ? 0 : timestamp - this.lastValid;
            if (elapsed > 500) { this.closedAt = null; this.smoothed = {}; this.held = {}; }
            if (elapsed > 2000) {
                // A face may have changed. Never reuse a stale person's reference.
                this.baseline = null; this.samples = []; this.calibrationMs = 0;
                this.closedAt = null; this.smoothed = {}; this.held = {};
            }
            const dt = this.last !== null && timestamp - this.last <= 500 ? timestamp - this.last : 0;
            this.last = timestamp; this.lastValid = timestamp;
            this.visibleMs += dt;
            if (speaking) this.speakingMs += dt;
            this.windows.push({ t: timestamp, dt });
            while (this.windows.length && this.windows[0].t < timestamp - 20000) this.windows.shift();
            const b = (key) => clamp(blendshapes[key]);
            const pair = (key) => (b(key + "Left") + b(key + "Right")) / 2;
            const hasEyes = Number.isFinite(blendshapes.eyeBlinkLeft) && Number.isFinite(blendshapes.eyeBlinkRight);
            if (!this.baseline) {
                // Eyes closed and speech are unsuitable for a quiet reference.
                if (!speaking && signals.ear > 0.12 && (!hasEyes || Math.max(b("eyeBlinkLeft"), b("eyeBlinkRight")) < 0.35)) {
                    this.samples.push({ ear: signals.ear, gazeX: signals.gazeX });
                    this.calibrationMs += dt;
                }
                if (this.calibrationMs >= 2000 && this.samples.length >= 20) {
                    const median = (key) => {
                        const values = this.samples.map(s => s[key]).sort((a, c) => a - c);
                        return values[Math.floor(values.length / 2)];
                    };
                    this.baseline = { ear: median("ear"), gazeX: median("gazeX") };
                    this.samples = [];
                } else {
                    this.lastOutput = { ...this.unavailable("Calibration: face forward with eyes open; pause speaking"),
                        status: "calibrating", progress: Math.min(99, Math.round(this.calibrationMs / 20)) };
                    return this.lastOutput;
                }
            }
            // Bilateral closure + reopening with duration bounds and hysteresis.
            const closed = hasEyes ? Math.min(b("eyeBlinkLeft"), b("eyeBlinkRight")) > 0.60 : signals.ear < this.baseline.ear * 0.60;
            const open = hasEyes ? Math.max(b("eyeBlinkLeft"), b("eyeBlinkRight")) < 0.25 : signals.ear > this.baseline.ear * 0.82;
            if (closed && this.closedAt === null) this.closedAt = timestamp;
            if (open && this.closedAt !== null) {
                const duration = timestamp - this.closedAt;
                if (duration >= 60 && duration <= 600 && (this.blinkTimes.length === 0 || timestamp - this.blinkTimes.at(-1) >= 200)) {
                    this.blinks++; this.blinkTimes.push(timestamp);
                }
                this.closedAt = null;
            }
            while (this.blinkTimes.length && this.blinkTimes[0] < timestamp - 20000) this.blinkTimes.shift();
            const observedMs = this.windows.reduce((sum, w) => sum + w.dt, 0);
            const blinkRate = observedMs >= 10000 ? Math.round(this.blinkTimes.length * 60000 / observedMs) : null;
            // These are independent activation coefficients, not normalized class probabilities.
            const raw = {
                smile: pair("mouthSmile"), brow_raise: Math.max(b("browInnerUp"), pair("browOuterUp")),
                brow_lower: pair("browDown"), eye_wide: pair("eyeWide"), eye_squint: pair("eyeSquint"),
                nose_wrinkle: pair("noseSneer"), lip_press: pair("mouthPress"),
                mouth_open: b("jawOpen"), mouth_frown: pair("mouthFrown"),
            };
            const actions = {}, active = [];
            const supplied = (...keys) => keys.every(k => Number.isFinite(blendshapes[k]));
            const available = {
                smile: supplied("mouthSmileLeft", "mouthSmileRight"),
                brow_raise: supplied("browInnerUp") || supplied("browOuterUpLeft", "browOuterUpRight"),
                brow_lower: supplied("browDownLeft", "browDownRight"),
                eye_wide: supplied("eyeWideLeft", "eyeWideRight"),
                eye_squint: supplied("eyeSquintLeft", "eyeSquintRight"),
                nose_wrinkle: supplied("noseSneerLeft", "noseSneerRight"),
                lip_press: supplied("mouthPressLeft", "mouthPressRight"),
                mouth_open: supplied("jawOpen"),
                mouth_frown: supplied("mouthFrownLeft", "mouthFrownRight"),
            };
            const hasBlend = Object.values(available).some(Boolean);
            for (const [key, value] of Object.entries(raw)) {
                const mouth = ["smile", "lip_press", "mouth_open", "mouth_frown", "nose_wrinkle"].includes(key);
                if (!available[key] || (speaking && mouth)) {
                    this.smoothed[key] = 0; this.held[key] = 0; actions[key] = null; continue;
                }
                const alpha = 1 - Math.exp(-dt / 180);
                this.smoothed[key] = (this.smoothed[key] || 0) + alpha * (value - (this.smoothed[key] || 0));
                this.held[key] = this.smoothed[key] >= 0.50 ? (this.held[key] || 0) + dt : 0;
                actions[key] = Math.round(this.smoothed[key] * 100);
                if (this.held[key] >= 350) {
                    active.push(key);
                    this.durations[key] = (this.durations[key] || 0) + dt;
                }
            }
            if (active.length) this.cueMs += dt; // Union of intervals, never sum overlapping cues.
            const offset = signals.gazeX - this.baseline.gazeX;
            const gaze = !open ? "Unavailable while eyes close" : Math.abs(offset) < 0.12 ? "Near reference" : offset > 0 ? "Image-right of reference" : "Image-left of reference";
            this.lastOutput = { status: "ready", reason: hasBlend ? "Facial actions available" : "Eye measurements only — expression model unavailable",
                stress: null, emotion: null, actions, active, blinkRate, gaze, blinks: this.blinks,
                speaking, activity: hasBlend ? Math.max(0, ...active.map(k => actions[k])) : null };
            return this.lastOutput;
        }
        summary() {
            return { measurements_version: 2, stress: null, emotion: null,
                visible_sec: +(this.visibleMs / 1000).toFixed(2),
                time_speaking_sec: +(this.speakingMs / 1000).toFixed(2),
                cue_observed_sec: +(this.cueMs / 1000).toFixed(2), blink_count: this.blinks,
                counters: Object.fromEntries(Object.entries(this.durations).map(([k, v]) => [k, +(v / 1000).toFixed(2)])) };
        }
    }
    function usableLandmarks(lm) {
        if (!Array.isArray(lm) || lm.length < 478) return false;
        if (!lm.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))) return false;
        const indices = [33, 133, 263, 362, 13, 14, 159, 386, 468, 473];
        if (!indices.every(i => lm[i] && Number.isFinite(lm[i].x) && Number.isFinite(lm[i].y) &&
            lm[i].x >= 0 && lm[i].x <= 1 && lm[i].y >= 0 && lm[i].y <= 1)) return false;
        const dist = (a, b) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);
        const left = dist(33, 133), right = dist(263, 362);
        return dist(33, 263) > 0.08 && Math.min(left, right) > 0.015 && Math.max(left, right) / Math.min(left, right) < 1.8;
    }
    root.AnavayaFaceObservations = { Engine, labels, usableLandmarks };
    if (typeof module !== "undefined") module.exports = root.AnavayaFaceObservations;
})(typeof window !== "undefined" ? window : globalThis);
