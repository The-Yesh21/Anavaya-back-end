// Diagnostics: same 3-participant check, but one client is forced to relay-only
// ICE — the situation of a participant who joins from another network / mobile
// data (CGNAT), who therefore cannot be reached by host or srflx candidates.
// RELAY_ONLY=A|B|C selects the client (default C, the newest joiner).
const { chromium } = require('playwright-core');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8123';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const RELAY_ONLY = (process.env.RELAY_ONLY || 'C').toUpperCase();

const W = 320, H = 240;
const COLOURS = {
  red:   { y: 81,  u: 90,  v: 240, rgb: [255, 0, 0] },
  green: { y: 145, u: 54,  v: 34,  rgb: [0, 255, 0] },
  blue:  { y: 41,  u: 240, v: 110, rgb: [0, 0, 255] },
};

function writeY4M(file, colour) {
  const chunks = [Buffer.from(`YUV4MPEG2 W${W} H${H} F15:1 Ip A1:1 C420jpeg\n`, 'ascii')];
  const y = Buffer.alloc(W * H, colour.y);
  const u = Buffer.alloc((W / 2) * (H / 2), colour.u);
  const v = Buffer.alloc((W / 2) * (H / 2), colour.v);
  for (let i = 0; i < 10; i++) chunks.push(Buffer.from('FRAME\n', 'ascii'), y, u, v);
  fs.writeFileSync(file, Buffer.concat(chunks));
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'anavaya-y4m-'));
const files = {};
for (const [name, c] of Object.entries(COLOURS)) { files[name] = path.join(tmp, `${name}.y4m`); writeY4M(files[name], c); }

// Patch RTCPeerConnection so we can (a) inspect connections and (b) optionally
// force relay-only ICE (plus report the resulting connection state).
const patchPC = (relayOnly) => {
  const Orig = window.RTCPeerConnection;
  window.__pcs = [];
  window.__offers = 0;
  const origOffer = Orig.prototype.createOffer;
  Orig.prototype.createOffer = function (...a) {
    window.__offers++;
    return origOffer.apply(this, a);
  };
  window.__sent = {};
  const origSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    try {
      const m = JSON.parse(data);
      if (m && m.type) window.__sent[m.type] = (window.__sent[m.type] || 0) + 1;
    } catch (_) {}
    return origSend.call(this, data);
  };
  window.__relayOnly = !!relayOnly;
  window.RTCPeerConnection = function (cfg, ...rest) {
    const merged = { ...(cfg || {}) };
    if (relayOnly) merged.iceTransportPolicy = 'relay';
    const pc = new Orig(merged, ...rest);
    window.__pcs.push(pc);
    return pc;
  };
  window.RTCPeerConnection.prototype = Orig.prototype;
};

