/**
 * Chakshu AI — Mobile Companion Camera Client
 * Connects mobile phone camera directly into the Courtroom WebRTC mesh as a high-definition stream.
 * Renders real-time Biometric Face Alignment HUD receiving guidance feedback from the desktop judge station.
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
    const resTag = document.getElementById("resolution-tag");
    const permCard = document.getElementById("permission-card");
    const grantBtn = document.getElementById("grant-btn");

    const state = {
        roomId: roomId || "courtroom",
        facingMode: "user",
        localStream: null,
        ws: null,
        sessionToken: "",
        myId: "",
        peers: new Map(), // pid -> { pc, dc }
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
        rafId: null
    };

    function setStatus(text, type = "default") {
        if (!statusText || !statusBadge) return;
        statusText.textContent = text;
        statusBadge.className = "status-pill " + type;
    }

    // 2. Fetch ICE configuration (STUN/TURN)
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

    // 3. Camera capture
    async function initCamera() {
        if (state.localStream) {
            state.localStream.getTracks().forEach(t => t.stop());
            state.localStream = null;
        }

        const constraints = {
            audio: false,
            video: {
                facingMode: state.facingMode,
                width: { ideal: 1920, max: 3840 },
                height: { ideal: 1080, max: 2160 },
                frameRate: { ideal: 60, min: 30 }
            }
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            state.localStream = stream;
            videoEl.srcObject = stream;
            videoEl.classList.toggle("rear", state.facingMode === "environment");

            permCard.classList.remove("active");

            // Inspect actual resolution
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                const settings = videoTrack.getSettings ? videoTrack.getSettings() : {};
                const w = settings.width || 1920;
                const h = settings.height || 1080;
                const fps = Math.round(settings.frameRate || 30);
                if (resTag) resTag.textContent = `${w}x${h} ${fps}fps`;

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

            setStatus("Camera Ready", "online");
        } catch (err) {
            console.error("Camera access failed:", err);
            permCard.classList.add("active");
            setStatus("Camera Blocked", "default");
        }
    }

    // 4. WebSocket Signaling
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
                handleSignalingMessage(msg);
            } catch (e) {
                console.error("Signaling parse error:", e);
            }
        };

        ws.onclose = () => {
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
                setStatus("Connected • Active", "online");

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
                    // Prepare peer connection to receive or offer
                    getOrCreatePeerConnection(pid);
                }
                break;
            }

            case "sdp_offer": {
                const remotePid = msg.from_participant_id;
                const pc = getOrCreatePeerConnection(remotePid);
                await pc.setRemoteDescription(new RTCSessionDescription(msg.data));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                state.ws.send(JSON.stringify({
                    type: "sdp_answer",
                    target_participant_id: remotePid,
                    data: answer
                }));
                setStatus("Streaming Live", "streaming");
                break;
            }

            case "sdp_answer": {
                const remotePid = msg.from_participant_id;
                const peer = state.peers.get(remotePid);
                if (peer && peer.pc) {
                    await peer.pc.setRemoteDescription(new RTCSessionDescription(msg.data));
                    setStatus("Streaming Live", "streaming");
                }
                break;
            }

            case "ice_candidate": {
                const remotePid = msg.from_participant_id;
                const peer = state.peers.get(remotePid);
                if (peer && peer.pc && msg.data) {
                    try {
                        await peer.pc.addIceCandidate(new RTCIceCandidate(msg.data));
                    } catch (e) {
                        console.warn("Error adding ICE candidate:", e);
                    }
                }
                break;
            }

            case "alignment_feedback": {
                if (msg.alignment) {
                    state.alignmentFeedback = msg.alignment;
                    state.lastFeedbackAt = Date.now();
                }
                break;
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
                setStatus("Streaming Live (4K)", "streaming");
            }
        };

        // DataChannel for low-latency alignment sync
        pc.ondatachannel = (e) => {
            const dc = e.channel;
            dc.onmessage = (evt) => {
                try {
                    const data = JSON.parse(evt.data);
                    if (data.type === "alignment_feedback" && data.alignment) {
                        state.alignmentFeedback = data.alignment;
                        state.lastFeedbackAt = Date.now();
                    }
                } catch (_) {}
            };
        };

        state.peers.set(remotePid, { pc });
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

    // 5. Canvas HUD Rendering Loop
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
            const dpr = window.devicePixelRatio || 1;
            ctx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);

            // Compute stability progress
            const now = Date.now();
            const feedback = state.alignmentFeedback;
            const isFresh = (now - state.lastFeedbackAt) < 2000;

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
            } else if (pose.isOptimal) {
                state.holdProgress = Math.min(1, state.holdProgress + 0.016 / 2.0);
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

    // 6. User Interactions
    if (flipCamBtn) {
        flipCamBtn.addEventListener("click", () => {
            state.facingMode = state.facingMode === "user" ? "environment" : "user";
            initCamera();
        });
    }

    if (grantBtn) {
        grantBtn.addEventListener("click", () => {
            initCamera();
        });
    }

    window.addEventListener("resize", resizeCanvas);

    // Boot
    async function boot() {
        resizeCanvas();
        await loadIceConfig();
        await initCamera();
        connectSignaling();
        renderHUD();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
