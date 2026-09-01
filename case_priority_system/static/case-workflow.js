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
                `<div class="loader" style="color:#B3402E">Cases unavailable — start the backend.</div>`;
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

        // Head click → expand + open the case workspace + populate Analysis tab
        registryList.querySelectorAll(".registry-case-head").forEach((head) => {
            head.addEventListener("click", async (e) => {
                const card = head.closest(".registry-case");
                const caseId = card.getAttribute("data-case-id");
                expandedCaseId = expandedCaseId === caseId ? null : caseId;
                UI.setCurrentCaseId(caseId);
                renderRegistry();
                updateTranscriptCaseBadge();
                // Open the case site for this case.
                await openCaseWorkspace(caseId);
                // Auto-populate the Analysis tab: find the first analyzed
                // document in this case's Excel rows and feed it to selectCase.
                try {
                    const caseRes = await fetch(`/api/cases/${encodeURIComponent(caseId)}`);
                    if (caseRes.ok) {
                        const caseData = await caseRes.json();
                        const docs = caseData.documents || [];
                        for (const d of docs) {
                            const row = UI.getCasesData().find((r) => r.Case_File === d.filename);
                            if (row) {
                                UI.selectCaseFn(row);
                                break;
                            }
                        }
                    }
                } catch (_) { /* non-fatal */ }
                const caseTabBtn = document.querySelector(".tab-btn[data-tab='case-tab']");
                if (caseTabBtn) caseTabBtn.click();
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
                    alert("This document has not been analysed yet — open the case and run “Analyze All Documents” from the Case tab.");
                }
                // Keep the Case workspace + Chakshu badge on the same case.
                const docCaseId = li.getAttribute("data-case");
                if (docCaseId) openCaseWorkspace(docCaseId);
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
    // 2. CREATE NEW CASE (single step: name OR FIR OR auto-assigned ID)
    //    + CASE WORKSPACE (open the case, upload evidence any time)
    // =================================================================
    const modal = $("case-wizard-modal");
    const createBtn = $("create-case-btn");
    let currentWorkspaceCaseId = null;

    function openWizard() {
        $("wizard-title").value = "";
        $("wizard-fir-input").value = "";
        modal.style.display = "flex";
        setTimeout(() => $("wizard-title").focus(), 60);
    }
    function closeWizard() { modal.style.display = "none"; }

    if (createBtn) createBtn.addEventListener("click", openWizard);
    const wsNewCaseBtn = $("workspace-new-case-btn");
    if (wsNewCaseBtn) wsNewCaseBtn.addEventListener("click", openWizard);
    $("wizard-close-btn").addEventListener("click", closeWizard);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeWizard(); });
    $("wizard-title").addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); $("wizard-create-btn").click(); }
    });

    // Create the case, then open its workspace immediately.
    $("wizard-create-btn").addEventListener("click", async () => {
        const btn = $("wizard-create-btn");
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Creating…';
        if (typeof lucide !== "undefined") lucide.createIcons();
        try {
            const title = $("wizard-title").value.trim();
            const firInput = $("wizard-fir-input");
            const firFile = firInput.files && firInput.files[0];

            const fd = new FormData();
            if (title) fd.append("case_title", title);
            if (firFile) fd.append("fir_file", firFile);

            const res = await fetch("/api/cases", { method: "POST", body: fd });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || "Case creation failed");
            }
            const caseData = await res.json();

            closeWizard();
            // Open the case site: switch to the Case tab and render it.
            const caseTabBtn = document.querySelector(".tab-btn[data-tab='case-tab']");
            if (caseTabBtn) caseTabBtn.click();
            await openCaseWorkspace(caseData.case_id);
            // Refresh the sidebar registry + Excel-backed list.
            try { await UI.refreshCases(); } catch (e) { /* non-fatal */ }
            fetchRegistry();
            // Auto-populate the Analysis tab if a FIR was analysed during creation.
            try {
                const cr = await fetch(`/api/cases/${encodeURIComponent(caseData.case_id)}`);
                if (cr.ok) {
                    const cd = await cr.json();
                    for (const d of (cd.documents || [])) {
                        const row = UI.getCasesData().find((r) => r.Case_File === d.filename);
                        if (row) { UI.selectCaseFn(row); break; }
                    }
                }
            } catch (_) { /* non-fatal */ }
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="folder-plus"></i> Create &amp; Open Case';
            if (typeof lucide !== "undefined") lucide.createIcons();
        }
    });

    // ---- Case workspace ---------------------------------------------

    async function fetchCaseDetail(caseId) {
        const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}`);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || "Failed to load case");
        }
        return res.json();
    }

    async function openCaseWorkspace(caseId) {
        currentWorkspaceCaseId = caseId;
        UI.setCurrentCaseId(caseId);
        updateTranscriptCaseBadge();
        $("case-workspace-empty").style.display = "none";
        $("case-workspace").style.display = "block";
        try {
            const c = await fetchCaseDetail(caseId);
            // Stale-response guard: ignore a slower fetch for a case the
            // officer has already navigated away from.
            if (currentWorkspaceCaseId !== caseId) return;
            renderCaseWorkspace(c);
        } catch (err) {
            if (currentWorkspaceCaseId !== caseId) return;
            const docListEl = $("workspace-doc-list");
            if (docListEl) {
                docListEl.innerHTML = `<div class="loader" style="color:#B3402E">${esc(err.message)}</div>`;
            }
        }
    }

    function renderCaseWorkspace(c) {
        $("workspace-title").textContent = c.title || c.case_id;
        $("workspace-case-id").textContent = c.case_id;
        $("workspace-source").textContent = c.source === "FIR_UPLOADED" ? "FIR attached" : "Auto-created";
        const prioEl = $("workspace-priority-badge");
        const prio = c.aggregate_priority;
        prioEl.className = `priority-pill ${prioClass(prio)}`;
        prioEl.textContent = prio ? `${prio} Priority` : "Not Analysed";
        const docs = c.documents || [];
        $("workspace-rationale").textContent = c.aggregate_rationale || (docs.length
            ? "Documents uploaded — run “Analyze All Documents” to compute the case priority."
            : "No documents yet — upload evidence to get a priority assessment.");
        $("workspace-doc-count").textContent = `${docs.length} doc${docs.length === 1 ? "" : "s"}`;
        const docListEl = $("workspace-doc-list");
        if (!docs.length) {
            docListEl.innerHTML = `<div class="transcript-empty">No documents yet — use the Upload Evidence panel.</div>`;
        } else {
            docListEl.innerHTML = docs.map((d) => `
                <div class="ws-doc-item ${d.priority ? "" : "pending"}" data-doc-id="${esc(d.doc_id)}">
                    <div class="ws-doc-main">
                        <i data-lucide="file-text"></i>
                        <div class="ws-doc-info">
                            <strong>${esc(d.filename)}</strong>
                            <span class="ws-doc-meta">${esc(d.doc_type)} · ${esc((d.uploaded_at || "").replace("T", " ").slice(0, 16))}</span>
                        </div>
                    </div>
                    <div class="ws-doc-side">
                        ${d.priority ? prioBadge(d.priority) : `<span class="ws-doc-pending">Analysis pending</span>`}
                        <a class="ws-doc-download" href="/api/cases/${encodeURIComponent(c.case_id)}/documents/${encodeURIComponent(d.doc_id)}/download" title="Download ${esc(d.filename)}" download><i data-lucide="download"></i></a>
                        <button class="ws-doc-delete" data-doc-id="${esc(d.doc_id)}" data-filename="${esc(d.filename)}" title="Delete ${esc(d.filename)}"><i data-lucide="trash-2"></i></button>
                    </div>
                </div>`).join("");
        // Attach delete handlers.
        docListEl.querySelectorAll(".ws-doc-delete").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const did = btn.getAttribute("data-doc-id");
                const fname = btn.getAttribute("data-filename");
                if (!confirm(`Remove "${fname}" from this case? The case priority will be recalculated.`)) return;
                btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i>';
                if (typeof lucide !== "undefined") lucide.createIcons();
                try {
                    const res = await fetch(`/api/cases/${encodeURIComponent(c.case_id)}/documents/${encodeURIComponent(did)}`, { method: "DELETE" });
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.detail || "Delete failed");
                    }
                    // Refresh workspace to show updated doc list + recalculated priority.
                    await openCaseWorkspace(c.case_id);
                    fetchRegistry();
                } catch (err) {
                    alert("Failed to delete document: " + err.message);
                    btn.disabled = false;
                    btn.innerHTML = '<i data-lucide="trash-2"></i>';
                    if (typeof lucide !== "undefined") lucide.createIcons();
                }
            });
        });
        }
        if (typeof lucide !== "undefined") lucide.createIcons();
    }

    // ---- Evidence upload (from inside the case workspace) -----------
    const wsDrop = $("workspace-doc-drop");
    const wsInput = $("workspace-doc-input");
    let wsPending = [];

    wsDrop.addEventListener("click", () => wsInput.click());
    ["dragenter", "dragover"].forEach((evt) => wsDrop.addEventListener(evt, (e) => {
        e.preventDefault();
        wsDrop.classList.add("drag-over");
    }));
    ["dragleave", "drop"].forEach((evt) => wsDrop.addEventListener(evt, (e) => {
        e.preventDefault();
        wsDrop.classList.remove("drag-over");
    }));
    wsDrop.addEventListener("drop", (e) => {
        Array.from((e.dataTransfer && e.dataTransfer.files) || []).forEach(addWsFile);
    });
    wsInput.addEventListener("change", () => {
        Array.from(wsInput.files || []).forEach(addWsFile);
        wsInput.value = "";
    });

    function addWsFile(file) {
        const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
        const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        if (!allowedExts.includes(fileExt)) {
            alert(`Only PDF and image files are supported (${file.name}).\n\nImages will be OCR-processed to extract text.`);
            return;
        }
        wsPending.push({ file, type: $("workspace-doc-type").value });
        renderWsPending();
    }

    function renderWsPending() {
        const list = $("workspace-pending-list");
        const uploadBtn = $("workspace-upload-btn");
        list.innerHTML = wsPending.map((pd, i) => `
            <li class="wizard-doc-item">
                <i data-lucide="file-text"></i>
                <span class="wizard-doc-name">${esc(pd.file.name)}</span>
                <select class="wizard-doc-type" data-i="${i}">
                    ${DOC_TYPES.map((t) => `<option value="${t}" ${t === pd.type ? "selected" : ""}>${t}</option>`).join("")}
                </select>
                <button class="wizard-doc-remove" data-i="${i}" aria-label="Remove"><i data-lucide="x"></i></button>
            </li>`).join("");
        list.querySelectorAll(".wizard-doc-type").forEach((sel) =>
            sel.addEventListener("change", () => { wsPending[Number(sel.getAttribute("data-i"))].type = sel.value; }));
        list.querySelectorAll(".wizard-doc-remove").forEach((b) =>
            b.addEventListener("click", () => { wsPending.splice(Number(b.getAttribute("data-i")), 1); renderWsPending(); }));
        uploadBtn.disabled = wsPending.length === 0;
        if (typeof lucide !== "undefined") lucide.createIcons();
    }

    $("workspace-upload-btn").addEventListener("click", async () => {
        if (!currentWorkspaceCaseId) { alert("Open a case first."); return; }
        const btn = $("workspace-upload-btn");
        btn.disabled = true;
        const status = $("workspace-upload-status");
        try {
            for (const pd of wsPending) {
                status.innerHTML = `<div class="loader">Uploading ${esc(pd.file.name)}…</div>`;
                const fd = new FormData();
                fd.append("file", pd.file);
                fd.append("doc_type", pd.type);
                const res = await fetch(`/api/cases/${encodeURIComponent(currentWorkspaceCaseId)}/documents`, {
                    method: "POST", body: fd,
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.detail || `Upload of ${pd.file.name} failed`);
                }
            }
            wsPending = [];
            renderWsPending();
            status.innerHTML = "";
            // Refresh the workspace + registry so the new evidence shows up.
            await openCaseWorkspace(currentWorkspaceCaseId);
            fetchRegistry();
        } catch (err) {
            status.innerHTML = `<div class="loader" style="color:#B3402E">${esc(err.message)}</div>`;
        } finally {
            // Re-enable only when files are still queued (empty batch = done).
            btn.disabled = wsPending.length > 0;
            btn.innerHTML = '<i data-lucide="upload"></i> Upload Evidence';
            if (typeof lucide !== "undefined") lucide.createIcons();
        }
    });

    // Analyze every document of the open case, then refresh the workspace.
    $("workspace-analyze-btn").addEventListener("click", async () => {
        if (!currentWorkspaceCaseId) { alert("Open a case first."); return; }
        const btn = $("workspace-analyze-btn");
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Analyzing…';
        if (typeof lucide !== "undefined") lucide.createIcons();
        try {
            const res = await fetch(`/api/cases/${encodeURIComponent(currentWorkspaceCaseId)}/analyze`, { method: "POST" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || "Analysis failed");
            }
            const data = await res.json();
            await openCaseWorkspace(currentWorkspaceCaseId);
            fetchRegistry();
            // Show per-document analysis errors (e.g. unreadable images).
            if (data.analysis_errors && data.analysis_errors.length) {
                const msg = data.analysis_errors.join("\n");
                alert("Some documents could not be analyzed:\n\n" + msg);
            }
        } catch (err) {
            alert("Analysis failed: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="sparkles"></i> Analyze All Documents';
            if (typeof lucide !== "undefined") lucide.createIcons();
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
    // 5. GPU STATUS BADGE (header)
    // =================================================================
    async function loadGpuBadge() {
        const badge = $("gpu-badge");
        const textEl = $("gpu-badge-text");
        if (!badge || !textEl) return;
        try {
            const res = await fetch("/api/gpu-status");
            if (!res.ok) throw new Error("status fetch failed");
            const st = await res.json();
            if (!st.gpu) { badge.hidden = true; return; }
            const gpuShort = String(st.gpu)
                .replace(/^NVIDIA GeForce /, "")
                .replace(/^NVIDIA /, "");
            textEl.textContent = `${gpuShort} · ${st.model || "LLM"} · `
                + (st.llm_mode === "enabled" ? "GPU inference" : "rule-based");
            badge.classList.toggle("gpu-on", st.llm_mode === "enabled");
            badge.hidden = false;
        } catch (e) {
            badge.hidden = true;
        }
    }

    // =================================================================
    // INIT
    // =================================================================
    fetchRegistry();
    updateTranscriptCaseBadge();
    loadGpuBadge();
});
