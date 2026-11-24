// BorderGlow's edge proximity and cursor angle, shared by dashboard hover targets.
(() => {
    const motion = window.matchMedia("(any-hover: hover) and (any-pointer: fine) and (prefers-reduced-motion: no-preference)");
    const targets = [
        ".stat-card", ".case-item", ".case-stack-card",
        ".courtroom-card", ".tab-btn",
        ".create-case-btn", ".upload-btn", ".lobby-create-btn",
        ".case-action-btn", ".cc-open", ".cc-copy", ".landing-back-btn"
    ].join(",");
    let active;
    let frame = 0;
    let pointer;

    function clear() {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        if (active) active.removeAttribute("data-border-glow");
        active = null;
    }

    document.addEventListener("pointermove", event => {
        if (!motion.matches || event.pointerType === "touch") return;
        const target = event.target.closest(targets);
        if (target !== active) {
            clear();
            if (!target || target.matches(":disabled, [aria-disabled=true]")) return;
            active = target;
        }
        if (!active) return;
        pointer = event;
        if (frame) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            const { left, top, width, height } = active.getBoundingClientRect();
            if (!width || !height) return;
            const x = pointer.clientX - left - width / 2;
            const y = pointer.clientY - top - height / 2;
            const edge = Math.min(1, Math.max(Math.abs(x) * 2 / width, Math.abs(y) * 2 / height));
            active.style.setProperty("--border-glow-angle", `${Math.atan2(y, x) * 180 / Math.PI + 90}deg`);
            active.style.setProperty("--border-glow-strength", Math.max(0, (edge - 0.55) / 0.45).toFixed(3));
            active.setAttribute("data-border-glow", "");
        });
    }, { passive: true });

    document.addEventListener("pointerout", event => {
        if (active && !active.contains(event.relatedTarget)) clear();
    }, { passive: true });
    window.addEventListener("blur", clear);
    motion.addEventListener("change", clear);
})();
