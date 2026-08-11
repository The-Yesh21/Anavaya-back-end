// =====================================================================
// ANAVAYA CASE WORKFLOW MODULE
// Create New Case wizard · Cases registry · Chakshu speech-to-text
// transcript · Evidence fact-checking
//
// Loaded after app.js. Communicates with the dashboard through the
// window.AnavayaUI bridge defined inside app.js's main closure.
// =====================================================================
document.addEventListener("DOMContentLoaded", () => {
    const UI = window.AnavayaUI;
    if (!UI) {
        console.error("AnavayaUI bridge not found — case workflow disabled.");
        return;
    }
    // Reuse the dashboard's escaper when available (fallback included).
    const esc = (s) => {
        if (UI && typeof UI.escHtml === "function") return UI.escHtml(s);
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    };

    const $ = (id) => document.getElementById(id);
    const DOC_TYPES = ["FIR", "Police Report", "Medical", "Statement", "Other"];

    // ---- priority helpers -------------------------------------------
    const prioClass = (p) => String(p || "medium").toLowerCase();
    function prioBadge(p) {
        return `<span class="badge-priority ${prioClass(p)}">${esc(p || "Not analysed")}</span>`;
    }

    // =================================================================
    // 1. CASES REGISTRY (sidebar section)
    // =================================================================
    const registryList = $("cases-registry-list");
    let registryCases = [];
    let expandedCaseId = null;

    async function fetchRegistry() {
        try {
            const res = await fetch("/api/case-registry");
            if (!res.ok) throw new Error("registry fetch failed");
            registryCases = await res.json();
            renderRegistry();
        } catch (err) {
            if (registryList) registryList.innerHTML =
                `<div class="loader" style="color:#A85448">Cases unavailable — start the backend.</div>`;
        }
    }

    function renderRegistry() {
        if (!registryList) return;
        if (!registryCases.length) {
            registryList.innerHTML = `<div class="registry-empty">No cases yet — click “Create New Case” above.</div>`;
            return;
        }
        registryList.innerHTML = registryCases.map((c) => {
            const open = expandedCaseId === c.case_id;
            const docs = (c.documents || []).map((d) => `
                <li class="registry-doc" data-case="${esc(c.case_id)}" data-doc="${esc(d.doc_id)}"
                    data-filename="${esc(d.filename)}" title="Select this document">
                    <i data-lucide="file-text"></i>
                    <span>${esc(d.filename)}</span>
                    ${d.priority ? prioBadge(d.priority) : ""}
                </li>`).join("");
            return `
            <div class="registry-case ${open ? "open" : ""}" data-case-id="${esc(c.case_id)}">
                <div class="registry-case-head">
                    <div class="registry-case-title">
                        <strong>${esc(c.title || c.case_id)}</strong>
                        <span class="registry-case-id">${esc(c.case_id)}</span>
                    </div>
                    <div class="registry-case-meta">
                        ${prioBadge(c.aggregate_priority)}
                        <span class="registry-doc-count">${(c.documents || []).length} docs</span>
                        <i data-lucide="chevron-down" class="registry-chevron"></i>
                    </div>
                </div>
                <ul class="registry-docs">${docs || `<li class="registry-doc-empty">No documents yet</li>`}</ul>
            </div>`;
        }).join("");
        if (typeof lucide !== "undefined") lucide.createIcons();

        // Head click → expand / select case
        registryList.querySelectorAll(".registry-case-head").forEach((head) => {
            head.addEventListener("click", (e) => {
                const card = head.closest(".registry-case");
                const caseId = card.getAttribute("data-case-id");
                expandedCaseId = expandedCaseId === caseId ? null : caseId;
                UI.setCurrentCaseId(caseId);
                renderRegistry();
                updateTranscriptCaseBadge();
            });
        });
        // Doc click → select the matching Excel row if present
        registryList.querySelectorAll(".registry-doc").forEach((li) => {
            li.addEventListener("click", (e) => {
                e.stopPropagation();
                const filename = li.getAttribute("data-filename");
                const row = UI.getCasesData().find((r) => r.Case_File === filename);
                if (row) {
                    UI.selectCaseFn(row);
                } else {
                    UI.setCurrentCaseId(li.getAttribute("data-case"));
                    alert("This document has not been analysed yet — run “Analyze” from the wizard.");
                }
                updateTranscriptCaseBadge();
            });
        });
    }

    const refreshCasesBtn = $("refresh-cases-btn");
    if (refreshCasesBtn) refreshCasesBtn.addEventListener("click", () => fetchRegistry());

    function updateTranscriptCaseBadge() {
        const badge = $("transcript-case-badge");
        const id = UI.getCurrentCaseId();
        if (!badge) return;
        if (id) {
            badge.style.display = "inline-block";
            badge.textContent = `Case ${id}`;
        } else {
            badge.style.display = "none";
        }
        const runBtn = $("run-factcheck-btn");
        if (runBtn) runBtn.disabled = !id;
    }

    // =================================================================
    // 2. CREATE NEW CASE WIZARD
    // =================================================================
    const modal = $("case-wizard-modal");
    const createBtn = $("create-case-btn");
    let wizardCaseId = null;
    let pendingDocs = [];

    function showStep(n) {
        document.querySelectorAll(".wstep").forEach((s) =>
            s.classList.toggle("active", Number(s.getAttribute("data-wstep")) === n));
        document.querySelectorAll(".wizard-step-pane").forEach((p) =>
            p.classList.toggle("active", Number(p.getAttribute("data-wstep-pane")) === n));
    }

    function openWizard() {
        wizardCaseId = null;
        pendingDocs = [];
        $("wizard-created").style.display = "none";
        $("wizard-upload-btn").disabled = true;
        renderPendingDocs();
        showStep(1);
        modal.style.display = "flex";
    }
    function closeWizard() { modal.style.display = "none"; }

    if (createBtn) createBtn.addEventListener("click", openWizard);
    $("wizard-close-btn").addEventListener("click", closeWizard);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeWizard(); });

    // Step 1: create the case
    $("wizard-create-btn").addEventListener("click", async () => {
        const btn = $("wizard-create-btn");
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Creating…';
        if (typeof lucide !== "undefined") lucide.createIcons();
        try {
            const title = $("wizard-title").value.trim();
            const officer = $("wizard-officer").value.trim();
            const firInput = $("wizard-fir-input");
            const firFile = firInput.files && firInput.files[0];

            const fd = new FormData();
            if (title) fd.append("case_title", title);
            if (officer) fd.append("created_by", officer);
            if (firFile) fd.append("fir_file", firFile);

            const res = await fetch("/api/cases", { method: "POST", body: fd });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || "Case creation failed");
            }
            const caseData = await res.json();
            wizardCaseId = caseData.case_id;
            UI.setCurrentCaseId(wizardCaseId);

            $("wizard-case-id").textContent = wizardCaseId;
            $("wizard-created").style.display = "block";
            $("wizard-upload-btn").disabled = false;
            updateTranscriptCaseBadge();
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="plus-circle"></i> Create Case';
            if (typeof lucide !== "undefined") lucide.createIcons();
        }
    });

    $("wizard-next-btn").addEventListener("click", () => showStep(2));

    // Step 2: evidence uploads
    const dropZone = $("wizard-doc-drop");
    const docInput = $("wizard-doc-input");

    dropZone.addEventListener("click", () => docInput.click());
    ["dragenter", "dragover"].forEach((evt) => dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
    }));
    ["dragleave", "drop"].forEach((evt) => dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
    }));
    dropZone.addEventListener("drop", (e) => {
        const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
        files.forEach(addPendingDoc);
    });
    docInput.addEventListener("change", () => {
        Array.from(docInput.files || []).forEach(addPendingDoc);
        docInput.value = "";
    });

    function addPendingDoc(file) {
        if (!file.name.toLowerCase().endsWith(".pdf")) {
            alert(`Only PDF files are supported (${file.name}).`);
            return;
        }
        pendingDocs.push({ file, type: $("wizard-doc-type").value });
        renderPendingDocs();
    }

    function renderPendingDocs() {
        const list = $("wizard-doc-list");
        list.innerHTML = pendingDocs.map((pd, i) => `
            <li class="wizard-doc-item">
                <i data-lucide="file-text"></i>
                <span class="wizard-doc-name">${esc(pd.file.name)}</span>
                <select class="wizard-doc-type" data-i="${i}">
                    ${DOC_TYPES.map((t) => `<option value="${t}" ${t === pd.type ? "selected" : ""}>${t}</option>`).join("")}
                </select>
                <button class="wizard-doc-remove" data-i="${i}" aria-label="Remove"><i data-lucide="x"></i></button>
            </li>`).join("");
        list.querySelectorAll(".wizard-doc-type").forEach((sel) =>
            sel.addEventListener("change", () => { pendingDocs[Number(sel.getAttribute("data-i"))].type = sel.value; }));
        list.querySelectorAll(".wizard-doc-remove").forEach((b) =>
            b.addEventListener("click", () => { pendingDocs.splice(Number(b.getAttribute("data-i")), 1); renderPendingDocs(); }));
        if (typeof lucide !== "undefined") lucide.createIcons();
    }

    // Upload all pending docs, then analyse the whole case
    $("wizard-upload-btn").addEventListener("click", async () => {
        if (!wizardCaseId) { alert("Create the case first."); return; }
        const btn = $("wizard-upload-btn");
        btn.disabled = true;
        const progress = $("wizard-progress");
        progress.innerHTML = '<div class="loader">Uploading documents…</div>';

        try {
            for (const pd of pendingDocs) {
                progress.innerHTML = `<div class="loader">Uploading ${esc(pd.file.name)}…</div>`;
                const fd = new FormData();
                fd.append("file", pd.file);
                fd.append("doc_type", pd.type);
                const res = await fetch(`/api/cases/${encodeURIComponent(wizardCaseId)}/documents`, {
                    method: "POST", body: fd,
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.detail || `Upload of ${pd.file.name} failed`);
                }
            }
            pendingDocs = [];

            progress.innerHTML = '<div class="loader">Running priority analysis (per document + aggregate)…</div>';
            const res = await fetch(`/api/cases/${encodeURIComponent(wizardCaseId)}/analyze`, { method: "POST" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || "Analysis failed");
            }
            const caseData = await res.json();
            renderWizardResults(caseData);
            showStep(3);
            progress.innerHTML = "";
        } catch (err) {
            progress.innerHTML = `<div class="loader" style="color:#A85448">${esc(err.message)}</div>`;
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="upload"></i> Upload &amp; Analyze All';
            if (typeof lucide !== "undefined") lucide.createIcons();
        }
    });

    // Step 3: per-document + aggregate results
    function renderWizardResults(caseData) {
        const results = $("wizard-results");
        const agg = caseData.aggregate_priority;
        const docs = caseData.documents || [];
        results.innerHTML = `
            <div class="wizard-aggregate">
                <span class="wizard-aggregate-label">Aggregate Case Priority</span>
                ${prioBadge(agg)}
                <p class="wizard-rationale">${esc(caseData.aggregate_rationale || "")}</p>
            </div>
            <div class="wizard-doc-cards">
                ${docs.map((d) => `
                    <div class="wizard-doc-card">
                        <div class="wizard-doc-card-head">
                            <strong>${esc(d.filename)}</strong>
                            <span class="wizard-doc-type-tag">${esc(d.doc_type)}</span>
                        </div>
                        ${d.priority ? `
                        <div class="wizard-doc-card-meta">
                            ${prioBadge(d.priority)}
                            <span>${esc((d.analysis || {}).case_category || "N/A")}</span>
                            <span>${esc((d.analysis || {}).severity || "N/A")}</span>
                            <span>${esc((d.analysis || {}).vulnerability || "N/A")}</span>
                            <span>${esc((d.analysis || {}).influence || "N/A")}</span>
                        </div>` : `<div class="wizard-doc-card-meta"><span class="text-muted">Analysis pending / failed</span></div>`}
                    </div>`).join("")}
            </div>`;
        $("wizard-done-btn").style.display = "inline-flex";
        if (typeof lucide !== "undefined") lucide.createIcons();
    }

    $("wizard-done-btn").addEventListener("click", async () => {
        closeWizard();
        if (wizardCaseId) {
            UI.setCurrentCaseId(wizardCaseId);
            updateTranscriptCaseBadge();
        }
        // Refresh Excel-backed list + registry, then select the FIR doc.
        try { await UI.refreshCases(); } catch (e) { /* non-fatal */ }
        await fetchRegistry();
        const caseRec = registryCases.find((c) => c.case_id === wizardCaseId);
        if (caseRec && caseRec.documents && caseRec.documents.length) {
            const first = caseRec.documents[0];
            const row = UI.getCasesData().find((r) => r.Case_File === first.filename);
            if (row) UI.selectCaseFn(row);
        }
    });

    // =================================================================
    // 3. CHAKSHU SPEECH-TO-TEXT TRANSCRIPT
    // =================================================================
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const speechStatus = $("speech-status");
    const transcriptEl = $("chakshu-transcript");
    const listeningBtn = $("toggle-listening-btn");
    const listeningLabel = $("listening-label");
    const askBtn = $("ask-question-btn");
    const questionInput = $("examiner-question");
    const typedInput = $("typed-statement-input");
    const typedAddBtn = $("add-typed-statement-btn");
    const runFactCheckBtn = $("run-factcheck-btn");
    const factCheckPanel = $("factcheck-panel");
    const downloadDossierBtn = $("download-dossier-btn");

    let recognition = null;
    let listening = false;
    let currentAnswer = "";   // accumulated speech since last question
    let sessionEntries = [];  // {role, text, ts, arousal}

    function nowTime() {
        const d = new Date();
        return d.toTimeString().slice(0, 8);
    }
    function currentArousal() {
        const el = $("deception-gauge-value");
        if (!el) return null;
        const v = parseInt((el.textContent || "0").replace(/\D/g, ""), 10);
        return Number.isFinite(v) ? v : null;
    }
    function renderTranscript() {
        if (!transcriptEl) return;
        if (!sessionEntries.length) {
            transcriptEl.innerHTML = '<div class="transcript-empty">Start a session, ask a question, and the subject\'s spoken answer will appear here.</div>';
            return;
        }
        transcriptEl.innerHTML = sessionEntries.map((e) => {
            const isExaminer = e.role === "examiner";
            return `
            <div class="chakshu-entry ${isExaminer ? "examiner" : "witness"}">
                <span class="chakshu-entry-role">${isExaminer ? "Examiner" : "Witness"}</span>
                <p>${esc(e.text)}</p>
                <span class="chakshu-entry-meta">${esc(e.ts)}${e.arousal != null ? " · arousal " + e.arousal + "%" : ""}</span>
            </div>`;
        }).join("");
    }
    function pushEntry(role, text) {
        const t = (text || "").trim();
        if (!t) return;
        sessionEntries.push({ role, text: t, ts: nowTime(), arousal: role === "witness" ? currentArousal() : null });
        renderTranscript();
    }

    // --- speech recognition setup ------------------------------------
    if (!SpeechRecognition) {
        if (speechStatus) speechStatus.textContent = "Speech-to-text unavailable in this browser — use the typed fallback below (Chrome recommended).";
        if (listeningBtn) listeningBtn.disabled = true;
    } else {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-IN";

        recognition.onresult = (event) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const r = event.results[i];
                if (r.isFinal) currentAnswer += (currentAnswer ? " " : "") + r[0].transcript;
                else interim += r[0].transcript;
            }
            if (interim && speechStatus) speechStatus.textContent = `Listening… “${interim}”`;
        };
        recognition.onerror = (event) => {
            if (speechStatus) speechStatus.textContent = `Speech error: ${event.error} — use the typed fallback.`;
            listening = false;
            if (listeningLabel) listeningLabel.textContent = "Start Listening";
            if (listeningBtn) listeningBtn.classList.remove("active");
        };
        recognition.onend = () => {
            listening = false;
            if (listeningLabel) listeningLabel.textContent = "Start Listening";
            if (listeningBtn) listeningBtn.classList.remove("active");
            // Finalize any captured speech so it is never silently lost.
            if (currentAnswer.trim()) { pushEntry("witness", currentAnswer); currentAnswer = ""; }
            if (speechStatus) speechStatus.textContent = "Listening stopped. Transcript captured so far.";
        };
    }

    function toggleListening() {
        if (!recognition) { alert("Speech-to-text is not supported in this browser."); return; }
        if (!window.webcamStream) {
            alert("Start the camera stream first (Initialize Camera Stream), then begin listening.");
            return;
        }
        if (listening) {
            recognition.stop();
            listening = false;
            if (listeningLabel) listeningLabel.textContent = "Start Listening";
            listeningBtn.classList.remove("active");
            if (currentAnswer.trim()) { pushEntry("witness", currentAnswer); currentAnswer = ""; }
        } else {
            currentAnswer = "";
            try { recognition.start(); } catch (e) { /* already started */ }
            listening = true;
            if (listeningLabel) listeningLabel.textContent = "Stop Listening";
            listeningBtn.classList.add("active");
            if (speechStatus) speechStatus.textContent = "Listening… speak clearly.";
        }
    }
    if (listeningBtn) listeningBtn.addEventListener("click", toggleListening);
    if (listeningBtn) listeningBtn.disabled = false; // enabled; guard happens on click

    // Ask a question: the examiner line goes FIRST so the fact-check engine can
    // attach the question's date context to the witness answer that follows it.
    if (askBtn) askBtn.addEventListener("click", () => {
        const q = questionInput.value.trim();
        if (!q) { questionInput.focus(); return; }
        pushEntry("examiner", q);
        questionInput.value = "";
        if (currentAnswer.trim()) { pushEntry("witness", currentAnswer); currentAnswer = ""; }
    });
    questionInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); askBtn.click(); }
    });

    // Typed fallback for witness statements
    if (typedAddBtn) typedAddBtn.addEventListener("click", () => {
        const t = typedInput.value.trim();
        if (!t) return;
        pushEntry("witness", t);
        typedInput.value = "";
    });
    typedInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); typedAddBtn.click(); }
    });

    // --- save session when the analysis stops --------------------------
    async function saveSession() {
        const caseId = UI.getCurrentCaseId();
        if (!caseId) {
            alert("Select a case first (Cases list or create a new case) so the session can be attached to it.");
            return;
        }
        if (currentAnswer.trim()) { pushEntry("witness", currentAnswer); currentAnswer = ""; }
        if (!sessionEntries.length) {
            alert("No transcript captured for this session.");
            return;
        }
        const summary = UI.getSessionSummary();
        const payload = {
            physio: summary,
            transcript: sessionEntries,
        };
        try {
            const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}/sessions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || "Session save failed");
            }
            runFactCheckBtn.disabled = false;
            if (speechStatus) speechStatus.textContent = "Session saved to case — you can now run the evidence fact-check.";
            fetchRegistry();
        } catch (err) {
            alert("Session save failed: " + err.message);
        }
    }
    UI.onSessionStopped = saveSession;

    // Clear transcript state when the officer resets the session.
    UI.onSessionReset = () => {
        sessionEntries = [];
        currentAnswer = "";
        renderTranscript();
        if (speechStatus) speechStatus.textContent = "Transcript cleared. Start a new session.";
    };

    // =================================================================
    // 4. EVIDENCE FACT-CHECK
    // =================================================================
    function renderFactCheck(report) {
        factCheckPanel.style.display = "block";
        const s = report.summary || {};
        const cred = s.credibility_index;
        const summaryEl = $("factcheck-summary");
        summaryEl.innerHTML = `
            <div class="factcheck-summary-chips">
                <span class="fc-chip fc-contradicted">⚠ Contradicted: <strong>${s.contradicted}</strong></span>
                <span class="fc-chip fc-consistent">✓ Consistent: <strong>${s.consistent}</strong></span>
                <span class="fc-chip fc-unverified">? Unverified: <strong>${s.unverified}</strong></span>
                <span class="fc-chip fc-credibility">Credibility Index: <strong>${cred != null ? cred + "%" : "n/a"}</strong></span>
            </div>
            ${(s.contradicted || 0) > 0
                ? `<p class="factcheck-warning">⚠ Fact-checking indicates <strong>${s.contradicted}</strong> statement(s) are lies / made-up — flagged below in red.</p>`
                : `<p class="factcheck-ok">No contradictions found against the case documents.</p>`}`;

        const verdictsEl = $("factcheck-verdicts");
        if (!(report.verdicts || []).length) {
            verdictsEl.innerHTML = `<div class="transcript-empty">No checkable claims (dates, places, events) were found in the transcript.</div>`;
        } else {
            // Group verdicts by the original statement so one sentence produces
            // one card (with its sub-verdicts listed), not three cards.
            const groups = [];
            for (const v of report.verdicts) {
                const last = groups[groups.length - 1];
                if (last && last.claim === v.claim && last.timestamp === v.timestamp) {
                    last.items.push(v);
                } else {
                    groups.push({ claim: v.claim, timestamp: v.timestamp, items: [v] });
                }
            }
            const worst = (items) => {
                if (items.some((v) => v.verdict === "contradicted")) return "contradicted";
                if (items.some((v) => v.verdict === "consistent")) return "consistent";
                return "unverified";
            };
            verdictsEl.innerHTML = groups.map((g) => {
                const cls = worst(g.items);
                const anyMadeUp = g.items.some((v) => v.made_up);
                const rows = g.items.map((v) => {
                    const ev = v.evidence || {};
                    return `
                    <div class="fc-subrow">
                        <span class="fc-verdict-pill ${v.verdict}">${v.made_up ? "⚠ LIE" : v.verdict.toUpperCase()}</span>
                        <span class="fc-claim-type">${esc(v.claim_type)}${v.negated ? " · negated" : ""}</span>
                        <p class="fc-reason">${esc(v.reason)}</p>
                        ${ev.document ? `<p class="fc-evidence"><strong>Evidence:</strong> ${esc(ev.document)} — “${esc(ev.excerpt)}”</p>` : ""}
                    </div>`;
                }).join("");
                return `
                <div class="fc-verdict ${cls}">
                    <div class="fc-verdict-head">
                        <span class="fc-verdict-pill ${cls}">${anyMadeUp ? "⚠ LIKELY MADE-UP / LIE" : cls.toUpperCase()}</span>
                        <span class="fc-claim-type">${esc(g.timestamp || "")}</span>
                    </div>
                    <p class="fc-claim">“${esc(g.claim)}”</p>
                    ${rows}
                </div>`;
            }).join("");
        }
        if (typeof lucide !== "undefined") lucide.createIcons();
    }

    if (runFactCheckBtn) runFactCheckBtn.addEventListener("click", async () => {
        const caseId = UI.getCurrentCaseId();
        if (!caseId) { alert("Select a case first."); return; }
        runFactCheckBtn.disabled = true;
        runFactCheckBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Fact-checking…';
        if (typeof lucide !== "undefined") lucide.createIcons();
        try {
            const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}/fact-check`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || "Fact-check failed");
            }
            const report = await res.json();
            renderFactCheck(report);
            downloadDossierBtn.style.display = "inline-flex";
            downloadDossierBtn.onclick = () => {
                window.location.href = `/api/cases/${encodeURIComponent(caseId)}/dossier`;
            };
            fetchRegistry();
        } catch (err) {
            alert("Fact-check failed: " + err.message);
        } finally {
            runFactCheckBtn.disabled = false;
            runFactCheckBtn.innerHTML = '<i data-lucide="search-check"></i> Run Fact-Check Against Documents';
            if (typeof lucide !== "undefined") lucide.createIcons();
        }
    });

    // =================================================================
    // INIT
    // =================================================================
    fetchRegistry();
    updateTranscriptCaseBadge();
});
