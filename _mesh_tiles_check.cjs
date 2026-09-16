// Diagnostics: 3-participant courtroom video-mesh check that looks at what the
// BROWSER ACTUALLY PAINTS in each stage tile (not just what the mesh negotiates).
//
// Each client gets its own fake camera file with a distinct solid colour
// (--use-file-for-fake-video-capture), so a tile's rendered pixels say exactly
// whose feed is in it. For every client we report, per stage tile:
//   expected  - the colour of the participant that tile belongs to
//   sampled   - average RGB decoded from the tile's <video> element
//   verdict   - ok / wrong-feed / blank
// plus srcObject track id, videoWidth/Height, readyState, frames decoded.
const { chromium } = require('playwright-core');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8123';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const W = 320, H = 240;

// BT.601 YUV for the three solid colours.
const COLOURS = {
  red:   { y: 81,  u: 90,  v: 240, rgb: [255, 0, 0] },
  green: { y: 145, u: 54,  v: 34,  rgb: [0, 255, 0] },
  blue:  { y: 41,  u: 240, v: 110, rgb: [0, 0, 255] },
};

function writeY4M(file, colour) {
  const chunks = [];
  chunks.push(Buffer.from(`YUV4MPEG2 W${W} H${H} F15:1 Ip A1:1 C420jpeg\n`, 'ascii'));
  const y = Buffer.alloc(W * H, colour.y);
  const u = Buffer.alloc((W / 2) * (H / 2), colour.u);
  const v = Buffer.alloc((W / 2) * (H / 2), colour.v);
  for (let i = 0; i < 10; i++) {
    chunks.push(Buffer.from('FRAME\n', 'ascii'), y, u, v);
  }
  fs.writeFileSync(file, Buffer.concat(chunks));
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'anavaya-y4m-'));
const files = {};
for (const [name, c] of Object.entries(COLOURS)) {
  files[name] = path.join(tmp, `${name}.y4m`);
  writeY4M(files[name], c);
}

const patchPC = () => {
  const Orig = window.RTCPeerConnection;
  window.__pcs = [];
  window.RTCPeerConnection = function (...args) {
    const pc = new Orig(...args);
    window.__pcs.push(pc);
    return pc;
  };
  window.RTCPeerConnection.prototype = Orig.prototype;
};

