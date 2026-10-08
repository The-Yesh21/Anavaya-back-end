// Diagnostics: verifies the courtroom fixes in a REAL browser against a running
// stack (default: the ngrok URL; override with BASE):
//   1. Four members join one room (Judge + Prosecution + Defence + Witness) —
//      i.e. the join screen no longer blocks the 4th member.
//   2. The join card disables ONLY an already-taken Judge.
//   3. Face & Expression panel is visible for the Judge and hidden for everyone
//      else.
//   4. The live-transcript on/off control is Judge-only, and toggling it is
//      reflected room-wide (off-note shown to every client).
//
// Uses playwright-core + the system Chrome with fake media devices.
const { chromium } = require('playwright-core');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = (process.env.BASE || 'https://overreach-headrest-gosling.ngrok-free.dev').replace(/\/$/, '');
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const NGROK = BASE.includes('ngrok');
// ngrok's free tier shows a browser-warning interstitial unless this header is
// present; it applies to page loads and XHR/fetch from the context.
const EXTRA_HEADERS = NGROK ? { 'ngrok-skip-browser-warning': 'true' } : {};

const W = 320, H = 240;
function writeY4M(file) {
  const chunks = [Buffer.from(`YUV4MPEG2 W${W} H${H} F15:1 Ip A1:1 C420jpeg\n`, 'ascii')];
  const y = Buffer.alloc(W * H, 128), u = Buffer.alloc((W / 2) * (H / 2), 128), v = Buffer.alloc((W / 2) * (H / 2), 128);
  for (let i = 0; i < 5; i++) chunks.push(Buffer.from('FRAME\n', 'ascii'), y, u, v);
  fs.writeFileSync(file, Buffer.concat(chunks));
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'anavaya-verify-'));
const fakeVideo = path.join(tmp, 'fake.y4m');
writeY4M(fakeVideo);

const launch = () => chromium.launch({
  headless: true,
  executablePath: CHROME,
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${fakeVideo}`,
  ],
});

async function join(page, roomId, name, role) {
  await page.goto(`${BASE}/court/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('#join-name', { timeout: 20000 });
  await page.fill('#join-name', name);
  await page.click(`.role-btn[data-role="${role}"]`);
  await page.click('#enter-btn');
  await page.waitForFunction(() => {
    const root = document.getElementById('courtroom-root');
    return root && root.style.display !== 'none';
  }, { timeout: 25000 });
}

const uistate = (page) => page.evaluate(() => {
  const vis = (id) => {
    const el = document.getElementById(id);
    if (!el) return 'missing';
    const s = getComputedStyle(el);
    return (s.display !== 'none' && s.visibility !== 'hidden') ? 'visible' : 'hidden';
  };
  return {
    role: (document.getElementById('you-are-role') || {}).textContent || '',
    facePanel: vis('face-analysis'),
    transcriptPower: vis('transcript-power-btn'),
    offNote: vis('transcript-off-note'),
    roster: [...document.querySelectorAll('.participant-tile .tile-name')].map((n) => n.textContent.trim()),
    powerLabel: (document.querySelector('#transcript-power-btn .btn-label') || {}).textContent || '',
  };
});

(async () => {
  const out = { base: BASE, room: null, joined: {}, ui: {}, joinCard: null, errors: {} };
  let roomId = null;
  const browsers = [];
  const clients = [];
  try {
    const boot = await launch(); browsers.push(boot);
    const bctx = await boot.newContext({ extraHTTPHeaders: EXTRA_HEADERS });
    const bootPage = await bctx.newPage();
    await bootPage.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const resp = await bootPage.evaluate(async () => {
      const r = await fetch('/api/court/rooms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_title: 'Live fixes verification' }),
      });
      return r.json();
    });
    roomId = resp.room_id; out.room = roomId;

    const specs = [
      ['Judge', 'Judge Verify', 'Judge'],
      ['Prosecution', 'Pros Verify', 'Prosecution'],
      ['Defence', 'Def Verify', 'Defence'],
      ['Witness', 'Wit Verify', 'Witness'],
    ];
    for (const [key, name, role] of specs) {
      const browser = await launch(); browsers.push(browser);
      const ctx = await browser.newContext({ extraHTTPHeaders: EXTRA_HEADERS });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e.message)));
      page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
      try {
        await join(page, roomId, name, role);
        out.joined[key] = 'ok';
      } catch (e) {
        out.joined[key] = 'FAILED: ' + String(e.message).split('\n')[0];
      }
      out.errors[key] = errs;
      clients.push({ key, page });
      await page.waitForTimeout(1000);
    }

    await clients[clients.length - 1].page.waitForTimeout(6000);

    for (const c of clients) out.ui[c.key] = await uistate(c.page);

    // Judge turns the live transcript OFF -> every client should see the note.
    const judge = clients.find((c) => c.key === 'Judge');
    if (judge) {
      try {
        await judge.page.click('#transcript-power-btn');
        await judge.page.waitForTimeout(1500);
        out.transcriptToggle = {};
        for (const c of clients) {
          const s = await uistate(c.page);
          out.transcriptToggle[c.key] = { offNote: s.offNote, powerLabel: s.powerLabel };
        }
      } catch (e) { out.transcriptToggle = 'FAILED: ' + e.message.split('\n')[0]; }
    }

    // A fresh join card: only the Judge role should be disabled.
    const probeContext = await browsers[0].newContext({ extraHTTPHeaders: EXTRA_HEADERS });
    const probe = await probeContext.newPage();
    await probe.goto(`${BASE}/court/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await probe.waitForSelector('.role-btn[data-role="Judge"]', { timeout: 20000 });
    out.joinCard = await probe.evaluate(() => {
      const o = {};
      for (const btn of document.querySelectorAll('.role-btn')) {
        o[btn.dataset.role] = { disabled: btn.disabled, taken: !!btn.querySelector('.role-taken') };
      }
      return o;
    });
    await probeContext.close();
  } catch (e) {
    out.fatal = String(e.message).split('\n')[0];
  } finally {
    if (roomId && browsers[0]) {
      try {
        const p = await browsers[0].newPage();
        await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await p.evaluate((id) => fetch(`/api/court/rooms/${id}`, { method: 'DELETE' }), roomId);
      } catch (_) {}
    }
    for (const b of browsers) { try { await b.close(); } catch (_) {} }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.error('HARNESS FAIL:', e); process.exit(1); });
