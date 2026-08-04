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
        Judge: "#5D7052",
        Defence: "#C18C5D",
        Prosecution: "#A85448",
        Witness: "#8B5C9E",
        system: "#78786C",
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
        micEnabled: true,
        localStream: null,
        peers: new Map(),          // participant_id -> { pc: RTCPeerConnection, audio: HTMLAudioElement }
        pendingOfferTargets: new Set(), // pids we still need to offer to once our stream is ready
    };

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
        remoteAudioHost: $("remote-audio-host"),
        toast: $("toast"),
    };

    // ====================================================================
    // INIT
    // ====================================================================
    async function init() {
        lucide.createIcons();
        await loadRoomPreview();
        renderRolePicker();
        els.joinForm.addEventListener("submit", onJoin);
        els.statementForm.addEventListener("submit", onStatement);
        els.copyInviteBtn.addEventListener("click", copyInvite);
        els.downloadTranscriptBtn.addEventListener("click", downloadTranscript);
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
            // Seed any existing transcript so a late joiner sees history.
            renderTranscript(room.transcript);
        } catch (e) {
            console.error("Failed to load room preview:", e);
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
            case "error": {
                console.warn("Server error:", msg.detail);
                // If the join was rejected (e.g. role taken), bounce back to overlay.
                if (!state.me && msg.detail.includes("already taken")) {
                    showJoinError(msg.detail + " Please pick another role.");
                    try { state.ws.close(); } catch (_) {}
                    els.enterBtn.disabled = false;
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
            // TURN server would go here for strict NATs (out of scope for demo).
        ],
    };

    async function ensureLocalStream() {
        if (state.localStream) return state.localStream;
        try {
            state.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                // video: false  — flip to enable video later
            });
        } catch (e) {
            console.warn("Microphone access denied or unavailable. Audio will be disabled.", e);
            state.localStream = null;
            state.micEnabled = false;
            toast("Microphone unavailable — you can still participate via text.");
        }
        return state.localStream;
    }

    function createPeerConnection(remotePid) {
        const pc = new RTCPeerConnection(RTC_CONFIG);

        // Remote audio element for this peer.
        const audio = document.createElement("audio");
        audio.autoplay = true;
        audio.playsInline = true;
        els.remoteAudioHost.appendChild(audio);

        pc.ontrack = (event) => {
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

        // Add our local tracks so the peer can hear us.
        if (state.localStream) {
            for (const track of state.localStream.getTracks()) {
                pc.addTrack(track, state.localStream);
            }
        }

        state.peers.set(remotePid, { pc, audio });
        return pc;
    }

    // Newcomer-initiated: we offer to each pending target once our mic is ready.
    async function drainPendingOffers() {
        if (!state.localStream) {
            // If the mic failed, wait briefly and retry; offer once tracks exist.
            if (state.localStream === null) return; // truly unavailable
        }
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
            const offer = await pc.createOffer({ offerToReceiveAudio: true });
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
        state.peers.delete(remotePid);
    }

    // Simple active-speaker detection via WebAudio analyser (visual glow only).
    function attachSpeakerDetection(audioEl, remotePid) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const src = ctx.createMediaElementSource(audioEl);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            src.connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
                if (!state.peers.has(remotePid)) return;
                analyser.getByteFrequencyData(data);
                const avg = data.reduce((a, b) => a + b, 0) / data.length;
                const tile = document.querySelector(`.participant-tile[data-pid="${remotePid}"]`);
                if (tile) tile.classList.toggle("speaking", avg > 18);
                requestAnimationFrame(tick);
            };
            tick();
        } catch (e) {
            // AudioContext may fail if not user-gesture-activated; non-fatal.
        }
    }

    function toggleMic() {
        if (!state.localStream) return;
        state.micEnabled = !state.micEnabled;
        for (const track of state.localStream.getAudioTracks()) {
            track.enabled = state.micEnabled;
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
        // Show phase controls only for the Judge.
        els.phaseControls.style.display = state.me.role === "Judge" ? "block" : "none";
        renderPhaseButtons();
        els.statementInput.focus();
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
                <div class="avatar role-${p.role}" style="background:${ROLE_ACCENT[p.role] || ROLE_ACCENT.system}">${initials}</div>
                <div class="tile-info">
                    <div class="tile-name">${escapeHtml(p.name)}${isMe ? " (you)" : ""}</div>
                    <div class="tile-role role-${p.role}">${escapeHtml(displayRole)}</div>
                </div>
                ${isMe ? `<button class="tile-mic-btn ${state.micEnabled ? "" : "off"}" title="${state.micEnabled ? "Mute" : "Unmute"}">
                    <i data-lucide="${state.micEnabled ? "mic" : "mic-off"}"></i>
                </button>` : ""}
            `;
            if (isMe) {
                tile.querySelector(".tile-mic-btn").addEventListener("click", toggleMic);
                if (!state.micEnabled) tile.querySelector(".avatar").classList.add("muted");
            }
            els.rosterList.appendChild(tile);
        }
        lucide.createIcons();
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
        } else {
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
                    <div class="entry-text">${escapeHtml(entry.text)}</div>
                </div>`;
        }
        els.transcriptFeed.appendChild(node);
        if (scroll) scrollToBottom();
    }

    function roleKeyFromDisplay(displayRole) {
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
    // ACTIONS (UI)
    // ====================================================================
    async function copyInvite() {
        const url = `${window.location.origin}/court/${ROOM_ID}`;
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
    });

    init();
})();
