// Layout check for the courtroom media notice: it must fit the stage column,
// wrap its text, and never cause horizontal overflow — in both themes.
const { chromium } = require('playwright-core');

const BASE = process.env.BASE || 'http://127.0.0.1:8123';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream',
           '--use-fake-device-for-media-stream'],
  });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  const roomId = await page.evaluate(async () => {
    const r = await fetch('/api/court/rooms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_title: 'Media notice layout check' }),
    });
    const j = await r.json();
    return j.room_id || j.id;
  });
  await page.goto(`${BASE}/court/${roomId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#join-name', { timeout: 15000 });
  await page.fill('#join-name', 'Layout Judge');
  await page.click('.role-btn[data-role="Judge"]');
  await page.click('#enter-btn');
  await page.waitForFunction(() => {
    const root = document.getElementById('courtroom-root');
    return root && root.style.display !== 'none';
  }, { timeout: 20000 });

  const results = [];
  const TEXT = 'No media connection with Alice Judge, Bob Prosecutor +2 more — their video and voice can\u2019t reach you. The configured TURN relay isn\u2019t answering, so a participant on another network or mobile data can\u2019t connect — retry, use the same network, or check the relay credentials.';
  for (const theme of ['light', 'dark']) {
    for (const vp of [{ w: 1280, h: 900 }, { w: 900, h: 800 }, { w: 390, h: 780 }]) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.evaluate(({ theme, text }) => {
        document.documentElement.setAttribute('data-theme', theme);
        const n = document.getElementById('media-notice');
        n.hidden = false;
        document.getElementById('media-notice-text').textContent = text;
      }, { theme, text: TEXT });
      await page.waitForTimeout(120);
      results.push(await page.evaluate(({ vp, theme }) => {
        const n = document.getElementById('media-notice');
        const stage = document.querySelector('.court-stage');
        const btn = document.getElementById('media-retry-btn');
        const txt = document.getElementById('media-notice-text');
        const nr = n.getBoundingClientRect(), sr = stage.getBoundingClientRect(), tr = txt.getBoundingClientRect();
        const doc = document.documentElement;
        return {
          theme, vp: vp.w,
          notice: [Math.round(nr.width), Math.round(nr.height)],
          stage: Math.round(sr.width),
          fitsStage: nr.left >= sr.left - 0.5 && nr.right <= sr.right + 0.5,
          textWidth: Math.round(tr.width),
          buttonVisible: btn.getBoundingClientRect().width > 0,
          docOverflowX: doc.scrollWidth - doc.clientWidth,
          noticeBg: getComputedStyle(n).backgroundColor,
        };
      }, { vp, theme }));
    }
  }
  console.log(JSON.stringify({ room: roomId, results, errors }, null, 2));
  await page.evaluate((id) => fetch(`/api/court/rooms/${id}`, { method: 'DELETE' }), roomId);
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