const join = async (page, name, role, room) => {
  await page.goto(`${BASE}/court/${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#join-name', { timeout: 15000 });
  await page.fill('#join-name', name);
  await page.click(`.role-btn[data-role="${role}"]`);
  await page.click('#enter-btn');
  await page.waitForFunction(() => {
    const root = document.getElementById('courtroom-root');
    return root && root.style.display !== 'none';
  }, { timeout: 20000 });
};

const report = (page) => page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const canvas = document.createElement('canvas');
  const sample = (video) => {
    try {
      if (!video.videoWidth) return null;
      canvas.width = 32; canvas.height = 24;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, 32, 24);
      const d = ctx.getImageData(0, 0, 32, 24).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4;
      return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
    } catch (e) { return 'ERR'; }
  };
  const snap = () => [...document.querySelectorAll('.stage-tile')].map((tile) => {
    const v = tile.querySelector('video');
    const name = tile.querySelector('.stage-name') ? tile.querySelector('.stage-name').textContent.trim() : null;
    const chip = tile.querySelector('.stage-conn');
    return {
      pid: tile.dataset.pid, name,
      colour: v ? sample(v) : null, w: v ? v.videoWidth : null,
      chip: chip ? chip.textContent : null,
      chipShown: !!(chip && getComputedStyle(chip).display !== 'none'),
      classes: [...tile.classList].filter((c) => c.startsWith('conn-')),
    };
  });
  const notice = () => {
    const n = document.getElementById('media-notice');
    if (!n) return { present: false };
    return {
      present: true,
      hidden: n.hidden,
      shown: getComputedStyle(n).display !== 'none',
      text: (document.getElementById('media-notice-text') || {}).textContent || '',
      retry: !!document.getElementById('media-retry-btn'),
    };
  };
  const a = snap();
  const pcs = (window.__pcs || []).map((pc) => ({ conn: pc.connectionState, ice: pc.iceConnectionState }));
  await sleep(2000);
  const b = snap();
  return {
    tiles: a.map((t, i) => ({ ...t, colour2: (b[i] || {}).colour ?? null })),
    pcs, relayOnly: !!window.__relayOnly, notice: notice(),
  };
});

(async () => {
  const launch = (y4m) => chromium.launch({
    headless: true, executablePath: CHROME,
    args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream',
           '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${y4m}`],
  });
  const out = { relayOnlyClient: RELAY_ONLY, clients: {} };
  const errorsByClient = {};
  const browsers = [];
  let roomId = null;
  try {
    const boot = await launch(files.red);
    browsers.push(boot);
    const p0 = await boot.newPage();
    await p0.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    const resp = await p0.evaluate(async () => {
      const r = await fetch('/api/court/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_title: 'Relay-only joiner check' }) });
      return r.json();
    });
    roomId = resp.room_id || resp.room?.room_id || resp.id;
    out.room = roomId;

    const specs = [['A', 'Alice Judge', 'Judge', 'red'], ['B', 'Bob Prosecutor', 'Prosecution', 'green'], ['C', 'Carol Witness', 'Witness', 'blue']];
    for (const [key, name, role, colour] of specs) {
      const browser = await launch(files[colour]);
      browsers.push(browser);
      const ctx = await browser.newContext();
      await ctx.addInitScript(patchPC, key === RELAY_ONLY);
      const page = await ctx.newPage();
      errorsByClient[key] = [];
      page.on('pageerror', (e) => errorsByClient[key].push(String(e.message)));
      await join(page, name, role, roomId);
      out.clients[key] = { colour, name, page };
      await page.waitForTimeout(key === 'C' ? 2000 : 2500);
    }
    // Let the mesh settle (ICE has to fail before the UI reports it) and only
    // then read every client, so A and B see the full roster too.
    await out.clients.C.page.waitForTimeout(12000);

    // The notice's Retry must re-drive the failed connections without throwing.
    out.retry = await out.clients.C.page.evaluate(async () => {
      const btn = document.getElementById('media-retry-btn');
      if (!btn) return { clicked: false, reason: 'no button' };
      const before = (window.__pcs || []).map((pc) => pc.signalingState);
      const offersBefore = window.__offers;
      const sentBefore = JSON.stringify(window.__sent);
      btn.click();
      await new Promise((r) => setTimeout(r, 3500));
      const toastEl = document.querySelector('.toast');
      return {
        clicked: true,
        statesBefore: before,
        statesAfter: (window.__pcs || []).map((pc) => pc.signalingState),
        offersBefore,
        offersAfter: window.__offers,
        sentBefore,
        sentAfter: JSON.stringify(window.__sent),
        toast: toastEl ? toastEl.textContent.trim() : null,
        noticeShown: !document.getElementById('media-notice').hidden,
      };
    });

    for (const key of ['A', 'B', 'C']) {
      out.clients[key].result = await report(out.clients[key].page);
      out.clients[key].pageErrors = errorsByClient[key];
      delete out.clients[key].page;
    }
  } finally {
    if (roomId) {
      try {
        const b = browsers[0];
        const p = await b.newPage();
        await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
        await p.evaluate((id) => fetch(`/api/court/rooms/${id}`, { method: 'DELETE' }), roomId);
      } catch (_) {}
    }
    for (const b of browsers) { try { await b.close(); } catch (_) {} }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.error('HARNESS FAIL:', e); process.exit(1); });
