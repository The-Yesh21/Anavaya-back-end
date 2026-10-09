// UI check: Whole-Case Analysis now shows a PICTORIAL "Case at a glance"
// instead of the text overview section the user asked to remove.
// Against a live server (BASE, default local nginx :8083), dark theme:
//   1. "The case — what it is about" section and the chips row are GONE,
//   2. #case-level-glance renders: semicircle priority gauge (3 segments,
//      1 active, needle), 6 fact tiles with semantic level dots,
//      party avatars, evidence-corroboration map (nodes + link lines),
//   3. data matches the known case (Medium verdict, 6 docs, 4 links,
//      1 standalone ⚠ node),
//   4. zero console/page/404 errors (favicon baseline excluded).
// Screenshot: _analysis_glance.png.
const { chromium } = require('playwright-core');

const BASE = process.env.BASE || 'http://127.0.0.1:8083';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CASE_ID = process.env.CASE_ID || 'ANV-2026-0019';

const failures = [];
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures.push(name);
};
// Pre-existing baseline: site ships no favicon, so the browser's automatic
// /favicon.ico probe 404s. Scoped out by exact URL only.
const isBaselineNoise = (e) => e.includes('favicon.ico');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text() + ' @ ' + (m.location() && m.location().url));
  });
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
    await page.waitForFunction(() =>
      document.querySelectorAll('#case-level-glance .gmap-node').length > 0,
      { timeout: 20000 });

    const s = await page.evaluate(() => {
      const g = document.getElementById('case-level-glance');
      const q = (sel) => g ? g.querySelectorAll(sel).length : -1;
      return {
        glanceExists: !!g,
        overviewGone: !document.getElementById('case-level-overview'),
        chipsGone: !document.getElementById('case-level-chips'),
        sectionTextGone: !document.body.textContent.includes('The case — what it is about'),
        gaugeSvg: q('.glance-gauge svg'),
        segs: q('.gseg'),
        segsOn: q('.gseg.on'),
        needle: q('.gneedle'),
        needleClass: (g && g.querySelector('.gneedle') || {}).className?.baseVal || '',
        gaugeLabel: (g && g.querySelector('.glance-gauge-label')?.textContent || '').trim(),
        tiles: q('.glance-tile'),
        tileLabels: [...(g ? g.querySelectorAll('.gt-label') : [])].map(e => e.textContent.trim()),
        dots: q('.gt-dot'),
        avatars: q('.gp-avatar'),
        partiesLabel: (g && g.querySelector('.gp-label')?.textContent || '').trim(),
        mapNodes: q('.gmap-node'),
        mapSolo: q('.gmap-node.solo'),
        mapLinks: q('.gmap-link'),
        mapHead: (g && g.querySelector('.glance-map-head')?.textContent || '').replace(/\s+/g, ' ').trim(),
        // Rendered pixel sizes: the head icon must stay tiny even after
        // lucide swaps <i data-lucide> for <svg> (regression: the generic
        // .glance-map svg rule used to blow it up to full panel width).
        mapIconW: (() => { const el = g && g.querySelector('.glance-map-head svg'); return el ? Math.round(el.getBoundingClientRect().width) : -1; })(),
        mapSvgW: (() => { const el = g && g.querySelector('.glance-map > svg'); return el ? Math.round(el.getBoundingClientRect().width) : -1; })(),
        narrativeStillLeads: !!document.querySelector('#case-level-narrative .cl-case-desc'),
      };
    });

    check('glance container renders', s.glanceExists);
    check('"The case — what it is about" section removed', s.overviewGone && s.sectionTextGone);
    check('duplicate chips row removed', s.chipsGone);
    check('priority gauge present (3 segments, 1 active, needle)',
      s.gaugeSvg === 1 && s.segs === 3 && s.segsOn === 1 && s.needle === 1,
      `segs=${s.segs} on=${s.segsOn} needle=${s.needle}`);
    check('needle points at Medium (n-medium)', s.needleClass.includes('n-medium'), s.needleClass);
    check('gauge label = "Medium Priority"', s.gaugeLabel === 'Medium Priority', s.gaugeLabel);
    check('6 fact tiles', s.tiles === 6, s.tileLabels.join(' | '));
    check('tiles cover the merged signals',
      ['Category', 'Case type', 'Severity', 'Vulnerability', 'Influence', 'Evidence']
        .every(l => s.tileLabels.includes(l)));
    check('semantic level dots on severity/vulnerability/influence', s.dots === 3, `dots=${s.dots}`);
    check('party avatars rendered (6 shown of 7, +N chip)', s.avatars === 6,
      `avatars=${s.avatars}, label="${s.partiesLabel}"`);
    check('evidence map: 6 nodes, 4 links, 1 standalone ⚠ node',
      s.mapNodes === 6 && s.mapLinks === 4 && s.mapSolo === 1,
      `nodes=${s.mapNodes} links=${s.mapLinks} solo=${s.mapSolo}`);
    check('map head states the link count',
      /4 corroborating links across 6 documents/.test(s.mapHead), s.mapHead);
    check('map head link icon stays tiny after the lucide <i>→<svg> swap',
      s.mapIconW > 0 && s.mapIconW <= 20, `icon=${s.mapIconW}px`);
    check('map svg renders wide (icon must not steal its width:100%)',
      s.mapSvgW >= 200 && s.mapSvgW > s.mapIconW * 5, `map=${s.mapSvgW}px icon=${s.mapIconW}px`);
    check('case description still leads the narrative', s.narrativeStillLeads);

    await page.locator('#analysis-whole-case').screenshot({ path: '_analysis_glance.png' });
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
