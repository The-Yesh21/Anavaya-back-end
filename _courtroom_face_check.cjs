// Behavioural check for the courtroom Face & Expression analyzer.
//
// The bug this guards against: ordinary SPEECH moved the mouth, brows and head
// far more than tension does, so a talking subject read as a nervous one. This
// drives the REAL analyzer (window.__anavayaFace.onResults -> extraction ->
// scoring -> render) with synthetic MediaPipe landmark frames that are built to
// produce exact metric values, and asserts:
//   1. calibration completes on a neutral face,
//   2. a person TALKING CALMLY stays low and raises no stress cue,
//   3. the same articulation PLUS real stress markers raises the index and the
//      cues (including the held-left gaze cue),
//   4. going quiet decays the index back to calm.
// Run against a live server:  node _courtroom_face_check.cjs
const { chromium } = require('playwright-core');

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : '  [' + detail + ']'}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() === 404) errors.push('404: ' + r.url()); });

  let out;
  let roomId = '';
  try {
    // A real room, so the page's own API calls are all valid (a made-up room id
    // would 404 and pollute the error assertion).
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    const created = await page.evaluate(async () => {
      const r = await fetch('/api/court/rooms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_title: 'Face analysis check' }),
      });
      return r.json();
    });
    roomId = created.room_id || '';
    await page.goto(BASE + '/court/' + roomId, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.__anavayaFace && window.__anavayaFace.onResults), null, { timeout: 25000 });

    out = await page.evaluate(async () => {
      const F = window.__anavayaFace;
      const state = F.state;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      // Deterministic noise so the check cannot flake.
      let seed = 987654321;
      const noise = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return (seed / 0x7fffffff - 0.5) * 2;   // -1..1
      };

      // Build 478 landmarks whose derived metrics are exactly the values asked
      // for (see the extraction formulas in courtroom.js). unit = 100.
      function makeLandmarks(m) {
        const lm = [];
        for (let i = 0; i < 478; i++) lm.push({ x: 50, y: -500, z: 0 });
        const set = (i, x, y) => { lm[i] = { x: x, y: y, z: 0 }; };

        set(33, 0, 0); set(263, 100, 0);                    // unit = 100
        const v = 15 * m.ear;                               // lid half-gap
        set(160, 10, -v); set(144, 10, v); set(158, 20, -v); set(153, 20, v); set(133, 30, 0);
        set(385, 80, -v); set(380, 80, v); set(387, 90, -v); set(373, 90, v); set(362, 70, 0);
        const bx = 50 - m.browGap * 50, by = -m.browRaise * 100;
        set(159, bx, 0); set(386, 100 - bx, 0);             // eye "top" references
        set(21, bx, by); set(22, 100 - bx, by);
        set(107, bx - 10, by); set(336, 100 - bx + 10, by);
        set(468, 15 + m.gazeX * 15, 0); set(473, 85 + m.gazeX * 15, 0);
        set(13, 50, -m.lipOpen * 50); set(14, 50, m.lipOpen * 50);
        set(61, 50 - m.lipWidth * 50, 0); set(291, 50 + m.lipWidth * 50, 0);
        set(0, 50, -m.frown * 100); set(17, 50, -m.frown * 100);
        return lm;
      }

      const feed = async (m, ms) => {
        F.onResults({ faceLandmarks: [makeLandmarks(m)] });
        await sleep(ms);
      };

      const out = {
        method: 'synthetic landmarks through the real analyzer',
        calibrated: false,
        calm: { max: 0, min: 100, cues: [], domScore: null, samples: 0, spokeFrames: 0 },
        stress: { max: 0, cues: [], domScore: null, samples: 0 },
        quiet: { end: 0, tail: [], domScore: null },
        lipMotionCalm: null, lipMotionStress: null,
      };
      const scored = ['lip_tremor', 'lip_press', 'gaze_left', 'gaze_right', 'brow_furrow'];

      // ---- phase 1: calibrate on a neutral, still face -------------------
      F.start();
      for (let i = 0; i < 150 && !state.calibrated; i++) {
        await feed({ lipOpen: 0.030 + noise() * 0.0004, lipWidth: 0.450 + noise() * 0.0004,
                     frown: 0.000 + noise() * 0.0002, browGap: 0.400 + noise() * 0.0004,
                     browRaise: 0.150 + noise() * 0.0004, ear: 0.300 + noise() * 0.0004,
                     gazeX: 0.000 + noise() * 0.0004 }, 8);
      }
      out.calibrated = state.calibrated === true;
      out.calibrationSamples = state.calibAcc.lipOpen.length;

      // ---- phase 2: the same person TALKING CALMLY ----------------------
      // Real articulation: the mouth opens and closes widely, the brow lifts for
      // emphasis, the head/eyes wander, the corners move. No stress markers.
      for (let i = 0; i < 260; i++) {
        const t = i / 30;
        const m = {
          lipOpen: 0.030 + 0.030 * Math.sin(t * 7.0) + noise() * 0.0015,
          lipWidth: 0.450 + 0.020 * Math.sin(t * 5.0) + noise() * 0.001,
          frown: 0.001 + 0.006 * Math.sin(t * 6.3) + noise() * 0.0008,
          browGap: 0.400 + 0.006 * Math.sin(t * 1.7) + noise() * 0.001,
          browRaise: 0.150 + 0.030 * Math.sin(t * 2.1) + noise() * 0.0015,
          ear: 0.300 + noise() * 0.004,
          gazeX: 0.010 * Math.sin(t * 1.3) + noise() * 0.002,
        };
        await feed(m, 26);
        if (state.speaking) out.calm.spokeFrames++;
        if (i >= 90) {   // after the warmup and the initial settle
          out.calm.samples++;
          out.calm.max = Math.max(out.calm.max, state.gauge);
          out.calm.min = Math.min(out.calm.min, state.gauge);
          for (const c of state.activeCues) if (!out.calm.cues.includes(c)) out.calm.cues.push(c);
        }
        if (i === 259) {
          out.lipMotionCalm = F.lipMotion(state.history.lipOpen.slice());
          out.calm.domScore = (document.getElementById('face-score') || {}).textContent;
        }
      }

      // ---- phase 3: same voice, now TENSE ------------------------------
      // A fast lip tremble on top of the articulation, a furrowed brow (inner
      // brows drawn together) and the gaze held to the subject's own left.
      for (let i = 0; i < 260; i++) {
        const t = i / 30;
        const tremor = (i % 2 === 0 ? 1 : -1) * 0.010;
        const m = {
          lipOpen: 0.030 + 0.030 * Math.sin(t * 7.0) + tremor + noise() * 0.001,
          lipWidth: 0.450 + 0.020 * Math.sin(t * 5.0) + noise() * 0.001,
          frown: 0.001 + 0.006 * Math.sin(t * 6.3) + noise() * 0.0008,
          browGap: 0.360 + noise() * 0.0008,
          browRaise: 0.150 + 0.030 * Math.sin(t * 2.1) + noise() * 0.0015,
          ear: 0.300 + noise() * 0.004,
          gazeX: 0.130 + noise() * 0.002,
        };
        await feed(m, 26);
        if (i >= 30) {
          out.stress.samples++;
          out.stress.max = Math.max(out.stress.max, state.gauge);
          for (const c of state.activeCues) if (!out.stress.cues.includes(c)) out.stress.cues.push(c);
        }
        if (i === 259) {
          out.lipMotionStress = F.lipMotion(state.history.lipOpen.slice());
          out.stress.domScore = (document.getElementById('face-score') || {}).textContent;
        }
      }

      // ---- phase 4: the subject stops talking --------------------------
      for (let i = 0; i < 150; i++) {
        await feed({ lipOpen: 0.030 + noise() * 0.0004, lipWidth: 0.450 + noise() * 0.0004,
                     frown: 0.000 + noise() * 0.0002, browGap: 0.400 + noise() * 0.0004,
                     browRaise: 0.150 + noise() * 0.0004, ear: 0.300 + noise() * 0.0004,
                     gazeX: 0.000 + noise() * 0.0004 }, 26);
        if (i >= 140) out.quiet.tail.push(state.gauge);
        out.quiet.end = state.gauge;
      }
      out.quiet.domScore = (document.getElementById('face-score') || {}).textContent;
      out.quiet.speaking = state.speaking;
      out.stressCueSet = scored.filter((c) => out.stress.cues.includes(c));
      out.calmCueSet = scored.filter((c) => out.calm.cues.includes(c));
      return out;
    });
  } catch (e) {
    check('analyzer drives end-to-end', false, e.message);
    console.log(JSON.stringify({ checks, errors }, null, 2));
    await browser.close();
    process.exit(1);
  }

  console.log(JSON.stringify(out, null, 2));

  check('calibration completes on a neutral face', out.calibrated, `samples=${out.calibrationSamples}`);
  check('the subject is detected as speaking while talking', out.calm.spokeFrames > 200, `frames=${out.calm.spokeFrames}`);
  check('calm talking stays at a calm index', out.calm.max <= 20, `max=${out.calm.max}%`);
  check('calm talking raises no stress cue', out.calmCueSet.length === 0, `cues=${out.calmCueSet.join(',') || 'none'}`);
  check('calm talking readout agrees', /^\d+%$/.test(out.calm.domScore || '') && parseInt(out.calm.domScore, 10) <= 20, `dom=${out.calm.domScore}`);
  check('articulation is measured as amplitude, not tremor',
    out.lipMotionCalm && out.lipMotionCalm.amplitude > 0.005 && out.lipMotionCalm.tremor < 0.003,
    out.lipMotionCalm ? `amp=${out.lipMotionCalm.amplitude.toFixed(4)} tremor=${out.lipMotionCalm.tremor.toFixed(4)}` : '');
  check('stress raises the index', out.stress.max >= 40, `max=${out.stress.max}%`);
  check('stress cues fire', out.stressCueSet.length >= 2, `cues=${out.stressCueSet.join(',') || 'none'}`);
  check('held-left gaze cue fires', out.stress.cues.includes('gaze_left'), `cues=${out.stress.cues.join(',')}`);
  check('lip tremor cue fires under real tremble', out.stress.cues.includes('lip_tremor'),
    out.lipMotionStress ? `tremor=${out.lipMotionStress.tremor.toFixed(4)}` : '');
  check('stress readout agrees', /^\d+%$/.test(out.stress.domScore || '') && parseInt(out.stress.domScore, 10) >= 40, `dom=${out.stress.domScore}`);
  check('going quiet decays back to calm', out.quiet.end <= 10 && out.quiet.speaking === false, `end=${out.quiet.end}% tail=${out.quiet.tail.join(',')}`);
  check('zero console/page/404 errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  if (roomId) {
    await page.evaluate((id) => fetch('/api/court/rooms/' + id, { method: 'DELETE' }), roomId).catch(() => {});
  }
  await browser.close();
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length) {
    console.log('FAILED: ' + failed.map((f) => f.name + ' [' + f.detail + ']').join('; '));
    process.exit(1);
  }
  process.exit(0);
})();
