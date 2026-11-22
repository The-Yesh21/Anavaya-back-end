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
        if (!Array.isArray(lm) || lm.length < 468) return false;
        if (!lm.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))) return false;
        const indices = [33, 133, 263, 362, 13, 14, 159, 386];
        if (lm.length >= 478) indices.push(468, 473);
        if (!indices.every(i => lm[i] && Number.isFinite(lm[i].x) && Number.isFinite(lm[i].y) &&
            lm[i].x >= 0 && lm[i].x <= 1 && lm[i].y >= 0 && lm[i].y <= 1)) return false;
        const dist = (a, b) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);
        const left = dist(33, 133), right = dist(263, 362);
        return dist(33, 263) > 0.05 && Math.min(left, right) > 0.01 && Math.max(left, right) / Math.max(1e-4, Math.min(left, right)) < 2.5;
    }

    /**
     * ISO/IEC 19794-5 Biometric Face Framing & Pose Estimation
     * Computes Roll, Yaw, Pitch, Scale, and Centering from MediaPipe 478 landmarks.
     */
    function calculateBiometricPose(lm) {
        if (!usableLandmarks(lm)) {
            return {
                status: "searching",
                quality: 0,
                roll: 0,
                yaw: 1,
                pitch: 0.40,
                scale: 0,
                centerOffset: 1,
                guidance: "Position face inside the oval reticle",
                isOptimal: false,
                metrics: { rollOk: false, yawOk: false, pitchOk: false, scaleOk: false, centerOk: false }
            };
        }

        const dx = lm[263].x - lm[33].x;
        const dy = lm[263].y - lm[33].y;
        const rollDeg = Math.atan2(dy, dx) * (180 / Math.PI);

        const dRight = Math.hypot(lm[1].x - lm[133].x, lm[1].y - lm[133].y);
        const dLeft = Math.hypot(lm[362].x - lm[1].x, lm[362].y - lm[1].y);
        const yawRatio = dRight / Math.max(1e-4, dLeft);

        const vertSpan = Math.max(1e-4, lm[152].y - lm[168].y);
        const pitchRatio = (lm[1].y - lm[168].y) / vertSpan;

        const scaleIod = Math.hypot(dx, dy);

        const eyeMidX = (lm[33].x + lm[263].x) / 2;
        const eyeMidY = (lm[33].y + lm[263].y) / 2;
        const targetCenterX = 0.50;
        const targetCenterY = 0.45;
        const centerOffset = Math.hypot(eyeMidX - targetCenterX, eyeMidY - targetCenterY);

        const rollOk = Math.abs(rollDeg) <= 4.5;
        const yawOk = yawRatio >= 0.84 && yawRatio <= 1.19;
        const pitchOk = pitchRatio >= 0.33 && pitchRatio <= 0.47;
        const scaleOk = scaleIod >= 0.17 && scaleIod <= 0.36;
        const centerOk = centerOffset <= 0.10;

        const isOptimal = rollOk && yawOk && pitchOk && scaleOk && centerOk;

        // Quality score: 0 to 100
        const rollScore = Math.max(0, 1 - Math.abs(rollDeg) / 15);
        const yawScore = Math.max(0, 1 - Math.abs(yawRatio - 1.0) / 0.4);
        const pitchScore = Math.max(0, 1 - Math.abs(pitchRatio - 0.40) / 0.15);
        const scaleScore = Math.max(0, 1 - Math.abs(scaleIod - 0.25) / 0.15);
        const centerScore = Math.max(0, 1 - centerOffset / 0.25);
        const quality = Math.round((rollScore * 25 + yawScore * 25 + pitchScore * 20 + scaleScore * 15 + centerScore * 15));

        let guidance = "Optimal alignment — hold steady";
        if (!centerOk) {
            guidance = eyeMidX < targetCenterX - 0.05 ? "Move slightly right" : eyeMidX > targetCenterX + 0.05 ? "Move slightly left" : "Center face in guide";
        } else if (!scaleOk) {
            guidance = scaleIod < 0.17 ? "Move closer to camera" : "Move further from camera";
        } else if (!rollOk) {
            guidance = rollDeg > 4.5 ? "Tilt head left" : "Tilt head right";
        } else if (!yawOk) {
            guidance = yawRatio < 0.84 ? "Turn face right" : "Turn face left";
        } else if (!pitchOk) {
            guidance = pitchRatio < 0.33 ? "Tilt chin down" : "Tilt chin up";
        }

        return {
            status: isOptimal ? "optimal" : "correcting",
            quality,
            roll: +rollDeg.toFixed(1),
            yaw: +yawRatio.toFixed(2),
            pitch: +pitchRatio.toFixed(2),
            scale: +scaleIod.toFixed(2),
            centerOffset: +centerOffset.toFixed(2),
            guidance,
            isOptimal,
            metrics: { rollOk, yawOk, pitchOk, scaleOk, centerOk }
        };
    }

    /**
     * Renders high-contrast Biometric Face Alignment HUD on canvas.
     */
    function drawBiometricAlignmentHUD(ctx, width, height, pose, holdProgress = 0) {
        if (!ctx || width <= 0 || height <= 0) return;
        ctx.save();

        const cx = width * 0.50;
        const cy = height * 0.46;
        const rx = width * 0.24;
        const ry = height * 0.34;

        const isOpt = pose && pose.isOptimal;
        const isCorrecting = pose && pose.status === "correcting";

        const strokeColor = isOpt ? "#10b981" : isCorrecting ? "#f59e0b" : "rgba(220, 220, 230, 0.4)";
        const glowColor = isOpt ? "rgba(16, 185, 129, 0.35)" : isCorrecting ? "rgba(245, 158, 11, 0.25)" : "rgba(255, 255, 255, 0.05)";

        // 1. Draw outer soft vignette / dark overlay outside oval guide
        ctx.fillStyle = "rgba(10, 15, 25, 0.25)";
        ctx.fillRect(0, 0, width, height);

        // 2. Clear oval opening so face shines through clearly
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.clip();
        ctx.clearRect(0, 0, width, height);
        ctx.restore();

        // 3. Draw biometric oval guide
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.lineWidth = isOpt ? 3 : 2;
        ctx.strokeStyle = strokeColor;
        if (!isOpt && !isCorrecting) ctx.setLineDash([8, 6]);
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = isOpt ? 12 : 6;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        // 4. Horizontal Eye Level Guide
        const eyeY = cy - ry * 0.18;
        ctx.beginPath();
        ctx.moveTo(cx - rx * 0.85, eyeY);
        ctx.lineTo(cx + rx * 0.85, eyeY);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = pose && pose.metrics && pose.metrics.rollOk ? "rgba(16, 185, 129, 0.75)" : "rgba(245, 158, 11, 0.75)";
        ctx.stroke();

        // Eye-level cross ticks
        [-rx * 0.5, rx * 0.5].forEach(ox => {
            ctx.beginPath();
            ctx.moveTo(cx + ox, eyeY - 6);
            ctx.lineTo(cx + ox, eyeY + 6);
            ctx.stroke();
        });

        // 5. Vertical Nose Midline
        ctx.beginPath();
        ctx.moveTo(cx, cy - ry * 0.5);
        ctx.lineTo(cx, cy + ry * 0.4);
        ctx.lineWidth = 1;
        ctx.strokeStyle = pose && pose.metrics && pose.metrics.yawOk ? "rgba(16, 185, 129, 0.5)" : "rgba(245, 158, 11, 0.5)";
        ctx.stroke();

        // 6. Stability Hold Progress Ring (when optimal)
        if (isOpt && holdProgress > 0) {
            const ringR = rx + 14;
            ctx.beginPath();
            ctx.arc(cx, cy, ringR, -Math.PI / 2, -Math.PI / 2 + (2 * Math.PI * Math.min(1, holdProgress)));
            ctx.lineWidth = 4;
            ctx.strokeStyle = "#10b981";
            ctx.shadowColor = "rgba(16, 185, 129, 0.8)";
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // 7. Top Guidance Badge Pill
        const msg = pose ? pose.guidance : "Position face inside guide";
        ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        const textWidth = ctx.measureText(msg).width;
        const pillW = Math.max(160, textWidth + 36);
        const pillH = 30;
        const pillX = cx - pillW / 2;
        const pillY = Math.max(14, cy - ry - 44);

        ctx.fillStyle = isOpt ? "rgba(16, 185, 129, 0.95)" : isCorrecting ? "rgba(245, 158, 11, 0.92)" : "rgba(30, 41, 59, 0.88)";
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 15);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(msg, cx, pillY + pillH / 2);

        // 8. Bottom Metrics Status Banner
        const bannerW = Math.min(width - 32, 380);
        const bannerH = 24;
        const bannerX = cx - bannerW / 2;
        const bannerY = Math.min(height - 34, cy + ry + 16);

        ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
        ctx.beginPath();
        ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 6);
        ctx.fill();

        ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
        const rollTxt = `Roll: ${pose ? pose.roll : 0}°`;
        const yawTxt = `Yaw: ${pose ? pose.yaw : 1.0}`;
        const qualTxt = `Quality: ${pose ? pose.quality : 0}%`;
        const statTxt = isOpt ? (holdProgress >= 1 ? "LOCKED" : `HOLD ${(2 * (1 - holdProgress)).toFixed(1)}s`) : "ALIGNING";

        ctx.fillText(`${rollTxt}  |  ${yawTxt}  |  ${qualTxt}  |  ${statTxt}`, cx, bannerY + bannerH / 2);

        ctx.restore();
    }

    root.AnavayaFaceObservations = { Engine, labels, usableLandmarks, calculateBiometricPose, drawBiometricAlignmentHUD };
    if (typeof module !== "undefined") module.exports = root.AnavayaFaceObservations;
})(typeof window !== "undefined" ? window : globalThis);
