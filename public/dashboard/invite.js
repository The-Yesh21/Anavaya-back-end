/* ============================================================
   Shared helper — courtroom invite links
   When the dashboard is opened via localhost/127.0.0.1, a copied
   invite link must point at this machine's LAN IP, otherwise a
   phone on the same network would resolve "localhost" to itself
   and fail to connect ("This site can't be reached").
   ============================================================ */

async function buildInviteUrl(roomId) {
    const origin = window.location.origin;
    const hostname = window.location.hostname;
    const isLoopback = !hostname
        || hostname === "localhost"
        || hostname === "127.0.0.1"
        || hostname === "::1"
        || hostname === "0.0.0.0";

    // Already reachable from other devices (LAN IP, domain, ...) — use as-is.
    if (!isLoopback) return `${origin}/court/${roomId}`;

    try {
        const res = await fetch("/api/court/invite-info");
        if (res.ok) {
            const data = await res.json();
            const ip = data && data.lan_ip;
            if (ip && ip !== "127.0.0.1") {
                const scheme = window.location.protocol === "https:" ? "https:" : "http:";
                const port = window.location.port ? `:${window.location.port}` : "";
                return `${scheme}//${ip}${port}/court/${roomId}`;
            }
        }
    } catch (e) {
        console.error("Could not resolve LAN IP for invite link:", e);
    }

    // Fallback: keep the current origin.
    return `${origin}/court/${roomId}`;
}

/* ============================================================
   Shared theme switch — light / dark, OS-aware, persisted.
   The inline <head> boot script already set documentElement.dataset.theme
   before first paint (no FOUC). Here we wire the header toggle, persist the
   choice, keep the button icon in sync, and broadcast `anavaya:themechange`
   so JS-drawn UI (the D3 tree, the courtroom roster, gauges…) can re-read
   its colours and redraw. Loaded by BOTH pages before their page script.
   ============================================================ */
const THEME_STORAGE_KEY = 'anavaya-theme';

/* The active theme, straight off <html data-theme>. */
function currentTheme() {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/* Read a CSS custom property off :root. Lets JS-drawn colour (SVG/canvas)
   follow the active theme instead of hardcoding hexes — used across app.js /
   courtroom.js so a theme flip re-skins everything, not just the CSS. */
function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* Point the toggle at the theme you'd switch TO (moon in light, sun in dark).
   Rebuild the <i> each time: after lucide.createIcons() the <i data-lucide>
   has become an <svg>, so we can't just flip an attribute. */
function syncThemeToggleIcon(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;
    const next = theme === 'dark' ? 'sun' : 'moon';
    btn.innerHTML = '<i data-lucide="' + next + '"></i>';
    if (window.lucide && lucide.createIcons) lucide.createIcons();
    const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
}

/* Apply a theme: flip the attribute + color-scheme, optionally persist, sync the
   icon, and notify JS-drawn UI. `persist` is true for an explicit user choice,
   false when merely following an OS change. */
function applyTheme(theme, persist) {
    const t = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
    document.documentElement.style.colorScheme = t;
    if (persist) {
        try { localStorage.setItem(THEME_STORAGE_KEY, t); } catch (e) { /* private mode */ }
    }
    syncThemeToggleIcon(t);
    document.dispatchEvent(new CustomEvent('anavaya:themechange', { detail: { theme: t } }));
}

function initThemeToggle() {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;
    // HTML ships the moon icon (light default); if we booted into dark, show the sun.
    if (currentTheme() === 'dark') {
        syncThemeToggleIcon('dark');
    } else {
        btn.setAttribute('aria-pressed', 'false');
    }
    btn.addEventListener('click', function () {
        applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
    });
    // While the user hasn't chosen explicitly, keep following the OS preference live.
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
            let saved = null;
            try { saved = localStorage.getItem(THEME_STORAGE_KEY); } catch (_) { /* ignore */ }
            if (saved !== 'dark' && saved !== 'light') {
                applyTheme(e.matches ? 'dark' : 'light', false);
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeToggle);
} else {
    initThemeToggle();
}
