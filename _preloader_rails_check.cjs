// Behavioural check for the preloader's side rails.
//
// The two things that are easy to get wrong (and were reported by the user):
//   1. the RIGHT rail must climb noticeably faster than the left one, and
//   2. the medallions must LOOP — come round again — instead of each making a
//      single pass and never returning while the curtain is still up.
//
// It samples every medallion's screen position while the curtain animates and
// derives both answers from the MEASURED motion (not from the source constants),
// and it also proves the lap is seamless: the handover has to happen while the
// medallion is off screen, so nobody ever sees it jump back down.
//
//   node _preloader_rails_check.cjs [landing_url]
//
// Default URL is the stacked remote setup (nginx :8083 -> vite :8084, base
// /landing/). Point it at http://localhost:8080/ for a plain local dev server.
const { chromium } = require('playwright-core');

const LANDING = process.argv[2] || process.env.LANDING || 'http://127.0.0.1:8083/landing/';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : '  [' + detail + ']'}`);
}

const SAMPLE_MS = 40;
const SAMPLE_COUNT = 170;   // ~6.8 s: the curtain animates for ~5.8 s

const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('response', (r) => {
    // The site ships no favicon at the landing origin root (Chrome probes it on
    // every load) — a known baseline; everything else fails the run.
    if (r.status() === 404 && !/\/favicon\.(ico|svg)$/.test(new URL(r.url()).pathname)) {
      errors.push('404: ' + r.url());
    }
  });

  // Fresh visit, so the curtain actually plays.
  await page.addInitScript(() => {
    try { sessionStorage.removeItem('anvaya-preloader-seen'); } catch (_) {}
  });

  await page.goto(LANDING, { waitUntil: 'commit', ignoreHTTPSErrors: true });
  const seen = await page
    .waitForSelector('[data-medallion]', { state: 'attached', timeout: 12000 })
    .then(() => true, () => false);
  check('the side rails mount with the curtain', seen);

  const samples = [];
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    await page.waitForTimeout(SAMPLE_MS);
    let frame;
    try {
      frame = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('[data-medallion]')];
        return {
          t: Math.round(performance.now()),
          vh: window.innerHeight,
          items: nodes.map((n) => {
            const r = n.getBoundingClientRect();
            return {
              key: `${n.getAttribute('data-medallion')}#${n.getAttribute('data-rail-index')}`,
              top: Math.round(r.top),
              h: Math.round(r.height),
            };
          }),
        };
      });
    } catch (_) {
      break;   // the curtain unmounted: end of the observation window
    }
    if (!frame.items.length) break;
    samples.push(frame);
  }
  check('medallions could be sampled while the curtain was up', samples.length > 20,
    `samples=${samples.length} span=${samples.length * SAMPLE_MS}ms`);

  if (samples.length > 20) {
    const vh = samples[0].vh;
    const travel = vh + 260;                    // window.innerHeight + RAIL.overshoot
    const medallionH = samples[0].items[0].h;

    // Align each sample into a per-medallion series (DOM order is stable).
    const series = new Map();
    for (const f of samples) {
      for (const it of f.items) {
        if (!series.has(it.key)) series.set(it.key, []);
        series.get(it.key).push({ t: f.t, top: it.top });
      }
    }

    // ---- pass 1: how fast does each rail actually climb? ----
    const speedSamples = { left: [], right: [] };
    for (const [key, pts] of series) {
      const side = key.split('#')[0];
      for (let i = 1; i < pts.length; i++) {
        const dy = pts[i].top - pts[i - 1].top;
        const dt = Math.max(1, pts[i].t - pts[i - 1].t) / 1000;
        // A wrap (a whole lap in one frame) is not motion; ignore those.
        if (Math.abs(dy) > 1 && Math.abs(dy) < travel * 0.4) speedSamples[side].push(Math.abs(dy) / dt);
      }
    }
    const speed = { left: Math.round(median(speedSamples.left)), right: Math.round(median(speedSamples.right)) };

    check('both rails actually move', speedSamples.left.length > 3 && speedSamples.right.length > 3,
      `left=${speedSamples.left.length} right=${speedSamples.right.length} motion samples across ${series.size} medallions`);

    // 1. The first report: the right edge has to be visibly quicker.
    check('the RIGHT rail climbs faster than the left', speed.right > speed.left * 1.2,
      `left=${speed.left}px/s right=${speed.right}px/s ratio=${(speed.right / Math.max(1, speed.left)).toFixed(2)}`);

    // ---- pass 2: laps, and whether a viewer could see the handover ----
    // SEAMLESS means: the medallion was entirely above the top edge before the
    // wrap, the jump is a full lap (so it is the repeat, not jitter), and it came
    // back below the fold — allowing for the ONE frame of climb that can happen
    // between the sample before the wrap and the sample after it.
    const stats = {
      left: { wraps: 0, seamless: 0, misses: [] },
      right: { wraps: 0, seamless: 0, misses: [] },
    };
    for (const [key, pts] of series) {
      const side = key.split('#')[0];
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const p = pts[i];
        const dy = p.top - prev.top;
        if (dy <= travel * 0.4) continue;
        stats[side].wraps++;
        const climbThisFrame = (speed[side] * Math.max(1, p.t - prev.t)) / 1000;
        const fullLap = Math.abs(Math.abs(dy) - travel) < travel * 0.15;
        if (prev.top + medallionH <= 0 && p.top >= vh - climbThisFrame && fullLap) {
          stats[side].seamless++;
        } else {
          stats[side].misses.push(
            `${prev.top}->${p.top} (h=${medallionH} climb=${Math.round(climbThisFrame)} fullLap=${fullLap})`,
          );
        }
      }
    }
    const wraps = stats.left.wraps + stats.right.wraps;
    const seamless = stats.left.seamless + stats.right.seamless;

    // 2. The second report: the medallions have to come round again, on BOTH rails.
    check('the right rail loops (a lap restarts while the curtain is up)', stats.right.wraps >= 1,
      `wraps=${stats.right.wraps}`);
    check('the left rail loops too', stats.left.wraps >= 1, `wraps=${stats.left.wraps}`);
    check('both rails complete at least one lap INSIDE the curtain\'s visible window', wraps >= 2,
      `total wraps=${wraps} in ${samples.length * SAMPLE_MS}ms`);

    // 3. And the loop is invisible: the handover happens off screen.
    check('every observed lap restart happens off screen (no visible jump)',
      seamless === wraps && seamless > 0,
      `seamless=${seamless}/${wraps} (left ${stats.left.seamless}/${stats.left.wraps}, right ${stats.right.seamless}/${stats.right.wraps}) travel=${travel}px vh=${vh} medallionH=${medallionH}`);
    if (seamless !== wraps) {
      console.log('  misses:', stats.left.misses.concat(stats.right.misses).slice(0, 5).join(' | '));
    }

    check('the curtain dismisses cleanly after all that motion', errors.length === 0,
      errors.slice(0, 3).join(' | '));
  }

  await browser.close();

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length) {
    console.log('FAILED: ' + failed.map((f) => `${f.name} [${f.detail}]`).join('; '));
    process.exit(1);
  }
})();
