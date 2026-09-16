// 3-participant courtroom video mesh verification.
// Joins 3 headless Chrome clients (fake camera+mic) to a real room and measures,
// for every ordered pair (A hears/sees B), whether media actually flows:
//   audio: inbound-rtp [audio] totalAudioEnergy delta > 0   (real decoded audio energy)
//   video: inbound-rtp [video] framesDecoded delta > 0      (real decoded frames)
// plus the negotiated audio/video m-line direction on each side.
const { chromium } = require('playwright-core');

const BASE = process.env.BASE || 'http://127.0.0.1:8123';
const ROOM = process.env.ROOM;

const evalInit = () => {
  // No getUserMedia stub — we rely on Chrome's --use-fake-device-for-media-stream
  // (a continuously animating source), which cannot be timer-throttled the way a
  // canvas captureStream is in headless tabs.
};

const join = async (ctx, name, role) => {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.addInitScript(evalInit);
  await page.goto(`${BASE}/court/${ROOM}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#join-name', { timeout: 15000 });
  await page.fill('#join-name', name);
  await page.click(`.role-btn[data-role="${role}"]`);
  await page.click('#enter-btn');
  // Wait until actually in the room (join overlay hidden).
  await page.waitForFunction(() => {
    const root = document.getElementById('courtroom-root');
    return root && root.style.display !== 'none';
  }, { timeout: 20000 }).catch(async (e) => {
    const dbg = await page.evaluate(() => ({
      rootHidden: document.getElementById('courtroom-root')?.style.display,
      joinErr: document.querySelector('#join-error')?.textContent || null,
      nameVal: document.getElementById('join-name')?.value,
    })).catch(() => ({}));
    throw new Error('join timeout: ' + JSON.stringify(dbg));
  });
  return { page, errors };
};

const stats = async (page) => page.evaluate(async () => {
  const pcs = (window.__pcs = window.__pcs || []);
  const out = [];
  for (const pc of pcs) {
    const rec = {
      conn: pc.connectionState, ice: pc.iceConnectionState, sig: pc.signalingState,
      iceServers: (pc.getConfiguration().iceServers || []).map((s) => Array.isArray(s.urls) ? s.urls.join('|') : String(s.urls)).slice(0, 4),
      txs: pc.getTransceivers().map((t) => ({
        mid: t.mid,
        kind: (t.receiver && t.receiver.track && t.receiver.track.kind) || (t.sender && t.sender.track && t.sender.track.kind) || '?',
        dir: t.direction, cur: t.currentDirection,
        sending: !!(t.sender && t.sender.track),
      })),
      recvV: pc.getReceivers().filter((r) => r.track && r.track.kind === 'video').map((r) => ({ muted: r.track.muted, enabled: r.track.enabled, ready: r.track.readyState })),
      out: {}, inA: 0, inV: 0,
    };
    const s = await pc.getStats();
    s.forEach((r) => {
      if (r.type === 'outbound-rtp') rec.out[r.kind || r.mediaType] = r.bytesSent || 0;
      if (r.type === 'inbound-rtp') {
        if ((r.kind || r.mediaType) === 'audio') rec.inA = (r.totalAudioEnergy || 0);
        if ((r.kind || r.mediaType) === 'video') rec.inV = (r.framesDecoded || 0);
      }
    });
    out.push(rec);
  }
  return out;
});

// Instrument: expose all RTCPeerConnections. We patch the constructor before app scripts run.
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

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  });
  const results = {};
  let roomId = process.env.ROOM || null;
  try {
    if (!roomId) {
      // Create room via API
      const ctx0 = await browser.newContext();
      const p0 = await ctx0.newPage();
      await p0.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      const resp = await p0.evaluate(async () => {
        const r = await fetch('/api/court/rooms', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ case_title: 'Mesh video verify' }),
        });
        return r.json();
      });
      roomId = resp.room_id || resp.room?.room_id || resp.id;
    }
    console.log('ROOM=' + roomId);

    const ctxA = await browser.newContext();
    await ctxA.addInitScript(patchPC);
    const A = await join(ctxA, 'Alice Judge', 'Judge');
    await A.page.waitForTimeout(2500);

    const ctxB = await browser.newContext();
    await ctxB.addInitScript(patchPC);
    const B = await join(ctxB, 'Bob Prosecutor', 'Prosecution');
    await B.page.waitForTimeout(4000);

    const ctxC = await browser.newContext();
    await ctxC.addInitScript(patchPC);
    const C = await join(ctxC, 'Carol Witness', 'Witness');
    await C.page.waitForTimeout(6000);

    // Sample twice, 3 s apart, per client: [before, after] per inbound-rtp
    const snap = async (cl) => {
    const s1 = await stats(cl.page);
    await cl.page.waitForTimeout(3000);
    const s2 = await stats(cl.page);
    return s1.map((r, i) => ({
      ...r,
      outA: (s2[i]?.out?.audio ?? 0) - (r.out?.audio ?? 0),
      outV: (s2[i]?.out?.video ?? 0) - (r.out?.video ?? 0),
      aEnergyDelta: +((s2[i]?.inA ?? 0) - (r.inA ?? 0)).toFixed(6),
      vFramesDelta: (s2[i]?.inV ?? 0) - (r.inV ?? 0),
    }));
    };
    results.A = await snap(A);
    results.B = await snap(B);
    results.C = await snap(C);

    // Tile rendering check on C (should see 3 stage tiles)
    results.tiles = await C.page.evaluate(() => ({
      stage: [...document.querySelectorAll('.stage-tile')].map((t) => t.dataset.pid),
      withVideo: [...document.querySelectorAll('.stage-tile video')].filter((v) => v.srcObject).length,
    }));

    results.errors = { A: A.errors, B: B.errors, C: C.errors };

    // TURN probe: can a TURN-only peer connection gather a relay candidate?
    // (Proves the Metered credentials in courtroom_turn.json actually authenticate.)
    try {
      const ctxT = await browser.newContext();
      const pT = await ctxT.newPage();
      await pT.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      results.turn = await pT.evaluate(async () => {
        const cfg = await (await fetch('/api/court/rtc-config')).json();
        const turnOnly = (cfg.iceServers || []).filter((s) => JSON.stringify(s).includes('turn'));
        if (!turnOnly.length) return { configured: false };
        const pc = new RTCPeerConnection({ iceServers: turnOnly, iceTransportPolicy: 'relay' });
        pc.createDataChannel('probe');
        await pc.setLocalDescription(await pc.createOffer());
        const types = new Set();
        await new Promise((res) => {
          const t0 = Date.now();
          pc.onicecandidate = (e) => {
            if (e.candidate) types.add(e.candidate.protocol + ':' + e.candidate.type);
            if (!e.candidate || Date.now() - t0 > 8000) res();
          };
          setTimeout(res, 8000);
        });
        pc.close();
        return { configured: true, serverCount: turnOnly.length, candidateTypes: [...types] };
      });
      await ctxT.close();
    } catch (e) {
      results.turn = { error: String(e.message) };
    }
  } finally {
    // cleanup room
    if (roomId) {
      try {
        const ctx = await browser.newContext();
        const p = await ctx.newPage();
        await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
        await p.evaluate(async (id) => {
          await fetch(`/api/court/rooms/${id}`, { method: 'DELETE' });
        }, roomId);
        await ctx.close();
      } catch (_) {}
    }
    await browser.close();
  }
  console.log(JSON.stringify(results, null, 2));
})().catch((e) => { console.error('HARNESS FAIL:', e); process.exit(1); });
