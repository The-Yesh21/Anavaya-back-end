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
    const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
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
        async checkNodeHealth(timeoutMs = 8000) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const targetUrl = this.apiUrl("/api/network-info");
                const res = await fetch(targetUrl, {
                    signal: controller.signal,
                    cache: "no-store",
                    headers: { "ngrok-skip-browser-warning": "1" }
                });
                clearTimeout(timer);
                return res.ok;
            } catch (e) {
                clearTimeout(timer);
                console.warn("[AnavayaNode] Health check probe failed:", e);
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
                            <strong>${escapeHtml(featureName)}</strong>
                        </div>
                    </div>

                    <div class="node-modal-body">
                        <div class="node-explanation-box">
                            <strong>Why is this node in standby?</strong><br>
                            Anavaya’s AI Copilot (Ollama Qwen 2.5) and Virtual Courtroom (Whisper GPU stenography & Chakshu facial analysis) strictly execute on an on-premise hardware node to safeguard sovereign judicial data and maintain Article 21 compliance without cloud leaks. The configured backend could not be reached. It may be offline or incorrectly configured.
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
                                    <input type="url" id="node-tunnel-input" class="node-tunnel-input" placeholder="https://xxxx.ngrok-free.app" value="${escapeHtml(currentTunnel)}">
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
                    const online = await AnavayaNode.checkNodeHealth(8000);
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
        const request = input instanceof Request ? input : null;
        const url = new URL(request ? request.url : input, window.location.href);
        if (!url.pathname.startsWith("/api/")) return originalFetch(input, init);

        const endpoint = url.pathname;
        const method = (init?.method || request?.method || "GET").toUpperCase();
        const backendBase = AnavayaNode.getBackendUrl();
        if (backendBase) {
            const rewritten = backendBase.replace(/\/+$/, "") + endpoint + url.search;
            const headers = new Headers(init?.headers || request?.headers);
            headers.set("ngrok-skip-browser-warning", "1");
            input = request ? new Request(rewritten, request) : rewritten;
            init = { ...init, headers };
        }

        let response;
        let failure;
        try {
            response = await originalFetch(input, init);
            const isGatewayFailure = response.status >= 502 && response.status <= 504;
            const isStaticPage = !response.headers.get("content-type")?.includes("json") &&
                (response.status === 404 || response.status === 405 ||
                    response.headers.get("content-type")?.includes("text/html"));
            const isMissingTree = method === "GET" && endpoint === "/api/tree" && response.status === 404;
            if (!isGatewayFailure && !isStaticPage && !isMissingTree) return response;
            if (isGatewayFailure) failure = new Error(`HTTP ${response.status} from backend on ${endpoint}`);
        } catch (err) {
            failure = err;
        }

        if (method === "GET") {
            const caseMatch = endpoint.match(/^\/api\/cases\/([A-Za-z0-9_-]+)$/);
            const demoAsset = {
                "/api/case-registry": "case-registry.json",
                "/api/cases": "cases.json",
                "/api/tree": "tree.json",
                "/api/delay-precedents": "delay-precedents.json"
            }[endpoint] || (caseMatch && `cases/${caseMatch[1]}.json`);
            if (demoAsset) {
                try {
                    const fallback = await originalFetch(`/dashboard/api/${demoAsset}`);
                    if (fallback.ok && fallback.headers.get("content-type")?.includes("json")) return fallback;
                } catch (_) {}
            }
        }

        if (endpoint.includes("/chat")) {
            AnavayaNode.showStandbyModal("Case AI Copilot (Ollama Qwen 2.5)");
        } else if (endpoint.startsWith("/api/court/")) {
            AnavayaNode.showStandbyModal("Live Virtual Courtroom (WebRTC & Whisper GPU)");
        } else if (!["GET", "HEAD", "OPTIONS"].includes(method) &&
            (endpoint === "/api/upload" || endpoint === "/api/cases" || endpoint.startsWith("/api/cases/"))) {
            AnavayaNode.showStandbyModal("Live Case Workspace");
        }

        if (failure) throw failure;
        return response;
    };

    window.AnavayaNode = AnavayaNode;
})();
