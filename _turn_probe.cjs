// Diagnostics: does the configured TURN actually produce a relay candidate?
// A courtroom participant on another network (or mobile data / CGNAT) can only
// connect through a relay; if gathering yields no candidate of type "relay"
// the room silently goes blank for exactly that participant.
const { chromium } = require('playwright-core');

const BASE = process.env.BASE || 'http://127.0.0.1:8123';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const page = await browser.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  const out = await page.evaluate(async () => {
    const gather = async (iceServers, policy) => {
      const pc = new RTCPeerConnection(policy ? { iceServers, iceTransportPolicy: policy } : { iceServers });
      pc.createDataChannel('probe');
      await pc.setLocalDescription(await pc.createOffer());
      const seen = [];
      await new Promise((res) => {
        const t0 = Date.now();
        pc.onicecandidate = (e) => {
          if (e.candidate) seen.push(`${e.candidate.type}/${e.candidate.protocol} ${(e.candidate.address || '').slice(0, 40)}`);
          if (!e.candidate || Date.now() - t0 > 12000) res();
        };
        setTimeout(res, 12000);
      });
      pc.close();
      return seen;
    };
    const creds = await (await fetch('/api/court/turn-credentials', { cache: 'no-store' })).json().catch((e) => ({ error: String(e) }));
    const staticCfg = await (await fetch('/api/court/rtc-config', { cache: 'no-store' })).json();
    const turnOnly = (staticCfg.iceServers || []).filter((s) => JSON.stringify(s).includes('turn'));
    return {
      dynamicCreds: { enabled: creds.enabled, count: (creds.iceServers || []).length, error: creds.error || null,
                      urls: (creds.iceServers || []).map((s) => s.urls) },
      staticTurnServers: turnOnly.map((s) => ({ urls: s.urls, hasCreds: !!s.credential, username: s.username || null })),
      all: await gather(staticCfg.iceServers || []),
      relayOnly: turnOnly.length ? await gather(turnOnly, 'relay') : null,
    };
  });
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
