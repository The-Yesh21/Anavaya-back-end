// Dark-theme color-system check for the Analysis section.
// Against a live server (BASE, default local nginx :8083):
//   DARK  — Evidence cards are charcoal (never white), meter track dark,
//           primary text warm off-white, metadata muted-but-readable,
//           priority badge is a dark tint with colored text/border,
//           weight number uses the bright semantic red.
//   LIGHT — cards stay the original warm ivory (light theme unchanged).
//   zero console/page/404 errors in both passes (except the pre-existing
//   /favicon.ico 404 — no favicon exists anywhere in the repo, unrelated
//   to these color changes).
// Screenshots: _analysis_dark.png / _analysis_light.png.
const { chromium } = require('playwright-core');

const BASE = process.env.BASE || 'http://127.0.0.1:8083';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CASE_ID = process.env.CASE_ID || 'ANV-2026-0019';

const failures = [];
// Pre-existing baseline noise: the site has no favicon (no file, no link),
// so the browser's automatic /favicon.ico probe 404s on every page load.
// Scoped out by exact URL; every other error still fails the run.
const isBaselineNoise = (e) => e.includes('favicon.ico');
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures.push(name);
};

const parseRGB = (s) => (s.match(/[\d.]+/g) || []).map(Number);

async function openAnalysis(page, theme) {
  await page.addInitScript((t) => {
    try { localStorage.setItem('anavaya-theme', t); } catch (_) {}
  }, theme);
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#cases-registry-list .registry-case', { timeout: 20000 });
  await page.click(`.registry-case[data-case-id="${CASE_ID}"] .registry-case-head`);
  await page.waitForFunction(() => {
    const wrap = document.getElementById('analysis-whole-case');
    return wrap && wrap.style.display !== 'none';
  }, { timeout: 15000 });
  await page.waitForFunction(() =>
    document.querySelectorAll('#case-level-evidence .ev-card').length > 0,
    { timeout: 20000 });
  return page.evaluate(() => document.documentElement.getAttribute('data-theme'));
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const errors = [];

  // ---------- DARK ----------
  {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    page.on('pageerror', (e) => errors.push('dark pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('dark console: ' + m.text() + ' @ ' + (m.location() && m.location().url)); });
    page.on('response', (r) => { if (r.status() === 404) errors.push('dark 404: ' + r.url()); });

    const theme = await openAnalysis(page, 'dark');
    check('dark theme active', theme === 'dark', `data-theme=${theme}`);

    const s = await page.evaluate(() => {
      const cs = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const c = getComputedStyle(el);
        return { bg: c.backgroundColor, color: c.color, border: c.borderColor };
      };
      const badge = document.querySelector('#case-level-evidence .badge-priority');
      const bc = badge ? getComputedStyle(badge) : null;
      return {
        card: cs('#case-level-evidence .ev-card'),
        name: cs('#case-level-evidence .ev-name'),
        says: cs('#case-level-evidence .ev-says'),
        track: cs('#case-level-evidence .ev-bar'),
        num: cs('#case-level-evidence .ev-weight-num'),
        article: cs('.ev-article') || cs('#case-level-articles .ev-article'),
        badge: bc ? { bg: bc.backgroundColor, color: bc.color, border: bc.borderTopColor } : null,
        badgeText: badge ? badge.textContent.trim() : '',
      };
    });

    const card = parseRGB(s.card.bg);
    check('evidence card is charcoal, never white', !!card && card[0] < 60 && card[1] < 60,
      s.card.bg);
    const art = s.article && parseRGB(s.article.bg);
    check('article card is charcoal too', !s.article || (!!art && art[0] < 60),
      s.article ? s.article.bg : 'no article card rendered (ok)');

    const name = parseRGB(s.name.color);
    check('document title is warm off-white', !!name && name[0] > 200 && name[1] > 200,
      s.name.color);

    const says = parseRGB(s.says.color);
    check('summary is muted but readable (not near-white, not dim)', !!says &&
      says[0] > 150 && says[0] < 240, s.says.color);

    const track = parseRGB(s.track.bg);
    check('meter track is dark charcoal', !!track && track[0] < 60, s.track.bg);

    const num = parseRGB(s.num.color);
    const numIsHigh = s.num.color.includes('232') || (num && num[0] >= 200);
    check('weight number uses bright semantic color on dark', !!num && numIsHigh,
      s.num.color);

    if (s.badge) {
      const bbg = s.badge.bg;
      const alpha = bbg.startsWith('rgba') ? Number(bbg.match(/[\d.]+/g)[3]) : 1;
      const bcol = parseRGB(s.badge.color);
      check(`badge "${s.badgeText}" is a dark tint, not a bright fill`, alpha <= 0.5,
        `${bbg} / text ${s.badge.color}`);
      check('badge text is the semantic color (colored on tint)', !!bcol && bcol[0] > 60 &&
        !(bcol[0] > 240 && bcol[1] > 240 && bcol[2] > 240), s.badge.color);
    } else {
      check('priority badge present', false, 'no .badge-priority in evidence card');
    }

    await page.locator('#analysis-whole-case').screenshot({ path: '_analysis_dark.png' });
    await page.close();
  }

  // ---------- LIGHT (unchanged) ----------
  {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    page.on('pageerror', (e) => errors.push('light pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('light console: ' + m.text() + ' @ ' + (m.location() && m.location().url)); });
    page.on('response', (r) => { if (r.status() === 404) errors.push('light 404: ' + r.url()); });

    const theme = await openAnalysis(page, 'light');
    check('light theme active', theme === 'light', `data-theme=${theme}`);

    const s = await page.evaluate(() => {
      const el = document.querySelector('#case-level-evidence .ev-card');
      const tr = document.querySelector('#case-level-evidence .ev-bar');
      return {
        card: el ? getComputedStyle(el).backgroundColor : null,
        track: tr ? getComputedStyle(tr).backgroundColor : null,
      };
    });
    const card = parseRGB(s.card || '');
    check('light card keeps original warm ivory', !!card &&
      card[0] === 255 && card[1] === 252 && card[2] === 245, s.card);
    const track = parseRGB(s.track || '');
    check('light meter track stays light ivory', !!track && track[0] > 230, s.track);

    await page.locator('#analysis-whole-case').screenshot({ path: '_analysis_light.png' });
    await page.close();
  }

  await browser.close();
  const realErrors = errors.filter((e) => !isBaselineNoise(e));
  check('zero console/page/404 errors (both passes, favicon baseline excluded)',
    realErrors.length === 0,
    realErrors.join(' ; ') || `clean${errors.length ? ` (${errors.length} favicon.ico baseline hit(s) ignored)` : ''}`);

  if (failures.length) {
    console.error(`\n${failures.length} CHECK(S) FAILED: ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log('\nALL CHECKS PASSED');
})().catch((e) => { console.error('HARNESS FAIL:', e); process.exit(1); });
