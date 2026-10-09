// The Evidence-level detail panel (#case-details-content) must NOT render for
// the case's [WHOLE CASE] row while the Whole-Case Analysis block is on screen
// (it would repeat the same verdict, parties and PDF a second time), but MUST
// still render for an individual document.
// Against a live server (BASE, default local nginx :8083):
//   1. open the analysed case from the CASES registry,
//   2. click the case's [WHOLE CASE] row in the sidebar list ->
//      whole-case panel visible AND #case-details-content hidden,
//   3. click an individual evidence document ->
//      #case-details-content visible, titled after that document (no
//      "[WHOLE CASE]" leak),
//   4. zero console/page errors and no 404s (except the pre-existing
//      /favicon.ico baseline — the site ships no favicon).
const { chromium } = require('playwright-core');

const BASE = process.env.BASE || 'http://127.0.0.1:8083';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CASE_ID = process.env.CASE_ID || 'ANV-2026-0019';

const failures = [];
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
    await page.addInitScript(() => {
      try { localStorage.setItem('anavaya-theme', 'dark'); } catch (_) {}
    });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#cases-registry-list .registry-case', { timeout: 20000 });
    await page.click(`.registry-case[data-case-id="${CASE_ID}"] .registry-case-head`);
    await page.waitForFunction(() => {
      const wrap = document.getElementById('analysis-whole-case');
      return wrap && wrap.style.display !== 'none';
    }, { timeout: 15000 });

    // ---- 2. [WHOLE CASE] row selected while the whole-case block is on screen
    await page.waitForSelector('#cases-list-container .case-item[data-case-file*="[WHOLE CASE]"]', { timeout: 15000 });
    await page.click('#cases-list-container .case-item[data-case-file*="[WHOLE CASE]"]');
    await page.waitForTimeout(400); // selectCase is async (activates the tab)

    const s1 = await page.evaluate(() => ({
      wholeCaseVisible: document.getElementById('analysis-whole-case').style.display !== 'none',
      detailsDisplay: document.getElementById('case-details-content').style.display,
      title: (document.getElementById('case-title-name').textContent || '').trim(),
    }));
    check('whole-case analysis block stays visible', s1.wholeCaseVisible);
    check('[WHOLE CASE] row does NOT open the duplicate evidence-level panel',
      s1.detailsDisplay === 'none', `display="${s1.detailsDisplay}" title="${s1.title}"`);

    // ---- 3. an individual document still gets its own detail panel
    const firstDoc = page.locator('.registry-doc').first();
    await firstDoc.click();
    await page.waitForFunction(() => {
      const el = document.getElementById('case-details-content');
      return el && el.style.display !== 'none';
    }, { timeout: 15000 });

    const s2 = await page.evaluate(() => ({
      detailsDisplay: document.getElementById('case-details-content').style.display,
      title: (document.getElementById('case-title-name').textContent || '').trim(),
      summary: (document.getElementById('case-summary').textContent || '').trim(),
      downloadVisible: document.getElementById('download-report-btn').style.display !== 'none',
    }));
    check('individual document opens its evidence-level panel',
      s2.detailsDisplay === 'flex', `display="${s2.detailsDisplay}"`);
    check('panel is titled after the document, not the whole case',
      s2.title.length > 0 && !/\[WHOLE CASE\]/i.test(s2.title), s2.title);
    check('document summary + PDF download populated',
      s2.summary.length > 0 && s2.summary !== 'Summary unavailable.' && s2.downloadVisible);

    await page.screenshot({ path: '_evidence_panel_dedupe.png', fullPage: false });
  } finally {
    await browser.close();
  }

  const realErrors = errors.filter((e) => !isBaselineNoise(e));
  check('zero console/page/404 errors (favicon baseline excluded)',
    realErrors.length === 0,
    realErrors.join(' ; ') || `clean${errors.length ? ` (${errors.length} favicon.ico baseline hit(s) ignored)` : ''}`);

  if (failures.length) {
    console.error(`\n${failures.length} CHECK(S) FAILED: ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log('\nALL CHECKS PASSED');
})().catch((e) => { console.error('HARNESS FAIL:', e); process.exit(1); });
