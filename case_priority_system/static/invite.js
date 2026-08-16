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
