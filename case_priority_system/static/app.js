// Anavaya Dashboard UI Logic
document.addEventListener("DOMContentLoaded", () => {
    let casesData = [];
    let globalTreeData = null;
    let selectedCase = null;
    let d3Zoom = null;
    let svgContainer = null;
    let activePathNodes = [];
    let courtroomsLoaded = false;

    // Bridge so the separately-loaded case-workflow module (wizard, Chakshu
    // transcript + fact-check) can interact with the dashboard state without
    // being inside this closure.
    let currentCaseId = null;
    window.AnavayaUI = {
        getSelectedCase: () => selectedCase,
        getCasesData: () => casesData,
        setCurrentCaseId: (id) => { currentCaseId = id || null; },
        getCurrentCaseId: () => currentCaseId,
        refreshCases: () => fetchCases(),
        refreshStats: () => { updateStats(casesData); populateFilters(casesData); renderCasesList(casesData); },
        selectCaseFn: (c) => selectCase(c),
        escHtml: escHtml,
        onSessionStopped: null,
        onSessionReset: null,
        getSessionSummary: () => {
            const scores = (sessionStats && sessionStats.scores) || [];
            const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
            let verdict = "Truthful (Stable)";
            if (score >= 60) verdict = "Deceptive Patterns Detected";
            else if (score >= 30) verdict = "Elevated Stress / Suspicious";
            return {
                score,
                verdict,
                blinks: (sessionStats && sessionStats.blinks) || 0,
                gazeAvoidance: (sessionStats && sessionStats.gazeAvoidance) || 0,
                twitches: (sessionStats && sessionStats.twitches) || 0,
                duration: (sessionStats && sessionStats.duration) || 0,
            };
        },
    };

    // Elements
    const casesListContainer = document.getElementById("cases-list-container");
    const searchInput = document.getElementById("search-input");
    const filterPriority = document.getElementById("filter-priority");
    const filterCategory = document.getElementById("filter-category");

    const noCaseSelectedEl = document.getElementById("no-case-selected");
    const caseDetailsContentEl = document.getElementById("case-details-content");

    // Stats elements
    const statTotalVal = document.getElementById("stat-total-val");
    const statHighVal = document.getElementById("stat-high-val");
    const statMediumVal = document.getElementById("stat-medium-val");
    const statLowVal = document.getElementById("stat-low-val");

    // Tabs logic
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    function activateTab(btn) {
        tabButtons.forEach(b => {
            b.classList.remove("active");
            b.setAttribute("aria-selected", "false");
        });
        tabContents.forEach(c => c.classList.remove("active"));

        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        const tabId = btn.getAttribute("data-tab");
        document.getElementById(tabId).classList.add("active");

            if (tabId === "tree-tab") {
                // Fetch the tree lazily on first activation, then draw it
                if (globalTreeData) {
                    drawDecisionTree(globalTreeData);
                } else {
                    fetchTree()
                        .then(() => { if (globalTreeData) drawDecisionTree(globalTreeData); })
                        .catch(() => {});
                }
            }

            // Lazy-load courtroom sessions when the Courtroom tab is activated
            if (tabId === "courtroom-tab" && typeof fetchCourtrooms === "function" && !courtroomsLoaded) {
                fetchCourtrooms();
            }

            // Clean up webcam stream if switching away from Lie Detector
            if (tabId !== "lie-detector-tab" && typeof webcamStream !== 'undefined' && webcamStream) {
                try {
                    webcamStream.getTracks().forEach(track => track.stop());
                    webcamStream = null;
                    if (typeof activeCamera !== 'undefined' && activeCamera) {
                        activeCamera.stop();
                        activeCamera = null;
                    }
                    document.getElementById("camera-placeholder").style.display = "flex";
                    document.getElementById("webcam-feed").style.display = "none";
                    document.getElementById("start-camera-btn").disabled = false;
                    document.getElementById("start-camera-btn").textContent = "Initialize Camera Stream";
                    isAnalyzing = false;
                    document.getElementById("stop-analysis-btn").disabled = true;
                    document.getElementById("start-analysis-btn").disabled = true;
                    document.getElementById("reset-analysis-btn").disabled = true;
                } catch(e) {
                    console.error("Webcam release error:", e);
                }
            }
    }

    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => activateTab(btn));
        // Tablist arrow-key navigation (roving tabindex)
        btn.addEventListener("keydown", (e) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
            e.preventDefault();
            const idx = Array.from(tabButtons).indexOf(btn);
            let next = idx;
            if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % tabButtons.length;
            else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + tabButtons.length) % tabButtons.length;
            else if (e.key === "Home") next = 0;
            else if (e.key === "End") next = tabButtons.length - 1;
            activateTab(tabButtons[next]);
            tabButtons[next].focus();
        });
    });

    // Tolerant parser for backend Python-style list-of-dict reprs, e.g.
    //   "[{'article': 'Article 21', 'title': 'Right to Life', 'primary': True}, ...]"
    function parseListRepr(str) {
        if (!str || typeof str !== "string" || !str.trim().startsWith("[")) return [];
        const results = [];
        const dictRe = /\{[^{}]*\}/g;
        // Values may be single-quoted ('x'), double-quoted ("x") — Python's
        // repr switches to double quotes when a string contains an apostrophe.
        const fieldRe = /'([^']+)'\s*:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|True|False|\d+)/g;
        let m;
        while ((m = dictRe.exec(str)) !== null) {
            const obj = {};
            const fr = new RegExp(fieldRe.source, "g");
            let f;
            while ((f = fr.exec(m[0])) !== null) {
                const key = f[1];
                const val = f[2];
                if (val === "True" || val === "False") obj[key] = val === "True";
                else if (/^\d+$/.test(val)) obj[key] = parseInt(val, 10);
                else if (val.startsWith('"')) obj[key] = val.slice(1, -1).replace(/\\"/g, '"');
                else obj[key] = val.slice(1, -1).replace(/\\'/g, "'");
            }
            if (Object.keys(obj).length) results.push(obj);
        }
        return results;
    }

    // Escape user-derived strings before injecting into innerHTML (XSS guard)
    function escHtml(str) {
        return String(str == null ? "" : str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // Fetch and Initialize App Data
    async function init() {
        try {
            // The decision tree is fetched lazily on the first Tree-tab
            // activation (see tab handler), so the initial page load only
            // waits on /api/cases.
            await fetchCases();
        } catch (err) {
            console.error("Initialization error:", err);
        } finally {
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            // Hide global page preloader
            const preloader = document.getElementById("global-preloader");
            if (preloader) {
                preloader.style.opacity = "0";
                preloader.style.visibility = "hidden";
                setTimeout(() => {
                    preloader.remove();
                }, 500);
            }
        }
    }

    async function fetchCases() {
        try {
            const res = await fetch("/api/cases");
            if (!res.ok) throw new Error("Failed to load cases");
            casesData = await res.json();
            
            updateStats(casesData);
            populateFilters(casesData);
            renderCasesList(casesData);
        } catch (err) {
            casesListContainer.innerHTML = `<div class="loader" style="color: #B3402E">Error loading cases. Make sure the backend is running.</div>`;
            throw err;
        }
    }

    // Download the generated PDF report for the selected case
    const downloadReportBtn = document.getElementById("download-report-btn");
    if (downloadReportBtn) {
        downloadReportBtn.addEventListener("click", (e) => {
            if (!selectedCase) {
                e.preventDefault();
                return;
            }
            // Allow the browser to download; href is set on selection.
            window.setTimeout(() => lucide.createIcons(), 0);
        });
    }

    async function fetchTree() {
        try {
            const res = await fetch("/api/tree");
            if (!res.ok) throw new Error("Failed to load decision tree");
            globalTreeData = await res.json();
            document.getElementById("tree-loading").style.display = "none";
        } catch (err) {
            document.getElementById("tree-loading").innerHTML = `<span style="color: #B3402E">Failed to load global decision tree structure.</span>`;
            throw err;
        }
    }

    // Stats calculations — counts, donut, category bars
    const donutTotalVal = document.getElementById("donut-total-val");
    const arcHigh = document.getElementById("arc-high");
    const arcMedium = document.getElementById("arc-medium");
    const arcLow = document.getElementById("arc-low");
    const categoryBarsEl = document.getElementById("category-bars");

    function updateStats(cases) {
        const total = cases.length;
        const high = cases.filter(c => c.Predicted_Priority === "High").length;
        const medium = cases.filter(c => c.Predicted_Priority === "Medium").length;
        const low = cases.filter(c => c.Predicted_Priority === "Low").length;

        statTotalVal.textContent = total;
        if (donutTotalVal) donutTotalVal.textContent = total;
        statHighVal.textContent = high;
        statMediumVal.textContent = medium;
        statLowVal.textContent = low;

        renderDonut(high, medium, low, total);
        renderCategoryBars(cases);
    }

    function renderDonut(high, medium, low, total) {
        const arcs = [arcHigh, arcMedium, arcLow];
        if (!arcs[0] || total === 0) return;
        const C = 2 * Math.PI * 50;
        const counts = [high, medium, low];
        let offset = 0;
        counts.forEach((n, i) => {
            const frac = total > 0 ? n / total : 0;
            arcs[i].style.strokeDasharray = `${frac * C} ${C}`;
            arcs[i].style.strokeDashoffset = `${-offset * C}`;
            // Round caps render dots on zero-length segments; use butt caps there.
            arcs[i].style.strokeLinecap = frac === 0 ? "butt" : "round";
            offset += frac;
        });
    }

    function renderCategoryBars(cases) {
        if (!categoryBarsEl) return;
        const counts = {};
        cases.forEach(c => {
            const cat = c.Category || "General Civil";
            counts[cat] = (counts[cat] || 0) + 1;
        });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
        if (sorted.length === 0) {
            categoryBarsEl.innerHTML = `<div class="loader">No cases yet.</div>`;
            return;
        }
        const max = sorted[0][1];
        categoryBarsEl.innerHTML = sorted.map(([cat, n]) => `
            <div class="cat-bar-row" title="${escHtml(cat)}">
                <span class="cat-bar-name">${escHtml(cat)}</span>
                <div class="cat-bar-track"><div class="cat-bar-fill" data-w="${Math.max(4, Math.round((n / max) * 100))}" style="width:0%"></div></div>
                <span class="cat-bar-count">${n}</span>
            </div>
        `).join("");
        // Animate bar widths after paint
        requestAnimationFrame(() => {
            categoryBarsEl.querySelectorAll(".cat-bar-fill").forEach(f => {
                f.style.width = f.getAttribute("data-w") + "%";
            });
        });
    }

    // Dropdown filters population
    function populateFilters(cases) {
        const categories = [...new Set(cases.map(c => c.Category).filter(Boolean))];
        filterCategory.innerHTML = `<option value="all">All Categories</option>`;
        categories.forEach(cat => {
            const opt = document.createElement("option");
            opt.value = cat;
            opt.textContent = cat;
            filterCategory.appendChild(opt);
        });
    }

    // Render Cases Sidebar
    function renderCasesList(cases) {
        const query = searchInput.value.toLowerCase().trim();
        const priorityVal = filterPriority.value;
        const categoryVal = filterCategory.value;

        const filtered = cases.filter(c => {
            const matchesQuery = 
                (c.Case_File && c.Case_File.toLowerCase().includes(query)) ||
                (c.Main_Parties && c.Main_Parties.toLowerCase().includes(query)) ||
                (c.Plain_Language_Summary && c.Plain_Language_Summary.toLowerCase().includes(query));

            const matchesPriority = priorityVal === "all" || c.Predicted_Priority === priorityVal;
            const matchesCategory = categoryVal === "all" || c.Category === categoryVal;

            return matchesQuery && matchesPriority && matchesCategory;
        });

        casesListContainer.innerHTML = "";
        if (filtered.length === 0) {
            casesListContainer.innerHTML = `<div class="empty-cases">
                <i data-lucide="scale" style="width:28px;height:28px;color:#C9A24B;"></i>
                <p>No cases yet. Upload a case PDF above to get an instant priority and report.</p>
            </div>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        filtered.forEach(c => {
            const cleanTitle = (c.Case_File || "").replace(/_/g, " ").replace(/\.[Pp][Dd][Ff]$/, "");
            const item = document.createElement("div");
            item.className = `case-item ${selectedCase && selectedCase.Case_File === c.Case_File ? "active" : ""}`;
            item.setAttribute("data-case-file", c.Case_File || "");
            item.setAttribute("tabindex", "0");
            item.setAttribute("role", "button");
            item.setAttribute("aria-label", `Select case ${cleanTitle}`);
            item.innerHTML = `
                <div class="case-item-title">${escHtml(cleanTitle) || "Unknown Case"}</div>
                <div class="case-item-desc">${escHtml(c.Main_Parties) || "Unknown Parties"}</div>
                <div class="case-item-details-expanded">
                    <div class="case-item-meta">
                        <span class="badge-priority ${String(c.Predicted_Priority || "medium").toLowerCase()}">${escHtml(c.Predicted_Priority)}</span>
                        <span class="case-item-category">${escHtml(c.Category) || "General Civil"}</span>
                    </div>
                </div>
            `;
            item.addEventListener("click", () => { selectCase(c); closeSidebar(); });
            item.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectCase(c);
                    closeSidebar();
                }
            });
            casesListContainer.appendChild(item);
        });
    }

    // Search and Filter Listeners (debounced search)
    let searchDebounceTimer = null;
    searchInput.addEventListener("input", () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => renderCasesList(casesData), 150);
    });
    filterPriority.addEventListener("change", () => renderCasesList(casesData));
    filterCategory.addEventListener("change", () => renderCasesList(casesData));

    // Ctrl/Cmd+K focuses search
    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
        }
    });

    // Triage legend → click to filter the case list by priority
    document.querySelectorAll(".triage-legend-item").forEach(btn => {
        btn.addEventListener("click", () => {
            const p = btn.getAttribute("data-priority");
            filterPriority.value = (filterPriority.value === p) ? "all" : p;
            renderCasesList(casesData);
        });
    });

    // Arrow-key navigation through the case list
    casesListContainer.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        e.preventDefault();
        const items = [...casesListContainer.querySelectorAll(".case-item")];
        if (items.length === 0) return;
        const idx = items.indexOf(document.activeElement);
        const next = e.key === "ArrowDown" ? Math.min(idx + 1, items.length - 1) : Math.max(idx - 1, 0);
        if (idx === -1) items[0].focus();
        else if (items[next]) items[next].focus();
    });

    // Mobile sidebar drawer
    const sidebarEl = document.getElementById("cases-sidebar");
    const sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");
    const sidebarCloseBtn = document.getElementById("sidebar-close-btn");
    const sidebarBackdrop = document.getElementById("sidebar-backdrop");

    function openSidebar() {
        if (sidebarEl) sidebarEl.classList.add("open");
        if (sidebarBackdrop) sidebarBackdrop.classList.add("show");
    }
    function closeSidebar() {
        if (sidebarEl) sidebarEl.classList.remove("open");
        if (sidebarBackdrop) sidebarBackdrop.classList.remove("show");
    }
    if (sidebarToggleBtn) sidebarToggleBtn.addEventListener("click", openSidebar);
    if (sidebarCloseBtn) sidebarCloseBtn.addEventListener("click", closeSidebar);
    if (sidebarBackdrop) sidebarBackdrop.addEventListener("click", closeSidebar);

    // Drag & drop upload
    const uploadZone = document.getElementById("upload-zone");
    if (uploadZone) {
        ["dragenter", "dragover"].forEach(evt => uploadZone.addEventListener(evt, (e) => {
            e.preventDefault();
            uploadZone.classList.add("drag-over");
        }));
        ["dragleave", "drop"].forEach(evt => uploadZone.addEventListener(evt, (e) => {
            e.preventDefault();
            uploadZone.classList.remove("drag-over");
        }));
        uploadZone.addEventListener("drop", (e) => {
            const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (file && fileInput) {
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInput.files = dt.files;
                fileInput.dispatchEvent(new Event("change"));
            }
        });
    }

    // Collapsible analysis sections
    document.querySelectorAll(".collapsible-toggle").forEach(btn => {
        btn.addEventListener("click", () => {
            const section = btn.closest(".collapsible");
            const isOpen = section.classList.toggle("open");
            btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
        });
    });

    // File upload handler
    const fileInput = document.getElementById("pdf-file-input");
    const loadingOverlay = document.getElementById("upload-loading-overlay");

    fileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith(".pdf")) {
            alert("Please upload a PDF file only.");
            fileInput.value = "";
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        // Show premium loading overlay
        loadingOverlay.style.display = "flex";

        try {
            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Upload and analysis failed");
            }

            const newCase = await response.json();
            
            // Append or update in local memory
            const existingIdx = casesData.findIndex(c => c.Case_File === newCase.Case_File);
            if (existingIdx > -1) {
                casesData[existingIdx] = newCase;
            } else {
                casesData.push(newCase);
            }

            // Update filters dropdown, totals, and list
            updateStats(casesData);
            populateFilters(casesData);
            renderCasesList(casesData);
            
            // Automatically select and display the newly analyzed case
            await selectCase(newCase);
            
            // Switch to the first tab (details) to view the analysis results immediately
            const firstTabBtn = document.querySelector(".tab-btn[data-tab='details-tab']");
            if (firstTabBtn) {
                firstTabBtn.click();
            }

        } catch (err) {
            console.error("Analysis failed:", err);
            alert(`Error: ${err.message}`);
        } finally {
            loadingOverlay.style.display = "none";
            fileInput.value = ""; // clear input
        }
    });

    // Case Selection
    async function selectCase(c) {
        const detailsTabBtn = document.querySelector('.tab-btn[data-tab="details-tab"]');
        if (detailsTabBtn && !detailsTabBtn.classList.contains('active')) {
            activateTab(detailsTabBtn);
        }
        selectedCase = c;
        // The Excel row now carries Case_ID for documents belonging to a case
        // registry entity — used by the Chakshu transcript + fact-check.
        if (c && c.Case_ID) {
            window.AnavayaUI.setCurrentCaseId(c.Case_ID);
        }
        
        // Highlight active sidebar item
        document.querySelectorAll(".case-item").forEach(item => {
            if (item.getAttribute("data-case-file") === c.Case_File) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });

        // Hide empty state and show details
        noCaseSelectedEl.style.display = "none";
        caseDetailsContentEl.style.display = "flex";

        // Set Details Values
        document.getElementById("case-title-name").textContent = (c.Case_File || "").replace(/_/g, " ").replace(/\.[Pp][Dd][Ff]$/, "");
        document.getElementById("case-parties").innerHTML = `<strong>Parties:</strong> ${escHtml(c.Main_Parties) || "Unknown"}`;
        document.getElementById("case-summary").textContent = c.Plain_Language_Summary || "Summary unavailable.";
        
        // Enable PDF report download link
        const reportBtn = document.getElementById("download-report-btn");
        if (reportBtn) {
            const encoded = encodeURIComponent(c.Case_File);
            reportBtn.href = `/api/cases/${encoded}/report.pdf`;
            reportBtn.style.display = "inline-flex";
        }
        
        // Enhanced Constitutional Analysis
        // 1. Constitutional Rights Engaged
        const rightsContainer = document.getElementById("case-constitutional-rights");
        if (c.Constitutional_Rights_Engaged && Array.isArray(c.Constitutional_Rights_Engaged) && c.Constitutional_Rights_Engaged.length > 0) {
            let rightsHtml = '<div class="rights-cards">';
            c.Constitutional_Rights_Engaged.forEach(right => {
                const primaryClass = right.primary ? 'primary' : 'secondary';
                const tagText = right.primary ? 'PRIMARY' : 'SECONDARY';
                rightsHtml += `
                    <div class="rights-card ${primaryClass}">
                        <div class="rights-article-tag">${tagText}</div>
                        <strong class="rights-article">${escHtml(right.article)}</strong>
                        <span class="rights-title">${escHtml(right.title)}</span>
                    </div>
                `;
            });
            rightsHtml += '</div>';
            rightsContainer.innerHTML = rightsHtml;
        } else if (typeof c.Constitutional_Rights_Engaged === 'string' && c.Constitutional_Rights_Engaged) {
            // Handle legacy string format (may embed a Python list-of-dict repr)
            const parsedRights = parseListRepr(c.Constitutional_Rights_Engaged);
            if (parsedRights.length) {
                let rightsHtml = '<div class="rights-cards">';
                parsedRights.forEach(right => {
                    const primaryClass = right.primary ? 'primary' : 'secondary';
                    const tagText = right.primary ? 'PRIMARY' : 'SECONDARY';
                    rightsHtml += `
                        <div class="rights-card ${primaryClass}">
                            <div class="rights-article-tag">${tagText}</div>
                            <strong class="rights-article">${escHtml(right.article)}</strong>
                            <span class="rights-title">${escHtml(right.title)}</span>
                        </div>
                    `;
                });
                rightsHtml += '</div>';
                rightsContainer.innerHTML = rightsHtml;
            } else {
                rightsContainer.innerHTML = `<p class="rights-text">${escHtml(c.Constitutional_Rights_Engaged)}</p>`;
            }
        } else {
            rightsContainer.innerHTML = `<p class="rights-text">Article 14 — Equality Before Law (General application). Specific constitutional rights analysis not available for this case.</p>`;
        }

        // 2. State Duty Analysis
        const stateDutyEl = document.getElementById("case-state-duty");
        if (c.State_Duty_Analysis) {
            stateDutyEl.innerHTML = formatConstitutionalText(c.State_Duty_Analysis);
        } else {
            stateDutyEl.innerHTML = '<p>The State has a general duty under Article 14 to ensure equality before law and under Article 21 to protect life and personal liberty. Specific duty analysis not available for this case.</p>';
        }

        // 3. Rights Balancing Analysis
        const balancingEl = document.getElementById("case-balancing");
        if (c.Rights_Balancing_Analysis) {
            balancingEl.innerHTML = formatConstitutionalText(c.Rights_Balancing_Analysis);
        } else {
            balancingEl.innerHTML = '<p>Balancing analysis not available for this case.</p>';
        }

        // 4. Applicable Doctrines
        const doctrinesContainer = document.getElementById("case-doctrines");
        if (c.Applicable_Doctrines && Array.isArray(c.Applicable_Doctrines) && c.Applicable_Doctrines.length > 0) {
            let doctrinesHtml = '<div class="doctrines-grid">';
            c.Applicable_Doctrines.forEach(doc => {
                doctrinesHtml += `
                    <div class="doctrine-card">
                        <strong class="doctrine-name">${escHtml(doc.name)}</strong>
                        <p class="doctrine-desc">${escHtml(doc.description)}</p>
                        <p class="doctrine-app"><strong>Application:</strong> ${escHtml(doc.application)}</p>
                    </div>
                `;
            });
            doctrinesHtml += '</div>';
            doctrinesContainer.innerHTML = doctrinesHtml;
        } else if (typeof c.Applicable_Doctrines === 'string' && c.Applicable_Doctrines) {
            const parsedDoctrines = parseListRepr(c.Applicable_Doctrines);
            if (parsedDoctrines.length) {
                let doctrinesHtml = '<div class="doctrines-grid">';
                parsedDoctrines.forEach(doc => {
                    doctrinesHtml += `
                        <div class="doctrine-card">
                            <strong class="doctrine-name">${escHtml(doc.name)}</strong>
                            <p class="doctrine-desc">${escHtml(doc.description)}</p>
                            <p class="doctrine-app"><strong>Application:</strong> ${escHtml(doc.application)}</p>
                        </div>
                    `;
                });
                doctrinesHtml += '</div>';
                doctrinesContainer.innerHTML = doctrinesHtml;
            } else {
                doctrinesContainer.innerHTML = `<p class="doctrines-text">${escHtml(c.Applicable_Doctrines)}</p>`;
            }
        } else {
            doctrinesContainer.innerHTML = '<p class="doctrines-text">General principles of constitutional interpretation apply. Specific doctrines not identified for this case.</p>';
        }

        // 5. Full Constitutional Opinion (State's Perspective)
        const opinionEl = document.getElementById("case-justification");
        if (c.Constitutional_Justification) {
            opinionEl.innerHTML = formatConstitutionalText(c.Constitutional_Justification);
        } else {
            opinionEl.innerHTML = '<p>Constitutional justification not available.</p>';
        }

        // 6. Priority Rules Applied
        const rulesEl = document.getElementById("case-priority-reason");
        if (c.Priority_Rules_Applied) {
            rulesEl.innerHTML = formatConstitutionalText(c.Priority_Rules_Applied);
        } else {
            rulesEl.innerHTML = '<p>Priority rules not available.</p>';
        }

        // Urgency badge based on severity
        const urgencyBadge = document.getElementById("case-urgency-badge");
        if (c.Severity === "Fatal") {
            urgencyBadge.className = "urgency-pill highest";
            urgencyBadge.textContent = "Urgent — Highest";
        } else if (c.Severity === "Major") {
            urgencyBadge.className = "urgency-pill high";
            urgencyBadge.textContent = "Urgent — High";
        } else if (c.Severity === "Minor") {
            urgencyBadge.className = "urgency-pill moderate";
            urgencyBadge.textContent = "Urgent — Moderate";
        } else {
            urgencyBadge.className = "urgency-pill standard";
            urgencyBadge.textContent = "Urgency — Standard";
        }
        
        // Badge styles
        const badgePriority = document.getElementById("case-priority-badge");
        badgePriority.className = `priority-pill ${c.Predicted_Priority.toLowerCase()}`;
        badgePriority.textContent = `${c.Predicted_Priority} Priority`;

        document.getElementById("case-category-badge").textContent = c.Category || "General Civil";

        // Parameters
        document.getElementById("param-model-cat").textContent = c.Broad_Model_Category || "N/A";
        document.getElementById("param-severity").textContent = c.Severity || "N/A";
        document.getElementById("param-vulnerability").textContent = c.Vulnerability || "N/A";
        document.getElementById("param-influence").textContent = c.Influence || "N/A";

        // Fetch Path Details from back-end
        const stepsContainer = document.getElementById("decision-path-steps");
        stepsContainer.innerHTML = `<div class="loader">Tracing decision path...</div>`;

        try {
            const res = await fetch(`/api/cases/${encodeURIComponent(c.Case_File)}/decision-path`);
            if (!res.ok) throw new Error("Path fetch failed");
            const pathInfo = await res.json();
            
            activePathNodes = pathInfo.path_node_ids || [];
            renderPathTimeline(pathInfo.steps);
            renderBreadcrumb(pathInfo.steps);
            const traceWrap = document.getElementById("path-trace-wrap");
            if (traceWrap) traceWrap.style.display = "block";

            // If we are currently on the tree tab, update tree highlighting immediately
            const activeTab = document.querySelector(".tab-btn.active").getAttribute("data-tab");
            if (activeTab === "tree-tab" && globalTreeData) {
                drawDecisionTree(globalTreeData);
            }
        } catch (err) {
            stepsContainer.innerHTML = `<div class="loader" style="color: #B3402E">Error loading path trace steps.</div>`;
            console.error(err);
        }
    }

    // Textual breadcrumb of the active case's path (readable in one line)
    function renderBreadcrumb(steps) {
        const bc = document.getElementById("path-breadcrumb");
        if (!bc) return;
        if (!steps || steps.length === 0) { bc.innerHTML = ""; return; }
        const parts = steps.map((step) => {
            if (step.type === "leaf") {
                const cls = String(step.result || "medium").toLowerCase();
                return `<span class="breadcrumb-step leaf-step ${cls}">${escHtml(step.result)} Priority</span>`;
            }
            return `<span class="breadcrumb-step">${escHtml(step.title)}</span>`;
        });
        bc.innerHTML = parts.map((p, i) => i > 0 ? `<span class="breadcrumb-sep">→</span>${p}` : p).join("");
    }

    // Side panel: explain one node in plain English
    function showNodePanel(d) {
        const panel = document.getElementById("tree-node-panel");
        if (!panel) return;
        const isLeaf = d.type === "leaf";
        let html = `<div class="node-panel-title">Node ${d.id}${isLeaf ? " — Final Verdict" : ""}</div>`;
        html += `<div class="node-panel-type">${isLeaf ? "Leaf node" : "Decision split"}</div>`;
        if (isLeaf) {
            html += `<div class="node-panel-row"><strong>Predicted Priority</strong><span class="panel-priority" style="color:${getPriorityColor(d.predicted_class)}">${escHtml(d.predicted_class)}</span></div>`;
            html += `<div class="node-panel-row"><strong>Samples at leaf</strong>${d.samples}</div>`;
        } else {
            html += `<div class="node-panel-row"><strong>Split rule</strong>${escHtml(d.name)}</div>`;
            html += `<div class="node-panel-row"><strong>Feature</strong>${escHtml(d.feature_clean || "—")}</div>`;
            html += `<div class="node-panel-row"><strong>Samples</strong>${d.samples}</div>`;
        }
        html += `<div class="node-panel-row"><strong>Class distribution</strong>${Object.entries(d.class_counts || {}).map(([k, v]) => `${escHtml(k)}: ${v}`).join(" · ")}</div>`;
        panel.innerHTML = html;
        if (typeof lucide !== "undefined") lucide.createIcons();
    }

    // Tree control bar (zoom / fit / path-only)
    const zoomInBtn = document.getElementById("tree-zoom-in");
    const zoomOutBtn = document.getElementById("tree-zoom-out");
    const fitBtn = document.getElementById("tree-fit");
    const pathOnlyBtn = document.getElementById("tree-path-only");
    const treeCanvasEl = document.getElementById("tree-canvas-container");
    const pathTraceToggle = document.getElementById("path-trace-toggle");

    function treeZoomBy(factor) {
        const svgEl = document.getElementById("tree-svg");
        if (svgEl && d3Zoom) d3.select(svgEl).transition().duration(250).call(d3Zoom.scaleBy, factor);
    }
    if (zoomInBtn) zoomInBtn.addEventListener("click", () => treeZoomBy(1.3));
    if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => treeZoomBy(0.75));
    if (fitBtn) fitBtn.addEventListener("click", () => {
        const svgEl = document.getElementById("tree-svg");
        if (svgEl && d3Zoom) d3.select(svgEl).transition().duration(300).call(d3Zoom.transform, d3.zoomIdentity.translate(20, 20).scale(0.85));
    });
    if (pathOnlyBtn) pathOnlyBtn.addEventListener("click", () => {
        if (!treeCanvasEl) return;
        if (!activePathNodes.length) return; // nothing to isolate without a selected case
        const isPathOnly = treeCanvasEl.classList.toggle("path-only");
        pathOnlyBtn.classList.toggle("active", isPathOnly);
        if (typeof lucide !== "undefined") lucide.createIcons();
    });
    if (pathTraceToggle) pathTraceToggle.addEventListener("click", () => {
        const wrap = document.getElementById("path-trace-wrap");
        if (wrap) wrap.classList.toggle("collapsed");
    });

    function renderPathTimeline(steps) {
        const stepsContainer = document.getElementById("decision-path-steps");
        stepsContainer.innerHTML = "";

        steps.forEach((step, idx) => {
            const stepEl = document.createElement("div");
            
            let classType = "match";
            let resultLabel = `<span class="step-match-label yes">Match: Yes</span>`;
            if (step.type === "leaf") {
                classType = `leaf leaf-${step.result.toLowerCase()}`;
                resultLabel = `<span class="step-match-label priority">${step.result} Priority</span>`;
            } else if (step.result === "No") {
                classType = "no-match";
                resultLabel = `<span class="step-match-label no">Match: No</span>`;
            }

            stepEl.className = `step-item ${classType}`;
            stepEl.innerHTML = `
                <div class="step-info">
                    <div class="step-title">Node ${step.node_id}: ${step.title}</div>
                    <div class="step-cond">${step.condition}</div>
                </div>
                <div class="step-outcome">
                    <div class="step-val">Actual: ${step.case_value}</div>
                    ${resultLabel}
                </div>
            `;
            stepsContainer.appendChild(stepEl);
        });
    }

    // D3.js Decision Tree Graph Visualizer
    function drawDecisionTree(data) {
        const svgElement = document.getElementById("tree-svg");
        const canvasContainer = document.querySelector(".tree-canvas-container");
        
        const width = canvasContainer.clientWidth;
        const height = canvasContainer.clientHeight;

        d3.select(svgElement).selectAll("*").remove();

        const svg = d3.select(svgElement)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("width", "100%")
            .attr("height", "100%");

        const mainGroup = svg.append("g").attr("class", "tree-main-group");

        // Tooltip setup
        const tooltip = d3.select("#tree-tooltip");

        // Pan/Zoom setup
        d3Zoom = d3.zoom()
            .scaleExtent([0.15, 3])
            .on("zoom", (event) => {
                mainGroup.attr("transform", event.transform);
            });
        
        svg.call(d3Zoom);

        // Banner setup for active case
        const banner = document.getElementById("tree-legend-case-active");
        const bannerCaseName = document.getElementById("active-path-case-name");
        if (selectedCase) {
            banner.style.display = "block";
            bannerCaseName.textContent = selectedCase.Case_File;
        } else {
            banner.style.display = "none";
        }

        // Setup hierarchy tree
        const treemap = d3.tree().size([height - 80, width - 260]);
        let root = d3.hierarchy(data, d => d.children);
        
        root.x0 = height / 2;
        root.y0 = 40;

        treemap(root);

        // Move tree layout horizontally so it starts cleanly from left
        root.descendants().forEach(d => {
            d.y = d.y + 40;
        });

        // Add Links
        const link = mainGroup.selectAll("path.tree-link")
            .data(root.links())
            .enter().append("path")
            .attr("class", d => {
                const isActive = activePathNodes.includes(d.source.data.id) && activePathNodes.includes(d.target.data.id);
                const hasPath = activePathNodes.length > 0;
                return `tree-link ${isActive ? 'path-active' : ''} ${hasPath && !isActive ? 'dimmed' : ''}`;
            })
            .attr("d", d3.linkHorizontal()
                .x(d => d.y)
                .y(d => d.x)
            );

        // Add Nodes Group
        const node = mainGroup.selectAll("g.tree-node")
            .data(root.descendants())
            .enter().append("g")
            .attr("class", d => {
                const isActive = activePathNodes.includes(d.data.id);
                const hasPath = activePathNodes.length > 0;
                const isLeaf = d.data.type === "leaf";
                return `tree-node ${isLeaf ? 'leaf' : 'decision'} ${isActive ? 'path-active' : ''} ${hasPath && !isActive ? 'dimmed' : ''}`;
            })
            .attr("transform", d => `translate(${d.y},${d.x})`)
            .on("mouseover", (event, d) => {
                tooltip.transition().duration(180).style("opacity", 1);
                
                let tooltipContent = `<div class="tooltip-title">Node ${d.data.id}: ${d.data.type === 'leaf' ? 'Leaf' : 'Decision Split'}</div>`;
                if (d.data.type === "leaf") {
                    tooltipContent += `
                        <div class="tooltip-row"><strong>Prediction:</strong> <span style="color: ${getPriorityColor(d.data.predicted_class)}">${d.data.predicted_class}</span></div>
                        <div class="tooltip-row"><strong>Samples:</strong> ${d.data.samples}</div>
                    `;
                } else {
                    tooltipContent += `
                        <div class="tooltip-row"><strong>Split Rule:</strong> ${d.data.name}</div>
                        <div class="tooltip-row"><strong>Feature:</strong> ${d.data.feature_clean}</div>
                        <div class="tooltip-row"><strong>Samples:</strong> ${d.data.samples}</div>
                    `;
                }

                // Append class counts distribution
                tooltipContent += `<div class="tooltip-row" style="margin-top:6px; font-size:10px; border-top: 1px solid rgba(80, 60, 20, 0.15); padding-top:4px;"><strong>Distribution:</strong></div>`;
                Object.entries(d.data.class_counts).forEach(([cls, count]) => {
                    tooltipContent += `<div class="tooltip-row" style="font-size:10px;">• ${cls}: ${count}</div>`;
                });

                tooltip.html(tooltipContent);
            })
            .on("mousemove", (event) => {
                const containerRect = canvasContainer.getBoundingClientRect();
                tooltip
                    .style("left", (event.clientX - containerRect.left + 15) + "px")
                    .style("top", (event.clientY - containerRect.top - 20) + "px");
            })
            .on("mouseout", () => {
                tooltip.transition().duration(200).style("opacity", 0);
            })
            .on("click", (event, d) => showNodePanel(d.data));

        // Node Visual representation
        node.append("circle")
            .attr("r", d => d.data.type === "leaf" ? 8 : 6)
            .style("stroke", d => {
                if (d.data.type === "leaf") {
                    return getPriorityColor(d.data.predicted_class);
                }
                return "#C9A24B"; // Decision node border (gold)
            })
            .style("fill", d => {
                const isActive = activePathNodes.includes(d.data.id);
                if (isActive) {
                    if (d.data.type === "leaf") {
                        return getPriorityColor(d.data.predicted_class);
                    }
                    return "#C9A24B"; // Active decision node fill (gold)
                }
                return "#FFFFFF"; // Background card color (white)
            })
            .style("color", d => {
                if (d.data.type === "leaf") {
                    return getPriorityColor(d.data.predicted_class);
                }
                return "#8A6A1F"; // Text-safe gold
            });

        // Invisible hit area so nodes are easy to click
        node.append("circle")
            .attr("r", 15)
            .attr("class", "tree-hit-circle")
            .style("fill", "transparent")
            .style("stroke", "none");

        // Add text labels
        node.append("text")
            .attr("dy", ".31em")
            .attr("x", d => d.children ? -12 : 12)
            .attr("text-anchor", d => d.children ? "end" : "start")
            .text(d => d.data.name.length > 30 ? d.data.name.substring(0, 28) + "..." : d.data.name)
            .style("text-shadow", "0 0 4px #FBF8F1");

        // Fit tree inside view
        const initialTransform = d3.zoomIdentity.translate(20, 20).scale(0.85);
        svg.call(d3Zoom.transform, initialTransform);
    }

    function getPriorityColor(priority) {
        if (priority === "High") return "#B3402E";
        if (priority === "Medium") return "#C25606";
        if (priority === "Low") return "#4E7A66";
        return "#8B8471";
    }

    // -------------------------------------------------------------
    // LIE DETECTOR (CHAKSHU) LOGIC
    // -------------------------------------------------------------
    window.webcamStream = null;
    window.activeCamera = null;
    window.isAnalyzing = false;
    let isCalibrated = false;
    let calibrationFrames = 0;
    
    // Indices for eyes and face landmarks
    const LEFT_EYE = [33, 160, 158, 133, 153, 144];
    const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
    const LEFT_IRIS = [468, 469, 470, 471, 472];
    const RIGHT_IRIS = [473, 474, 475, 476, 477];
    const BROWS = [70, 107, 300, 336];
    const MOUTH = [61, 291];

    let calibrationAccumulator = {
        ear: [],
        gazeRatio: [],
        stressVariance: []
    };

    let baseline = {
        earMean: 0.28,
        earStd: 0.02,
        gazeMean: 0.5,
        gazeStd: 0.03,
        stressMean: 0.005,
        stressStd: 0.001
    };

    function calculateMean(array) {
        if (array.length === 0) return 0;
        return array.reduce((a, b) => a + b, 0) / array.length;
    }

    function calculateStdDev(array, mean) {
        if (array.length === 0) return 0;
        const variance = array.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / array.length;
        return Math.sqrt(variance);
    }

    let sessionStats = {
        blinks: 0,
        gazeAvoidance: 0,
        twitches: 0,
        startTime: null,
        duration: 0,
        scores: [],
        lastEarState: 'open'
    };

    let frameHistory = {
        mouthPos: [],
        browPos: []
    };

    const startCameraBtn = document.getElementById("start-camera-btn");
    const cameraPlaceholder = document.getElementById("camera-placeholder");
    const webcamFeed = document.getElementById("webcam-feed");
    const overlayCanvas = document.getElementById("mesh-overlay-canvas");
    const overlayCtx = overlayCanvas.getContext("2d");

    const startAnalysisBtn = document.getElementById("start-analysis-btn");
    const stopAnalysisBtn = document.getElementById("stop-analysis-btn");
    const resetAnalysisBtn = document.getElementById("reset-analysis-btn");
    
    const calibrationOverlay = document.getElementById("calibration-overlay");
    const calibrationText = document.getElementById("calibration-text");

    const metricBlinkEl = document.getElementById("metric-blink");
    const metricGazeEl = document.getElementById("metric-gaze");
    const metricStressEl = document.getElementById("metric-stress");
    const metricTremorEl = document.getElementById("metric-tremor");

    const fillBlinkEl = document.getElementById("fill-blink");
    const fillGazeEl = document.getElementById("fill-gaze");
    const fillStressEl = document.getElementById("fill-stress");
    const fillTremorEl = document.getElementById("fill-tremor");

    const deceptionGaugeFill = document.getElementById("deception-gauge-fill");
    const deceptionGaugeValue = document.getElementById("deception-gauge-value");
    const sessionStatusBanner = document.getElementById("session-status-banner");

    const summaryCard = document.getElementById("session-summary-card");
    const summaryDuration = document.getElementById("summary-duration");
    const summaryBlinks = document.getElementById("summary-blinks");
    const summaryGazeAvoid = document.getElementById("summary-gaze-avoid");
    const summaryTwitches = document.getElementById("summary-twitches");
    const summaryVerdict = document.getElementById("summary-verdict");

    // MediaPipe (face_mesh + camera_utils, ~2.5 MB) is lazy-loaded only when
    // the user actually starts the camera, so the dashboard never pays the
    // script parse/memory cost on every page load.
    let mediaPipePromise = null;

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

    function ensureMediaPipeLibs() {
        if (typeof window.FaceMesh !== "undefined" && typeof window.Camera !== "undefined") {
            return Promise.resolve();
        }
        if (!mediaPipePromise) {
            mediaPipePromise = Promise.all([
                loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"),
                loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"),
            ]);
        }
        return mediaPipePromise;
    }

    // Initialize Camera Stream
    startCameraBtn.addEventListener("click", async () => {
        try {
            startCameraBtn.disabled = true;
            startCameraBtn.textContent = "Accessing webcam...";

            webcamStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: "user" }
            });

            webcamFeed.srcObject = webcamStream;
            cameraPlaceholder.style.display = "none";
            webcamFeed.style.display = "block";

            overlayCanvas.width = 640;
            overlayCanvas.height = 480;

            await ensureMediaPipeLibs();
            initializeFaceMesh();
            
            startAnalysisBtn.disabled = false;
            resetAnalysisBtn.disabled = false;
        } catch (err) {
            console.error("Camera startup error:", err);
            alert("Webcam startup failed. Make sure camera permissions are enabled in your browser.");
            startCameraBtn.disabled = false;
            startCameraBtn.textContent = "Initialize Camera Stream";
        }
    });

    function initializeFaceMesh() {
        faceMesh = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        faceMesh.onResults(onFaceMeshResults);

        activeCamera = new Camera(webcamFeed, {
            onFrame: async () => {
                if (webcamFeed.readyState >= 2) {
                    await faceMesh.send({ image: webcamFeed });
                }
            },
            width: 640,
            height: 480
        });

        activeCamera.start();
    }

    // Start Analysis Stream
    startAnalysisBtn.addEventListener("click", () => {
        isAnalyzing = true;
        isCalibrated = false;
        calibrationFrames = 0;
        calibrationAccumulator = { ear: [], gazeRatio: [], stressVariance: [] };
        
        sessionStats = {
            blinks: 0,
            gazeAvoidance: 0,
            twitches: 0,
            startTime: Date.now(),
            duration: 0,
            scores: [],
            lastEarState: 'open'
        };

        startAnalysisBtn.disabled = true;
        stopAnalysisBtn.disabled = false;
        calibrationOverlay.style.display = "flex";
        calibrationText.textContent = "Calibrating baseline... Look directly at the camera.";
        sessionStatusBanner.textContent = "Calibrating Neutral State...";
        summaryCard.style.display = "none";
    });

    // Stop Stream Analysis & Score Session
    stopAnalysisBtn.addEventListener("click", () => {
        isAnalyzing = false;
        stopAnalysisBtn.disabled = true;
        startAnalysisBtn.disabled = false;

        sessionStats.duration = Math.round((Date.now() - sessionStats.startTime) / 1000);
        
        let avgScore = 0;
        if (sessionStats.scores.length > 0) {
            avgScore = Math.round(sessionStats.scores.reduce((a, b) => a + b, 0) / sessionStats.scores.length);
        }

        updateDeceptionGauge(avgScore);

        // Render summary report
        summaryCard.style.display = "flex";
        summaryDuration.textContent = `${sessionStats.duration} seconds`;
        summaryBlinks.textContent = sessionStats.blinks;
        summaryGazeAvoid.textContent = sessionStats.gazeAvoidance;
        summaryTwitches.textContent = sessionStats.twitches;

        summaryVerdict.className = "verdict-pill";
        if (avgScore < 30) {
            summaryVerdict.classList.add("text-low");
            summaryVerdict.textContent = "Truthful (Stable)";
        } else if (avgScore < 60) {
            summaryVerdict.classList.add("text-medium");
            summaryVerdict.textContent = "Elevated Stress / Suspicious";
        } else {
            summaryVerdict.classList.add("text-high");
            summaryVerdict.textContent = "Deceptive Patterns Detected";
        }

        sessionStatusBanner.textContent = `Analysis Completed. Session Score: ${avgScore}%`;

        // Notify the case-workflow module so it can save the transcript + physio
        // and enable the evidence fact-check.
        if (window.AnavayaUI && typeof window.AnavayaUI.onSessionStopped === "function") {
            window.AnavayaUI.onSessionStopped();
        }
    });

    // Reset Session
    resetAnalysisBtn.addEventListener("click", () => {
        isAnalyzing = false;
        isCalibrated = false;
        startAnalysisBtn.disabled = false;
        stopAnalysisBtn.disabled = true;
        calibrationOverlay.style.display = "none";
        summaryCard.style.display = "none";
        updateDeceptionGauge(0);
        sessionStatusBanner.textContent = "Ready for Baseline Calibration";
        
        metricBlinkEl.textContent = "0 bpm";
        metricGazeEl.textContent = "Neutral";
        metricStressEl.textContent = "Low";
        metricTremorEl.textContent = "0.00 Hz";

        fillBlinkEl.style.width = "0%";
        fillGazeEl.style.width = "0%";
        fillStressEl.style.width = "0%";
        fillTremorEl.style.width = "0%";

        // Notify the case-workflow module so it clears its transcript state.
        if (window.AnavayaUI && typeof window.AnavayaUI.onSessionReset === "function") {
            window.AnavayaUI.onSessionReset();
        }
    });

    function getLandmarkDist(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2));
    }

    function getEAR(landmarks, eyeIndices) {
        const v1 = getLandmarkDist(landmarks[eyeIndices[1]], landmarks[eyeIndices[5]]);
        const v2 = getLandmarkDist(landmarks[eyeIndices[2]], landmarks[eyeIndices[4]]);
        const h = getLandmarkDist(landmarks[eyeIndices[0]], landmarks[eyeIndices[3]]);
        return (v1 + v2) / (2.0 * h);
    }

    function updateDeceptionGauge(score) {
        const circumference = 314.16;
        const offset = circumference - (score / 100) * circumference;
        deceptionGaugeFill.style.strokeDashoffset = offset;
        deceptionGaugeValue.textContent = `${score}%`;

        if (score < 30) {
            deceptionGaugeFill.style.stroke = "var(--color-low)";
        } else if (score < 60) {
            deceptionGaugeFill.style.stroke = "var(--color-medium)";
        } else {
            deceptionGaugeFill.style.stroke = "var(--color-high)";
        }
    }

    function onFaceMeshResults(results) {
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            return;
        }

        const landmarks = results.multiFaceLandmarks[0];

        drawOverlayMesh(landmarks);

        if (!isAnalyzing) return;

        // --- Calibrate Phase (120 Frames / ~4 Seconds) ---
        if (!isCalibrated) {
            calibrationFrames++;
            
            const leftEar = getEAR(landmarks, LEFT_EYE);
            const rightEar = getEAR(landmarks, RIGHT_EYE);
            const avgEar = (leftEar + rightEar) / 2.0;
            calibrationAccumulator.ear.push(avgEar);

            const leftCorner = landmarks[33];
            const rightCorner = landmarks[133];
            const irisCenter = landmarks[468];
            const gazeRatio = getLandmarkDist(leftCorner, irisCenter) / getLandmarkDist(leftCorner, rightCorner);
            calibrationAccumulator.gazeRatio.push(gazeRatio);

            const mouthCornerLeft = landmarks[61];
            const mouthCornerRight = landmarks[291];
            const curMouthDist = getLandmarkDist(mouthCornerLeft, mouthCornerRight);
            frameHistory.mouthPos.push(curMouthDist);
            if (frameHistory.mouthPos.length > 20) frameHistory.mouthPos.shift();

            let mouthJitter = 0;
            if (frameHistory.mouthPos.length > 5) {
                const avgMouth = frameHistory.mouthPos.reduce((a, b) => a + b, 0) / frameHistory.mouthPos.length;
                const variance = frameHistory.mouthPos.reduce((sum, val) => sum + Math.pow(val - avgMouth, 2), 0) / frameHistory.mouthPos.length;
                mouthJitter = Math.sqrt(variance);
            }
            calibrationAccumulator.stressVariance.push(mouthJitter);

            calibrationOverlay.style.display = "flex";
            const percent = Math.min(100, Math.round((calibrationFrames / 120) * 100));
            calibrationText.textContent = `Analyzing facial contours... ${percent}%`;

            if (calibrationFrames >= 120) {
                isCalibrated = true;
                calibrationOverlay.style.display = "none";
                
                // Calculate means
                baseline.earMean = calculateMean(calibrationAccumulator.ear);
                baseline.gazeMean = calculateMean(calibrationAccumulator.gazeRatio);
                baseline.stressMean = calculateMean(calibrationAccumulator.stressVariance);
                
                // Calculate standard deviations
                baseline.earStd = calculateStdDev(calibrationAccumulator.ear, baseline.earMean);
                baseline.gazeStd = calculateStdDev(calibrationAccumulator.gazeRatio, baseline.gazeMean);
                baseline.stressStd = calculateStdDev(calibrationAccumulator.stressVariance, baseline.stressMean);
                
                // Set bounds to avoid division issues
                baseline.earStd = Math.max(0.005, baseline.earStd);
                baseline.gazeStd = Math.max(0.005, baseline.gazeStd);
                baseline.stressStd = Math.max(0.0005, baseline.stressStd);
                
                sessionStats.startTime = Date.now();
                sessionStatusBanner.textContent = "Live Stream Analysis Active";
                console.log("Calibration complete.", baseline);
            }
            return;
        }

        // --- Active Stream Analysis ---
        const elapsedSec = (Date.now() - sessionStats.startTime) / 1000;

        // 1. Calculate EAR and detect Blinks
        const leftEar = getEAR(landmarks, LEFT_EYE);
        const rightEar = getEAR(landmarks, RIGHT_EYE);
        const currentEar = (leftEar + rightEar) / 2.0;

        // Calculate Z-Score for eye aspect ratio (closing is negative deviation)
        const z_ear = (currentEar - baseline.earMean) / baseline.earStd;
        if (z_ear < -2.2) {
            if (sessionStats.lastEarState === 'open') {
                sessionStats.blinks++;
                sessionStats.lastEarState = 'closed';
            }
        } else {
            sessionStats.lastEarState = 'open';
        }

        const bpm = Math.round((sessionStats.blinks / (elapsedSec || 1)) * 60);
        metricBlinkEl.textContent = `${bpm} bpm (${sessionStats.blinks} total)`;
        const blinkRatio = Math.min(100, Math.round(Math.max(0, -z_ear) * 20));
        fillBlinkEl.style.width = `${blinkRatio}%`;

        // 2. Calculate Gaze Deviation Index (GDI)
        const leftCorner = landmarks[33];
        const rightCorner = landmarks[133];
        const irisCenter = landmarks[468];
        const gazeRatio = getLandmarkDist(leftCorner, irisCenter) / getLandmarkDist(leftCorner, rightCorner);
        
        // Z-Score for Gaze
        const z_gaze = (gazeRatio - baseline.gazeMean) / baseline.gazeStd;
        const abs_z_gaze = Math.abs(z_gaze);

        let gazeLabel = "Neutral";
        if (abs_z_gaze > 2.0) {
            gazeLabel = `Avoidant (Z = ${z_gaze.toFixed(1)})`;
            if (Math.random() < 0.05) {
                sessionStats.gazeAvoidance++;
            }
            metricGazeEl.style.color = "var(--color-medium)";
        } else if (abs_z_gaze > 1.2) {
            gazeLabel = "Minor Gaze Shift";
            metricGazeEl.style.color = "var(--text-secondary)";
        } else {
            metricGazeEl.style.color = "#fff";
        }
        metricGazeEl.textContent = gazeLabel;
        fillGazeEl.style.width = `${Math.min(100, (abs_z_gaze / 3.0) * 100)}%`;

        // 3. Calculate Facial Stress (Eyebrows and Mouth)
        const mouthCornerLeft = landmarks[61];
        const mouthCornerRight = landmarks[291];
        const curMouthDist = getLandmarkDist(mouthCornerLeft, mouthCornerRight);
        
        frameHistory.mouthPos.push(curMouthDist);
        if (frameHistory.mouthPos.length > 20) frameHistory.mouthPos.shift();

        let mouthJitter = 0;
        if (frameHistory.mouthPos.length > 5) {
            const avgMouth = frameHistory.mouthPos.reduce((a, b) => a + b, 0) / frameHistory.mouthPos.length;
            const variance = frameHistory.mouthPos.reduce((sum, val) => sum + Math.pow(val - avgMouth, 2), 0) / frameHistory.mouthPos.length;
            mouthJitter = Math.sqrt(variance);
        }

        // Z-Score for Stress jitter
        const z_stress = (mouthJitter - baseline.stressMean) / baseline.stressStd;

        let stressLabel = "Low (Stable)";
        if (z_stress > 2.0) {
            stressLabel = `High Tension (Z = ${z_stress.toFixed(1)})`;
            if (Math.random() < 0.08) {
                sessionStats.twitches++;
            }
            metricStressEl.style.color = "var(--color-high)";
        } else if (z_stress > 1.0) {
            stressLabel = "Moderate Tension";
            metricStressEl.style.color = "var(--color-medium)";
        } else {
            metricStressEl.style.color = "#fff";
        }
        metricStressEl.textContent = stressLabel;
        fillStressEl.style.width = `${Math.min(100, Math.max(0, z_stress / 3.0) * 100)}%`;

        // 4. Jitter / Tremor Frequency
        const eyeBrowLeft = landmarks[70];
        const eyeBrowRight = landmarks[300];
        const browDist = getLandmarkDist(eyeBrowLeft, eyeBrowRight);
        frameHistory.browPos.push(browDist);
        if (frameHistory.browPos.length > 30) frameHistory.browPos.shift();

        let browJitter = 0;
        if (frameHistory.browPos.length > 10) {
            const avgBrow = frameHistory.browPos.reduce((a, b) => a + b, 0) / frameHistory.browPos.length;
            browJitter = frameHistory.browPos.reduce((sum, val) => sum + Math.abs(val - avgBrow), 0) / frameHistory.browPos.length;
        }

        const tremorFreq = (browJitter * 250).toFixed(2);
        metricTremorEl.textContent = `${tremorFreq} Hz`;
        fillTremorEl.style.width = `${Math.min(100, (browJitter / 0.008) * 100)}%`;

        // 5. Overall Cognitive Arousal Index
        const avg_z = (abs_z_gaze + Math.max(0, z_stress)) / 2.0;
        
        // Z-score <= 0.6 is 0% arousal. Z-score >= 2.6 is 100% arousal.
        let baseArousalScore = Math.min(100, Math.max(0, Math.round(((avg_z - 0.6) / 2.0) * 100)));
        
        // Blink rate anomaly check
        if (bpm > 26 || bpm < 7) {
            baseArousalScore = Math.min(100, baseArousalScore + 15);
        }

        sessionStats.scores.push(baseArousalScore);
        if (sessionStats.scores.length > 15) {
            const smoothedScore = Math.round(sessionStats.scores.slice(-15).reduce((a,b)=>a+b, 0) / 15);
            updateDeceptionGauge(smoothedScore);
        } else {
            updateDeceptionGauge(baseArousalScore);
        }
    }

    function drawOverlayMesh(landmarks) {
        overlayCtx.fillStyle = "rgba(201, 162, 75, 0.45)"; // gold
        overlayCtx.strokeStyle = "rgba(201, 162, 75, 0.2)";
        overlayCtx.lineWidth = 1;

        // Draw left eye loop
        overlayCtx.beginPath();
        LEFT_EYE.forEach((idx, i) => {
            const p = landmarks[idx];
            const cx = p.x * overlayCanvas.width;
            const cy = p.y * overlayCanvas.height;
            if (i === 0) overlayCtx.moveTo(cx, cy);
            else overlayCtx.lineTo(cx, cy);
        });
        overlayCtx.closePath();
        overlayCtx.stroke();

        // Draw right eye loop
        overlayCtx.beginPath();
        RIGHT_EYE.forEach((idx, i) => {
            const p = landmarks[idx];
            const cx = p.x * overlayCanvas.width;
            const cy = p.y * overlayCanvas.height;
            if (i === 0) overlayCtx.moveTo(cx, cy);
            else overlayCtx.lineTo(cx, cy);
        });
        overlayCtx.closePath();
        overlayCtx.stroke();

        // Draw pupil centers in glowing moss green
        overlayCtx.fillStyle = "rgba(78, 122, 102, 0.85)"; // sage
        [468, 473].forEach(idx => {
            const p = landmarks[idx];
            overlayCtx.beginPath();
            overlayCtx.arc(p.x * overlayCanvas.width, p.y * overlayCanvas.height, 3, 0, 2 * Math.PI);
            overlayCtx.fill();
        });

        // Draw eyebrows
        overlayCtx.strokeStyle = "rgba(80, 60, 20, 0.4)"; // warm charcoal
        overlayCtx.beginPath();
        overlayCtx.moveTo(landmarks[70].x * overlayCanvas.width, landmarks[70].y * overlayCanvas.height);
        overlayCtx.lineTo(landmarks[107].x * overlayCanvas.width, landmarks[107].y * overlayCanvas.height);
        overlayCtx.moveTo(landmarks[300].x * overlayCanvas.width, landmarks[300].y * overlayCanvas.height);
        overlayCtx.lineTo(landmarks[336].x * overlayCanvas.width, landmarks[336].y * overlayCanvas.height);
        overlayCtx.stroke();
    }

    // Helper: Format constitutional analysis text — handles markdown-like formatting
    function formatConstitutionalText(text) {
        if (!text) return '';
        
        // Convert markdown bold to HTML bold
        let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Convert markdown headings to HTML headings
        formatted = formatted.replace(/^### (.*?)$/gm, '<h4 class="constitutional-h4">$1</h4>');
        formatted = formatted.replace(/^## (.*?)$/gm, '<h3 class="constitutional-h3">$1</h3>');
        
        // Convert markdown bullet points to HTML list items
        formatted = formatted.replace(/^- (.*?)$/gm, '<li>$1</li>');
        
        // Wrap consecutive list items
        formatted = formatted.replace(/(<li>.*?<\/li>\n?)+/g, '<ul class="constitutional-ul">$&</ul>');
        
        // Convert double newlines to paragraph breaks
        formatted = formatted.replace(/\n\n/g, '</p><p class="constitutional-p">');
        
        // Convert single newlines to line breaks
        formatted = formatted.replace(/\n/g, '<br>');
        
        // Wrap in paragraph if not already wrapped
        if (!formatted.startsWith('<')) {
            formatted = '<p class="constitutional-p">' + formatted + '</p>';
        }
        
        // Fix any nested <p> tags
        formatted = formatted.replace(/<p class="constitutional-p">\s*<p class="constitutional-p">/g, '<p class="constitutional-p">');
        formatted = formatted.replace(/<\/p>\s*<\/p>/g, '</p>');
        
        return formatted;
    }

    // ================================================================
    // LIVE COURTROOM LOBBY
    // ================================================================
    const lobbyCreateForm = document.getElementById("create-room-form");
    const lobbyCreateBtn = document.querySelector(".lobby-create-btn");
    const lobbySuccess = document.getElementById("lobby-create-success");
    const successText = document.getElementById("success-text");
    const openRoomBtn = document.getElementById("open-room-btn");
    const copyRoomInviteBtn = document.getElementById("copy-room-invite-btn");
    const refreshRoomsBtn = document.getElementById("refresh-rooms-btn");
    const roomsListContainer = document.getElementById("rooms-list-container");
    const newRoomTitle = document.getElementById("new-room-title");
    const newRoomHost = document.getElementById("new-room-host");

    let lastCreatedRoomId = null;

    async function fetchCourtrooms() {
        try {
            const res = await fetch("/api/court/rooms");
            if (!res.ok) throw new Error(res.statusText);
            const rooms = await res.json();
            renderCourtrooms(rooms);
            courtroomsLoaded = true;
        } catch (e) {
            roomsListContainer.innerHTML = `<div class="loader" style="color:var(--color-high);">Failed to load trial sessions.</div>`;
        }
    }

    function renderCourtrooms(rooms) {
        if (!rooms || rooms.length === 0) {
            roomsListContainer.innerHTML = `<div class="empty-state" style="padding:30px 0;">
                <div class="empty-icon"><i data-lucide="gavel"></i></div>
                <h3>No Trials Yet</h3>
                <p>Create a courtroom session above to begin a live trial with counsel.</p>
            </div>`;
            if (typeof lucide !== "undefined") lucide.createIcons();
            return;
        }
        roomsListContainer.innerHTML = rooms.map(r => {
            const isActive = r.active;
            const statusClass = r.phase === "Concluded" ? "priority-low" : "priority-high";
            const phaseLabel = r.phase || "Opening";
            const inviteUrl = `${window.location.origin}/court/${r.room_id}`;
            return `
            <div class="courtroom-card ${isActive ? "" : "inactive"}">
                <div class="cc-header">
                    <span class="cc-title">${escapeHtml(r.case_title)}</span>
                    <span class="priority-pill ${statusClass}">${phaseLabel}</span>
                </div>
                <div class="cc-meta">
                    <span><i data-lucide="users"></i> ${r.participant_count} participant${r.participant_count !== 1 ? "s" : ""}</span>
                    <span><i data-lucide="scroll-text"></i> ${r.transcript_entries} entries</span>
                    <span><i data-lucide="clock"></i> ${new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <div class="cc-actions">
                    <button class="cc-open" onclick="window.open('${inviteUrl}','_blank')"><i data-lucide="door-open"></i> Open Trial</button>
                    <button class="cc-copy" data-invite-room="${r.room_id}"><i data-lucide="link"></i> Invite Link</button>
                    <a class="cc-transcript" href="/api/court/rooms/${r.room_id}/transcript" download><i data-lucide="download"></i> Transcript</a>
                </div>
            </div>`;
        }).join("");
        if (typeof lucide !== "undefined") lucide.createIcons();
        // Wire up the LAN-aware invite-link copy buttons (see invite.js).
        roomsListContainer.querySelectorAll("[data-invite-room]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const url = await buildInviteUrl(btn.dataset.inviteRoom);
                try {
                    await navigator.clipboard.writeText(url);
                } catch (e) {
                    console.warn("Clipboard write failed:", e);
                }
                btn.innerHTML = '<i data-lucide="check"></i> Copied';
                if (typeof lucide !== "undefined") lucide.createIcons();
            });
        });
    }

    lobbyCreateForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        lobbyCreateBtn.disabled = true;
        lobbyCreateBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Creating…';
        if (typeof lucide !== "undefined") lucide.createIcons();

        try {
            const res = await fetch("/api/court/rooms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    case_title: newRoomTitle.value.trim(),
                    created_by: newRoomHost.value.trim(),
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: res.statusText }));
                throw new Error(err.detail || "Failed to create room.");
            }
            const room = await res.json();
            lastCreatedRoomId = room.room_id;
            successText.textContent = `Room ${room.room_id} created — "${room.case_title}"`;
            lobbyCreateForm.style.display = "none";
            lobbySuccess.style.display = "block";
            openRoomBtn.onclick = () => window.open(`/court/${room.room_id}`, "_blank");
            copyRoomInviteBtn.onclick = async () => {
                const url = await buildInviteUrl(room.room_id);
                try {
                    await navigator.clipboard.writeText(url);
                } catch (e) {
                    console.warn("Clipboard write failed:", e);
                }
                copyRoomInviteBtn.innerHTML = '<i data-lucide="check"></i> Copied';
            };
            if (typeof lucide !== "undefined") lucide.createIcons();
            // Refresh the room list.
            fetchCourtrooms();
        } catch (e) {
            alert("Could not create room: " + e.message);
        } finally {
            lobbyCreateBtn.disabled = false;
            lobbyCreateBtn.innerHTML = '<i data-lucide="gavel"></i> Create Courtroom';
            if (typeof lucide !== "undefined") lucide.createIcons();
        }
    });

    refreshRoomsBtn.addEventListener("click", () => {
        roomsListContainer.innerHTML = '<div class="loader">Refreshing…</div>';
        fetchCourtrooms();
    });

    // Run Initialization
    init();
});
