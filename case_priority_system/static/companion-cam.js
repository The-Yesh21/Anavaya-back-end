/**
 * Chakshu AI — Mobile Companion Camera Client
 * Connects mobile phone camera directly into the Courtroom WebRTC mesh as a high-definition stream.
 * Renders real-time Biometric Face Alignment HUD receiving guidance feedback from the desktop judge station.
 * Upgraded with luxury dark judicial HUD, live telemetry, torch toggle, and Web Speech API voice coaching.
 */
(() => {
    "use strict";

    // 1. Resolve room ID
    const urlParams = new URLSearchParams(window.location.search);
    let roomId = urlParams.get("room") || "";
    if (!roomId) {
        const parts = window.location.pathname.split("/").filter(Boolean);
        // /court/{room_id}/companion
        if (parts.length >= 2 && parts[0] === "court") {
            roomId = parts[1];
        }
    }

    // Elements
    const videoEl = document.getElementById("mobile-video");
    const hudCanvas = document.getElementById("mobile-hud");
    const statusBadge = document.getElementById("status-badge");
    const statusText = document.getElementById("status-text");
    const flipCamBtn = document.getElementById("flip-cam-btn");
    const torchBtn = document.getElementById("torch-btn");
    const torchLabel = document.getElementById("torch-label");
    const headerVoiceBtn = document.getElementById("header-voice-btn");
    const headerVoiceLabel = document.getElementById("header-voice-label");
    const footerVoiceBtn = document.getElementById("footer-voice-btn");
    const footerVoiceIcon = document.getElementById("footer-voice-icon");
    const footerVoiceLabel = document.getElementById("footer-voice-label");
    const guidanceBanner = document.getElementById("guidance-banner");
    const guidanceIcon = document.getElementById("guidance-icon");
    const guidanceCategory = document.getElementById("guidance-category");
    const guidanceText = document.getElementById("guidance-text");
    const resTag = document.getElementById("resolution-tag");
    const telemetryFpsRes = document.getElementById("telemetry-fps-res");
    const telemetryPing = document.getElementById("telemetry-ping");
    const permCard = document.getElementById("permission-card");
    const grantBtn = document.getElementById("grant-btn");

    const state = {
        roomId: roomId || "courtroom",
        facingMode: "user",
        localStream: null,
        ws: null,
        sessionToken: "",
        myId: "",
        peers: new Map(), // pid -> { pc, iceCandidates }
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" }
        ],
        alignmentFeedback: {
            status: "searching",
            quality: 0,
            roll: 0,
            yaw: 1,
            pitch: 0.40,
            scale: 0,
            guidance: "Position face inside guide",
            isOptimal: false,
            countdown: 0
        },
        lastFeedbackAt: 0,
        holdProgress: 0,
        rafId: null,

        // Voice Coaching State
        voiceEnabled: true,
        lastSpokenAt: 0,
        lastGuidanceSpoken: "",
        speaking: false,

        // Hardware Controls State
        torchActive: false,
        torchSupported: false,

        // Telemetry State
        currentRes: "1080p 60FPS",
        currentFps: 60,
        currentPingMs: 24
    };

    function setStatus(text, type = "default") {
        if (!statusText || !statusBadge) return;
        statusText.textContent = text;
        statusBadge.className = "status-pill " + type;
    }

    // =========================================================================
    // VOICE COACHING & AUDIO UNLOCK (Web Speech API)
    // =========================================================================
    let audioUnlocked = false;
    function unlockAudioPlayback() {
        if (audioUnlocked) return;
        audioUnlocked = true;
        if ("speechSynthesis" in window) {
            try {
                const u = new SpeechSynthesisUtterance("");
                u.volume = 0;
                window.speechSynthesis.speak(u);
            } catch (_) {}
        }
    }
    window.addEventListener("click", unlockAudioPlayback, { once: true, passive: true });
    window.addEventListener("touchstart", unlockAudioPlayback, { once: true, passive: true });

    function updateVoiceUI() {
        if (headerVoiceBtn) {
            headerVoiceBtn.className = "voice-coach-btn " + (state.voiceEnabled ? "active" : "muted") + (state.speaking ? " speaking" : "");
            if (headerVoiceLabel) {
                headerVoiceLabel.textContent = state.voiceEnabled ? "🔊 Voice Guide (On)" : "🔇 Voice Guide (Off)";
            }
        }
        if (footerVoiceBtn) {
            footerVoiceBtn.className = "btn-ctrl " + (state.voiceEnabled ? "active" : "");
            if (footerVoiceIcon) {
                footerVoiceIcon.textContent = state.voiceEnabled ? "🔊" : "🔇";
            }
            if (footerVoiceLabel) {
                footerVoiceLabel.textContent = state.voiceEnabled ? "Voice On" : "Voice Muted";
            }
        }
    }

    function toggleVoiceGuide() {
        unlockAudioPlayback();
        state.voiceEnabled = !state.voiceEnabled;
        if (!state.voiceEnabled) {
            if ("speechSynthesis" in window) {
                try { window.speechSynthesis.cancel(); } catch (_) {}
            }
            state.speaking = false;
        }
        updateVoiceUI();
    }

    function speakVoiceCommand(spokenText) {
        if (!state.voiceEnabled) return;
        if (!spokenText) return;
        if (!("speechSynthesis" in window)) return;

        const now = Date.now();
        const timeSince = now - state.lastSpokenAt;

        // Throttle speech to at most once every 3.5 - 4.0 seconds to prevent chatter
        if (spokenText === state.lastGuidanceSpoken && timeSince < 4000) {
            return;
        }
        if (timeSince < 3500) {
            return;
        }

        try {
            // Cancel previous utterance before speaking a new command
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(spokenText);
            utterance.rate = 1.02;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            utterance.lang = "en-US";

            utterance.onstart = () => {
                state.speaking = true;
                updateVoiceUI();
            };
            utterance.onend = () => {
                state.speaking = false;
                updateVoiceUI();
            };
            utterance.onerror = () => {
                state.speaking = false;
                updateVoiceUI();
            };

            state.lastSpokenAt = now;
            state.lastGuidanceSpoken = spokenText;
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.warn("Speech synthesis failure:", e);
            state.speaking = false;
            updateVoiceUI();
        }
    }

    // =========================================================================
    // GUIDANCE BANNER & HUD LOGIC
    // =========================================================================
    function updateGuidanceBannerUI(instruction, mode, icon = "🎯", category = "Biometric Face Alignment") {
        if (!guidanceBanner || !guidanceText) return;

        guidanceBanner.className = "guidance-banner " + mode;
        guidanceText.textContent = instruction;
        if (guidanceIcon) guidanceIcon.textContent = icon;
        if (guidanceCategory) guidanceCategory.textContent = category;
    }

    function processAlignmentFeedback(alignment) {
        if (!alignment) return;
        const { isOptimal, guidance = "", roll = 0, yaw = 1, pitch = 0.40, scale = 0 } = alignment;
        const gLower = (guidance || "").toLowerCase();

        if (isOptimal) {
            updateGuidanceBannerUI("OPTIMAL ALIGNMENT - HOLD STEADY", "optimal", "✨", "Biometric Lock Acquired");
            speakVoiceCommand("Optimal alignment acquired. Please remain steady.");
            return;
        }

        // 1. Too far from camera
        if (gLower.includes("closer") || (scale > 0 && scale < 0.17)) {
            updateGuidanceBannerUI("MOVE CLOSER", "correcting", "🔍", "Distance Adjustment");
            speakVoiceCommand("Please move closer to the camera.");
        }
        // 2. Too close to camera
        else if (gLower.includes("further") || gLower.includes("back") || scale > 0.35) {
            updateGuidanceBannerUI("STEP BACK", "correcting", "📏", "Distance Adjustment");
            speakVoiceCommand("Please step slightly back.");
        }
        // 3. Face turned / Yaw offset
        else if (gLower.includes("turn") || gLower.includes("face right") || gLower.includes("face left") || Math.abs(yaw - 1) > 0.16) {
            updateGuidanceBannerUI("TURN FACE TO CENTER", "correcting", "🔄", "Orientation Adjustment");
            speakVoiceCommand("Please face the camera directly.");
        }
        // 4. Head tilted / Pitch or Roll offset
        else if (gLower.includes("tilt") || gLower.includes("chin") || gLower.includes("level") || Math.abs(roll) > 5.0 || Math.abs(pitch - 0.40) > 0.08) {
            updateGuidanceBannerUI("KEEP HEAD LEVEL", "correcting", "⚖️", "Posture Adjustment");
            speakVoiceCommand("Please keep your head level.");
        }
        // 5. General centering
        else if (gLower.includes("center") || gLower.includes("right") || gLower.includes("left")) {
            updateGuidanceBannerUI("ALIGNING... CENTER FACE IN GUIDE", "correcting", "🎯", "Position Adjustment");
        }
        // 6. Searching
        else {
            updateGuidanceBannerUI("ALIGNING... POSITION FACE IN GUIDE", "searching", "🎯", "Biometric Face Alignment");
        }
    }

    // =========================================================================
    // HARDWARE CONTROLS (Torch / Flashlight & Camera Switch)
    // =========================================================================
    function inspectTorchSupport() {
        if (!state.localStream) return;
        const track = state.localStream.getVideoTracks()[0];
        if (!track) return;

        try {
            const caps = track.getCapabilities ? track.getCapabilities() : {};
            state.torchSupported = Boolean(caps && "torch" in caps && caps.torch);
            if (torchBtn) {
                torchBtn.disabled = !state.torchSupported;
                torchBtn.style.display = state.torchSupported ? "inline-flex" : "none";
            }
        } catch (_) {
            state.torchSupported = false;
            if (torchBtn) torchBtn.style.display = "none";
        }
        updateTorchUI();
    }

    function updateTorchUI() {
        if (!torchBtn || !torchLabel) return;
        torchBtn.className = "btn-ctrl " + (state.torchActive ? "active" : "");
        torchLabel.textContent = state.torchActive ? "Torch On" : "Torch Off";
    }

    async function toggleTorch() {
        if (!state.localStream || !state.torchSupported) return;
        const track = state.localStream.getVideoTracks()[0];
        if (!track) return;

        try {
            state.torchActive = !state.torchActive;
            await track.applyConstraints({
                advanced: [{ torch: state.torchActive }]
            });
            updateTorchUI();
        } catch (err) {
            console.warn("Torch constraint application error:", err);
            state.torchActive = false;
            updateTorchUI();
        }
    }

    // =========================================================================
    // TELEMETRY & NETWORK STATS
    // =========================================================================
    async function refreshTelemetry() {
        if (!state.peers || state.peers.size === 0) {
            if (telemetryPing) telemetryPing.textContent = "24ms latency";
            return;
        }

        for (const [, peer] of state.peers) {
            if (!peer.pc) continue;
            try {
                const stats = await peer.pc.getStats();
                stats.forEach(report => {
                    if (report.type === "candidate-pair" && report.state === "succeeded") {
                        if (typeof report.currentRoundTripTime === "number") {
                            state.currentPingMs = Math.max(8, Math.round(report.currentRoundTripTime * 1000));
                        }
                    }
                    if (report.type === "outbound-rtp" && report.kind === "video") {
                        if (typeof report.framesPerSecond === "number" && report.framesPerSecond > 0) {
                            state.currentFps = Math.round(report.framesPerSecond);
                        }
                    }
                });
            } catch (_) {}
        }

        if (telemetryPing) {
            telemetryPing.textContent = `${state.currentPingMs}ms latency`;
        }
        if (telemetryFpsRes) {
            telemetryFpsRes.textContent = state.currentRes;
        }
    }
    setInterval(refreshTelemetry, 2000);

    // =========================================================================
    // ICE CONFIG & CAMERA
    // =========================================================================
    async function loadIceConfig() {
        try {
            const res = await fetch("/api/court/turn-credentials");
            if (res.ok) {
                const data = await res.json();
                if (data.enabled && Array.isArray(data.iceServers) && data.iceServers.length) {
                    state.iceServers = data.iceServers;
                    return;
                }
            }
        } catch (_) {}
        try {
            const res = await fetch("/api/court/rtc-config");
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.iceServers) && data.iceServers.length) {
                    state.iceServers = data.iceServers;
                }
            }
        } catch (_) {}
    }

    async function initCamera() {
        if (state.localStream) {
            state.localStream.getTracks().forEach(t => t.stop());
            state.localStream = null;
        }
        state.torchActive = false;

        const constraints = {
            audio: false,
            video: {
                facingMode: state.facingMode,
                width: { ideal: 1920, max: 3840 },
                height: { ideal: 1080, max: 2160 },
                frameRate: { ideal: 30 }
            }
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            state.localStream = stream;
            videoEl.srcObject = stream;
            videoEl.classList.toggle("rear", state.facingMode === "environment");

            if (permCard) permCard.classList.remove("active");

            // Inspect actual resolution
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                const settings = videoTrack.getSettings ? videoTrack.getSettings() : {};
                const w = settings.width || 1920;
                const h = settings.height || 1080;
                const fps = Math.round(settings.frameRate || 60);
                const is4K = (w >= 3840 || h >= 2160);
                state.currentRes = is4K ? `4K ${fps}FPS` : `${w}x${h} ${fps}FPS`;

                if (resTag) resTag.textContent = state.currentRes;
                if (telemetryFpsRes) telemetryFpsRes.textContent = state.currentRes;

                // Update tracks in existing peer connections
                state.peers.forEach(({ pc }) => {
                    const senders = pc.getSenders();
                    const videoSender = senders.find(s => s.track && s.track.kind === "video");
                    if (videoSender) {
                        videoSender.replaceTrack(videoTrack).catch(() => {});
                    } else {
                        pc.addTrack(videoTrack, stream);
                    }
                });
            }

            inspectTorchSupport();
            if (!state.ws) connectSignaling();
        } catch (err) {
            console.error("Camera access failed:", err);
            if (permCard) permCard.classList.add("active");
            setStatus("Camera Blocked", "default");
        }
    }

    // =========================================================================
    // WEBSOCKET SIGNALING & WEBRTC MESH
    // =========================================================================
    function connectSignaling() {
        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${proto}//${window.location.host}/ws/court/${state.roomId}`;
        setStatus("Connecting...", "default");

        const ws = new WebSocket(wsUrl);
        state.ws = ws;

        ws.onopen = () => {
            console.log("WebSocket connected to courtroom:", state.roomId);
            setStatus("Registering...", "default");
            // Join as Companion Camera
            ws.send(JSON.stringify({
                type: "join",
                name: "Mobile 4K Witness Cam",
                role: "Companion"
            }));
        };

        ws.onmessage = async (event) => {
            try {
                const msg = JSON.parse(event.data);
                await handleSignalingMessage(msg);
            } catch (e) {
                console.error("Companion signaling error:", e);
            }
        };

        ws.onclose = () => {
            for (const { pc } of state.peers.values()) pc.close();
            state.peers.clear();
            console.warn("WebSocket closed. Reconnecting in 3s...");
            setStatus("Disconnected", "default");
            setTimeout(connectSignaling, 3000);
        };

        ws.onerror = (e) => {
            console.error("WebSocket error:", e);
        };
    }

    async function handleSignalingMessage(msg) {
        switch (msg.type) {
            case "room_state": {
                state.myId = msg.me ? msg.me.participant_id : "";
                state.sessionToken = msg.session_token || "";
                setStatus("Joined · Connecting video", "online");

                // As newcomer, initiate WebRTC offer to all existing participants (Judge, etc.)
                const participants = msg.room && msg.room.participants ? msg.room.participants : [];
                for (const p of participants) {
                    if (p.participant_id !== state.myId) {
                        await initiatePeerConnection(p.participant_id);
                    }
                }
                break;
            }

            case "participant_joined": {
                const pid = msg.participant ? msg.participant.participant_id : null;
                if (pid && pid !== state.myId && !state.peers.has(pid)) {
                    getOrCreatePeerConnection(pid);
                }
                break;
            }

            case "sdp_offer": {
                const remotePid = msg.from_participant_id;
                const pc = getOrCreatePeerConnection(remotePid);
                await pc.setRemoteDescription(new RTCSessionDescription(msg.data));
                await flushIceCandidates(remotePid);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                state.ws.send(JSON.stringify({
                    type: "sdp_answer",
                    target_participant_id: remotePid,
                    data: answer
                }));
                break;
            }

            case "sdp_answer": {
                const remotePid = msg.from_participant_id;
                const peer = state.peers.get(remotePid);
                if (peer && peer.pc) {
                    await peer.pc.setRemoteDescription(new RTCSessionDescription(msg.data));
                    await flushIceCandidates(remotePid);
                }
                break;
            }

            case "ice_candidate": {
                const remotePid = msg.from_participant_id;
                if (!remotePid || !msg.data) break;
                getOrCreatePeerConnection(remotePid);
                state.peers.get(remotePid).iceCandidates.push(msg.data);
                await flushIceCandidates(remotePid);
                break;
            }

            case "participant_left": {
                const peer = state.peers.get(msg.participant_id);
                if (peer) peer.pc.close();
                state.peers.delete(msg.participant_id);
                break;
            }

            case "alignment_feedback": {
                if (msg.alignment) {
                    state.alignmentFeedback = msg.alignment;
                    state.lastFeedbackAt = Date.now();
                    processAlignmentFeedback(msg.alignment);
                }
                break;
            }
        }
    }

    async function flushIceCandidates(remotePid) {
        const peer = state.peers.get(remotePid);
        if (!peer?.pc.remoteDescription) return;
        for (const candidate of peer.iceCandidates.splice(0)) {
            try {
                await peer.pc.addIceCandidate(candidate);
            } catch (error) {
                console.warn("Error adding ICE candidate:", error);
            }
        }
    }

    function getOrCreatePeerConnection(remotePid) {
        if (state.peers.has(remotePid)) {
            return state.peers.get(remotePid).pc;
        }

        const pc = new RTCPeerConnection({ iceServers: state.iceServers });

        if (state.localStream) {
            state.localStream.getTracks().forEach(track => {
                pc.addTrack(track, state.localStream);
            });
        }

        pc.onicecandidate = (e) => {
            if (e.candidate && state.ws && state.ws.readyState === WebSocket.OPEN) {
                state.ws.send(JSON.stringify({
                    type: "ice_candidate",
                    target_participant_id: remotePid,
                    data: e.candidate
                }));
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`Peer ${remotePid} connection state:`, pc.connectionState);
            if (pc.connectionState === "connected") {
                setStatus("Video connected", "streaming");
            } else if (pc.connectionState === "failed" &&
                ![...state.peers.values()].some(peer => peer.pc.connectionState === "connected")) {
                setStatus("Video connection failed", "default");
            }
        };

        // DataChannel for low-latency biometric alignment sync
        pc.ondatachannel = (e) => {
            const dc = e.channel;
            dc.onmessage = (evt) => {
                try {
                    const data = JSON.parse(evt.data);
                    if (data.type === "alignment_feedback" && data.alignment) {
                        state.alignmentFeedback = data.alignment;
                        state.lastFeedbackAt = Date.now();
                        processAlignmentFeedback(data.alignment);
                    }
                } catch (_) {}
            };
        };

        state.peers.set(remotePid, { pc, iceCandidates: [] });
        return pc;
    }

    async function initiatePeerConnection(remotePid) {
        const pc = getOrCreatePeerConnection(remotePid);
        try {
            const dc = pc.createDataChannel("companion_ctrl");
            dc.onmessage = (evt) => {
                try {
                    const data = JSON.parse(evt.data);
                    if (data.type === "alignment_feedback" && data.alignment) {
                        state.alignmentFeedback = data.alignment;
                        state.lastFeedbackAt = Date.now();
                        processAlignmentFeedback(data.alignment);
                    }
                } catch (_) {}
            };
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            state.ws.send(JSON.stringify({
                type: "sdp_offer",
                target_participant_id: remotePid,
                data: offer
            }));
        } catch (e) {
            console.error("Failed to initiate offer:", e);
        }
    }

    // =========================================================================
    // CANVAS HUD RENDERING LOOP
    // =========================================================================
    function resizeCanvas() {
        if (!hudCanvas) return;
        const rect = hudCanvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        hudCanvas.width = rect.width * dpr;
        hudCanvas.height = rect.height * dpr;
    }

    function renderHUD() {
        if (hudCanvas) {
            const ctx = hudCanvas.getContext("2d");
            ctx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);

            // Compute stability progress
            const now = Date.now();
            const feedback = state.alignmentFeedback;
            const isFresh = (now - state.lastFeedbackAt) < 2200;

            let pose = feedback;
            if (!isFresh) {
                pose = {
                    status: "searching",
                    quality: 0,
                    roll: 0,
                    yaw: 1,
                    pitch: 0.40,
                    scale: 0,
                    guidance: "Position face inside guide",
                    isOptimal: false
                };
                state.holdProgress = 0;
                updateGuidanceBannerUI("ALIGNING... POSITION FACE IN GUIDE", "searching", "🎯");
            } else if (pose.isOptimal) {
                state.holdProgress = Math.min(1, state.holdProgress + 0.016 / 2.0);
                if (feedback && feedback.emotion && state.holdProgress >= 0.85) {
                    updateGuidanceBannerUI(`${feedback.emotion.label.toUpperCase()} · ${feedback.emotion.stressIndex}% STRESS`, "optimal", "🧠");
                }
            } else {
                state.holdProgress = Math.max(0, state.holdProgress - 0.05);
            }

            if (window.AnavayaFaceObservations && window.AnavayaFaceObservations.drawBiometricAlignmentHUD) {
                window.AnavayaFaceObservations.drawBiometricAlignmentHUD(
                    ctx,
                    hudCanvas.width,
                    hudCanvas.height,
                    pose,
                    state.holdProgress
                );
            }
        }
        state.rafId = requestAnimationFrame(renderHUD);
    }

    // =========================================================================
    // EVENT LISTENERS & USER INTERACTIONS
    // =========================================================================
    if (flipCamBtn) {
        flipCamBtn.addEventListener("click", () => {
            unlockAudioPlayback();
            state.facingMode = state.facingMode === "user" ? "environment" : "user";
            initCamera();
        });
    }

    if (torchBtn) {
        torchBtn.addEventListener("click", () => {
            unlockAudioPlayback();
            toggleTorch();
        });
    }

    if (headerVoiceBtn) {
        headerVoiceBtn.addEventListener("click", toggleVoiceGuide);
    }

    if (footerVoiceBtn) {
        footerVoiceBtn.addEventListener("click", toggleVoiceGuide);
    }

    if (grantBtn) {
        grantBtn.addEventListener("click", () => {
            unlockAudioPlayback();
            initCamera();
        });
    }

    window.addEventListener("resize", resizeCanvas);

    // Boot
    async function boot() {
        resizeCanvas();
        updateVoiceUI();
        await loadIceConfig();
        await initCamera();
        renderHUD();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
