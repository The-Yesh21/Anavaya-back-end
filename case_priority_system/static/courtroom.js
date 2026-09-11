/* ============================================================
   Anavaya — Live Courtroom client
   - WebSocket signaling at /ws/court/{room_id}
   - WebRTC full-mesh audio (newcomer initiates offers)
   - Live transcript + structured courtroom actions
   ============================================================ */

(() => {
    "use strict";

    // ---- resolve room id from the URL -----------------------------------
    const pathParts = window.location.pathname.split("/");
    const ROOM_ID = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];

    // ---- role metadata (mirrors the backend) ----------------------------
    const ROLES = [
        { id: "Judge",        label: "Judge",             tag: "Presides, rules" },
        { id: "Defence",      label: "Defence Counsel",   tag: "Defends accused" },
        { id: "Prosecution",  label: "Prosecution",       tag: "Argues the case" },
        { id: "Witness",      label: "Witness",           tag: "Gives testimony" },
    ];
    const ROLE_ACCENT = {
        Judge: "#A87E2F",
        Defence: "#C25606",
        Prosecution: "#B3402E",
        Witness: "#8B5C9E",
        system: "#8B8471",
    };

    // role-specific quick actions shown in the action bar
    const QUICK_ACTIONS = {
        Judge: [
            { label: "Sustain",        text: "Objection sustained.",            cls: "ruling" },
            { label: "Overrule",       text: "Objection overruled.",            cls: "ruling" },
            { label: "Warn witness",   text: "The witness is directed to answer the question.", cls: "ruling" },
        ],
        Defence: [
            { label: "Object",         text: "Objection — ",                    cls: "objection" },
            { label: "Examine witness",text: "Witness, please state for the record: ", cls: "" },
            { label: "No further questions", text: "No further questions, Your Honour.", cls: "" },
        ],
        Prosecution: [
            { label: "Object",         text: "Objection — ",                    cls: "objection" },
            { label: "Examine witness",text: "Witness, please state for the record: ", cls: "" },
            { label: "No further questions", text: "No further questions, Your Honour.", cls: "" },
        ],
        Witness: [
            { label: "I don't recall", text: "I do not recall.",                cls: "" },
            { label: "Affirm",         text: "Yes, that is correct.",           cls: "" },
        ],
    };

    // ---- state ----------------------------------------------------------
    const state = {
        me: null,                  // { participant_id, name, role, display_role }
        participants: [],          // roster from server
        selectedRole: null,
        ws: null,
        // The live mic starts CLOSED: participants are heard only while they
        // hold the Hold to Talk button (or explicitly open the mic with the
        // roster toggle). Previously the mic track stayed enabled from join,
        // so the whole room heard every participant continuously.
        micEnabled: false,
        videoEnabled: true,
        iEnded: false,            // this client clicked End Session (Judge) — return to dashboard after adjournment
        localStream: null,         // local audio + video, shared with every peer + the self-view
        localStreamPromise: null,   // in-flight getUserMedia (dedupes concurrent requests)
        peers: new Map(),          // participant_id -> { pc: RTCPeerConnection, audio, videoTrack }
        pendingOfferTargets: new Set(), // pids we still need to offer to once our stream is ready
    };

    // Persistent <video> element per participant (roster tiles rebuild, streams don't).
    const videoEls = new Map();    // participant_id -> <video>

    // Per-peer live volume, keyed by participant_id. Survives roster rebuilds
    // and re-offer / reconnect cycles — a slider stays where you left it.
    const peerVolumes = new Map();  // participant_id -> { gain: GainNode, level: number }

    // Smallest sensible lift for a newly-joined participant whose mic level is
    // unknown. Quieter-than-usual courtroom mics are common; a small boost makes
    // them audible without making a loud participant painful.
    const DEFAULT_PEER_GAIN = 1.4;  // ~ +3 dB; each tile's slider can raise it further.

    // ---- element refs ---------------------------------------------------
    const $ = (id) => document.getElementById(id);
    const els = {
        joinOverlay: $("join-overlay"),
        joinCaseTitle: $("join-case-title"),
        joinSubtitle: $("join-subtitle"),
        rolePicker: $("role-picker"),
        joinForm: $("join-form"),
        joinName: $("join-name"),
        enterBtn: $("enter-btn"),
        joinError: $("join-error"),
        root: $("courtroom-root"),
        caseTitle: $("court-case-title"),
        roomId: $("court-room-id"),
        phaseBadge: $("court-phase-badge"),
        rosterList: $("roster-list"),
        rosterOnline: $("roster-online"),
        phaseControls: $("phase-controls"),
        phaseButtons: $("phase-buttons"),
        youAreRole: $("you-are-role"),
        quickActions: $("quick-actions"),
        statementForm: $("statement-form"),
        statementInput: $("statement-input"),
        transcriptFeed: $("transcript-feed"),
        copyInviteBtn: $("copy-invite-btn"),
        downloadTranscriptBtn: $("download-transcript-btn"),
        pushToTalkBtn: $("push-to-talk-btn"),
        dictateStatus: $("dictate-status"),
        remoteAudioHost: $("remote-audio-host"),
        asrStatus: $("asr-status"),
        toast: $("toast"),
        endSessionBtn: $("end-session-btn"),
        sessionEndedPanel: $("session-ended-panel"),
        endedMdLink: $("ended-md-link"),
        endedPdfLink: $("ended-pdf-link"),
        endedReportLink: $("ended-report-link"),
        sessionReportBtn: $("session-report-btn"),
        downloadReportBtn: $("download-report-btn"),
        caseContext: $("case-context"),
        contextRefreshBtn: $("context-refresh-btn"),
        joinError: $("join-error"),
    };

    // ====================================================================
    // INIT
    // ====================================================================
    async function init() {
        lucide.createIcons();
        await loadRoomPreview();
        await loadRtcConfig();
        maybeShowMediaWarning();
        renderRolePicker();
        els.joinForm.addEventListener("submit", onJoin);
        els.statementForm.addEventListener("submit", onStatement);
        els.copyInviteBtn.addEventListener("click", copyInvite);
        els.downloadTranscriptBtn.addEventListener("click", downloadTranscript);
        const pdfBtn = document.getElementById("download-transcript-pdf-btn");
        if (pdfBtn) pdfBtn.addEventListener("click", downloadTranscriptPdf);
        if (els.downloadReportBtn) els.downloadReportBtn.addEventListener("click", () => {
            window.location.href = `/api/court/rooms/${ROOM_ID}/session-report.pdf`;
        });
        if (els.contextRefreshBtn) els.contextRefreshBtn.addEventListener("click", refreshCaseContext);
        if (els.pushToTalkBtn) initPushToTalk();
        if (els.endSessionBtn) els.endSessionBtn.addEventListener("click", requestEndSession);
        els.joinName.focus();
    }

    // Fetch room metadata to show in the join card + disable taken roles.
    async function loadRoomPreview() {
        try {
            const res = await fetch(`/api/court/rooms/${ROOM_ID}`);
            if (!res.ok) {
                if (res.status === 404) {
                    els.joinCaseTitle.textContent = "Room not found";
                    els.joinSubtitle.textContent = "This trial does not exist. Check your invite link.";
                    els.enterBtn.disabled = true;
                }
                return;
            }
            const room = await res.json();
            els.joinCaseTitle.textContent = room.case_title;
            els.caseTitle.textContent = room.case_title;
            els.roomId.textContent = room.room_id;
            els.phaseBadge.textContent = room.phase;
            state.participants = room.participants;
            renderCaseContext(room.case_context);
            setReportButtons(room.status);
            // A room the Judge already adjourned cannot be joined again —
            // show the ended card with the record download links instead.
            if (room.status === "ended") {
                showEndedJoinCard(room);
            }
            // Seed any existing transcript so a late joiner sees history.
            renderTranscript(room.transcript);
        } catch (e) {
            console.error("Failed to load room preview:", e);
        }
    }

    // ====================================================================
    // CASE CONTEXT (linked case: parties, evidence, links)
    // ====================================================================
    function renderCaseContext(ctx) {
        if (!els.caseContext) return;
        if (!ctx || !ctx.case_id) {
            els.caseContext.style.display = "none";
            return;
        }
        els.caseContext.style.display = "flex";
        const titleEl = document.getElementById("cc-case-title");
        const idEl = document.getElementById("cc-case-id");
        const partiesEl = document.getElementById("cc-parties");
        const evidenceEl = document.getElementById("cc-evidence");
        const linksEl = document.getElementById("cc-links");
        if (titleEl) titleEl.textContent = ctx.title || "Case";
        if (idEl) idEl.textContent = ctx.case_id || "";
        const prio = ctx.case_level_priority
            ? ` · whole-case priority ${ctx.case_level_priority}`
            : (ctx.aggregate_priority
                ? ` · aggregate priority ${ctx.aggregate_priority}` : "");
        if (partiesEl) {
            const parties = ctx.parties && ctx.parties.length
                ? ctx.parties.join(", ") : "No parties extracted yet";
            partiesEl.innerHTML = `<strong>Parties:</strong> ${escapeHtml(parties)}${prio}`;
        }
        if (evidenceEl) {
            const evs = ctx.evidence || [];
            evidenceEl.innerHTML = evs.length
                ? evs.map((ev) => `
                    <div class="cc-ev">
                        <span class="cc-ev-name"><i data-lucide="file-text"></i> ${escapeHtml(ev.filename)}</span>
                        <span class="cc-ev-type">${escapeHtml(ev.doc_type || "")}</span>
                        <span class="cc-ev-prio ${escapeHtml((ev.priority || "none").toLowerCase())}">${escapeHtml(ev.priority || "not analysed")}</span>
                        ${ev.summary ? `<p class="cc-ev-sum">${escapeHtml(ev.summary)}</p>` : ""}
                    </div>`).join("")
                : '<p class="cc-line">No evidence documents attached to this case yet.</p>';
        }
        if (linksEl) {
            linksEl.innerHTML = ctx.evidence_links
                ? `<strong>Evidence links:</strong> ${escapeHtml(ctx.evidence_links)}`
                : "";
        }
        if (els.contextRefreshBtn) els.contextRefreshBtn.style.display = "";
        lucide.createIcons();
    }

    async function refreshCaseContext() {
        try {
            const res = await fetch(`/api/court/rooms/${ROOM_ID}/refresh-context`, { method: "POST" });
            if (!res.ok) throw new Error(res.statusText);
            const ctx = await res.json();
            renderCaseContext(ctx);
            toast("Case context refreshed from the case file.");
        } catch (e) {
            toast("Could not refresh the case context.");
        }
    }

    function setReportButtons(roomStatus) {
        // The session analysis report is available as soon as the room exists;
        // before joining it lives in the header (hidden until the court page).
        if (els.sessionReportBtn) {
            els.sessionReportBtn.href = `/api/court/rooms/${ROOM_ID}/session-report.pdf`;
            els.sessionReportBtn.style.display = "";
        }
        if (els.downloadReportBtn) els.downloadReportBtn.style.display = "";
        if (roomStatus === "ended" && els.sessionReportBtn) {
            els.sessionReportBtn.style.display = "none"; // ended card has its own link
        }
    }

    // ====================================================================
    // JOIN
    // ====================================================================
    function renderRolePicker() {
        const taken = new Set(state.participants.map((p) => p.role));
        els.rolePicker.innerHTML = "";
        for (const role of ROLES) {
            const isTaken = taken.has(role.id) && role.id !== "Witness";
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "role-btn";
            btn.dataset.role = role.id;
            btn.disabled = isTaken;
            btn.innerHTML = `
                <span class="role-name">${role.label}</span>
                <span class="role-tag">${role.tag}</span>
                ${isTaken ? '<span class="role-taken">Already taken</span>' : ""}
            `;
            btn.addEventListener("click", () => selectRole(role.id, btn));
            els.rolePicker.appendChild(btn);
        }
    }

    function selectRole(roleId, btn) {
        state.selectedRole = roleId;
        els.rolePicker.querySelectorAll(".role-btn").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        validateJoin();
    }

    function validateJoin() {
        const ok = els.joinName.value.trim().length > 0 && state.selectedRole;
        els.enterBtn.disabled = !ok;
    }
    els.joinName.addEventListener("input", validateJoin);

    async function onJoin(e) {
        e.preventDefault();
        hideJoinError();
        const name = els.joinName.value.trim();
        if (!name || !state.selectedRole) return;

        els.enterBtn.disabled = true;
        els.enterBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Connecting…';
        lucide.createIcons();

        await connectWebSocket(name, state.selectedRole);
    }

    // ====================================================================
    // WEBSOCKET
    // ====================================================================
    async function connectWebSocket(name, role) {
        const wsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws/court/${ROOM_ID}`;
        state.ws = new WebSocket(wsUrl);

        state.ws.onopen = async () => {
            state.ws.send(JSON.stringify({ type: "join", name, role }));
            // Kick off the local mic so it's ready when we start making offers.
            await ensureLocalStream();
        };

        state.ws.onmessage = async (event) => {
            const msg = JSON.parse(event.data);
            await handleMessage(msg);
        };

        state.ws.onclose = () => {
            // If we never made it into the room, surface a friendly error.
            if (!state.me) {
                showJoinError("Could not reach the courtroom server. Please try again.");
                els.enterBtn.disabled = false;
                els.enterBtn.innerHTML = '<i data-lucide="door-open"></i> Enter the Courtroom';
                lucide.createIcons();
            }
        };

        state.ws.onerror = (e) => console.error("WebSocket error:", e);
    }

    async function handleMessage(msg) {
        switch (msg.type) {
            case "room_state": {
                // First message after a successful join.
                state.me = msg.me;
                state.participants = msg.room.participants;
                enterCourtroom();
                renderRoster();
                renderTranscript(msg.room.transcript);
                renderPhase(msg.room.phase);
                renderQuickActions();
                renderCaseContext(msg.room.case_context);
                setReportButtons(msg.room.status);
                // Offer to every existing participant (newcomer initiates).
                for (const p of state.participants) {
                    if (p.participant_id !== state.me.participant_id) {
                        state.pendingOfferTargets.add(p.participant_id);
                    }
                }
                drainPendingOffers();
                toast(`Joined as ${state.me.display_role}`);
                break;
            }
            case "participant_joined": {
                state.participants.push(msg.participant);
                renderRoster();
                appendTranscript(msg.transcript_entry);
                // The NEW participant initiates the offer; existing peers just
                // wait for it. So here we do NOT initiate — we only prepare an
                // RTCPeerConnection entry when the offer arrives.
                break;
            }
            case "participant_left": {
                state.participants = msg.room.participants;
                closePeer(msg.participant_id);
                renderRoster();
                // The leave system-entry was already broadcast + persisted.
                if (msg.room.transcript && msg.room.transcript.length) {
                    renderTranscript(msg.room.transcript);
                }
                break;
            }
            case "sdp_offer": {
                await onRemoteOffer(msg.from_participant_id, msg.data);
                break;
            }
            case "sdp_answer": {
                await onRemoteAnswer(msg.from_participant_id, msg.data);
                break;
            }
            case "ice_candidate": {
                await onRemoteIce(msg.from_participant_id, msg.data);
                break;
            }
            case "transcript_entry": {
                appendTranscript(msg.entry);
                break;
            }
            case "phase_changed": {
                renderPhase(msg.phase);
                appendTranscript(msg.transcript_entry);
                break;
            }
            case "session_ended": {
                // The Judge adjourned the trial — everyone is returned to the
                // join card with the record preserved for download.
                handleSessionEnded(msg.room);
                break;
            }
            case "error": {
                console.warn("Server error:", msg.detail);
                // If the join was rejected (e.g. role taken), bounce back to overlay.
                if (!state.me && (msg.detail.includes("already taken") || msg.detail.includes("has ended"))) {
                    showJoinError(msg.detail + (msg.detail.includes("already taken") ? " Please pick another role." : ""));
                    try { state.ws.close(); } catch (_) {}
                    // Ended sessions stay closed; role-taken rooms re-enable on pick.
                    els.enterBtn.disabled = msg.detail.includes("has ended");
                    els.enterBtn.innerHTML = '<i data-lucide="door-open"></i> Enter the Courtroom';
                    lucide.createIcons();
                    // refresh role availability
                    await loadRoomPreview();
                    renderRolePicker();
                } else {
                    toast(msg.detail);
                }
                break;
            }
        }
    }

    // ====================================================================
    // WEBRTC MESH
    // ====================================================================
    const RTC_CONFIG = {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
        ],
    };

    // Merge the STUN defaults with any TURN relays the server advertises at
    // /api/court/rtc-config. TURN is what lets remote participants on other
    // networks / mobile data actually connect: carriers and many ISPs use
    // symmetric NAT (CGNAT), which STUN hole-punching cannot traverse — the
    // media then has to relay through a TURN server. Runs before any
    // RTCPeerConnection is created, so every offer/answer carries the relays.
    async function loadRtcConfig() {
        try {
            const res = await fetch("/api/court/rtc-config", { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();
            if (!Array.isArray(data.iceServers)) return;
            const seen = new Set(RTC_CONFIG.iceServers.map((s) => JSON.stringify(s)));
            for (const s of data.iceServers) {
                if (!s || typeof s !== "object") continue;
                const key = JSON.stringify(s);
                if (seen.has(key)) continue;
                seen.add(key);
                RTC_CONFIG.iceServers.push(s);
            }
        } catch (_) {
            // Non-fatal: without a TURN relay the mesh still works for peers
            // that can connect directly (same network / open NATs).
        }
    }

    async function ensureLocalStream() {
        if (state.localStream) return state.localStream;
        // Collapse concurrent requests (join-time + a Hold to Talk press in the
        // same moment) into ONE getUserMedia call. Without this, two pending
        // requests race on the permission prompt and can each resume into a
        // half-set-up state — e.g. a recording that starts with nobody holding.
        if (state.localStreamPromise) return state.localStreamPromise;
        state.localStreamPromise = acquireLocalStream();
        try {
            return await state.localStreamPromise;
        } finally {
            state.localStreamPromise = null;
        }
    }

    async function acquireLocalStream() {
        if (state.localStream) return state.localStream;
        if (mediaUnavailableReason()) {
            reportMicFailure(null, "Microphone unavailable on this connection.");
            state.micEnabled = false;
            showMicFallback();
            return null;
        }
        try {
            state.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
            });
        } catch (e) {
            console.warn("Camera+microphone access denied or unavailable. Falling back to audio-only.", e);
            state.localStream = null;
            try {
                state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (e2) {
                console.warn("Microphone access denied too. Audio will be disabled.", e2);
                state.localStream = null;
                state.micEnabled = false;
                reportMicFailure(e2, "Microphone unavailable — you can still participate via text.");
                showMicFallback();
            }
        }
        attachSelfVideo();
        // Enforce the default mic gate on a freshly acquired stream (closed
        // unless the user explicitly opened the mic / is holding to talk).
        applyMicGate();
        if (state.me) {
            renderRoster();
            // Stream resolved after peers were already negotiated → send tracks now.
            drainPendingOffers();
            for (const pid of [...state.peers.keys()]) upgradePeerWithTracks(pid);
        }
        return state.localStream;
    }

    // (Re)negotiate with an established peer once our stream gains tracks that
    // weren't there when the original offer/answer was negotiated.
    async function upgradePeerWithTracks(remotePid) {
        const entry = state.peers.get(remotePid);
        if (!entry || !state.localStream) return;
        const pc = entry.pc;
        if (pc.signalingState !== "stable" || pc.connectionState === "closed") return;
        const kinds = new Set(pc.getSenders().map((s) => s.track && s.track.kind).filter(Boolean));
        let added = false;
        for (const track of state.localStream.getTracks()) {
            if (!kinds.has(track.kind)) {
                pc.addTrack(track, state.localStream);
                kinds.add(track.kind);
                added = true;
            }
        }
        if (!added) return;
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            state.ws.send(JSON.stringify({
                type: "sdp_offer",
                target_participant_id: remotePid,
                data: pc.localDescription,
            }));
        } catch (e) {
            console.error(`Track upgrade offer to ${remotePid} failed:`, e);
        }
    }

    // Pick the starting gain for a participant whose volume we haven't seen yet.
    // If we already persisted a level for this pid (e.g. from a previous session
    // render or a reconnect), use it; otherwise apply the small default lift.
    function previousLevelFor(participantId) {
        if (peerVolumes.has(participantId)) {
            return peerVolumes.get(participantId).level;
        }
        return DEFAULT_PEER_GAIN;
    }

    function videoElFor(participantId) {
        let v = videoEls.get(participantId);
        if (!v) {
            v = document.createElement("video");
            v.autoplay = true;
            v.playsInline = true;
            v.muted = true;   // remote audio flows through the hidden <audio> element
            videoEls.set(participantId, v);
        }
        return v;
    }

    function attachSelfVideo() {
        if (!state.me) return;
        const v = videoElFor(state.me.participant_id);
        const stream = (state.localStream && state.localStream.getVideoTracks().length)
            ? state.localStream
            : null;
        v.srcObject = stream;
        if (stream) {
            startVideoKeepalive(v, stream, () => videoHasSrc(v));
        } else {
            stopVideoKeepalive(v);
        }
    }

    function createPeerConnection(remotePid) {
        const pc = new RTCPeerConnection(RTC_CONFIG);

        // Receive both audio and video from the peer. Our own tracks are added
        // below, which flips these transceivers to sendrecv.
        pc.addTransceiver("audio", { direction: "recvonly" });
        pc.addTransceiver("video", { direction: "recvonly" });

        // Remote audio element for this peer.
        const audio = document.createElement("audio");
        audio.autoplay = true;
        audio.playsInline = true;
        els.remoteAudioHost.appendChild(audio);

        // Per-peer live volume (WebRTC voice gain). Each peer gets its own
        // AudioContext + GainNode so participants with quiet mics can be turned
        // up independently without affecting the others.
        let peerGain = null;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            ctx.resume().catch(() => {});
            const gain = ctx.createGain();
            const prev = peerVolumes.get(remotePid);
            if (prev && prev.gainNode) {
                // Restore the level this participant had before (e.g. after a
                // re-offer / reconnect).
                gain.gain.value = prev.level;
            } else {
                // New participant — small lift so quiet mics are usable out of
                // the gate instead of inaudible. The user can pull it down if
                // they want it quieter.
                gain.gain.value = previousLevelFor(remotePid);
            }
            peerGain = { ctx, gain, level: gain.gain.value };
            // Route the peer's incoming audio through the gain before the speakers.
            const src = ctx.createMediaElementSource(audio);
            src.connect(gain);
            gain.connect(ctx.destination);
        } catch (e) {
            // AudioContext may fail on some browsers/contexts — non-fatal, audio
            // still plays through the element directly (no per-peer boost).
            console.warn("Peer audio gain setup failed for", remotePid, "-", e);
        }

        const peer = { pc, audio, videoTrack: null, gain: peerGain };
        state.peers.set(remotePid, peer);

        pc.ontrack = (event) => {
            if (event.track.kind === "video") {
                // Route video to the persistent roster tile element (muted —
                // audio plays through the hidden <audio> element above).
                peer.videoTrack = event.track;
                const v = videoElFor(remotePid);
                const stream = new MediaStream([event.track]);
                v.srcObject = stream;
                v.play().catch(() => {});
                // Keep this tile's video alive: if the tile goes black while the
                // mesh still owns the track, re-play it. The tile is watched until
                // the track is removed (closePeer) or a new track replaces it.
                startVideoKeepalive(v, stream, () => {
                    // Tile is still "live" if the peer is still here and still owns
                    // this video track (or a newer one).
                    const p = state.peers.get(remotePid);
                    return p && (p.videoTrack === event.track || !!p.videoTrack);
                });
                refreshFaceSourceIfPending(remotePid);
                return;
            }
            audio.srcObject = event.streams[0];
            audio.play().catch(() => {});
            // Light active-speaker glow via WebRTC audio-level (analyser).
            attachSpeakerDetection(audio, remotePid);
        };

        // Trickle ICE: send every candidate to the remote peer.
        pc.onicecandidate = (event) => {
            if (event.candidate && state.ws && state.ws.readyState === WebSocket.OPEN) {
                state.ws.send(JSON.stringify({
                    type: "ice_candidate",
                    target_participant_id: remotePid,
                    data: event.candidate.toJSON(),
                }));
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === "failed" || pc.connectionState === "closed") {
                // WebRTC will retry naturally on next interaction; nothing to do here.
            }
        };

        // Add our local tracks so the peer can hear + see us.
        if (state.localStream) {
            for (const track of state.localStream.getTracks()) {
                pc.addTrack(track, state.localStream);
            }
        }
        return pc;
    }

    // Newcomer-initiated: we offer to each pending target once our mic+camera
    // stream is ready, so every offer actually carries audio + video tracks.
    // ensureLocalStream() re-invokes this when the stream resolves late.
    async function drainPendingOffers() {
        if (!state.localStream || !state.pendingOfferTargets.size) return;
        for (const pid of [...state.pendingOfferTargets]) {
            state.pendingOfferTargets.delete(pid);
            await makeOffer(pid);
        }
    }

    async function makeOffer(remotePid) {
        let entry = state.peers.get(remotePid);
        if (!entry) entry = { pc: createPeerConnection(remotePid), audio: null };
        const pc = entry.pc;
        try {
            const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
            await pc.setLocalDescription(offer);
            state.ws.send(JSON.stringify({
                type: "sdp_offer",
                target_participant_id: remotePid,
                data: pc.localDescription,
            }));
        } catch (e) {
            console.error(`Offer to ${remotePid} failed:`, e);
        }
    }

    async function onRemoteOffer(remotePid, data) {
        let entry = state.peers.get(remotePid);
        if (!entry) entry = { pc: createPeerConnection(remotePid), audio: null };
        const pc = entry.pc;
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(data));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            state.ws.send(JSON.stringify({
                type: "sdp_answer",
                target_participant_id: remotePid,
                data: pc.localDescription,
            }));
        } catch (e) {
            console.error(`Answer to ${remotePid} failed:`, e);
        }
    }

    async function onRemoteAnswer(remotePid, data) {
        const entry = state.peers.get(remotePid);
        if (!entry) return;
        try {
            if (entry.pc.signalingState !== "stable") {
                await entry.pc.setRemoteDescription(new RTCSessionDescription(data));
            }
        } catch (e) {
            console.error(`Apply answer from ${remotePid} failed:`, e);
        }
    }

    async function onRemoteIce(remotePid, data) {
        const entry = state.peers.get(remotePid);
        if (!entry) return;
        try {
            await entry.pc.addIceCandidate(new RTCIceCandidate(data));
        } catch (e) {
            // Harmless if it arrives before the SDP is set.
        }
    }

    function closePeer(remotePid) {
        const entry = state.peers.get(remotePid);
        if (!entry) return;
        try { entry.pc.close(); } catch (_) {}
        if (entry.audio && entry.audio.parentNode) entry.audio.parentNode.removeChild(entry.audio);
        // Tear down this peer's gain node so we don't leak AudioContexts.
        if (entry.gain) {
            try { entry.gain.ctx.close(); } catch (_) {}
            peerVolumes.delete(remotePid);
        }
        const v = videoEls.get(remotePid);
        if (v) {
            stopVideoKeepalive(v);
            v.srcObject = null;
            if (v.parentNode) v.parentNode.removeChild(v);
        }
        videoEls.delete(remotePid);
        state.peers.delete(remotePid);
        // If the face analyzer was watching this participant, fall back to self.
        if (face.source === remotePid) {
            face.source = "self";
            const sel = faceEl("face-source");
            if (sel) sel.value = "self";
            attachFaceSource();
        }
    }

    // Keep the WebRTC audio track in sync with who should be audible:
    //   - micEnabled (roster toggle)  -> always audible
    //   - ptt.recording (hold)        -> audible while holding to talk
    // Everything else (not holding, not toggled) is silent to the room.
    function applyMicGate() {
        if (!state.localStream) return;
        const open = state.micEnabled || ptt.recording;
        for (const track of state.localStream.getAudioTracks()) {
            track.enabled = open;
        }
    }

    function toggleMic() {
        if (!state.localStream) return;
        state.micEnabled = !state.micEnabled;
        applyMicGate();
        renderRoster();
    }

    function toggleVideo() {
        if (!state.localStream) return;
        state.videoEnabled = !state.videoEnabled;
        for (const track of state.localStream.getVideoTracks()) {
            track.enabled = state.videoEnabled;
        }
        renderRoster();
    }

    // ====================================================================
    // RENDER
    // ====================================================================
    function enterCourtroom() {
        els.joinOverlay.style.display = "none";
        els.root.style.display = "flex";
        els.youAreRole.textContent = state.me.display_role;
        // Show phase controls + End Session only for the Judge.
        const isJudge = state.me.role === "Judge";
        els.phaseControls.style.display = isJudge ? "block" : "none";
        if (els.endSessionBtn) els.endSessionBtn.style.display = isJudge ? "inline-flex" : "none";
        renderPhaseButtons();
        initFacePanel();
        // Re-affirm every live video element after the courtroom root is shown,
        // so feeds that went black while covered by another panel recover now.
        reaffirmAllRoomVideos();
        probeAsr();
        // Don't auto-focus on touch devices — it pops the on-screen keyboard
        // the moment you enter, hiding the transcript behind it.
        if (!("ontouchstart" in window)) els.statementInput.focus();
    }

    function renderRoster() {
        els.rosterOnline.textContent = state.participants.length;
        els.rosterList.innerHTML = "";
        // Always render "me" first, then others.
        const ordered = [...state.participants].sort((a, b) => {
            if (a.participant_id === state.me?.participant_id) return -1;
            if (b.participant_id === state.me?.participant_id) return 1;
            return 0;
        });
        for (const p of ordered) {
            const isMe = p.participant_id === state.me?.participant_id;
            const displayRole = isMe ? state.me.display_role : displayRoleFor(p);
            const initials = (p.name || "?").trim().charAt(0).toUpperCase();
            const tile = document.createElement("div");
            tile.className = "participant-tile" + (isMe ? " is-me" : "");
            tile.dataset.pid = p.participant_id;
            tile.innerHTML = `
                <div class="tile-video">
                    <div class="avatar role-${p.role}" style="background:${ROLE_ACCENT[p.role] || ROLE_ACCENT.system}">${initials}</div>
                </div>
                <div class="tile-info">
                    <div class="tile-name">${escapeHtml(p.name)}${isMe ? " (you)" : ""}</div>
                    <div class="tile-role role-${p.role}">${escapeHtml(displayRole)}</div>
                </div>
                <div class="tile-controls">
                    ${isMe ? `<button class="tile-mic-btn ${state.micEnabled ? "" : "off"}" title="${state.micEnabled ? "Mic on — always audible to the room (click to mute)" : "Mic off — others hear you only while you hold Hold to Talk (click for always-on mic)"}">
                        <i data-lucide="${state.micEnabled ? "mic" : "mic-off"}"></i>
                    </button>` : ""}
                    ${isMe ? `<button class="tile-video-btn ${state.videoEnabled ? "" : "off"}" title="${state.videoEnabled ? "Hide my video" : "Show my video"}">
                        <i data-lucide="${state.videoEnabled ? "video" : "video-off"}"></i>
                    </button>` : ""}
                    ${!isMe ? `<div class="tile-vol" title="Live voice volume for ${escapeHtml(p.name)}">
                        <input type="range" min="0" max="3" step="0.05" value="${peerLevelFor(p.participant_id)}" aria-label="Volume for ${escapeHtml(p.name)}">
                    </div>` : ""}
                </div>
            `;
            // Move the persistent video element (already fed by the mesh) into
            // this tile's video slot; the avatar stays as the fallback.
            tile.querySelector(".tile-video").prepend(videoElFor(p.participant_id));
            if (isMe) {
                attachSelfVideo();
                tile.querySelector(".tile-mic-btn").addEventListener("click", toggleMic);
                const vbtn = tile.querySelector(".tile-video-btn");
                if (vbtn) vbtn.addEventListener("click", toggleVideo);
                if (!state.micEnabled) tile.querySelector(".avatar").classList.add("muted");
            } else {
                // Bind the per-peer live-volume slider, if the peer's gain node
                // was created successfully.
                const volEl = tile.querySelector(".tile-vol input");
                if (volEl) {
                    const peer = state.peers.get(p.participant_id);
                    if (peer && peer.gain) {
                        volEl.addEventListener("input", () => {
                            const v = parseFloat(volEl.value);
                            peer.gain.gain.setValueAtTime(v, ctxTime(peer.gain.ctx));
                            peerVolumes.set(p.participant_id, { gain: peer.gain, level: v });
                        });
                    } else {
                        // No gain node (AudioContext unavailable) — hide the slider
                        // since it can't do anything.
                        volEl.remove();
                    }
                }
            }
            els.rosterList.appendChild(tile);
        }
        lucide.createIcons();
        populateFaceSourceSelect();
    }

    // Current value we want this participant's live voice to play at.
    // Reads the persisted level if we have one, otherwise the small default lift.
    function peerLevelFor(participantId) {
        const prev = peerVolumes.get(participantId);
        if (prev && typeof prev.level === "number") return prev.level;
        return DEFAULT_PEER_GAIN;
    }

    // Convenience for setValueAtTime / linearRamp calls.
    function ctxTime(ctx) {
        try { return ctx.currentTime; } catch (_) { return 0; }
    }

    // ---- video keepalive (face monitor + roster / self tiles) ----------
    // A live camera feed can look "gone" for a few reasons that are all
    // recoverable without making the user re-enable the camera:
    //   - the <video> element was fed a srcObject but its playback stalled /
    //     went black while the underlying track is still live;
    //   - the mesh replaced a track (re-offer / renegotiation) and the tile's
    //     srcObject wasn't refreshed;
    //   - the tab or the face panel was covered by another panel for a while,
    //     and the browser quieted the media element.
    // A keepalive per <video> watches for these and re-attaches / re-plays.
    const videoKeepalive = new Map();  // videoEl -> { timer, streamRef }

    // Start or refresh a keepalive on a <video> that should show a live camera feed.
    // `stream` is the MediaStream to attach (may be null to clear the element).
    // `onLive` is an optional predicate: the keepalive only re-plays while it
    // returns true (e.g. the stream still has video tracks / the mesh still owns
    // a track for this participant).
    function startVideoKeepalive(video, stream, onLive) {
        if (!video) return;
        const prev = videoKeepalive.get(video);
        if (prev) {
            // Update the stream we're watching without restarting the loop.
            prev.streamRef = stream;
            prev.onLive = onLive || null;
            return;
        }
        const keep = { timer: null, streamRef: stream, onLive: onLive || null };
        videoKeepalive.set(video, keep);

        const tick = () => {
            const still = keep.streamRef && (!keep.onLive || keep.onLive());
            if (!still) {
                // Feed gone — clear the element and stop watching.
                if (video.srcObject) {
                    try { video.srcObject = null; } catch (_) {}
                }
                stopVideoKeepalive(video);
                return;
            }

            // If the element has a stream but isn't playing, re-attach + re-play.
            const hasSrc = video.srcObject != null;
            const playing = !!(video.readyState >= 2 && (video.paused === false));
            if (hasSrc && !playing) {
                // The underlying track is fine; the element just went quiet.
                // Re-attach the same object and re-ask for playback.
                try {
                    video.play().catch(() => {});
                } catch (_) {}
            }

            keep.timer = requestAnimationFrame(tick);
        };

        // Start the loop on the next frame so we don't burn a frame on setup.
        keep.timer = requestAnimationFrame(tick);
    }

    function stopVideoKeepalive(video) {
        const keep = videoKeepalive.get(video);
        if (!keep) return;
        if (keep.timer) {
            try { cancelAnimationFrame(keep.timer); } catch (_) {}
        }
        videoKeepalive.delete(video);
    }

    // Default "is this <video> feed still live?" predicate: it has a non-empty
    // MediaStream (or a track) attached.
    function videoHasSrc(video) {
        if (!video || !video.srcObject) return false;
        try {
            const tracks = video.srcObject.getVideoTracks ? video.srcObject.getVideoTracks() : [];
            return tracks.length > 0;
        } catch (_) {
            return false;
        }
    }

    // Re-affirm every live video element for this room (face monitor + roster /
    // self tiles) so a feed that went black while covered by another panel recovers
    // on the next frame instead of waiting for a source change.
    function reaffirmAllRoomVideos() {
        // Face monitor.
        const faceVideo = faceEl("face-video");
        if (faceVideo && faceVideo.srcObject && videoHasSrc(faceVideo)) {
            affirmVideo(faceVideo, faceVideo.srcObject);
        }
        // Self + remote roster tiles.
        for (const [pid, v] of videoEls) {
            if (v && v.srcObject && videoHasSrc(v)) {
                // Find the peer so we can use its current track stream if present.
                const peer = state.peers.get(pid);
                let stream = v.srcObject;
                if (peer && peer.videoTrack) {
                    try { stream = new MediaStream([peer.videoTrack]); } catch (_) {}
                }
                affirmVideo(v, stream);
            }
        }
    }

    // Force a <video> to show a live feed again, even if it currently has a
    // srcObject but went black/paused (e.g. because its container was hidden
    // for a while). Safe to call repeatedly.
    function affirmVideo(video, stream) {
        if (!video) return;
        if (!stream) {
            if (video.srcObject) {
                try { video.srcObject = null; } catch (_) {}
            }
            return;
        }
        try {
            video.srcObject = stream;
        } catch (_) {
            return;
        }
        // Force a fresh playback request so a stalled/black monitor recovers.
        // This is deliberately redone on each affirm — browsers can leave a
        // video paused after its container was hidden for a while.
        video.play().catch(() => {});
    }

    function displayRoleFor(p) {
        if (p.role === "Witness") {
            // Reconstruct witness number from roster position.
            const witnessIndex = state.participants
                .filter((x) => x.role === "Witness")
                .indexOf(p) + 1;
            return `Witness ${witnessIndex}`;
        }
        return ({ Judge: "Presiding Judge", Defence: "Defence Counsel", Prosecution: "Prosecution Counsel" })[p.role] || p.role;
    }

    function renderPhaseButtons() {
        const phases = ["Opening", "Examination", "Cross-Examination", "Closing", "Concluded"];
        els.phaseButtons.innerHTML = "";
        for (const ph of phases) {
            const btn = document.createElement("button");
            btn.className = "phase-btn";
            btn.textContent = ph;
            btn.dataset.phase = ph;
            btn.addEventListener("click", () => setPhase(ph));
            els.phaseButtons.appendChild(btn);
        }
    }

    function renderPhase(phase) {
        els.phaseBadge.textContent = phase;
        els.phaseButtons.querySelectorAll(".phase-btn").forEach((b) => {
            b.classList.toggle("active", b.dataset.phase === phase);
        });
    }

    function renderQuickActions() {
        const actions = QUICK_ACTIONS[state.me.role] || [];
        els.quickActions.innerHTML = "";
        for (const a of actions) {
            const btn = document.createElement("button");
            btn.className = `quick-action ${a.cls}`;
            btn.textContent = a.label;
            btn.addEventListener("click", () => {
                // If the action needs a suffix (objection/examine), put focus in the box with the prefix.
                if (a.text.endsWith("— ") || a.text.endsWith(": ")) {
                    els.statementInput.value = a.text;
                    els.statementInput.focus();
                    // Move cursor to end.
                    const len = els.statementInput.value.length;
                    els.statementInput.setSelectionRange(len, len);
                } else {
                    sendAction(a.text);
                }
            });
            els.quickActions.appendChild(btn);
        }
    }

    // ====================================================================
    // TRANSCRIPT
    // ====================================================================
    function renderTranscript(entries) {
        els.transcriptFeed.innerHTML = "";
        if (!entries || !entries.length) {
            els.transcriptFeed.innerHTML = '<div class="transcript-empty">The court is in session. Statements will appear here.</div>';
            return;
        }
        for (const e of entries) appendTranscript(e, /*scroll*/false);
        scrollToBottom();
    }

    function appendTranscript(entry, scroll = true) {
        // Clear the empty placeholder if present.
        const empty = els.transcriptFeed.querySelector(".transcript-empty");
        if (empty) empty.remove();

        const node = document.createElement("div");
        node.className = `entry kind-${entry.kind}`;

        if (entry.kind === "phase") {
            node.innerHTML = `<div class="entry-body"><div class="entry-text">${escapeHtml(entry.text)}</div></div>`;
        } else if (entry.kind === "system") {
            node.innerHTML = `
                <div class="entry-body">
                    <div class="entry-text">${escapeHtml(entry.text)}</div>
                </div>`;
        } else if (entry.kind === "behavior") {
            // Automated face/expression observations (nervousness cues).
            const initials = (entry.actor || "?").charAt(0).toUpperCase();
            const color = ROLE_ACCENT[roleKeyFromDisplay(entry.role)] || ROLE_ACCENT.system;
            const time = formatTime(entry.timestamp);
            node.innerHTML = `
                <div class="entry-avatar" style="background:${color}">${initials}</div>
                <div class="entry-body">
                    <div class="entry-meta">
                        <span class="entry-role role-${roleKeyFromDisplay(entry.role)}">${escapeHtml(entry.role)}</span>
                        <span class="entry-name">${escapeHtml(entry.actor)}</span>
                        <span class="entry-time">${time}</span>
                    </div>
                    <div class="entry-text">⚠ ${escapeHtml(entry.text)}</div>
                </div>`;
        } else {
            const initials = (entry.actor || "?").charAt(0).toUpperCase();
            const color = ROLE_ACCENT[roleKeyFromDisplay(entry.role)] || ROLE_ACCENT.system;
            const time = formatTime(entry.timestamp);
            // Spoken statements carry their recorded audio clip.
            let audioHtml = "";
            if (entry.audio_file) {
                const url = `/api/court/rooms/${ROOM_ID}/audio/${encodeURIComponent(entry.audio_file)}`;
                audioHtml = `
                    <span class="entry-audio">
                        <button type="button" class="audio-play" data-url="${url}" title="Play recording" aria-label="Play recording"><i data-lucide="play"></i></button>
                        <a class="audio-download" href="${url}" download="${escapeHtml(entry.audio_file)}" title="Download recording" aria-label="Download recording"><i data-lucide="download"></i></a>
                    </span>`;
            }
            node.innerHTML = `
                <div class="entry-avatar" style="background:${color}">${initials}</div>
                <div class="entry-body">
                    <div class="entry-meta">
                        <span class="entry-role role-${roleKeyFromDisplay(entry.role)}">${escapeHtml(entry.role)}</span>
                        <span class="entry-name">${escapeHtml(entry.actor)}</span>
                        <span class="entry-time">${time}</span>
                    </div>
                    <div class="entry-text">${escapeHtml(entry.text)}</div>
                    ${audioHtml}
                </div>`;
        }
        els.transcriptFeed.appendChild(node);
        lucide.createIcons();
        if (scroll) scrollToBottom();
    }

    // Map a display role (server ROLE_LABELS value) back to the internal
    // role key used for avatar colors and CSS role accents. The server stores
    // friendly labels like "Presiding Judge", so the naive first-word split
    // produced "Presiding" and every Judge statement rendered with the gray
    // system color instead of the Judge gold.
    function roleKeyFromDisplay(displayRole) {
        if (displayRole === "Presiding Judge") return "Judge";
        if (displayRole === "Defence Counsel") return "Defence";
        if (displayRole === "Prosecution Counsel") return "Prosecution";
        if (displayRole.startsWith("Witness")) return "Witness";
        return displayRole.split(" ")[0];
    }

    function scrollToBottom() {
        els.transcriptFeed.scrollTop = els.transcriptFeed.scrollHeight;
    }

    function formatTime(iso) {
        try {
            return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        } catch { return ""; }
    }

    // ====================================================================
    // SEND
    // ====================================================================
    function onStatement(e) {
        e.preventDefault();
        const text = els.statementInput.value.trim();
        if (!text) return;
        // Heuristic: lines starting with objection/leading/etc. are actions.
        const isAction = /^(objection|sustained|overruled|the witness is directed)/i.test(text);
        if (isAction) {
            sendAction(text);
        } else {
            sendStatement(text);
        }
        els.statementInput.value = "";
    }

    function sendStatement(text) {
        state.ws.send(JSON.stringify({ type: "statement", text }));
    }
    function sendAction(text) {
        state.ws.send(JSON.stringify({ type: "action", text }));
    }
    function setPhase(phase) {
        state.ws.send(JSON.stringify({ type: "set_phase", phase }));
    }

    // ====================================================================
    // MIC / CAMERA AVAILABILITY
    // ====================================================================
    // getUserMedia only exists in a secure context (https or localhost).
    // Invite links built by invite.js point at this machine's LAN IP over
    // plain http, where the browser exposes NO mediaDevices API — previously
    // this surfaced as a generic "Microphone unavailable" toast that gave the
    // user no idea why Hold to Talk would not work. Detect it up front, warn
    // on the join card, and give an actionable reason for each failure mode.
    function mediaUnavailableReason() {
        if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return "insecure_context";
        }
        return null;
    }

    function maybeShowMediaWarning() {
        const warn = document.getElementById("join-media-warning");
        if (!warn || mediaUnavailableReason() !== "insecure_context") return;
        const room = warn.querySelector("#join-media-room");
        if (room) room.textContent = ROOM_ID;
        warn.style.display = "flex";
        lucide.createIcons();
    }

    // Human-readable, actionable reason for a failed mic/camera request.
    function micErrorInfo(e) {
        if (mediaUnavailableReason() === "insecure_context") {
            return {
                title: "Microphone & camera need a secure connection.",
                hint: "This page is open over plain http on a network address. Join at http://localhost:8000 on the host machine (or serve the app over https) to enable your mic.",
            };
        }
        if (!e) return null;
        const name = e.name || "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
            return {
                title: "Microphone permission was blocked.",
                hint: "Click the lock or shield icon beside the address bar, allow Microphone (and Camera for video), then press Hold to Talk again.",
            };
        }
        if (name === "NotFoundError" || name === "DevicesNotFoundError") {
            return { title: "No microphone was found.", hint: "Check that a microphone is connected and enabled on this device." };
        }
        if (name === "NotReadableError" || name === "TrackStartError") {
            return { title: "Microphone is busy in another app.", hint: "Close other apps using the mic (video calls, meetings, recorders) and try again." };
        }
        if (name === "OverconstrainedError") {
            return { title: "Microphone couldn't start with the requested settings.", hint: "Try again — your browser may have just restarted the mic." };
        }
        return null;
    }

    function reportMicFailure(e, fallbackText) {
        const info = micErrorInfo(e);
        const title = info ? info.title : fallbackText;
        const hint = info ? info.hint : "";
        toast((hint ? `${title} ${hint}` : title).trim());
        if (els.pushToTalkBtn) els.pushToTalkBtn.title = hint ? `${title} ${hint}` : title;
        setAsrStatus(title);
    }

    // ====================================================================
    // ====================================================================
    // PUSH-TO-TALK
    // ====================================================================
    // Press and hold the button to record; release to stop and submit.
    // This eliminates overlapping speech — only the person holding the
    // button can talk, keeping the trial transcript clean.
    const ptt = {
        recorder: null,
        chunks: [],
        recording: false,
        stream: null,
        startedAt: 0,
        minMs: 300,  // ignore sub-300ms blips
        releasedDuringInit: false, // set true if user releases while we're still acquiring the mic
        serverAsr: true,    // whisper available on the server (probed at join)
        browserAsr: false,  // fall back to browser SpeechRecognition when whisper is missing
        sr: null,           // active SpeechRecognition session while holding (browser mode)
        srText: "",         // accumulated final transcript of the current hold
    };

    function initPushToTalk() {
        const btn = els.pushToTalkBtn;
        if (!btn) return;
        // Mouse
        btn.addEventListener("mousedown", pttStart);
        btn.addEventListener("mouseup", pttStop);
        btn.addEventListener("mouseleave", pttStop);
        // Touch (mobile)
        btn.addEventListener("touchstart", (e) => { e.preventDefault(); pttStart(); });
        btn.addEventListener("touchend", (e) => { e.preventDefault(); pttStop(); });
        btn.addEventListener("touchcancel", pttStop);
    }

    async function pttStart() {
        if (ptt.recording) return;
        ptt.releasedDuringInit = false;
        // Server whisper unavailable → browser SpeechRecognition hold mode.
        if (!ptt.serverAsr && ptt.browserAsr) {
            if (mediaUnavailableReason()) {
                reportMicFailure(null, "Microphone unavailable on this connection.");
                showMicFallback();
                return;
            }
            pttStartBrowserAsr();
            return;
        }
        // If we already have a stream, start synchronously (no race condition).
        let stream = state.localStream;
        if (!stream) {
            // First time or after denial — acquire async. While the browser
            // shows its permission prompt the button must still react, so flip
            // it to a visible "waiting" state instead of appearing dead.
            // If the user releases during the wait (typical: they let go of the
            // mouse to click "Allow"), pttStop flags ptt.releasedDuringInit and
            // we abort below — but first tell them the mic is now ready.
            setPttLabel(true, "Waiting for microphone…");
            try {
                stream = await ensureLocalStream();
            } finally {
                if (!stream || ptt.releasedDuringInit) setPttLabel(false, "Hold to Talk");
            }
            if (!stream) {
                // ensureLocalStream already reported the failure (toast + asr
                // status) and enabled the typed-statement fallback.
                ptt.releasedDuringInit = false;
                return;
            }
            // The shared stream can carry no audio (e.g. the join-time prompt
            // was dismissed). Hold to Talk needs a mic, so ask for a dedicated
            // audio stream — this re-triggers the browser's permission prompt
            // when the earlier one was dismissed rather than blocked.
            if (!stream.getAudioTracks().length) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                } catch (e) {
                    console.warn("Push-to-talk could not access the microphone:", e);
                    setPttLabel(false, "Hold to Talk");
                    reportMicFailure(e, "Microphone unavailable — you can still type your statement.");
                    showMicFallback();
                    return;
                }
            }
        }
        // If the user released while we were waiting for the mic, abort — and
        // say the mic is ready so they know to simply press again.
        if (ptt.releasedDuringInit) {
            ptt.releasedDuringInit = false;
            setPttLabel(false, "Hold to Talk");
            setAsrStatus("Microphone ready — press and hold again to speak.");
            return;
        }
        ptt.stream = stream;
        ptt.chunks = [];
        // Record AUDIO ONLY: the shared local stream also carries video tracks
        // (added for the WebRTC video mesh), which makes MediaRecorder reject
        // the audio/webm mime type and later breaks the WAV decode in blobToWav.
        const audioOnlyStream = new MediaStream(stream.getAudioTracks());
        try {
            ptt.recorder = new MediaRecorder(audioOnlyStream, { mimeType: "audio/webm" });
        } catch (_) {
            try { ptt.recorder = new MediaRecorder(audioOnlyStream); } catch (_) {
                toast("Recording not supported in this browser.");
                return;
            }
        }
        ptt.recorder.ondataavailable = (e) => { if (e.data && e.data.size) ptt.chunks.push(e.data); };
        ptt.recorder.onstop = pttOnStopped;
        ptt.recorder.start(250);
        ptt.recording = true;
        ptt.startedAt = Date.now();
        // Holding to talk opens the live mic to the room (see applyMicGate).
        applyMicGate();
        els.pushToTalkBtn.classList.add("active");
        els.pushToTalkBtn.innerHTML = '<i data-lucide="mic-off"></i> Recording…';
        lucide.createIcons();
        setAsrStatus("Recording — release to send.");
    }

    function pttStop() {
        if (ptt.sr) {
            // Browser speech mode — release finalizes + submits (see onend).
            try { ptt.sr.stop(); } catch (_) {}
            return;
        }
        if (!ptt.recording || !ptt.recorder) {
            // User released before recording actually started (async mic init).
            // Flag it so pttStart aborts when it finally resolves.
            ptt.releasedDuringInit = true;
            return;
        }
        ptt.recording = false;
        // Release = stop being heard immediately (don't wait for the async
        // recorder stop to fire).
        applyMicGate();
        try { ptt.recorder.stop(); } catch (_) {}
    }

    async function pttOnStopped() {
        const chunks = ptt.chunks;
        ptt.chunks = [];
        const elapsed = Date.now() - ptt.startedAt;
        // Belt-and-braces: recorder stopped without pttStop (edge cases).
        applyMicGate();
        els.pushToTalkBtn.classList.remove("active");
        els.pushToTalkBtn.innerHTML = '<i data-lucide="mic"></i> Hold to Talk';
        lucide.createIcons();

        if (!chunks.length || elapsed < ptt.minMs) {
            setAsrStatus("");
            return;
        }
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAsrStatus("Transcribing…");
        try {
            const wav = await blobToWav(blob);
            await pttUpload(wav);
        } catch (e) {
            console.warn("Push-to-talk transcription failed:", e);
            toast("Transcription failed — try again.");
        } finally {
            setAsrStatus("");
        }
    }

    async function pttUpload(wavBlob) {
        const fd = new FormData();
        fd.append("room_id", ROOM_ID);
        fd.append("participant_id", state.me.participant_id);
        fd.append("audio", wavBlob, `ptt_${Date.now()}.wav`);
        const res = await fetch("/api/court/transcribe", { method: "POST", body: fd });
        if (!res.ok) {
            let msg = `Transcription failed (${res.status})`;
            let asrUnavailable = false;
            try {
                const d = await res.json();
                if (d && d.detail) {
                    const det = d.detail;
                    msg = typeof det === "object" ? (det.message || msg) : det;
                    if (typeof det === "object" && det.code === "asr_unavailable") asrUnavailable = true;
                }
            } catch (_) {}
            if (asrUnavailable) {
                ptt.serverAsr = false;
                const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
                ptt.browserAsr = !!SR && window.isSecureContext;
                if (ptt.browserAsr) {
                    msg = "Recordings can't be transcribed on this server — press and hold again and speak: your browser will add it to the transcript.";
                } else {
                    msg += " Type your statement below instead.";
                }
            }
            toast(msg);
        }
        // Server broadcasts the entry to the room via WebSocket — nothing else needed.
    }

    // ---- mic-unavailable text fallback ----
    function showMicFallback() {
        els.statementInput.placeholder = "Type your statement for the record…";
        els.statementInput.focus();
    }

    function setAsrStatus(text) {
        if (!els.asrStatus) return;
        if (text) {
            els.asrStatus.textContent = text;
            els.asrStatus.hidden = false;
        } else {
            els.asrStatus.textContent = "";
            els.asrStatus.hidden = true;
        }
    }

    // ====================================================================
    // END SESSION + ASR AVAILABILITY
    // ====================================================================
    // The Presiding Judge can adjourn the trial for everyone. The server marks
    // the room ended (phase Concluded, new joins refused) and closes every
    // socket; each client lands back on the join card, now showing the
    // official record's download links.
    function requestEndSession() {
        if (!state.ws || !state.me || state.me.role !== "Judge") return;
        const ok = window.confirm(
            "End this trial session for everyone? The transcript stays available for download, and no one will be able to rejoin.\n\nYou will be returned to the dashboard after the session ends."
        );
        if (!ok) return;
        if (els.endSessionBtn) els.endSessionBtn.disabled = true;
        state.iEnded = true;
        state.ws.send(JSON.stringify({ type: "end_session" }));
    }

    // The join card, dressed as a "session ended" screen.
    function showEndedJoinCard(room) {
        const title = (room && room.case_title) || "Trial";
        els.joinCaseTitle.textContent = `${title} — concluded`;
        els.joinSubtitle.textContent =
            "The Presiding Judge adjourned this session. The official record is preserved below — no one can rejoin.";
        els.joinForm.style.display = "none";
        const warn = document.getElementById("join-media-warning");
        if (warn) warn.style.display = "none";
        const md = els.endedMdLink, pdf = els.endedPdfLink, rep = els.endedReportLink;
        if (md) md.href = `/api/court/rooms/${ROOM_ID}/transcript`;
        if (pdf) pdf.href = `/api/court/rooms/${ROOM_ID}/transcript.pdf`;
        if (rep) rep.href = `/api/court/rooms/${ROOM_ID}/session-report.pdf`;
        if (els.sessionEndedPanel) els.sessionEndedPanel.style.display = "block";
        if (md || pdf || rep) lucide.createIcons();
    }

    function handleSessionEnded(room) {
        // Tear down the live session: peers, local media, analyzers.
        for (const pid of [...state.peers.keys()]) closePeer(pid);
        try { if (state.localStream) state.localStream.getTracks().forEach((t) => t.stop()); } catch (_) {}
        state.localStream = null;
        // Stop watching the self tile's video — the stream is gone now.
        if (state.me) {
            const selfV = videoElFor(state.me.participant_id);
            stopVideoKeepalive(selfV);
        }
        try { stopAutoDictation(); } catch (_) {}
        try { if (ptt.sr) ptt.sr.abort(); } catch (_) {}
        ptt.sr = null;
        // If face analysis is still running, log its session summary to the
        // record before the teardown — the aggregate must survive the adjournment.
        try { stopFaceAnalysis(); } catch (_) {}
        disableFaceCamera();
        // Back to the join card, now showing the ended state.
        els.root.style.display = "none";
        els.joinOverlay.style.display = "";
        hideJoinError();
        showEndedJoinCard(room);
        state.me = null;
        if (state.ws) {
            try { state.ws.onclose = null; state.ws.close(); } catch (_) {}
            state.ws = null;
        }
        toast("Session ended — the transcript is preserved.");
        // The Judge who clicked "End Session" is sent back to the dashboard /
        // analysis view they opened the trial from: a short countdown on the
        // ended card, then close this tab and focus the opener (or navigate to
        // the dashboard when there is no opener). Other participants keep the
        // ended card with the record downloads.
        if (state.iEnded) {
            state.iEnded = false;
            scheduleReturnToDashboard();
        }
    }

    // Counts down on the ended card, then returns the Judge to the dashboard.
    function scheduleReturnToDashboard() {
        const base = els.joinSubtitle.textContent;
        let n = 5;
        els.joinSubtitle.textContent = `${base} Returning to the dashboard in ${n}s…`;
        const timer = setInterval(() => {
            n -= 1;
            if (n <= 0) {
                clearInterval(timer);
                returnToDashboard();
                return;
            }
            els.joinSubtitle.textContent = `${base} Returning to the dashboard in ${n}s…`;
        }, 1000);
    }

    // Close this tab and hand focus back to the dashboard tab that opened the
    // trial (script-opened tabs may self-close); otherwise just navigate there.
    function returnToDashboard() {
        try {
            if (window.opener && !window.opener.closed) {
                try { window.opener.focus(); } catch (_) {}
                window.close();
                return;
            }
        } catch (_) {}
        window.location.href = "/";
    }

    // Ask the server whether whisper is installed. When it isn't, Hold to Talk
    // switches to the browser's SpeechRecognition (Chrome) so spoken words
    // still reach the official transcript — the record-then-upload path can't
    // work without server ASR.
    async function probeAsr() {
        try {
            const res = await fetch("/api/court/asr-status", { cache: "no-store" });
            const data = res.ok ? await res.json() : null;
            if (data && typeof data.available === "boolean") ptt.serverAsr = data.available;
        } catch (_) {
            ptt.serverAsr = true; // unknown — keep the recorded-clip path; a 503 will flip it
        }
        if (ptt.serverAsr) return;
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        ptt.browserAsr = !!SR && window.isSecureContext;
        if (ptt.browserAsr) {
            toast("Server speech-to-text isn't installed — Hold to Talk will use your browser's speech recognition (Chrome).");
            if (els.pushToTalkBtn) els.pushToTalkBtn.title = "Hold, speak, release — your browser transcribes it into the record";
        } else {
            setAsrStatus(window.isSecureContext
                ? "Server speech-to-text isn't installed and this browser has none — Hold to Talk needs Chrome, or install it with: pip install openai-whisper"
                : "");
        }
    }

    // ---- Hold to Talk over browser SpeechRecognition -------------------
    // While the button is held, Chrome listens (continuous); on release the
    // accumulated words are grammar-corrected via Ollama and sent as this
    // speaker's statement — no server whisper required.
    function pttStartBrowserAsr() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            toast("Speech recognition isn't available in this browser — type your statement instead.");
            showMicFallback();
            return;
        }
        if (ptt.sr) return; // already listening
        const rec = new SR();
        ptt.sr = rec;
        ptt.srText = "";
        rec.lang = "en-IN";
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (ev) => {
            let interim = "";
            for (let i = ev.resultIndex; i < ev.results.length; i++) {
                const seg = ev.results[i];
                if (!seg || !seg[0]) continue;
                const t = seg[0].transcript;
                if (seg.isFinal) ptt.srText = (ptt.srText + " " + t).trim();
                else interim += t;
            }
            if (interim) setAsrStatus("Listening… " + interim);
        };
        rec.onerror = (ev) => {
            const err = (ev && ev.error) || "";
            if (err === "not-allowed" || err === "service-not-allowed") {
                reportMicFailure(null, "Microphone permission was blocked — click the lock icon beside the address bar and allow Microphone.");
            }
            // 'no-speech' and others end quietly (release with silence = no-op).
        };
        rec.onend = () => {
            if (ptt.sr === rec) ptt.sr = null;
            pttFinishBrowserAsr();
        };
        ptt.recording = true;
        ptt.startedAt = Date.now();
        setPttLabel(true, "Listening…");
        applyMicGate(); // browser-ASR hold also opens the live mic
        try {
            rec.start();
        } catch (_) {
            ptt.sr = null;
            ptt.recording = false;
            setPttLabel(false, "Hold to Talk");
            toast("Speech recognition could not start — type your statement instead.");
            showMicFallback();
        }
    }

    function pttFinishBrowserAsr() {
        const wasRecording = ptt.recording;
        ptt.recording = false;
        applyMicGate();
        setPttLabel(false, "Hold to Talk");
        if (!wasRecording) return;
        const raw = ptt.srText;
        ptt.srText = "";
        if (!raw) {
            setAsrStatus("");
            return;
        }
        setAsrStatus("Adding to transcript…");
        (async () => {
            let text = raw;
            try {
                const res = await fetch("/api/court/correct-transcript", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: raw }),
                });
                if (res.ok) {
                    const d = await res.json();
                    if (d && typeof d.corrected === "string" && d.corrected.trim()) text = d.corrected.trim();
                }
            } catch (_) {}
            if (text.trim()) sendStatement(text.slice(0, 500));
            setAsrStatus("");
        })();
    }

    function setPttLabel(active, text) {
        if (!els.pushToTalkBtn) return;
        els.pushToTalkBtn.classList.toggle("active", !!active);
        els.pushToTalkBtn.innerHTML = active
            ? `<i data-lucide="mic-off"></i> ${text}`
            : '<i data-lucide="mic"></i> Hold to Talk';
        lucide.createIcons();
    }

    // ====================================================================
    // AUTO-TRANSCRIPTION (kept as fallback, disabled by default)
    // ====================================================================
    class AsrUnavailableError extends Error {}

    // Voice-activity detection tuning (RMS of the mic's time-domain data).
    const VAD_SPEECH_THRESHOLD = 0.02; // above this = speech energy
    const VAD_START_FRAMES = 10;       // ~170ms of speech before starting a segment
    const VAD_STOP_FRAMES = 55;        // ~920ms of silence before ending a segment
    const MIN_SEGMENT_MS = 500;        // ignore sub-half-second blips
    const MAX_SEGMENT_MS = 20000;      // hard cap — whisper handles ≤ ~30s

    const autoT = {
        enabled: false,      // user toggle (default off — push-to-talk is primary)
        active: false,       // VAD pipeline running
        usingFallback: false,// browser SpeechRecognition mode in use
        ctx: null,           // AudioContext for the analyser
        src: null,           // MediaStreamSource tap on the local mic
        analyser: null,
        timeData: null,
        recorder: null,      // MediaRecorder for the current segment
        recording: false,
        chunks: [],
        speechFrames: 0,
        silenceFrames: 0,
        segmentStartedAt: 0,
        queue: Promise.resolve(), // serializes uploads (one at a time, in order)
    };

    function renderAutoToggle() {
        // No-op — auto-transcribe button removed in favor of push-to-talk.
    }

    async function toggleAutoTranscribe() {
        // Legacy no-op — push-to-talk is now the primary input.
    }

    async function startAutoTranscription() {
        // Legacy no-op — push-to-talk is now the primary input.
    }

    function stopAutoTranscription() {
        // Legacy no-op — push-to-talk is now the primary input.
    }

    // Convert a recorded WebM/Opus blob to a 16 kHz mono WAV (what whisper needs).
    async function blobToWav(blob) {
        const arrayBuf = await blob.arrayBuffer();
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuf = await ctx.decodeAudioData(arrayBuf);
        const targetRate = 16000;
        const outLen = Math.max(1, Math.ceil(audioBuf.duration * targetRate));
        const offline = new OfflineAudioContext(1, outLen, targetRate);
        const src = offline.createBufferSource();
        src.buffer = audioBuf;
        src.connect(offline.destination);
        src.start(0);
        const rendered = await offline.startRendering();
        const channel = rendered.getChannelData(0);

        const buffer = new ArrayBuffer(44 + channel.length * 2);
        const view = new DataView(buffer);
        const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
        writeStr(0, "RIFF");
        view.setUint32(4, 36 + channel.length * 2, true);
        writeStr(8, "WAVE");
        writeStr(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);          // PCM
        view.setUint16(22, 1, true);          // mono
        view.setUint32(24, targetRate, true);
        view.setUint32(28, targetRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeStr(36, "data");
        view.setUint32(40, channel.length * 2, true);
        let offset = 44;
        for (let i = 0; i < channel.length; i++) {
            const s = Math.max(-1, Math.min(1, channel[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
            offset += 2;
        }
        return new Blob([view], { type: "audio/wav" });
    }

    // ---- fallback: browser SpeechRecognition, auto-submitting each utterance ----
    let autoDictating = false;
    let recognition = null;
    let finalSpeech = "";
    // Lazily create browser SpeechRecognition (if available).
    try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = "en-IN";
            recognition.onresult = (event) => {
                let interim = "";
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalSpeech += transcript + " ";
                        autoSubmitSpoken(finalSpeech.trim());
                        finalSpeech = "";
                    } else {
                        interim += transcript;
                    }
                }
                if (interim) setAsrStatus("Listening… " + interim);
            };
            recognition.onerror = () => {};
            recognition.onend = () => { if (autoDictating) try { recognition.start(); } catch (_) {} };
        }
    } catch (_) {}

    function startAutoDictation() {
        if (!recognition) {
            setAsrStatus("Speech-to-text is not supported in this browser — use Chrome.");
            return;
        }
        autoDictating = true;
        finalSpeech = "";
        try { recognition.start(); } catch (_) {}
        setAsrStatus("Browser dictation active — your speech is added to the transcript automatically.");
    }

    function stopAutoDictation() {
        autoDictating = false;
        try { if (recognition) recognition.stop(); } catch (_) {}
    }

    async function autoSubmitSpoken(raw) {
        setAsrStatus("Correcting with Ollama LLM…");
        let text = raw.trim();
        try {
            const res = await fetch("/api/court/correct-transcript", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: raw }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data && typeof data.corrected === "string" && data.corrected.trim()) {
                    text = data.corrected.trim();
                }
            }
        } catch (e) {
            console.warn("LLM correction failed, using raw transcript:", e);
        }
        text = text.slice(0, 500); // match the input's maxlength
        if (text.trim()) sendStatement(text);
        if (autoDictating) setAsrStatus("Browser dictation active — your speech is added to the transcript automatically.");
    }

    // ---- audio playback of recorded clips in the transcript ----
    const clipPlayer = new Audio();

    // Shared playback gain for transcript clips. A quiet courtroom recording
    // (or a distant mic) is often inaudible at unity; a small fixed lift makes
    // the attached .wav clips listenable without touching each clip.
    let clipGain = null;
    const CLIP_GAIN = 1.4;  // ~ +3 dB, same default lift as the live peers

    function ensureClipGain() {
        if (clipGain) return clipGain;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            ctx.resume().catch(() => {});
            const gain = ctx.createGain();
            gain.gain.value = CLIP_GAIN;
            const src = ctx.createMediaElementSource(clipPlayer);
            src.connect(gain);
            gain.connect(ctx.destination);
            clipGain = { ctx, gain };
        } catch (e) {
            console.warn("Transcript clip playback gain unavailable -", e);
        }
        return clipGain;
    }

    let activeClipBtn = null;

    function toggleClipPlay(btn) {
        const url = btn.dataset.url;
        if (activeClipBtn === btn && !clipPlayer.paused) {
            clipPlayer.pause();
            btn.innerHTML = '<i data-lucide="play"></i>';
            lucide.createIcons();
            activeClipBtn = null;
            return;
        }
        // Make sure the playback gain node is set up on this user gesture
        // (AudioContext may be suspended until a gesture).
        ensureClipGain();
        clipPlayer.src = url;
        clipPlayer.play().catch(() => {});
        if (activeClipBtn) activeClipBtn.innerHTML = '<i data-lucide="play"></i>';
        btn.innerHTML = '<i data-lucide="pause"></i>';
        lucide.createIcons();
        activeClipBtn = btn;
        clipPlayer.onended = () => {
            btn.innerHTML = '<i data-lucide="play"></i>';
            lucide.createIcons();
            if (activeClipBtn === btn) activeClipBtn = null;
        };
    }

    els.transcriptFeed.addEventListener("click", (e) => {
        const btn = e.target.closest(".audio-play");
        if (btn) toggleClipPlay(btn);
    });

    // ====================================================================
    // FACE & EXPRESSION ANALYSIS (local camera → nervousness cues)
    // ====================================================================
    // MediaPipe FaceLandmarker (@mediapipe/tasks-vision, lazy-loaded). Detects
    // lip movement / expression cues — lip pressing, lip trembling, frowning,
    // furrowed/raised brows, rapid blinking, gaze avoidance — and logs them to
    // the official transcript as kind='behavior' entries, so nervousness cues
    // become part of the court record. Works on the local camera OR any remote
    // participant's video feed (selected in the panel's source dropdown).
    const FACE_LANDMARKS = {
        leftEye: [33, 160, 158, 133, 153, 144],
        rightEye: [362, 385, 387, 263, 373, 380],
        leftIris: 468,
        rightIris: 473,
        lipLeftCorner: 61,
        lipRightCorner: 291,
        lipUpper: 13,      // inner upper lip
        lipLower: 14,      // inner lower lip
        lipMidUpper: 0,    // outer upper lip centre
        lipMidLower: 17,   // outer lower lip centre
        browInnerL: 21,
        browInnerR: 22,
        browOuterL: 107,
        browOuterR: 336,
        eyeTopL: 159,
        eyeTopR: 386,
        eyeOuterL: 33,
        eyeOuterR: 263,
    };

    const CALIBRATION_FRAMES = 120; // ~4 s of neutral face
    const CUE_PERSIST_FRAMES = 45;  // a cue must persist ~0.75 s to count (rejects momentary twitches)
    const CUE_LOG_INTERVAL_MS = 25000;
    // Calm-face suppression: brief spikes are noise. The reported index is an
    // EMA over frames, and the transcript only carries cues that held on long
    // enough to be deliberate. A session aggregate — not the peak — defines
    // the person's demeanor in the record.
    const SCORE_EMA_ALPHA = 0.06;   // ~16-frame time constant (≈0.27 s)
    const SPEECH_GRACE_MS = 3000;   // no cue logging until speech has been seen
    const CUE_LOG_MIN_CUES = 2;     // need ≥2 concurrent cues before logging

    const face = {
        source: "self",          // "self" or a remote participant_id to analyze
        stream: null,
        ownStream: null,         // dedicated camera stream (only when the mesh lacks video)
        ownsStream: false,       // true when we created ownStream ourselves (safe to stop)
        landmarker: null,        // Vision.FaceLandmarker instance (lazy)
        camera: null,            // { stop() } — frame-loop handle for the landmarker
        _raf: null,
        mediaPipePromise: null,
        analyzing: false,
        calibrated: false,
        calibrationFrames: 0,
        calibAcc: { ear: [], lipOpen: [], lipWidth: [], frown: [], browGap: [], browRaise: [], gaze: [], lipJitter: [] },
        baseline: {
            earMean: 0.3, earStd: 0.02,
            lipOpenMean: 0.05, lipOpenStd: 0.004,
            lipWidthMean: 0.45, lipWidthStd: 0.02,
            frownMean: 0.0, frownStd: 0.003,
            browGapMean: 0.4, browGapStd: 0.02,
            browRaiseMean: 0.15, browRaiseStd: 0.01,
            gazeMean: 0.5, gazeStd: 0.03,
            lipJitterMean: 0.001, lipJitterStd: 0.0005,
        },
        stats: { blinks: 0, lastEarState: "open", startedAt: 0, peakScore: 0, cueEvents: 0, peakAtSpeaking: false },
        history: { lipOpen: [] },
        activeCues: new Set(),
        cueStreak: {},
        cueDurations: {},           // cue name -> seconds active this session
        lastFrameAt: 0,
        logCooldownUntil: 0,
        gauge: 0,
        emaScore: 0,
        emaStarted: false,
        indexSum: 0,
        indexFrames: 0,
        speaking: false,            // currently speaking (self mic / remote audio level)
        speakingAcc: { frames: 0, samples: 0 },
        lastSpeakingSeenAt: 0,
        speechSeenAt: 0,            // first time speech was detected this session
        meter: null,                // { ctx, analyser, buf, source } for self mic level
        remoteMeter: null,          // { ctx, analyser, buf, stream } for remote feed level
        sessionStartIso: "",
    };

    const CUE_LABELS = {
        rapid_blink: { label: "Rapid blinking", icon: "eye", sev: "strong" },
        gaze_avoid: { label: "Gaze avoidance", icon: "scan-eye", sev: "strong" },
        lip_press: { label: "Lip pressing", icon: "smile", sev: "strong" },
        lip_tremor: { label: "Lip trembling", icon: "activity", sev: "strong" },
        frown: { label: "Frowning", icon: "frown", sev: "mild" },
        brow_furrow: { label: "Furrowed brows", icon: "chevrons-down", sev: "mild" },
        brow_raise: { label: "Raised brows", icon: "chevrons-up", sev: "mild" },
    };

    function faceEl(id) { return document.getElementById(id); }

    function initFacePanel() {
        const panel = faceEl("face-analysis");
        if (!panel) return;
        panel.style.display = "flex";
        // If the panel was covered by another panel (e.g. the transcript/PDF)
        // while the camera was supposed to keep running, re-affirm the monitor so
        // it recovers rather than staying black until a source change.
        reaffirmAllRoomVideos();
        const camBtn = faceEl("face-camera-btn");
        if (camBtn) camBtn.addEventListener("click", enableFaceCamera);
        const startBtn = faceEl("face-start-btn");
        if (startBtn) startBtn.addEventListener("click", startFaceAnalysis);
        const stopBtn = faceEl("face-stop-btn");
        if (stopBtn) stopBtn.addEventListener("click", stopFaceAnalysis);
        const srcSel = faceEl("face-source");
        if (srcSel) {
            srcSel.addEventListener("change", () => {
                face.source = srcSel.value;
                if (face.camera) attachFaceSource();  // already monitoring → switch feed
                // The speech meter watches a different stream now — rebuild it
                // so the speaking gate follows the analyzed feed.
                if (face.analyzing) attachSpeechMeter();
            });
        }
        lucide.createIcons();
    }

    // ---- MediaPipe lazy-load (mirrors the dashboard Chakshu pattern) ----
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = src;
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("Failed to load " + src));
            document.head.appendChild(s);
        });
    }

    // Loads the official, maintained @mediapipe/tasks-vision bundle (the legacy
    // @mediapipe/face_mesh "solution" bundle is deprecated and throws when sent
    // frames before its model finishes loading).
    function ensureFacePipeLibs() {
        if (typeof window.Vision !== "undefined" && window.Vision.FaceLandmarker) return Promise.resolve();
        if (!face.mediaPipePromise) {
            face.mediaPipePromise = loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.js");
        }
        return face.mediaPipePromise;
    }

    // Which feed the analyzer watches: repopulated from the roster. The
    // selected feed is mirrored onto the panel's #face-video monitor element,
    // so the landmarker always reads one element regardless of source.
    function populateFaceSourceSelect() {
        const sel = faceEl("face-source");
        if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = '<option value="self">My camera</option>';
        if (state.participants && state.me) {
            for (const p of state.participants) {
                if (p.participant_id === state.me.participant_id) continue;
                const opt = document.createElement("option");
                opt.value = p.participant_id;
                opt.textContent = `${displayRoleFor(p)} — ${p.name}`;
                sel.appendChild(opt);
            }
        }
        if (prev && [...sel.options].some((o) => o.value === prev)) {
            sel.value = prev;
        } else {
            sel.value = "self";
            face.source = "self";
        }
    }

    function attachFaceSource() {
        const video = faceEl("face-video");
        const wrap = document.querySelector(".face-video-wrap");
        const status = faceEl("face-source-status");
        if (!video) return;
        if (wrap) wrap.classList.toggle("mirror", face.source === "self");
        if (status) status.hidden = true;

        if (face.source === "self") {
            // Reuse the shared mesh stream when it has a camera; otherwise fall
            // back to the dedicated stream requested by enableFaceCamera().
            const selfStream = (state.localStream && state.localStream.getVideoTracks().length)
                ? state.localStream
                : (face.ownStream || null);
            affirmVideo(video, selfStream);
            // Keep the monitor alive: if the self tile's stream is live but the
            // monitor goes black, re-play it. Stop watching if the feed disappears.
            startVideoKeepalive(video, selfStream, () => videoHasSrc(video));
            return;
        }

        // A remote participant's feed.
        const peer = state.peers.get(face.source);
        const track = peer && peer.videoTrack;
        if (track) {
            const stream = new MediaStream([track]);
            affirmVideo(video, stream);
            startVideoKeepalive(video, stream, () => videoHasSrc(video));
        } else {
            // No track yet — clear the monitor and keep watching until one lands
            // (refreshFaceSourceIfPending will re-attach when it does).
            affirmVideo(video, null);
            stopVideoKeepalive(video);
            if (status) {
                status.textContent = "Waiting for video from the selected participant…";
                status.hidden = false;
            }
        }
    }

    function refreshFaceSourceIfPending(pid) {
        // The remote's video track just arrived — if the panel is monitoring
        // them, switch the monitor feed over now.
        if (face.camera && face.source === pid) attachFaceSource();
    }

    // ---- camera lifecycle -----------------------------------------------
    async function enableFaceCamera() {
        const btn = faceEl("face-camera-btn");
        const video = faceEl("face-video");
        const placeholder = faceEl("face-placeholder");
        const statePill = faceEl("face-state");
        try {
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Connecting to feed…';
            lucide.createIcons();
            // Self: reuse the shared mesh camera when available; only ask the
            // browser for a dedicated stream if the user joined audio-only.
            // Remote: no permission needed — we mirror their video track.
            if (face.source === "self" && (!state.localStream || !state.localStream.getVideoTracks().length)) {
                face.ownStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, facingMode: "user" },
                });
                face.ownsStream = true;
            }
            attachFaceSource();
            if (placeholder) placeholder.style.display = "none";
            await ensureFacePipeLibs();
            await initFaceMesh();
            if (statePill) { statePill.textContent = "On"; statePill.classList.add("on"); }
            const startBtn = faceEl("face-start-btn");
            if (startBtn) startBtn.disabled = false;
            btn.innerHTML = '<i data-lucide="video-off"></i> Disable';
            btn.disabled = false;
            btn.onclick = disableFaceCamera;
            toast("Feed connected — start analysis to detect nervousness cues.");
        } catch (err) {
            console.error("Face camera error:", err);
            toast("Could not access the selected feed. Check camera permissions.");
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="video"></i> Enable Camera';
            lucide.createIcons();
        }
    }

    function disableFaceCamera() {
        stopFaceAnalysis();
        if (face.camera) { try { face.camera.stop(); } catch (_) {} face.camera = null; }
        // Only stop a stream we created ourselves — never the shared mesh stream.
        if (face.ownStream && face.ownsStream) {
            face.ownStream.getTracks().forEach((t) => t.stop());
        }
        face.ownStream = null;
        face.ownsStream = false;
        // Only clear the face monitor if there is no live feed left to show.
        // If the mesh still has a self camera (or we still have a dedicated stream
        // we did not create), keep feeding the monitor instead of killing it.
        const video = faceEl("face-video");
        if (video) {
            const meshHasVideo = !!(state.localStream && state.localStream.getVideoTracks().length);
            const hasDedicated = !!(face.ownStream && face.ownsStream && face.ownStream.getVideoTracks().length);
            if (!meshHasVideo && !hasDedicated) {
                stopVideoKeepalive(video);
                affirmVideo(video, null);
            } else {
                // Re-affirm so a blackout that happened while the panel was covered
                // recovers now that the camera is supposedly "disabled" in name only.
                const keep = meshHasVideo ? state.localStream : face.ownStream;
                affirmVideo(video, keep);
                startVideoKeepalive(video, keep, () => videoHasSrc(video));
            }
        }
        const placeholder = faceEl("face-placeholder");
        if (placeholder) placeholder.style.display = "flex";
        const statePill = faceEl("face-state");
        if (statePill) { statePill.textContent = "Off"; statePill.classList.remove("on", "live"); }
        const camBtn = faceEl("face-camera-btn");
        if (camBtn) {
            camBtn.innerHTML = '<i data-lucide="video"></i> Enable Camera';
            camBtn.onclick = enableFaceCamera;
        }
        const startBtn = faceEl("face-start-btn");
        if (startBtn) startBtn.disabled = true;
        const stopBtn = faceEl("face-stop-btn");
        if (stopBtn) stopBtn.disabled = true;
        lucide.createIcons();
    }

    // Creates the FaceLandmarker (async — resolves only once the model is
    // loaded, so there is no race sending frames too early). Falls back to the
    // CPU delegate if GPU is unavailable (headless / software rendering).
    async function ensureFaceLandmarker() {
        if (face.landmarker) return face.landmarker;
        const fileset = await Vision.FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
        );
        const make = (delegate) => Vision.FaceLandmarker.createFromOptions(fileset, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                delegate,
            },
            runningMode: "VIDEO",
            numFaces: 1,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false,
        });
        try {
            face.landmarker = await make("GPU");
        } catch (e) {
            console.warn("GPU FaceLandmarker unavailable — using CPU.", e);
            face.landmarker = await make("CPU");
        }
        return face.landmarker;
    }

    // Starts a requestAnimationFrame loop feeding the monitor <video> (local or
    // remote feed) into the landmarker. detectForVideo is synchronous and needs
    // strictly increasing timestamps.
    async function initFaceMesh() {
        const landmarker = await ensureFaceLandmarker();
        if (!landmarker) throw new Error("FaceLandmarker failed to initialise.");
        const video = faceEl("face-video");
        const overlay = faceEl("face-overlay");
        if (overlay) { overlay.width = 640; overlay.height = 480; }
        if (face.camera) { try { face.camera.stop(); } catch (_) {} }
        face.camera = {
            stop: () => { if (face._raf) cancelAnimationFrame(face._raf); face._raf = null; },
        };
        let lastTs = 0;
        const loop = () => {
            if (!face.landmarker || !face.camera) return;
            if (video.readyState >= 2) {
                const ts = performance.now();
                if (ts > lastTs) {
                    lastTs = ts;
                    try {
                        onFaceMeshResults(landmarker.detectForVideo(video, ts));
                    } catch (e) {
                        console.error("Face landmark inference failed:", e);
                    }
                }
            }
            face._raf = requestAnimationFrame(loop);
        };
        face._raf = requestAnimationFrame(loop);
    }

    // ---- analysis lifecycle ---------------------------------------------
    function startFaceAnalysis() {
        face.analyzing = true;
        face.calibrated = false;
        face.calibrationFrames = 0;
        face.calibAcc = { ear: [], lipOpen: [], lipWidth: [], frown: [], browGap: [], browRaise: [], gaze: [], lipJitter: [] };
        face.stats = { blinks: 0, lastEarState: "open", startedAt: Date.now(), peakScore: 0, cueEvents: 0 };
        face.history = { lipOpen: [] };
        face.activeCues.clear();
        face.cueStreak = {};
        face.cueDurations = {};
        face.lastFrameAt = 0;
        face.logCooldownUntil = 0;
        face.gauge = 0;
        face.emaScore = 0;
        face.emaStarted = false;
        face.indexSum = 0;
        face.indexFrames = 0;
        face.speaking = false;
        face.speakingAcc = { frames: 0, samples: 0 };
        face.lastSpeakingSeenAt = 0;
        face.speechSeenAt = 0;
        face.sessionStartIso = new Date().toISOString();
        attachSpeechMeter();

        const startBtn = faceEl("face-start-btn");
        if (startBtn) startBtn.disabled = true;
        const stopBtn = faceEl("face-stop-btn");
        if (stopBtn) stopBtn.disabled = false;
        const scoreEl = faceEl("face-score");
        if (scoreEl) scoreEl.textContent = "0%";
        const fill = faceEl("face-gauge-fill");
        if (fill) { fill.style.width = "0%"; fill.style.background = "var(--color-low)"; }
        const statePill = faceEl("face-state");
        if (statePill) {
            statePill.textContent = "Calibrating…";
            statePill.classList.add("live");
            statePill.classList.remove("on");
        }
        renderFaceCueChips();
    }

    function stopFaceAnalysis(sendSummary = true) {
        if (!face.analyzing) return;
        face.analyzing = false;
        detachSpeechMeter();
        const startBtn = faceEl("face-start-btn");
        if (startBtn) startBtn.disabled = false;
        const stopBtn = faceEl("face-stop-btn");
        if (stopBtn) stopBtn.disabled = true;
        const statePill = faceEl("face-state");
        if (statePill) { statePill.textContent = "Camera on"; statePill.classList.remove("live"); statePill.classList.add("on"); }
        const names = [...face.activeCues].map((k) => (CUE_LABELS[k] || { label: k }).label.toLowerCase());
        const peak = face.stats.peakScore;
        const mean = face.indexFrames ? Math.round(face.indexSum / face.indexFrames) : 0;
        const calmPct = sessionSummary().calmPct;
        let summary =
            `Face analysis ended — session aggregate: mean index ${mean}%, peak ${peak}%, ` +
            `calm ${calmPct}% of the session.`;
        if (names.length) summary += ` Cues at stop: ${names.join(", ")}.`;
        else summary += " No persistent nervousness cues.";
        face.activeCues.clear();
        face.cueStreak = {};
        renderFaceCueChips();
        if (sendSummary) {
            sendBehaviorEntry(summary);
            sendFaceSummary();
            toast("Face analysis stopped — session aggregate logged.");
        }
    }

    // Aggregates the whole analysis run into one object (also sent to the
    // server so the session report and the record carry the balanced view).
    function sessionSummary() {
        const durationSec = Math.max(1, Math.round((Date.now() - face.stats.startedAt) / 1000));
        let cueSec = 0;
        for (const v of Object.values(face.cueDurations)) cueSec += v;
        const calmSec = Math.max(0, durationSec - Math.round(cueSec));
        const subject = subjectInfo();
        return {
            subject: subject.name,
            subject_role: subject.role,
            observer: state.me ? state.me.name : "",
            analyzed_source: face.source,
            started_at: face.sessionStartIso || "",
            ended_at: new Date().toISOString(),
            duration_sec: durationSec,
            time_speaking_sec: face.speakingAcc.samples,
            calm_sec: calmSec,
            calmPct: Math.round((calmSec / durationSec) * 100),
            peak_index: face.stats.peakScore || 0,
            mean_index: face.indexFrames ? Math.round(face.indexSum / face.indexFrames) : 0,
            end_index: face.gauge || 0,
            peak_during_speech: !!(face.stats.peakAtSpeaking),
            counters: { ...face.cueDurations },
            active_durations: { ...face.cueDurations },
            cue_events: face.stats.cueEvents || 0,
        };
    }

    function sendFaceSummary() {
        if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
        const summary = sessionSummary();
        // Fire-and-forget; the server persists it on the room.
        fetch(`/api/court/rooms/${ROOM_ID}/face-summary`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(summary),
        }).catch(() => {});
    }

    // Who is being analyzed — name + display role for the record.
    function subjectInfo() {
        if (face.source === "self") {
            return { name: state.me ? state.me.name : "Me", role: state.me ? state.me.display_role : "" };
        }
        const p = (state.participants || []).find((x) => x.participant_id === face.source);
        if (p) {
            return {
                name: p.name,
                role: displayRoleFor(p) || p.role,
            };
        }
        return { name: "Participant", role: "" };
    }

    function finishFaceCalibration() {
        const b = face.baseline;
        b.earMean = meanOf(face.calibAcc.ear);       b.earStd = Math.max(0.005, stddev(face.calibAcc.ear));
        b.lipOpenMean = meanOf(face.calibAcc.lipOpen); b.lipOpenStd = Math.max(0.0005, stddev(face.calibAcc.lipOpen));
        b.lipWidthMean = meanOf(face.calibAcc.lipWidth); b.lipWidthStd = Math.max(0.005, stddev(face.calibAcc.lipWidth));
        b.frownMean = meanOf(face.calibAcc.frown);   b.frownStd = Math.max(0.0005, stddev(face.calibAcc.frown));
        b.browGapMean = meanOf(face.calibAcc.browGap); b.browGapStd = Math.max(0.005, stddev(face.calibAcc.browGap));
        b.browRaiseMean = meanOf(face.calibAcc.browRaise); b.browRaiseStd = Math.max(0.003, stddev(face.calibAcc.browRaise));
        b.gazeMean = meanOf(face.calibAcc.gaze);     b.gazeStd = Math.max(0.005, stddev(face.calibAcc.gaze));
        b.lipJitterMean = meanOf(face.calibAcc.lipJitter); b.lipJitterStd = Math.max(0.0002, stddev(face.calibAcc.lipJitter));
        face.calibrated = true;
        face.stats.startedAt = Date.now();
        face.sessionStartIso = new Date().toISOString();
        const statePill = faceEl("face-state");
        if (statePill) { statePill.textContent = "Analyzing"; statePill.classList.remove("on"); statePill.classList.add("live"); }
        const subj = subjectInfo();
        sendBehaviorEntry(`Face analysis started — baseline calibrated for ${subj.name} (${subj.role}). Cues count only while the subject is speaking and only when persistent.`);
    }

    // ---- per-frame signal extraction ------------------------------------
    function meanOf(arr) {
        if (!arr.length) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }
    function stddev(arr) {
        if (arr.length < 2) return 0;
        const m = meanOf(arr);
        return Math.sqrt(arr.reduce((s, v) => s + (v - m) * (v - m), 0) / arr.length);
    }
    function lmDist(a, b) {
        return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2));
    }
    function eyeAspectRatio(lm, idxs) {
        const v1 = lmDist(lm[idxs[1]], lm[idxs[5]]);
        const v2 = lmDist(lm[idxs[2]], lm[idxs[4]]);
        const h = lmDist(lm[idxs[0]], lm[idxs[3]]);
        return (v1 + v2) / (2.0 * h);
    }

    function onFaceMeshResults(results) {
        const overlay = faceEl("face-overlay");
        if (!overlay) return;
        const ctx = overlay.getContext("2d");
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        if (!results.faceLandmarks || !results.faceLandmarks.length) return;
        const lm = results.faceLandmarks[0];
        drawFaceOverlay(ctx, lm);
        if (!face.analyzing) return;

        const L = FACE_LANDMARKS;
        // Stable per-face scale: distance between the outer eye corners.
        const unit = Math.max(1e-4, lmDist(lm[L.eyeOuterL], lm[L.eyeOuterR]));

        const lipOpen = lmDist(lm[L.lipUpper], lm[L.lipLower]) / unit;
        const lipWidth = lmDist(lm[L.lipLeftCorner], lm[L.lipRightCorner]) / unit;
        const mouthMidY = (lm[L.lipMidUpper].y + lm[L.lipMidLower].y) / 2;
        const cornerMidY = (lm[L.lipLeftCorner].y + lm[L.lipRightCorner].y) / 2;
        const frown = (cornerMidY - mouthMidY) / unit;   // corners sag below the lip midline
        const browGap = lmDist(lm[L.browInnerL], lm[L.browInnerR]) / unit;
        const browRaise = (lmDist(lm[L.browInnerL], lm[L.eyeTopL]) + lmDist(lm[L.browInnerR], lm[L.eyeTopR])) / 2 / unit;
        const ear = (eyeAspectRatio(lm, L.leftEye) + eyeAspectRatio(lm, L.rightEye)) / 2;
        const gaze = lmDist(lm[L.eyeOuterL], lm[L.leftIris]) / lmDist(lm[L.eyeOuterL], lm[133]);

        // Rolling window for lip tremor (jitter of the mouth opening).
        face.history.lipOpen.push(lipOpen);
        if (face.history.lipOpen.length > 15) face.history.lipOpen.shift();
        const lipJitter = stddev(face.history.lipOpen);

        // ---- calibration phase (neutral face baseline) ----
        if (!face.calibrated) {
            face.calibrationFrames++;
            face.calibAcc.ear.push(ear);
            face.calibAcc.lipOpen.push(lipOpen);
            face.calibAcc.lipWidth.push(lipWidth);
            face.calibAcc.frown.push(frown);
            face.calibAcc.browGap.push(browGap);
            face.calibAcc.browRaise.push(browRaise);
            face.calibAcc.gaze.push(gaze);
            face.calibAcc.lipJitter.push(lipJitter);
            const statePill = faceEl("face-state");
            if (statePill) {
                statePill.textContent = `Calibrating ${Math.min(100, Math.round((face.calibrationFrames / CALIBRATION_FRAMES) * 100))}%`;
            }
            if (face.calibrationFrames >= CALIBRATION_FRAMES) finishFaceCalibration();
            return;
        }

        // ---- live analysis ----
        const b = face.baseline;
        const z = (v, mean, sd) => (v - mean) / Math.max(sd, 1e-6);
        const zLipOpen = z(lipOpen, b.lipOpenMean, b.lipOpenStd);
        const zFrown = z(frown, b.frownMean, b.frownStd);
        const zBrowGap = z(browGap, b.browGapMean, b.browGapStd);
        const zBrowRaise = z(browRaise, b.browRaiseMean, b.browRaiseStd);
        const zGaze = z(gaze, b.gazeMean, b.gazeStd);
        const zLipJitter = z(lipJitter, b.lipJitterMean, b.lipJitterStd);
        const zEar = z(ear, b.earMean, b.earStd);

        updateSpeakingState();

        // Blink counting: EAR dropping well below baseline = a blink.
        if (zEar < -2.2) {
            if (face.stats.lastEarState === "open") {
                face.stats.blinks++;
                face.stats.lastEarState = "closed";
            }
        } else {
            face.stats.lastEarState = "open";
        }
        const elapsedSec = Math.max(1, (Date.now() - face.stats.startedAt) / 1000);
        const bpm = Math.round((face.stats.blinks / elapsedSec) * 60);

        // ---- cue detection: strict thresholds + persistence gating ----
        // Cues only accumulate while the subject is SPEAKING — a person
        // listening quietly (blinking, looking around, shifting) is not
        // "nervous". Thresholds raised from the old 2.0–2.2σ (which fired
        // constantly on calm faces) to 2.8–3.0σ, well into deliberate-motion
        // territory.
        const S = face.speaking;
        const frame = {
            rapid_blink: S && bpm > 30,
            gaze_avoid: S && Math.abs(zGaze) > 3.0,
            lip_press: S && zLipOpen < -3.0 && lipOpen < b.lipOpenMean * 0.7,
            lip_tremor: S && zLipJitter > 2.8,
            frown: S && zFrown > 2.8,
            brow_furrow: S && zBrowGap < -2.8,
            brow_raise: S && zBrowRaise > 2.8,
        };
        // Persistence gating + per-cue duration accounting. A cue must hold
        // for CUE_PERSIST_FRAMES (~0.75 s) before it counts at all; its total
        // active time feeds the session aggregate.
        const nowMs = Date.now();
        const dtSec = face.lastFrameAt ? Math.min(0.5, (nowMs - face.lastFrameAt) / 1000) : 0;
        face.lastFrameAt = nowMs;
        for (const key of Object.keys(frame)) {
            face.cueStreak[key] = frame[key] ? (face.cueStreak[key] || 0) + 1 : 0;
            if (frame[key] && face.cueStreak[key] >= CUE_PERSIST_FRAMES) {
                face.activeCues.add(key);
                face.cueDurations[key] = (face.cueDurations[key] || 0) + dtSec;
            } else if (!frame[key]) face.activeCues.delete(key);
        }

        // ---- nervousness index (0-100), speech-gated + EMA-smoothed ----
        // Raw instantaneous score first...
        const zPool = [
            Math.abs(zGaze),
            Math.max(0, zLipJitter),
            Math.max(0, zFrown),
            Math.max(0, -zBrowGap),
            Math.max(0, -zLipOpen),
            Math.max(0, zBrowRaise),
        ];
        const avgZ = zPool.reduce((a, v) => a + v, 0) / zPool.length;
        let raw = Math.min(100, Math.max(0, Math.round(((avgZ - 1.0) / 2.4) * 100)));
        raw = Math.min(100, raw + face.activeCues.size * 8);
        if (bpm > 32) raw = Math.min(100, raw + 8);
        // ...but a calm face must READ calm: the reported index is a slow
        // EMA, so a two-frame eyebrow twitch cannot swing the gauge, and
        // while the subject is not speaking the index decays toward zero
        // instead of idling at some elevated value.
        if (!face.emaStarted) { face.emaScore = raw; face.emaStarted = true; }
        face.emaScore = face.emaScore + SCORE_EMA_ALPHA * (raw - face.emaScore);
        let score = Math.round(face.emaScore);
        if (!S) score = Math.round(score * 0.9);          // decay when quiet
        if (score < 3) score = 0;                          // floor: calm is calm
        face.gauge = score;
        face.indexSum += score;
        face.indexFrames += 1;
        if (score > face.stats.peakScore) {
            face.stats.peakScore = score;
            face.stats.peakAtSpeaking = S;
        }

        renderFaceLive(score, bpm);
        maybeLogFaceCues();
    }

    // ---- rendering ----
    function setMetric(el, text, cls) {
        if (!el) return;
        el.textContent = text;
        el.className = cls || "";
    }

    function renderFaceLive(score, bpm) {
        const fill = faceEl("face-gauge-fill");
        if (fill) {
            fill.style.width = `${score}%`;
            fill.style.background = score >= 60 ? "var(--color-high)" : score >= 30 ? "var(--color-medium)" : "var(--color-low)";
        }
        const scoreEl = faceEl("face-score");
        if (scoreEl) scoreEl.textContent = `${score}%`;

        const blinks = faceEl("fm-blinks");
        if (blinks) blinks.textContent = `${bpm} bpm (${face.stats.blinks})`;

        const expr = faceEl("fm-expression");
        if (score >= 60) setMetric(expr, "High stress", "tension");
        else if (score >= 30) setMetric(expr, "Elevated", "elevated");
        else setMetric(expr, "Neutral", "");

        const lips = faceEl("fm-lips");
        if (face.activeCues.has("lip_tremor")) setMetric(lips, "Trembling", "tension");
        else if (face.activeCues.has("lip_press")) setMetric(lips, "Pressing", "tension");
        else setMetric(lips, "Stable", "");

        const brows = faceEl("fm-brows");
        if (face.activeCues.has("brow_furrow")) setMetric(brows, "Furrowed", "tension");
        else if (face.activeCues.has("brow_raise")) setMetric(brows, "Raised", "elevated");
        else setMetric(brows, "Relaxed", "");

        renderFaceCueChips();
    }

    function renderFaceCueChips() {
        const wrap = faceEl("face-cues");
        if (!wrap) return;
        const keys = [...face.activeCues];
        if (!keys.length) {
            wrap.innerHTML = face.analyzing ? '<span class="face-note" style="margin:0;">No active cues</span>' : "";
            return;
        }
        wrap.innerHTML = keys.map((k) => {
            const c = CUE_LABELS[k] || { label: k, icon: "activity", sev: "mild" };
            return `<span class="cue-chip ${c.sev}"><i data-lucide="${c.icon}"></i> ${c.label}</span>`;
        }).join("");
        lucide.createIcons();
    }

    function drawFaceOverlay(ctx, lm) {
        const W = ctx.canvas.width, H = ctx.canvas.height;
        const L = FACE_LANDMARKS;
        const px = (i) => ({ x: lm[i].x * W, y: lm[i].y * H });
        ctx.lineWidth = 1;

        // Eye loops (gold)
        ctx.strokeStyle = "rgba(201, 162, 75, 0.45)";
        [L.leftEye, L.rightEye].forEach((idxs) => {
            ctx.beginPath();
            idxs.forEach((idx, i) => {
                const p = px(idx);
                if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
            });
            ctx.closePath();
            ctx.stroke();
        });

        // Pupils (sage)
        ctx.fillStyle = "rgba(78, 122, 102, 0.85)";
        [L.leftIris, L.rightIris].forEach((idx) => {
            const p = px(idx);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.5, 0, 2 * Math.PI);
            ctx.fill();
        });

        // Brows
        ctx.strokeStyle = "rgba(80, 60, 20, 0.4)";
        ctx.beginPath();
        [[L.browInnerL, L.browOuterL], [L.browInnerR, L.browOuterR]].forEach((pair) => {
            const a = px(pair[0]), b = px(pair[1]);
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
        });
        ctx.stroke();

        // Lips: corners + inner upper/lower
        ctx.strokeStyle = "rgba(201, 162, 75, 0.45)";
        const cL = px(L.lipLeftCorner), cR = px(L.lipRightCorner);
        const uL = px(L.lipUpper), lL = px(L.lipLower);
        ctx.beginPath();
        ctx.moveTo(cL.x, cL.y);
        ctx.lineTo(uL.x, uL.y);
        ctx.lineTo(cR.x, cR.y);
        ctx.lineTo(lL.x, lL.y);
        ctx.closePath();
        ctx.stroke();
    }

    // ---- logging to the official record ----
    function maybeLogFaceCues() {
        const now = Date.now();
        if (now < face.logCooldownUntil) return;
        if (!face.activeCues.size) return;
        // Calm-face suppression: at most one brief flare is noise — require
        // ≥2 concurrent persistent cues and a minimum speech history before
        // anything reaches the official record. The session aggregate
        // (logged on stop) remains the authoritative summary.
        if (face.activeCues.size < CUE_LOG_MIN_CUES) return;
        if (!face.speechSeenAt || now - face.speechSeenAt < SPEECH_GRACE_MS) return;
        if (face.gauge < 25) return;
        const names = [...face.activeCues].map((k) => (CUE_LABELS[k] || { label: k }).label.toLowerCase());
        sendBehaviorEntry(`Nervousness cues detected while speaking: ${names.join(", ")} — nervousness index ${face.gauge}%.`);
        face.logCooldownUntil = now + CUE_LOG_INTERVAL_MS;
        face.stats.cueEvents++;
    }

    // ---- speech detection (is the analyzed feed actually talking?) ----
    // Self: the local mic track's level via an AnalyserNode. Remote: the
    // peer's incoming <audio> element through the same mechanism. Speech
    // gates every cue: a silent, listening face is a calm face.
    function attachSpeechMeter() {
        detachSpeechMeter();
        try {
            if (face.source === "self") {
                const stream = (state.localStream && state.localStream.getAudioTracks().length)
                    ? state.localStream : null;
                if (!stream) return;
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                ctx.resume().catch(() => {});
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 512;
                ctx.createMediaStreamSource(stream).connect(analyser);
                face.meter = { ctx, analyser, buf: new Uint8Array(analyser.fftSize), source: stream };
            } else {
                const peer = state.peers.get(face.source);
                if (!peer || !peer.audio) return;
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                ctx.resume().catch(() => {});
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 512;
                ctx.createMediaElementSource(peer.audio).connect(analyser);
                face.remoteMeter = { ctx, analyser, buf: new Uint8Array(analyser.fftSize) };
            }
        } catch (e) {
            console.warn("Face speech meter unavailable — cues gated OFF for this run.", e);
            // No meter ⇒ face.speaking stays false ⇒ no cues logged. That is
            // the safe direction: never accuse based on a face alone.
        }
    }

    function detachSpeechMeter() {
        for (const key of ["meter", "remoteMeter"]) {
            const m = face[key];
            if (m) {
                try { m.ctx.close(); } catch (_) {}
                face[key] = null;
            }
        }
    }

    function updateSpeakingState() {
        const now = Date.now();
        let level = 0;
        const m = face.source === "self" ? face.meter : face.remoteMeter;
        if (m && m.analyser) {
            m.analyser.getByteTimeDomainData(m.buf);
            let sum = 0;
            for (let i = 0; i < m.buf.length; i++) {
                const v = (m.buf[i] - 128) / 128;
                sum += v * v;
            }
            level = Math.sqrt(sum / m.buf.length); // RMS 0..1
        }
        const SPEAK_RMS = 0.045;                     // talking, not breathing
        const HOLD_MS = 900;                          // speech lag before "quiet"
        if (level > SPEAK_RMS) {
            face.speaking = true;
            face.lastSpeakingSeenAt = now;
            if (!face.speechSeenAt) face.speechSeenAt = now;
            face.speakingAcc.frames++;
            // Rough speaking-time accounting (sampled every other frame).
            if (face.speakingAcc.frames % 2 === 0) face.speakingAcc.samples += 1;
        } else if (face.speaking && now - (face.lastSpeakingSeenAt || 0) > HOLD_MS) {
            face.speaking = false;
        }
    }

    function sendBehaviorEntry(text) {
        if (!state.ws || state.ws.readyState !== WebSocket.OPEN || !state.me) return;
        state.ws.send(JSON.stringify({ type: "behavior", text }));
    }

    // ====================================================================
    // ACTIONS (UI)
    // ====================================================================
    async function copyInvite() {
        const url = await buildInviteUrl(ROOM_ID);
        try {
            await navigator.clipboard.writeText(url);
            toast("Invite link copied to clipboard");
        } catch {
            // Fallback: select a temporary input.
            const tmp = document.createElement("input");
            tmp.value = url;
            document.body.appendChild(tmp);
            tmp.select();
            document.execCommand("copy");
            document.body.removeChild(tmp);
            toast("Invite link copied");
        }
    }

    function downloadTranscript() {
        window.location.href = `/api/court/rooms/${ROOM_ID}/transcript`;
    }

    function downloadTranscriptPdf() {
        window.location.href = `/api/court/rooms/${ROOM_ID}/transcript.pdf`;
    }

    // ====================================================================
    // UTIL
    // ====================================================================
    function showJoinError(text) {
        els.joinError.textContent = text;
        els.joinError.style.display = "block";
    }
    function hideJoinError() {
        els.joinError.style.display = "none";
    }

    let toastTimer = null;
    function toast(text) {
        els.toast.textContent = text;
        els.toast.style.display = "block";
        // Reflow to restart animation.
        void els.toast.offsetWidth;
        els.toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            els.toast.classList.remove("show");
            setTimeout(() => { els.toast.style.display = "none"; }, 300);
        }, 2600);
    }

    function escapeHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // Clean up on unload.
    window.addEventListener("beforeunload", () => {
        try { state.ws && state.ws.close(); } catch (_) {}
        for (const pid of [...state.peers.keys()]) closePeer(pid);
        if (state.localStream) state.localStream.getTracks().forEach((t) => t.stop());
        stopAutoTranscription();
        stopAutoDictation();
        try { clipPlayer.pause(); } catch (_) {}
        if (clipGain) {
            try { clipGain.ctx.close(); } catch (_) {}
            clipGain = null;
        }
        disableFaceCamera();
        // Stop any keepalive still running on the self tile.
        if (state.me) {
            const selfV = videoElFor(state.me.participant_id);
            stopVideoKeepalive(selfV);
        }
    });

    init();
})();