const join = async (page, name, role) => {
  await page.goto(`${BASE}/court/${process.env.ROOM || ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#join-name', { timeout: 15000 });
  await page.fill('#join-name', name);
  await page.click(`.role-btn[data-role="${role}"]`);
  await page.click('#enter-btn');
  await page.waitForFunction(() => {
    const root = document.getElementById('courtroom-root');
    return root && root.style.display !== 'none';
  }, { timeout: 20000 });
};

// What the browser paints in each stage tile.
const tileReport = (page) => page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const canvas = document.createElement('canvas');
  const sample = (video) => {
    try {
      const w = video.videoWidth, h = video.videoHeight;
      if (!w || !h) return null;
      canvas.width = 32; canvas.height = 24;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4;
      return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
    } catch (e) {
      return 'ERR:' + e.message;
    }
  };
  const one = () => [...document.querySelectorAll('.stage-tile')].map((tile) => {
    const v = tile.querySelector('video');
    const chip = tile.querySelector('.stage-conn');
    const track = v && v.srcObject && v.srcObject.getVideoTracks ? v.srcObject.getVideoTracks()[0] : null;
    let frames = null;
    try { frames = v && v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality().totalVideoFrames : null; } catch (_) {}
    const rect = tile.getBoundingClientRect();
    return {
      pid: tile.dataset.pid,
      hasVideoEl: !!v,
      trackId: track ? track.id : null,
      muted: track ? track.muted : null,
      w: v ? v.videoWidth : null,
      h: v ? v.videoHeight : null,
      readyState: v ? v.readyState : null,
      paused: v ? v.paused : null,
      frames,
      colour: v ? sample(v) : null,
      box: [Math.round(rect.width), Math.round(rect.height)],
      classes: [...tile.classList].filter((c) => c.startsWith('conn-')),
      chip: chip ? chip.textContent : null,
      chipShown: !!(chip && getComputedStyle(chip).display !== 'none'),
    };
  });
  const noticeEl = document.getElementById('media-notice');
  const before = one();
  await sleep(2500);
  const after = one();
  return {
    notice: { present: !!noticeEl, shown: !!(noticeEl && !noticeEl.hidden), text: (document.getElementById('media-notice-text') || {}).textContent || '' },
    tiles: before.map((t, i) => {
      const a = after[i] || {};
      return { ...t, framesDelta: (a.frames ?? 0) - (t.frames ?? 0), colour2: a.colour ?? null };
    }),
  };
});

const rosterNames = (page) => page.evaluate(() => [...document.querySelectorAll('.participant-tile')].map((t) => ({
  pid: t.dataset.pid,
  name: t.querySelector('.tile-name') ? t.querySelector('.tile-name').textContent.trim() : null,
})));

const localTrackId = (page) => page.evaluate(() => {
  for (const pc of window.__pcs || []) {
    for (const s of pc.getSenders()) if (s.track && s.track.kind === 'video') return s.track.id;
  }
  return null;
});

(async () => {
  const launch = (y4m) => chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${y4m}`,
    ],
  });
  const out = { room: null, clients: {}, errors: {}, localTracks: {} };
  let roomId = null;
  const browsers = [];
  try {
    // room
    const boot = await launch(files.red);
    browsers.push(boot);
    const p0 = await boot.newPage();
    await p0.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    const resp = await p0.evaluate(async () => {
      const r = await fetch('/api/court/rooms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_title: 'Mesh tile check' }),
      });
      return r.json();
    });
    roomId = resp.room_id || resp.room?.room_id || resp.id;
    process.env.ROOM = roomId;
    out.room = roomId;

    const specs = [
      ['A', 'Alice Judge', 'Judge', 'red'],
      ['B', 'Bob Prosecutor', 'Prosecution', 'green'],
      ['C', 'Carol Witness', 'Witness', 'blue'],
    ];
    const clients = {};
    for (const [key, name, role, colour] of specs) {
      const browser = await launch(files[colour]);
      browsers.push(browser);
      const ctx = await browser.newContext();
      await ctx.addInitScript(patchPC);
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
      await join(page, name, role);
      clients[key] = { page, colour, name, errors };
      out.errors[key] = errors;
      await page.waitForTimeout(key === 'C' ? 2000 : 2500);
    }
    // Settle: ICE must succeed (or time out) and every client must see the
    // full roster before we sample, otherwise an early read is meaningless.
    await clients.C.page.waitForTimeout(14000);

    for (const key of ['A', 'B', 'C']) {
      out.localTracks[key] = await localTrackId(clients[key].page);
    }
    // pid -> name as each client sees the roster, so we can map tiles to colours.
    const rosters = {};
    for (const key of ['A', 'B', 'C']) rosters[key] = await rosterNames(clients[key].page);
    out.rosters = rosters;
    const pidToName = {};
    for (const key of Object.keys(rosters)) for (const r of rosters[key]) if (r.pid) pidToName[r.pid] = r.name;
    out.pidToName = pidToName;

    const nameToColour = {};
    for (const key of ['A', 'B', 'C']) nameToColour[clients[key].name] = clients[key].colour;
    out.nameToColour = nameToColour;

    for (const key of ['A', 'B', 'C']) {
      const report2 = await tileReport(clients[key].page);
      const tiles = report2.tiles;
      out.notice = out.notice || {};
      out.notice[key] = report2.notice;
      out.clients[key] = tiles.map((t) => {
        const owner = pidToName[t.pid];
        const expected = nameToColour[owner] || (owner ? '?' : 'unknown');
        const c = Array.isArray(t.colour) ? t.colour : null;
        let verdict = 'blank';
        if (c && (c[0] + c[1] + c[2]) > 30) {
          const dim = ['red', 'green', 'blue'].reduce((best, k) => {
            const [er, eg, eb] = COLOURS[k].rgb;
            const dist = Math.abs(c[0] - er) + Math.abs(c[1] - eg) + Math.abs(c[2] - eb);
            return dist < best.dist ? { k, dist } : best;
          }, { k: null, dist: Infinity });
          verdict = dim.k === expected ? 'ok' : `WRONG(${dim.k})`;
        }
        return { ...t, owner, expected, verdict };
      });
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
