/**
 * Anavaya — Hardware Node Resolver & Standby Alert System
 *
 * Facilitates cloud deployments (Netlify/Vercel) connecting to Yeshwanth's local
 * on-premise GPU hardware node (Ollama Qwen 2.5, Whisper ASR, MediaPipe, CART engine).
 *
 * If the hardware node is unreachable or sleeping, it alerts the visitor gracefully
 * and provides a 1-click notification to yeshwanth9750@gmail.com to power on the system.
 */

(function () {
    const ADMIN_EMAIL = "yeshwanth9750@gmail.com";
    const STORAGE_KEY = "anavaya_backend_url";

    const AnavayaNode = {
        ADMIN_EMAIL: ADMIN_EMAIL,

        /**
         * Get configured custom backend URL if set by administrator (e.g. ngrok / DuckDNS).
         */
        getBackendUrl() {
            try {
                return (localStorage.getItem(STORAGE_KEY) || "").trim();
            } catch (e) {
                return "";
            }
        },

        /**
         * Set custom backend URL (with protocol normalization).
         */
        setBackendUrl(url) {
            if (!url) {
                localStorage.removeItem(STORAGE_KEY);
                return;
            }
            let clean = url.trim().replace(/\/+$/, "");
            if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
                clean = "https://" + clean;
            }
            localStorage.setItem(STORAGE_KEY, clean);
        },

        /**
         * Remove custom backend URL and revert to relative origin.
         */
        clearBackendUrl() {
            localStorage.removeItem(STORAGE_KEY);
        },

        /**
         * Resolve an HTTP/REST API endpoint.
         * Prepends custom backend URL if configured, otherwise returns relative path.
         */
        apiUrl(endpoint) {
            const base = this.getBackendUrl();
            const path = endpoint.startsWith("/") ? endpoint : "/" + endpoint;
            return base ? (base + path) : path;
        },

        /**
         * Resolve a WebSocket signaling URL.
         */
        wsUrl(endpoint) {
            const base = this.getBackendUrl();
            const path = endpoint.startsWith("/") ? endpoint : "/" + endpoint;
            if (base) {
                const wsBase = base.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:");
                return wsBase + path;
            }
            const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
            return proto + "//" + window.location.host + path;
        },

        /**
         * Test if the backend hardware node is actively responding.
         */
        async checkNodeHealth(timeoutMs = 4000) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const res = await fetch(this.apiUrl("/api/network-info"), {
                    signal: controller.signal,
                    cache: "no-store",
                    headers: { "ngrok-skip-browser-warning": "1" }
                });
                clearTimeout(timer);
                return res.ok;
            } catch (e) {
                clearTimeout(timer);
                return false;
            }
        },

        /**
         * Generates the pre-filled Gmail activation link for Yeshwanth.
         */
        getMailtoLink(featureName = "Live AI Feature") {
            const subject = encodeURIComponent(`[Anavaya Activation Request] Request to turn on GPU Node for ${featureName}`);
            const body = encodeURIComponent(
`Hello Yeshwanth,

I am reviewing the Anavaya Judicial System on the deployed web application (${window.location.origin}) and would like to test the following hardware-dependent feature:

Requested Feature: ${featureName}
Timestamp: ${new Date().toLocaleString()}
Page URL: ${window.location.href}

Please turn on your on-premise GPU server / tunnel so the cloud interface can patch up to your system.

Thank you!`
            );
            return `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;
        },

        /**
         * Display the polished Hardware Node Standby Dialog.
         */
        showStandbyModal(featureName = "AI Copilot / Live Courtroom", opts = {}) {
            let modal = document.getElementById("anavaya-node-modal");
            if (!modal) {
                modal = document.createElement("div");
                modal.id = "anavaya-node-modal";
                modal.className = "node-modal-backdrop";
                document.body.appendChild(modal);
            }

            const currentTunnel = this.getBackendUrl();
            const mailto = this.getMailtoLink(featureName);

            modal.innerHTML = `
                <div class="node-modal-card" role="dialog" aria-modal="true" aria-labelledby="node-modal-title">
                    <div class="node-modal-header">
                        <button type="button" class="node-modal-close-btn" id="node-modal-close" aria-label="Close dialog">✕</button>
                        <div class="node-kicker">
                            <span class="node-kicker-pulse"></span>
                            SOVEREIGN ON-DEVICE NODE · HARDWARE STANDBY
                        </div>
                        <h3 class="node-modal-title" id="node-modal-title">Hardware System in Standby</h3>
                        <div class="node-feature-pill">
                            <span>⚡ Requested:</span>
                            <strong>${featureName}</strong>
                        </div>
                    </div>

                    <div class="node-modal-body">
                        <div class="node-explanation-box">
                            <strong>Why is this node in standby?</strong><br>
                            Anavaya’s AI Copilot (Ollama Qwen 2.5) and Virtual Courtroom (Whisper GPU stenography & Chakshu facial analysis) strictly execute on an on-premise hardware node to safeguard sovereign judicial data and maintain Article 21 compliance without cloud leaks. The local workstation is currently sleeping.
                        </div>

                        <div class="node-action-stack">
                            <a href="${mailto}" target="_blank" rel="noopener noreferrer" class="node-btn-primary" id="node-alert-gmail-btn">
                                <span>✉️ Alert Yeshwanth via Gmail to Turn On Node</span>
                            </a>
                            <div style="font-size: 11.5px; text-align: center; color: var(--text-muted, #64748B);">
                                Direct Email: <strong style="color: #C9A227;">${ADMIN_EMAIL}</strong>
                            </div>

                            <details class="node-admin-accordion" ${currentTunnel ? 'open' : ''}>
                                <summary class="node-admin-summary">⚙️ Administrator: Connect Live Tunnel (ngrok / DuckDNS)</summary>
                                <p style="font-size: 11px; margin: 6px 0; color: var(--text-muted, #64748B);">
                                    If your local server is running with a public tunnel, paste the HTTPS tunnel URL below to patch the cloud UI directly to your machine.
                                </p>
                                <div class="node-tunnel-form">
                                    <input type="url" id="node-tunnel-input" class="node-tunnel-input" placeholder="https://xxxx.ngrok-free.app" value="${currentTunnel}">
                                    <button type="button" id="node-tunnel-save-btn" class="node-tunnel-btn">Connect</button>
                                </div>
                                ${currentTunnel ? '<button type="button" id="node-tunnel-clear-btn" style="background:none;border:none;color:#EF4444;font-size:11px;cursor:pointer;margin-top:6px;padding:0;">Disconnect custom tunnel</button>' : ''}
                            </details>
                        </div>
                    </div>

                    <div class="node-modal-footer">
                        <span class="node-status-badge">
                            <span style="color:#F59E0B;">●</span> Status: Awaiting Hardware Node
                        </span>
                        <button type="button" id="node-dismiss-btn" style="background:none;border:none;color:inherit;font-size:12px;font-weight:600;cursor:pointer;text-decoration:underline;">
                            Explore Cached Dossiers
                        </button>
                    </div>
                </div>
            `;

            // Wire event handlers
            requestAnimationFrame(() => modal.classList.add("active"));

            const close = () => {
                modal.classList.remove("active");
                if (opts.onClose) opts.onClose();
            };

            modal.querySelector("#node-modal-close").addEventListener("click", close);
            modal.querySelector("#node-dismiss-btn").addEventListener("click", close);

            // Tunnel save
            const saveBtn = modal.querySelector("#node-tunnel-save-btn");
            const tunnelInput = modal.querySelector("#node-tunnel-input");
            if (saveBtn && tunnelInput) {
                saveBtn.addEventListener("click", async () => {
                    const url = tunnelInput.value.trim();
                    if (!url) {
                        AnavayaNode.clearBackendUrl();
                        alert("Custom tunnel cleared. Reverting to origin.");
                        close();
                        window.location.reload();
                        return;
                    }
                    saveBtn.textContent = "Connecting…";
                    AnavayaNode.setBackendUrl(url);
                    const online = await AnavayaNode.checkNodeHealth(3000);
                    if (online) {
                        alert("Connection established! Successfully linked to " + url);
                        close();
                        window.location.reload();
                    } else {
                        alert("Tunnel saved, but server did not respond at " + url + ". Please ensure uvicorn/tunnel is active.");
                        saveBtn.textContent = "Retry Connect";
                    }
                });
            }

            const clearBtn = modal.querySelector("#node-tunnel-clear-btn");
            if (clearBtn) {
                clearBtn.addEventListener("click", () => {
                    AnavayaNode.clearBackendUrl();
                    alert("Custom tunnel cleared.");
                    close();
                    window.location.reload();
                });
            }
        },

        closeStandbyModal() {
            const modal = document.getElementById("anavaya-node-modal");
            if (modal) modal.classList.remove("active");
        }
    };

    // ========================================================================
    // GLOBAL FETCH INTERCEPTOR FOR AUTOMATIC TUNNEL REWRITE & RESILIENT FALLBACKS
    // ========================================================================
    const originalFetch = window.fetch;
    window.fetch = async function (input, init) {
        let url = typeof input === "string" ? input : (input && input.url ? input.url : "");
        const isApi = typeof url === "string" && (url.startsWith("/api/") || url.includes("/api/"));

        if (isApi) {
            const backendBase = AnavayaNode.getBackendUrl();
            if (backendBase) {
                // If endpoint starts with /api/, rewrite to custom backend
                const cleanEndpoint = url.startsWith("http") ? new URL(url).pathname : url;
                const rewritten = backendBase.replace(/\/+$/, "") + cleanEndpoint;
                init = init || {};
                init.headers = init.headers || {};
                if (init.headers instanceof Headers) {
                    init.headers.set("ngrok-skip-browser-warning", "1");
                } else if (Array.isArray(init.headers)) {
                    init.headers.push(["ngrok-skip-browser-warning", "1"]);
                } else {
                    init.headers["ngrok-skip-browser-warning"] = "1";
                }
                if (typeof input === "string") {
                    input = rewritten;
                } else if (input && input.url) {
                    input = new Request(rewritten, init || input);
                }
            }
        }

        try {
            const res = await originalFetch.apply(this, [input, init]);
            // If the server answered 404/502/503/504 on a static host without backend:
            if (!res.ok && isApi && (res.status === 404 || res.status >= 500)) {
                throw new Error(`HTTP ${res.status} from backend on ${url}`);
            }
            return res;
        } catch (err) {
            // Check if this is an API call on a static host without active backend
            if (isApi) {
                const endpoint = typeof url === "string" ? (url.startsWith("http") ? new URL(url).pathname : url) : "";

                // 1. Fallback for case-registry
                if (endpoint === "/api/case-registry" || endpoint.endsWith("/api/case-registry")) {
                    try {
                        const fallbackRes = await originalFetch("/dashboard/api/case-registry.json");
                        if (fallbackRes.ok) return fallbackRes;
                    } catch (_) {}
                }

                // 2. Fallback for /api/cases
                if (endpoint === "/api/cases" || endpoint.endsWith("/api/cases")) {
                    try {
                        const fallbackRes = await originalFetch("/dashboard/api/cases.json");
                        if (fallbackRes.ok) return fallbackRes;
                    } catch (_) {}
                }

                // 3. Fallback for /api/delay-precedents
                if (endpoint === "/api/delay-precedents" || endpoint.endsWith("/api/delay-precedents")) {
                    try {
                        const fallbackRes = await originalFetch("/dashboard/api/delay-precedents.json");
                        if (fallbackRes.ok) return fallbackRes;
                    } catch (_) {}
                }

                // 4. Fallback for /api/cases/{caseId}
                const caseMatch = endpoint.match(/\/api\/cases\/([A-Za-z0-9_-]+)$/);
                if (caseMatch) {
                    const cid = caseMatch[1];
                    try {
                        const fallbackRes = await originalFetch(`/dashboard/api/cases/${cid}.json`);
                        if (fallbackRes.ok) return fallbackRes;
                    } catch (_) {}
                }

                // 5. Active triggers for Chatbot & Courtroom
                if (endpoint.includes("/chat")) {
                    AnavayaNode.showStandbyModal("Case AI Copilot (Ollama Qwen 2.5)");
                } else if (endpoint.includes("/court/")) {
                    AnavayaNode.showStandbyModal("Live Virtual Courtroom (WebRTC & Whisper GPU)");
                }
            }
            throw err;
        }
    };

    window.AnavayaNode = AnavayaNode;
})();
