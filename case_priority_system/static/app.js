// Anavaya Dashboard UI Logic
document.addEventListener("DOMContentLoaded", () => {
    let casesData = [];
    let globalTreeData = null;
    let selectedCase = null;
    let d3Zoom = null;
    let svgContainer = null;
    let activePathNodes = [];
    let courtroomsLoaded = false;

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

    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            tabButtons.forEach(b => b.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));

            btn.classList.add("active");
            const tabId = btn.getAttribute("data-tab");
            document.getElementById(tabId).classList.add("active");

            if (tabId === "tree-tab") {
                // Trigger tree resize/draw if tree data is ready
                if (globalTreeData) {
                    drawDecisionTree(globalTreeData);
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
        });
    });

    // Fetch and Initialize App Data
    async function init() {
        try {
            await Promise.all([fetchCases(), fetchTree()]);
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
            casesListContainer.innerHTML = `<div class="loader" style="color: #A85448">Error loading cases. Make sure the backend is running.</div>`;
            throw err;
        }
    }

    async function fetchTree() {
        try {
            const res = await fetch("/api/tree");
            if (!res.ok) throw new Error("Failed to load decision tree");
            globalTreeData = await res.json();
            document.getElementById("tree-loading").style.display = "none";
        } catch (err) {
            document.getElementById("tree-loading").innerHTML = `<span style="color: #A85448">Failed to load global decision tree structure.</span>`;
            throw err;
        }
    }

    // Stats calculations
    function updateStats(cases) {
        statTotalVal.textContent = cases.length;
        statHighVal.textContent = cases.filter(c => c.Predicted_Priority === "High").length;
        statMediumVal.textContent = cases.filter(c => c.Predicted_Priority === "Medium").length;
        statLowVal.textContent = cases.filter(c => c.Predicted_Priority === "Low").length;
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
            casesListContainer.innerHTML = `<div class="loader">No matching cases.</div>`;
            return;
        }

        filtered.forEach(c => {
            const cleanTitle = c.Case_File.replace(/_/g, " ").replace(/\.[Pp][Dd][Ff]$/, "");
            const item = document.createElement("div");
            item.className = `case-item ${selectedCase && selectedCase.Case_File === c.Case_File ? "active" : ""}`;
            item.setAttribute("data-case-file", c.Case_File);
            item.innerHTML = `
                <div class="case-item-align">
                    <span class="dot-red"></span>
                    <span class="dot-yellow"></span>
                    <span class="dot-green"></span>
                </div>
                <div class="case-item-title">${cleanTitle || "Unknown Case"}</div>
                <div class="case-item-details-expanded">
                    <div class="case-item-desc">${c.Main_Parties || "Unknown Parties"}</div>
                    <div class="case-item-meta">
                        <span class="badge-priority ${c.Predicted_Priority.toLowerCase()}">${c.Predicted_Priority}</span>
                        <span class="case-item-category">${c.Category || "General Civil"}</span>
                    </div>
                    <div class="case-item-summary-preview">${c.Plain_Language_Summary || "No summary available."}</div>
                </div>
            `;
            item.addEventListener("click", () => selectCase(c));
            casesListContainer.appendChild(item);
        });
    }

    // Search and Filter Listeners
    searchInput.addEventListener("input", () => renderCasesList(casesData));
    filterPriority.addEventListener("change", () => renderCasesList(casesData));
    filterCategory.addEventListener("change", () => renderCasesList(casesData));

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
        selectedCase = c;
        
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
        document.getElementById("case-title-name").textContent = c.Case_File.replace(/_/g, " ").replace(/\.[Pp][Dd][Ff]$/, "");
        document.getElementById("case-parties").innerHTML = `<strong>Parties:</strong> ${c.Main_Parties || "Unknown"}`;
        document.getElementById("case-summary").textContent = c.Plain_Language_Summary || "Summary unavailable.";
        
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
                        <strong class="rights-article">${right.article}</strong>
                        <span class="rights-title">${right.title}</span>
                    </div>
                `;
            });
            rightsHtml += '</div>';
            rightsContainer.innerHTML = rightsHtml;
        } else if (typeof c.Constitutional_Rights_Engaged === 'string' && c.Constitutional_Rights_Engaged) {
            // Handle legacy string format
            rightsContainer.innerHTML = `<p class="rights-text">${c.Constitutional_Rights_Engaged}</p>`;
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
                        <strong class="doctrine-name">${doc.name}</strong>
                        <p class="doctrine-desc">${doc.description}</p>
                        <p class="doctrine-app"><strong>Application:</strong> ${doc.application}</p>
                    </div>
                `;
            });
            doctrinesHtml += '</div>';
            doctrinesContainer.innerHTML = doctrinesHtml;
        } else if (typeof c.Applicable_Doctrines === 'string' && c.Applicable_Doctrines) {
            doctrinesContainer.innerHTML = `<p class="doctrines-text">${c.Applicable_Doctrines}</p>`;
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

            // If we are currently on the tree tab, update tree highlighting immediately
            const activeTab = document.querySelector(".tab-btn.active").getAttribute("data-tab");
            if (activeTab === "tree-tab" && globalTreeData) {
                drawDecisionTree(globalTreeData);
            }
        } catch (err) {
            stepsContainer.innerHTML = `<div class="loader" style="color: #A85448">Error loading path trace steps.</div>`;
            console.error(err);
        }
    }

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
                tooltipContent += `<div class="tooltip-row" style="margin-top:6px; font-size:10px; border-top: 1px solid rgba(74, 74, 64, 0.15); padding-top:4px;"><strong>Distribution:</strong></div>`;
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
            });

        // Node Visual representation
        node.append("circle")
            .attr("r", d => d.data.type === "leaf" ? 8 : 6)
            .style("stroke", d => {
                if (d.data.type === "leaf") {
                    return getPriorityColor(d.data.predicted_class);
                }
                return "#4A4A40"; // Decision Node border (Bark)
            })
            .style("fill", d => {
                const isActive = activePathNodes.includes(d.data.id);
                if (isActive) {
                    if (d.data.type === "leaf") {
                        return getPriorityColor(d.data.predicted_class);
                    }
                    return "#C18C5D"; // Active decision node fill (Clay/Terracotta)
                }
                return "#FEFEFA"; // Background card color (Rice Paper)
            })
            .style("color", d => {
                if (d.data.type === "leaf") {
                    return getPriorityColor(d.data.predicted_class);
                }
                return "#5D7052"; // Moss Green
            });

        // Add text labels
        node.append("text")
            .attr("dy", ".31em")
            .attr("x", d => d.children ? -12 : 12)
            .attr("text-anchor", d => d.children ? "end" : "start")
            .text(d => d.data.name.length > 30 ? d.data.name.substring(0, 28) + "..." : d.data.name)
            .style("text-shadow", "0 0 4px #FDFCF8");

        // Fit tree inside view
        const initialTransform = d3.zoomIdentity.translate(20, 20).scale(0.85);
        svg.call(d3Zoom.transform, initialTransform);
    }

    function getPriorityColor(priority) {
        if (priority === "High") return "#A85448";
        if (priority === "Medium") return "#C18C5D";
        if (priority === "Low") return "#5D7052";
        return "#78786C";
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
        overlayCtx.fillStyle = "rgba(193, 140, 93, 0.45)"; // Terracotta/Clay
        overlayCtx.strokeStyle = "rgba(193, 140, 93, 0.2)";
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
        overlayCtx.fillStyle = "rgba(93, 112, 82, 0.85)"; // Moss Green
        [468, 473].forEach(idx => {
            const p = landmarks[idx];
            overlayCtx.beginPath();
            overlayCtx.arc(p.x * overlayCanvas.width, p.y * overlayCanvas.height, 3, 0, 2 * Math.PI);
            overlayCtx.fill();
        });

        // Draw eyebrows
        overlayCtx.strokeStyle = "rgba(74, 74, 64, 0.4)"; // Bark
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
                    <button class="cc-copy" onclick="navigator.clipboard.writeText('${inviteUrl}');this.innerHTML='<i data-lucide=\\'check\\'></i> Copied';"><i data-lucide="link"></i> Invite Link</button>
                    <a class="cc-transcript" href="/api/court/rooms/${r.room_id}/transcript" download><i data-lucide="download"></i> Transcript</a>
                </div>
            </div>`;
        }).join("");
        if (typeof lucide !== "undefined") lucide.createIcons();
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
            copyRoomInviteBtn.onclick = () => {
                navigator.clipboard.writeText(`${window.location.origin}/court/${room.room_id}`);
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
