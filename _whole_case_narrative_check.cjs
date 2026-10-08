// UI check: Whole-Case Analysis panel leads with WHAT THE CASE IS.
// Against a live server (BASE, default local nginx :8083):
//   1. open the case workspace -> Analysis tab,
//   2. #case-level-narrative leads with .cl-case-desc (case description:
//      who filed what, amount, relief/what the proceeding seeks),
//   3. the audit inventory (.cl-merge-audit) follows below it,
//   4. no "accused is accused" extraction artifact,
//   5. zero console/page errors and no 404s (except the pre-existing
//      /favicon.ico 404 — the site ships no favicon; unrelated to these
//      changes).
const { chromium } = require('playwright-core');

const BASE = process.env.BASE || 'http://127.0.0.1:8083';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CASE_ID = process.env.CASE_ID || 'ANV-2026-0019';

const failures = [];
// Pre-existing baseline noise: the browser's automatic /favicon.ico probe
// 404s because the site ships no favicon. Scoped out by exact URL only;
// every other error still fails the run.
const isBaselineNoise = (e) => e.includes('favicon.ico');
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures.push(name);
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text() + ' @ ' + (m.location() && m.location().url)); });
  page.on('response', (r) => { if (r.status() === 404) errors.push('404: ' + r.url()); });

  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#cases-registry-list .registry-case', { timeout: 20000 });
    await page.click(`.registry-case[data-case-id="${CASE_ID}"] .registry-case-head`);
    await page.waitForFunction(() => {
      const wrap = document.getElementById('analysis-whole-case');
      return wrap && wrap.style.display !== 'none';
    }, { timeout: 15000 });
    await page.waitForFunction(() => {
      const el = document.getElementById('case-level-narrative');
      return el && el.textContent.trim().length > 0;
    }, { timeout: 20000 });

    const narr = await page.evaluate(() => {
      const el = document.getElementById('case-level-narrative');
      const kids = [...el.children].map((c) => ({
        cls: c.className,
        text: (c.textContent || '').trim(),
      }));
      return { kids, full: (el.textContent || '').trim() };
    });

    const desc = narr.kids.find((k) => k.cls.includes('cl-case-desc'));
    const audit = narr.kids.find((k) => k.cls.includes('cl-merge-audit'));

    check('narrative has a case-description block', !!desc,
      desc ? desc.text.slice(0, 90) + '…' : 'missing .cl-case-desc');
    check('description comes FIRST in the panel',
      !!desc && narr.kids[0] === desc,
      narr.kids.map((k) => k.cls).join(' | '));
    check('description says what the case is (who filed what)',
      !!desc && /filed a complaint|seeks to hold/i.test(desc.text));
    check('description names the amount in dispute',
      !!desc && /Rs\.?\s*[0-9]/i.test(desc.text));
    check('description says what the proceeding seeks (relief)',
      !!desc && /relief sought|seeks to|enforcement/i.test(desc.text));
    check('audit inventory still present, BELOW the description',
      !!audit && narr.kids.indexOf(audit) > narr.kids.indexOf(desc),
      audit ? audit.text.slice(0, 70) + '…' : 'missing .cl-merge-audit');
    check('audit inventory is the 6-document inventory',
      !!audit && /brings together 6 documents/.test(audit.text));
    check('no "accused is accused" artifact', !/accused is accused/i.test(narr.full));
    check('priority justification still rendered', await page.evaluate(() =>
      (document.getElementById('case-level-justification')?.textContent || '').trim().length > 0));
    const realErrors = errors.filter((e) => !isBaselineNoise(e));
    check('zero console/page/404 errors (favicon baseline excluded)', realErrors.length === 0,
      realErrors.join(' ; ') || `clean${errors.length ? ` (${errors.length} favicon.ico baseline hit(s) ignored)` : ''}`);
  } finally {
    await browser.close();
  }
  if (failures.length) {
    console.error(`\n${failures.length} CHECK(S) FAILED: ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log('\nALL CHECKS PASSED');
})().catch((e) => { console.error('HARNESS FAIL:', e); process.exit(1); });
