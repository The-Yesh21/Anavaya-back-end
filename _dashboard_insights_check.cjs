// Diagnostics: dashboard "click a case → straight to the analysis" flow.
// Verifies, against a live server (BASE, default http://127.0.0.1:8131):
//   1. clicking a registry case head opens the Analysis tab on the
//      whole-case verdict,
//   2. the Evidence & weight section renders one card per document with a
//      weight + the merge signals it drives,
//   3. the "Why this priority" section renders the Decision Tree path with
//      raised/lowered effect chips and the other-branch counterfactuals,
//   4. clicking a document in the registry also lands on the Analysis tab,
//   5. zero console/page errors.
const { chromium } = require('playwright-core');

const BASE = process.env.BASE || 'http://127.0.0.1:8131';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CASE_ID = process.env.CASE_ID || 'ANV-2026-0019';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() === 404) errors.push('404: ' + r.url()); });

  const out = { caseId: CASE_ID, checks: {}, errors };
  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#cases-registry-list .registry-case', { timeout: 20000 });

    // 1. Click the case head → workspace opens + Analysis tab activates.
    await page.click(`.registry-case[data-case-id="${CASE_ID}"] .registry-case-head`);
    await page.waitForFunction((cid) => {
      const wrap = document.getElementById('analysis-whole-case');
      return wrap && wrap.style.display !== 'none';
    }, CASE_ID, { timeout: 15000 });
    out.checks.activeTab = await page.evaluate(() =>
      document.querySelector('.tab-btn.active')?.getAttribute('data-tab'));
    out.checks.wholeCaseVisible = true;

    // 2. Evidence & weight cards.
    await page.waitForFunction((cid) => {
      const wrap = document.getElementById('case-level-evidence');
      return wrap && wrap.querySelectorAll('.ev-card').length > 0;
    }, CASE_ID, { timeout: 20000 });
    out.checks.evidence = await page.evaluate((cid) => {
      const cards = [...document.querySelectorAll('#case-level-evidence .ev-card')];
      return {
        count: cards.length,
        withWeight: cards.filter((c) => /\d/.test(c.querySelector('.ev-weight-num')?.textContent || '')).length,
        withDrives: cards.filter((c) => c.querySelector('.ev-drives')).length,
        names: cards.map((c) => c.querySelector('.ev-name')?.textContent.trim()).slice(0, 8),
      };
    }, CASE_ID);

    // 3. Why-this-priority path trace.
    await page.waitForFunction((cid) => {
      const wrap = document.getElementById('case-level-path');
      return wrap && wrap.querySelectorAll('.ev-step').length > 0;
    }, CASE_ID, { timeout: 20000 });
    out.checks.path = await page.evaluate((cid) => {
      const wrap = document.getElementById('case-level-path');
      return {
        steps: wrap.querySelectorAll('.ev-step').length,
        raised: wrap.querySelectorAll('.ev-effect.raised').length,
        lowered: wrap.querySelectorAll('.ev-effect.lowered').length,
        branches: wrap.querySelectorAll('.ev-branch').length,
        summary: (wrap.querySelector('.ev-path-summary')?.textContent || '').trim().slice(0, 240),
        firstStep: (wrap.querySelector('.ev-step-head strong')?.textContent || '').trim(),
      };
    }, CASE_ID);

    // Verdict badge + narrative still render.
    out.checks.verdict = await page.evaluate(() => ({
      badge: document.getElementById('case-level-priority-badge')?.textContent.trim(),
      chips: document.querySelectorAll('#case-level-chips .case-level-chip').length,
    }));

    // 3b. The case overview (parties + narrative).
    await page.waitForFunction(() =>
      document.querySelectorAll('#case-level-overview .ov-party').length > 0,
      { timeout: 15000 });
    out.checks.overview = await page.evaluate(() => ({
      parties: [...document.querySelectorAll('#case-level-overview .ov-party')]
        .map((e) => e.textContent.trim()).slice(0, 6),
      narrative: (document.querySelector('#case-level-overview .ov-narrative')?.textContent || '').slice(0, 100),
    }));

    // 3c. Articles that apply + doctrines.
    await page.waitForFunction(() =>
      document.querySelectorAll('#case-level-articles .ev-article').length > 0,
      { timeout: 15000 });
    out.checks.articles = await page.evaluate(() => ({
      articles: document.querySelectorAll('#case-level-articles .ev-article').length,
      primary: document.querySelectorAll('#case-level-articles .ev-article.primary').length,
      withWhy: document.querySelectorAll('#case-level-articles .ev-article-why').length,
      doctrines: document.querySelectorAll('#case-level-articles .ev-doctrine').length,
      firstArticle: (document.querySelector('#case-level-articles .ev-article-num')?.textContent || '').trim(),
    }));

    // 3d. Evidence cards show what they say + how they connect.
    out.checks.connects = await page.evaluate(() => ({
      withSummary: document.querySelectorAll('#case-level-evidence .ev-says').length,
      withConnects: document.querySelectorAll('#case-level-evidence .ev-connects').length,
      linkSample: (document.querySelector('#case-level-evidence .ev-link')?.textContent || '').trim().slice(0, 120),
    }));

    // 4. Click a document in the registry → Analysis tab again.
    await page.click(`.registry-case[data-case-id="${CASE_ID}"] .registry-case-head`); // collapse
    await page.click(`.registry-case[data-case-id="${CASE_ID}"] .registry-case-head`); // re-open (expands doc list)
    await page.waitForSelector(`.registry-case[data-case-id="${CASE_ID}"] .registry-doc`, { timeout: 10000 });
    await page.click(`.registry-case[data-case-id="${CASE_ID}"] .registry-doc`);
    await page.waitForFunction(() =>
      document.querySelector('.tab-btn.active')?.getAttribute('data-tab') === 'details-tab',
      { timeout: 10000 });
    out.checks.docClickLandsOnAnalysis = true;
    out.checks.docClickWholeCaseStillVisible = await page.evaluate(() => {
      const wrap = document.getElementById('analysis-whole-case');
      return !!wrap && wrap.style.display !== 'none';
    });
    out.checks.activeTabAfterDocClick = await page.evaluate(() =>
      document.querySelector('.tab-btn.active')?.getAttribute('data-tab'));

    // 5. The per-document path timeline (Decision Tree tab data) carries the
    //    why-this-split effect chips.
    await page.waitForFunction(() =>
      document.querySelectorAll('#decision-path-steps .step-effect').length > 0,
      { timeout: 20000 });
    out.checks.timeline = await page.evaluate(() => ({
      steps: document.querySelectorAll('#decision-path-steps .step-item').length,
      effectChips: [...document.querySelectorAll('#decision-path-steps .step-effect')]
        .map((e) => `${e.textContent.trim()}(${e.className.split(' ').pop()})`),
      branches: document.querySelectorAll('#decision-path-steps .step-branch').length,
    }));
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.error('HARNESS FAIL:', e); process.exit(1); });
