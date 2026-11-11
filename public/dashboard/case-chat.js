/**
 * ANAVAYA CASE AI COPILOT
 * Client-side controller for grounded case intelligence powered by Ollama (qwen2.5:3b).
 * Provides multi-turn case context chat, quick prompt chips, and history persistence.
 */

(function () {
    "use strict";

    // State
    const state = {
        isOpen: false,
        isMinimized: false,
        activeCaseId: null,
        activeCaseTitle: null,
        activeCasePriority: null,
        histories: {}, // { [caseId]: [ { role: 'user'|'assistant', content: string } ] }
        isLoading: false
    };

    // Cache DOM Elements
    let floatBtn, drawer, headerContext, headerPriority, messagesEl, inputForm, inputText, sendBtn;
    let btnClear, btnMin, btnClose, quickChips;

    function init() {
        floatBtn = document.getElementById("case-chat-float-btn");
        drawer = document.getElementById("case-chat-drawer");
        headerContext = document.getElementById("chat-context-case-name");
        headerPriority = document.getElementById("chat-context-priority");
        messagesEl = document.getElementById("chat-messages");
        inputForm = document.getElementById("chat-input-form");
        inputText = document.getElementById("chat-input-text");
        sendBtn = document.getElementById("chat-send-btn");
        btnClear = document.getElementById("chat-btn-clear");
        btnMin = document.getElementById("chat-btn-minimize");
        btnClose = document.getElementById("chat-btn-close");
        quickChips = document.getElementById("chat-quick-chips");

        if (!floatBtn || !drawer) {
            console.warn("[CaseAIChat] Elements not found in DOM during init.");
            return;
        }

        // Attach Event Listeners
        floatBtn.addEventListener("click", () => toggleChat());
        btnClose.addEventListener("click", () => closeChat());
        btnMin.addEventListener("click", () => toggleMinimize());
        btnClear.addEventListener("click", () => clearCurrentHistory());

        inputForm.addEventListener("submit", (e) => {
            e.preventDefault();
            handleSend();
        });

        inputText.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        // Auto-expand textarea
        inputText.addEventListener("input", () => {
            inputText.style.height = "auto";
            inputText.style.height = Math.min(inputText.scrollHeight, 100) + "px";
        });

        // Quick Suggestion Chips
        if (quickChips) {
            quickChips.addEventListener("click", (e) => {
                const chip = e.target.closest(".chat-chip");
                if (chip && chip.dataset.query) {
                    const query = chip.dataset.query;
                    if (state.isLoading) return;
                    inputText.value = query;
                    handleSend();
                }
            });
        }

        // Hook into Workspace & Analysis "Ask Case AI" buttons if present
        document.addEventListener("click", (e) => {
            const askBtn = e.target.closest("#workspace-chat-btn, #case-level-chat-btn, .ask-case-ai-btn");
            if (askBtn) {
                e.preventDefault();
                openChat();
            }
        });

        // Listen for Case Selection changes from AnavayaUI
        syncActiveCaseFromUI();
        setInterval(syncActiveCaseFromUI, 1200);
    }

    /**
     * Resolves currently active case from UI state
     */
    function resolveCurrentCase() {
        let caseId = null;
        let caseTitle = null;
        let priority = null;

        if (window.AnavayaUI && typeof window.AnavayaUI.getCurrentCaseId === "function") {
            caseId = window.AnavayaUI.getCurrentCaseId();
        }

        if (!caseId && window.AnavayaUI && typeof window.AnavayaUI.getSelectedCase === "function") {
            const sc = window.AnavayaUI.getSelectedCase();
            if (sc) {
                caseId = sc.Case_ID || sc.Case_File;
                caseTitle = sc.Case_Title || sc.Case_File;
                priority = sc.Priority;
            }
        }

        // Fallback DOM inspection
        if (!caseId) {
            const wsCaseEl = document.getElementById("workspace-case-id");
            if (wsCaseEl && wsCaseEl.textContent && wsCaseEl.textContent.trim()) {
                caseId = wsCaseEl.textContent.trim();
            }
        }
        if (!caseTitle) {
            const wsTitleEl = document.getElementById("workspace-title");
            if (wsTitleEl && wsTitleEl.textContent && wsTitleEl.textContent.trim()) {
                caseTitle = wsTitleEl.textContent.trim();
            }
        }
        if (!priority) {
            const wsPriEl = document.getElementById("workspace-priority-badge");
            if (wsPriEl && wsPriEl.textContent) {
                priority = wsPriEl.textContent.trim();
            }
        }

        return {
            caseId: caseId || "ANV-2026-0025", // Default to main demo case if not set
            caseTitle: caseTitle || "Active Case Dossier",
            priority: priority || "High"
        };
    }

    /**
     * Periodically or reactively synchronizes the active case state with the UI
     */
    function syncActiveCaseFromUI() {
        const info = resolveCurrentCase();
        if (info.caseId !== state.activeCaseId) {
            setActiveCase(info.caseId, info.caseTitle, info.priority, false);
        }
    }

    /**
     * Sets the active case context for the chat
     */
    function setActiveCase(caseId, title, priority, render = true) {
        if (!caseId) return;
        const changed = state.activeCaseId !== caseId;
        state.activeCaseId = caseId;
        state.activeCaseTitle = title || caseId;
        state.activeCasePriority = priority || "High";

        if (floatBtn) {
            floatBtn.classList.add("active-case");
        }

        if (headerContext) {
            headerContext.textContent = `${state.activeCaseId} · ${state.activeCaseTitle}`;
            headerContext.title = `${state.activeCaseId} - ${state.activeCaseTitle}`;
        }

        if (headerPriority) {
            headerPriority.textContent = state.activeCasePriority;
            headerPriority.className = `chat-context-priority priority-${state.activeCasePriority}`;
            headerPriority.style.display = "inline-block";
        }

        if (!state.histories[caseId]) {
            state.histories[caseId] = [];
        }

        if (render || changed) {
            renderMessages();
        }
    }

    function toggleChat() {
        if (state.isOpen) {
            closeChat();
        } else {
            openChat();
        }
    }

    function openChat(caseInfo) {
        if (caseInfo && caseInfo.caseId) {
            setActiveCase(caseInfo.caseId, caseInfo.caseTitle, caseInfo.priority, true);
        } else {
            const current = resolveCurrentCase();
            setActiveCase(current.caseId, current.caseTitle, current.priority, true);
        }

        state.isOpen = true;
        state.isMinimized = false;
        drawer.classList.add("open");
        drawer.classList.remove("minimized");
        drawer.setAttribute("aria-hidden", "false");

        setTimeout(() => {
            if (inputText) inputText.focus();
            scrollChatToBottom();
        }, 150);
    }

    function closeChat() {
        state.isOpen = false;
        drawer.classList.remove("open");
        drawer.setAttribute("aria-hidden", "true");
    }

    function toggleMinimize() {
        state.isMinimized = !state.isMinimized;
        drawer.classList.toggle("minimized", state.isMinimized);
        if (btnMin) {
            btnMin.innerHTML = state.isMinimized
                ? '<i data-lucide="chevron-up"></i>'
                : '<i data-lucide="chevron-down"></i>';
            if (window.lucide) window.lucide.createIcons();
        }
    }

    function clearCurrentHistory() {
        if (!state.activeCaseId) return;
        state.histories[state.activeCaseId] = [];
        renderMessages();
    }

    /**
     * Renders messages for the active case
     */
    function renderMessages() {
        if (!messagesEl) return;
        const history = state.histories[state.activeCaseId] || [];

        messagesEl.innerHTML = "";

        // Welcome / Intro bubble if history is empty
        if (history.length === 0) {
            const welcomeDiv = document.createElement("div");
            welcomeDiv.className = "chat-msg assistant";
            welcomeDiv.innerHTML = `
                <div class="chat-msg-avatar"><i data-lucide="bot"></i></div>
                <div class="chat-bubble">
                    <p><strong>Case Intelligence Assistant Active</strong></p>
                    <p>I have indexed the complete case dossier, evidence register, and corroborated timeline for <strong>${escapeHtml(state.activeCaseTitle)}</strong> (<code>${escapeHtml(state.activeCaseId)}</code>).</p>
                    <p style="margin-bottom:0; font-size: 0.78rem; color: #7A7263;">Ask me to summarize allegations, detail specific witness statements, inspect timeline contradictions, or explain the Decision Tree priority.</p>
                </div>
            `;
            messagesEl.appendChild(welcomeDiv);
        } else {
            history.forEach((msg) => {
                const msgDiv = document.createElement("div");
                msgDiv.className = `chat-msg ${msg.role}`;
                if (msg.role === "assistant") {
                    msgDiv.innerHTML = `
                        <div class="chat-msg-avatar"><i data-lucide="bot"></i></div>
                        <div class="chat-bubble">${formatMarkdown(msg.content)}</div>
                    `;
                } else {
                    msgDiv.innerHTML = `
                        <div class="chat-msg-avatar"><i data-lucide="user"></i></div>
                        <div class="chat-bubble">${escapeHtml(msg.content)}</div>
                    `;
                }
                messagesEl.appendChild(msgDiv);
            });
        }

        if (window.lucide) {
            window.lucide.createIcons();
        }
        scrollChatToBottom();
    }

    function scrollChatToBottom() {
        if (messagesEl) {
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }
    }

    /**
     * Handles user message submission
     */
    async function handleSend() {
        const text = inputText.value.trim();
        if (!text || state.isLoading) return;

        const currentCaseId = state.activeCaseId || "ANV-2026-0025";
        if (!state.histories[currentCaseId]) {
            state.histories[currentCaseId] = [];
        }

        // Add user message to history
        const userMsg = { role: "user", content: text };
        state.histories[currentCaseId].push(userMsg);
        inputText.value = "";
        inputText.style.height = "auto";

        renderMessages();

        // Show typing indicator
        showTypingIndicator();
        state.isLoading = true;
        sendBtn.disabled = true;

        try {
            // Prepare recent history (last 6 turns)
            const recentHistory = (state.histories[currentCaseId] || [])
                .slice(-7, -1)
                .map(m => ({ role: m.role, content: m.content }));

            const chatUrl = (window.AnavayaNode && typeof window.AnavayaNode.apiUrl === "function")
                ? window.AnavayaNode.apiUrl(`/api/cases/${encodeURIComponent(currentCaseId)}/chat`)
                : `/api/cases/${encodeURIComponent(currentCaseId)}/chat`;

            const response = await fetch(chatUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: text,
                    history: recentHistory
                })
            });

            removeTypingIndicator();

            if (!response.ok) {
                const errData = await response.json().catch(() => ({ detail: "Server error" }));
                throw new Error(errData.detail || `Server responded with ${response.status}`);
            }

            const data = await response.json();
            const replyText = data.reply || "No response received from case assistant.";

            state.histories[currentCaseId].push({
                role: "assistant",
                content: replyText
            });

            renderMessages();
        } catch (err) {
            console.error("[CaseAIChat] Error dispatching message:", err);
            removeTypingIndicator();

            if (window.AnavayaNode && typeof window.AnavayaNode.showStandbyModal === "function") {
                window.AnavayaNode.showStandbyModal("Case AI Copilot (Ollama Qwen 2.5)");
            }

            const adminEmail = (window.AnavayaNode && window.AnavayaNode.ADMIN_EMAIL) || "yeshwanth9750@gmail.com";
            state.histories[currentCaseId].push({
                role: "assistant",
                content: `⚠️ **GPU Hardware Node in Standby:**\n\nThe local Ollama Qwen 2.5 engine is currently sleeping or disconnected from this cloud deployment.\n\n👉 **[Alert Yeshwanth to Turn On System Node](javascript:window.AnavayaNode%26%26window.AnavayaNode.showStandbyModal('Case%20AI%20Copilot'))** or email directly at **${adminEmail}**.`
            });
            renderMessages();
        } finally {
            state.isLoading = false;
            sendBtn.disabled = false;
            if (inputText) inputText.focus();
        }
    }

    function showTypingIndicator() {
        removeTypingIndicator();
        const typingDiv = document.createElement("div");
        typingDiv.className = "chat-msg assistant chat-typing-indicator-row";
        typingDiv.id = "chat-typing-indicator";
        typingDiv.innerHTML = `
            <div class="chat-msg-avatar"><i data-lucide="bot"></i></div>
            <div class="chat-typing">
                <span class="chat-typing-dot"></span>
                <span class="chat-typing-dot"></span>
                <span class="chat-typing-dot"></span>
            </div>
        `;
        messagesEl.appendChild(typingDiv);
        if (window.lucide) window.lucide.createIcons();
        scrollChatToBottom();
    }

    function removeTypingIndicator() {
        const el = document.getElementById("chat-typing-indicator");
        if (el) el.remove();
    }

    /**
     * Minimal safe Markdown to HTML converter
     */
    function formatMarkdown(text) {
        if (!text) return "";
        let escaped = escapeHtml(text);

        // Bold **text**
        escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

        // Italic *text*
        escaped = escaped.replace(/\*(.*?)\*/g, "<em>$1</em>");

        // Code `text`
        escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");

        // Bullet lists: lines starting with "- " or "* "
        const lines = escaped.split("\n");
        let html = "";
        let inList = false;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (line.startsWith("- ") || line.startsWith("* ")) {
                if (!inList) {
                    html += "<ul>";
                    inList = true;
                }
                html += `<li>${line.substring(2)}</li>`;
            } else if (/^\d+\.\s/.test(line)) {
                if (!inList) {
                    html += "<ol>";
                    inList = true;
                }
                const content = line.replace(/^\d+\.\s/, "");
                html += `<li>${content}</li>`;
            } else {
                if (inList) {
                    html += "</ul>";
                    inList = false;
                }
                if (line.length > 0) {
                    html += `<p>${line}</p>`;
                }
            }
        }
        if (inList) {
            html += "</ul>";
        }

        // Highlight Exhibit citations like [EXHIBIT-1], [DOC-01]
        html = html.replace(/\[(DOC-\d+|EXHIBIT-[^\]]+|FIR-\d+)\]/gi, '<span class="exhibit-tag">$1</span>');

        return html;
    }

    function escapeHtml(str) {
        if (!str) return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Expose Global API
    window.CaseAIChat = {
        open: openChat,
        close: closeChat,
        toggle: toggleChat,
        setActiveCase: setActiveCase,
        ask: (promptText) => {
            openChat();
            if (inputText) {
                inputText.value = promptText;
                handleSend();
            }
        }
    };

    // Auto-initialize when DOM ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
