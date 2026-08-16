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
        dictateBtn: $("dictate-btn"),
        dictateStatus: $("dictate-status"),
        remoteAudioHost: $("remote-audio-host"),
        autoTranscribeBtn: $("auto-transcribe-btn"),
        asrStatus: $("asr-status"),
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
        if (els.dictateBtn) els.dictateBtn.addEventListener("click", toggleDictate);
        if (els.autoTranscribeBtn) els.autoTranscribeBtn.addEventListener("click", toggleAutoTranscribe);
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
                // Kick off automatic speech transcription for this participant:
                // speak → recorded → Ollama whisper → grammar-corrected → transcript.
                startAutoTranscription();
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
    // DICTATION (speech-to-text + LLM cleanup)
    // ====================================================================
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let dictating = false;
    let finalSpeech = ""; // accumulated final utterances of the current session

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-IN";

        recognition.onresult = (event) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const r = event.results[i];
                if (r.isFinal) finalSpeech += (finalSpeech ? " " : "") + r[0].transcript;
                else interim += r[0].transcript;
            }
            if (interim && els.dictateStatus) {
                els.dictateStatus.textContent = `Listening… “${interim}”`;
            }
        };

        recognition.onerror = (event) => {
            if (event.error === "not-allowed" || event.error === "service-not-allowed") {
                if (autoDictating) stopAutoDictation();
                setDictating(false);
                toast("Microphone access denied — allow the mic in your browser to dictate.");
                if (els.dictateStatus) els.dictateStatus.textContent = "Microphone access denied. Type instead.";
                setAsrStatus("Microphone access denied — automatic transcription is off.");
            } else {
                // Persistent recognition errors would otherwise loop (onend restarts).
                if (autoDictating) stopAutoDictation();
                setDictating(false);
                if (els.dictateStatus) els.dictateStatus.textContent = `Speech error: ${event.error} — type instead.`;
                if (autoT.usingFallback) {
                    autoT.usingFallback = false;
                    setAsrStatus(`Speech error: ${event.error} — automatic transcription is off.`);
                }
            }
        };

        recognition.onend = () => {
            // Recognition stopped (manual or auto) — flush what was captured.
            setDictating(false);
            const captured = finalSpeech;
            finalSpeech = "";
            if (autoDictating) {
                // Fallback auto mode: keep listening and auto-submit each utterance.
                try { recognition.start(); } catch (_) {}
                if (captured.trim()) autoSubmitSpoken(captured);
                return;
            }
            if (captured.trim()) {
                if (els.dictateStatus) els.dictateStatus.textContent = "Correcting with Ollama LLM…";
                correctAndInsert(captured);
            } else if (els.dictateStatus) {
                els.dictateStatus.textContent = "";
            }
        };
    }

    function setDictating(on) {
        dictating = on;
        if (!els.dictateBtn) return;
        els.dictateBtn.classList.toggle("active", on);
        els.dictateBtn.innerHTML = on
            ? '<i data-lucide="mic-off"></i> Stop'
            : '<i data-lucide="mic"></i> Dictate';
        lucide.createIcons();
        if (on && els.dictateStatus) els.dictateStatus.textContent = "Listening… speak clearly.";
        else if (!on && els.dictateStatus && !els.dictateStatus.textContent.startsWith("Correcting")) {
            els.dictateStatus.textContent = "";
        }
    }

    function toggleDictate() {
        if (!recognition) {
            toast("Speech-to-text isn't supported in this browser — use Chrome.");
            return;
        }
        if (dictating) {
            try { recognition.stop(); } catch (_) {}
            // onend flushes the captured speech into the input.
            return;
        }
        // Manual dictation takes over from the automatic fallback mode.
        if (autoDictating) stopAutoDictation();
        finalSpeech = "";
        try { recognition.start(); } catch (e) { /* already started */ }
        setDictating(true);
    }

    async function correctAndInsert(raw) {
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
        els.statementInput.value = text;
        els.statementInput.focus();
        const len = els.statementInput.value.length;
        els.statementInput.setSelectionRange(len, len);
        if (els.dictateStatus) els.dictateStatus.textContent = "Corrected — review and press Speak to submit.";
    }

    // ====================================================================
    // AUTO-TRANSCRIPTION (continuous: speak → record → Ollama → transcript)
    //
    // Every participant's client records ONLY its own mic. Speech segments
    // (voice-activity detected) are converted to 16 kHz WAV and POSTed to
    // /api/court/transcribe, where Ollama whisper transcribes them, the chat
    // LLM fixes the grammar, and the corrected words are appended to the
    // official transcript with the audio clip attached. The server attributes
    // the entry to this participant, so every speaker ends up in the record.
    // If whisper is unavailable the client falls back to the browser's own
    // speech recognition (auto-submitting for the local speaker only).
    // ====================================================================

    // Voice-activity detection tuning (RMS of the mic's time-domain data).
    const VAD_SPEECH_THRESHOLD = 0.02; // above this = speech energy
    const VAD_START_FRAMES = 10;       // ~170ms of speech before starting a segment
    const VAD_STOP_FRAMES = 55;        // ~920ms of silence before ending a segment
    const MIN_SEGMENT_MS = 500;        // ignore sub-half-second blips
    const MAX_SEGMENT_MS = 20000;      // hard cap — whisper handles ≤ ~30s

    class AsrUnavailableError extends Error {}

    const autoT = {
        enabled: true,       // user toggle (default on)
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

    function renderAutoToggle() {
        if (!els.autoTranscribeBtn) return;
        els.autoTranscribeBtn.classList.toggle("active", autoT.enabled);
        if (autoT.enabled) {
            setAsrStatus(autoT.usingFallback
                ? "Browser dictation active — your speech is added to the transcript automatically."
                : "Listening… speak to add your words to the transcript.");
        } else {
            setAsrStatus("");
        }
    }

    async function toggleAutoTranscribe() {
        autoT.enabled = !autoT.enabled;
        renderAutoToggle();
        if (autoT.enabled) {
            await startAutoTranscription();
        } else {
            stopAutoTranscription();
        }
    }

    async function startAutoTranscription() {
        if (!autoT.enabled) return;
        if (autoT.usingFallback) { startAutoDictation(); return; }
        if (autoT.active) return;

        const stream = await ensureLocalStream();
        if (!stream || !stream.getAudioTracks().length) {
            setAsrStatus("Microphone unavailable — automatic transcription is off.");
            return;
        }
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === "suspended") ctx.resume().catch(() => {});
            const src = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            src.connect(analyser);
            autoT.ctx = ctx;
            autoT.src = src;
            autoT.analyser = analyser;
            autoT.timeData = new Uint8Array(analyser.fftSize);
            autoT.active = true;
            setAsrStatus("Listening… speak to add your words to the transcript.");
            vadTick();
        } catch (e) {
            console.warn("Could not start voice-activity detection:", e);
            setAsrStatus("Automatic transcription unavailable.");
        }
    }

    function stopAutoTranscription() {
        // Detach handlers first so a torn-down segment is never uploaded.
        if (autoT.recorder) autoT.recorder.onstop = null;
        autoT.active = false;
        autoT.recording = false;
        if (autoT.recorder && autoT.recorder.state !== "inactive") {
            try { autoT.recorder.stop(); } catch (_) {}
        }
        autoT.recorder = null;
        autoT.chunks = [];
        if (autoT.src) { try { autoT.src.disconnect(); } catch (_) {} }
        if (autoT.ctx) { try { autoT.ctx.close(); } catch (_) {} }
        autoT.src = null;
        autoT.analyser = null;
        autoT.ctx = null;
        stopAutoDictation();
    }

    function computeRms(timeData) {
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
            const v = (timeData[i] - 128) / 128;
            sum += v * v;
        }
        return Math.sqrt(sum / timeData.length);
    }

    function vadTick() {
        if (!autoT.active || !autoT.analyser) return;
        autoT.analyser.getByteTimeDomainData(autoT.timeData);
        const speaking = computeRms(autoT.timeData) > VAD_SPEECH_THRESHOLD;
        if (speaking) {
            autoT.silenceFrames = 0;
            autoT.speechFrames++;
            if (autoT.speechFrames >= VAD_START_FRAMES && !autoT.recording) startSegment();
        } else {
            autoT.speechFrames = 0;
            if (autoT.recording) {
                autoT.silenceFrames++;
                if (autoT.silenceFrames >= VAD_STOP_FRAMES) stopSegment();
            }
        }
        // Safety cap so a long monologue is flushed before whisper's limit.
        if (autoT.recording && Date.now() - autoT.segmentStartedAt > MAX_SEGMENT_MS) stopSegment();
        requestAnimationFrame(vadTick);
    }

    function startSegment() {
        if (autoT.recording) return;
        autoT.recording = true;
        autoT.segmentStartedAt = Date.now();
        autoT.chunks = [];
        try {
            autoT.recorder = new MediaRecorder(state.localStream, { mimeType: "audio/webm" });
        } catch (e) {
            try { autoT.recorder = new MediaRecorder(state.localStream); }
            catch (e2) { autoT.recording = false; return; }
        }
        autoT.recorder.ondataavailable = (e) => { if (e.data && e.data.size) autoT.chunks.push(e.data); };
        autoT.recorder.onstop = onSegmentStopped;
        autoT.recorder.start(250);
        setAsrStatus("Recording…");
    }

    function stopSegment() {
        if (!autoT.recording || !autoT.recorder) return;
        autoT.recording = false;
        try { autoT.recorder.stop(); } catch (_) {}
    }

    function onSegmentStopped() {
        const chunks = autoT.chunks;
        autoT.chunks = [];
        const startedAt = autoT.segmentStartedAt;
        const blob = new Blob(chunks, { type: "audio/webm" });
        if (!blob.size || Date.now() - startedAt < MIN_SEGMENT_MS) {
            if (autoT.active) setAsrStatus("Listening…");
            return;
        }
        setAsrStatus("Transcribing with Ollama…");
        // Serialize uploads so segments are processed in order, one at a time.
        autoT.queue = autoT.queue.then(async () => {
            try {
                const wav = await blobToWav(blob);
                await uploadSegment(wav);
            } catch (e) {
                if (e instanceof AsrUnavailableError) {
                    handleAsrUnavailable(e.message);
                } else {
                    console.warn("Segment transcription failed:", e);
                }
            } finally {
                if (autoT.active) setAsrStatus("Listening…");
            }
        });
    }

    async function uploadSegment(wavBlob) {
        const fd = new FormData();
        fd.append("room_id", ROOM_ID);
        fd.append("participant_id", state.me.participant_id);
        fd.append("audio", wavBlob, `segment_${Date.now()}.wav`);
        const res = await fetch("/api/court/transcribe", { method: "POST", body: fd });
        if (!res.ok) {
            let code = null, msg = `Transcription failed (${res.status})`;
            try {
                const d = await res.json();
                if (d && d.detail) {
                    if (typeof d.detail === "object") { code = d.detail.code; msg = d.detail.message || msg; }
                    else msg = d.detail;
                }
            } catch (_) {}
            if (code === "asr_unavailable") throw new AsrUnavailableError(msg);
            throw new Error(msg);
        }
        // The server broadcasts the entry to the room; nothing else to do here.
        return res.json();
    }

    function handleAsrUnavailable(message) {
        if (autoT.usingFallback) return;
        autoT.usingFallback = true;
        stopAutoTranscription();
        startAutoDictation();
        toast(message || "Ollama whisper is not installed — using browser dictation for your speech only.");
        setAsrStatus("Browser dictation active — your speech is added to the transcript automatically.");
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
        try { recognition.stop(); } catch (_) {}
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
    });

    init();
})();
