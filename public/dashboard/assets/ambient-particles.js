// Ambient depth, drift, twinkle and pointer parallax, inspired by React Bits Particles.
export function mountParticles(canvas, { waitForDashboard = false } = {}) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};

    const root = document.documentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const palette = {
        dark: ["#e4bd74", "#f4e8d1", "#d56b78"],
        light: ["#886222", "#aa7840", "#a33f53"]
    };
    const points = Array.from({ length: 84 }, () => ({
        x: Math.random(),
        y: Math.random(),
        depth: Math.random(),
        phase: Math.random() * Math.PI * 2,
        color: Math.floor(Math.random() * 3)
    }));
    let width = 0;
    let height = 0;
    let frame = 0;
    let previousTime = 0;
    let time = 0;
    let visible = false;
    let dark = false;
    let pointerX = 0;
    let pointerY = 0;
    let offsetX = 0;
    let offsetY = 0;

    function draw() {
        ctx.clearRect(0, 0, width, height);
        const colors = dark ? palette.dark : palette.light;
        const animated = !reducedMotion.matches;
        const count = width < 600 ? 34 : points.length;
        for (let i = 0; i < count; i++) {
            const p = points[i];
            const depth = 0.35 + p.depth * 0.65;
            const drift = animated ? time * (3 + depth * 5) : 0;
            const x = p.x * width + (animated ? Math.sin(time * 0.3 + p.phase) * 6 - offsetX * depth : 0);
            const y = ((p.y * height - drift - (animated ? offsetY * depth : 0)) % height + height) % height;
            const radius = 0.55 + p.depth * 1.27;
            const twinkle = animated ? 0.72 + 0.28 * Math.cos(time * 1.6 + p.phase) : 0.8;
            const alpha = (dark ? 0.52 : 0.38) * depth * twinkle;
            ctx.fillStyle = colors[p.color];
            if (p.depth > 0.82) {
                ctx.globalAlpha = alpha * 0.22;
                ctx.beginPath();
                ctx.arc(x, y, radius * 2.25, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function tick(now) {
        frame = requestAnimationFrame(tick);
        const elapsed = now - previousTime;
        if (elapsed < 32) return;
        previousTime = now;
        time += Math.min(elapsed, 65) / 1000;
        offsetX += (pointerX - offsetX) * 0.12;
        offsetY += (pointerY - offsetY) * 0.12;
        draw();
    }

    function refresh() {
        dark = root.classList.contains("dark") || root.dataset.theme === "dark";
        const ready = width > 0 && height > 0 && visible && !document.hidden &&
            (!waitForDashboard || root.classList.contains("dashboard-ready"));
        if (ready && !reducedMotion.matches) {
            if (!frame) {
                draw();
                previousTime = performance.now();
                frame = requestAnimationFrame(tick);
            }
        } else {
            if (frame) cancelAnimationFrame(frame);
            frame = 0;
            if (ready) draw();
        }
    }

    function resize() {
        width = canvas.clientWidth;
        height = canvas.clientHeight;
        const scale = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        refresh();
    }

    function pointer(event) {
        if (!frame || event.pointerType === "touch") return;
        pointerX = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 34;
        pointerY = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 24;
    }

    function resetPointer() {
        pointerX = 0;
        pointerY = 0;
    }

    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(canvas);
    const viewportObserver = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        refresh();
    });
    viewportObserver.observe(canvas);
    const themeObserver = new MutationObserver(refresh);
    themeObserver.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pointermove", pointer, { passive: true });
    root.addEventListener("pointerleave", resetPointer);
    reducedMotion.addEventListener("change", refresh);

    return () => {
        if (frame) cancelAnimationFrame(frame);
        sizeObserver.disconnect();
        viewportObserver.disconnect();
        themeObserver.disconnect();
        document.removeEventListener("visibilitychange", refresh);
        window.removeEventListener("pointermove", pointer);
        root.removeEventListener("pointerleave", resetPointer);
        reducedMotion.removeEventListener("change", refresh);
    };
}
