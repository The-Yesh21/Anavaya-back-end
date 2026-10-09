// Decision Tree tab must show THE CASE's priority (not just the global tree).
// Against a live server (BASE, default local nginx :8083):
//   1. open the analysed case from the CASES registry → its whole-case row is
//      selected, so the Decision Tree tab knows which case is active,
//   2. switch to the Decision Tree tab:
//      - the active-case banner is visible, names the case, AND carries a
//        "Medium Priority" badge (the case's verdict),
//      - the case's path is highlighted (decision nodes + links + final leaf),
//      - the path breadcrumb ends in the leaf verdict "Medium Priority",
//      - the path timeline shows the leaf step with the priority,
//      - clicking the active leaf opens a node panel with Predicted Priority,
//   3. zero console/page/404 errors (pre-existing /favicon.ico excluded by URL).
const { chromium } = require('playwright-core');

const BASE = process.env.BASE || 'http://127.0.0.1:8083';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CASE_ID = process.env.CASE_ID || 'ANV-2026-0019';
const EXPECT_PRIORITY = process.env.PRIORITY || 'Medium';

const failures = [];
// Pre-existing baseline noise: the site ships no favicon, so the browser's
// automatic /favicon.ico probe 404s. Scoped out by exact URL only.
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

    // 1. Open the case from the CASES registry (the primary navigation).
    await page.click(`.registry-case[data-case-id="${CASE_ID}"] .registry-case-head`);
    await page.waitForFunction(() => {
      const wrap = document.getElementById('analysis-whole-case');
      return wrap && wrap.style.display !== 'none';
    }, { timeout: 20000 });
    // The whole-case row selection drives the Decision Tree path fetch.
    await page.waitForFunction(() =>
      (document.getElementById('decision-path-steps')?.querySelectorAll('.step-item').length || 0) > 0,
      { timeout: 30000 });

    // 2. Decision Tree tab.
    await page.click(".tab-btn[data-tab='tree-tab']");
    await page.waitForFunction(() =>
      document.querySelectorAll('g.tree-node').length > 0, { timeout: 15000 });

    const s = await page.evaluate(() => {
      const banner = document.getElementById('tree-legend-case-active');
      const badge = document.getElementById('active-path-case-priority');
      const nodes = [...document.querySelectorAll('g.tree-node')];
      const active = nodes.filter((n) => n.classList.contains('path-active'));
      const activeLeaf = active.find((n) => n.classList.contains('leaf'));
      const activeLinks = document.querySelectorAll('path.tree-link.path-active').length;
      const steps = [...document.querySelectorAll('#decision-path-steps .step-item')];
      const leafStep = steps.find((el) => /priority/i.test(el.textContent) && el.className.includes('leaf'));
      return {
        bannerVisible: !!banner && banner.style.display !== 'none',
        bannerText: banner ? banner.textContent.replace(/\s+/g, ' ').trim() : '',
        badgeVisible: !!badge && badge.style.display !== 'none' && badge.textContent.trim().length > 0,
        badgeText: badge ? badge.textContent.trim() : '',
        badgeClass: badge ? badge.className : '',
        activeNodes: active.length,
        activeLinks,
        activeLeafLabel: activeLeaf ? (activeLeaf.querySelector('text')?.textContent || '') : null,
        breadcrumb: (document.getElementById('path-breadcrumb')?.textContent || '').trim(),
        traceWrapVisible: document.getElementById('path-trace-wrap')?.style.display !== 'none',
        timelineSteps: steps.length,
        leafStepText: leafStep ? leafStep.textContent.replace(/\s+/g, ' ').trim() : '',
      };
    });

    check('active-case banner visible on the Decision Tree tab', s.bannerVisible, `visible=${s.bannerVisible}`);
    check('banner names the active case', /Evidence Booklet|Whole case/i.test(s.bannerText), s.bannerText.slice(0, 90));
    check(`banner carries the case's priority badge`, s.badgeVisible && s.badgeText === `${EXPECT_PRIORITY} Priority`,
      `${s.badgeText} [${s.badgeClass}]`);
    check('badge is colour-classed like other priority pills', s.badgeClass.includes(`priority-pill ${EXPECT_PRIORITY.toLowerCase()}`),
      s.badgeClass);
    check('case path highlights decision nodes', s.activeNodes >= 2, `${s.activeNodes} active nodes`);
    check('case path highlights links between them', s.activeLinks >= 1, `${s.activeLinks} active links`);
    check(`final leaf on the path is labelled "Priority: ${EXPECT_PRIORITY}"`,
      s.activeLeafLabel === `Priority: ${EXPECT_PRIORITY}`, s.activeLeafLabel || 'no active leaf');
    check('breadcrumb ends with the leaf verdict', s.breadcrumb.endsWith(`${EXPECT_PRIORITY} Priority`), s.breadcrumb);
    check('path trace panel visible with steps', s.traceWrapVisible && s.timelineSteps >= 3,
      `visible=${s.traceWrapVisible} steps=${s.timelineSteps}`);
    check('timeline shows the leaf priority step', s.leafStepText.includes(`${EXPECT_PRIORITY} Priority`),
      s.leafStepText.slice(0, 90) || 'no leaf step');

    // Node panel on the active leaf.
    const panel = await page.evaluate(() => {
      const leaf = [...document.querySelectorAll('g.tree-node.path-active.leaf')][0];
      if (!leaf) return null;
      leaf.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    });
    await page.waitForTimeout(400);
    const panelText = await page.evaluate(() =>
      (document.getElementById('tree-node-panel')?.textContent || '').replace(/\s+/g, ' ').trim());
    check('clicking the active leaf opens the node panel with the verdict',
      !!panel && panelText.includes('Final Verdict') && panelText.includes('Predicted Priority') &&
      panelText.includes(EXPECT_PRIORITY),
      panelText.slice(0, 110) || 'panel not opened');
  } catch (err) {
    check('harness ran to completion', false, err.message);
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
