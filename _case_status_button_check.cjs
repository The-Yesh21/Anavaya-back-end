// State-aware workspace action button e2e (live server, BASE default
// local nginx :8083). Exercises the exact user story:
//   1. fully-analysed case  → button reads "View the analysis"; clicking it
//      opens the Analysis tab (Case tab is switched away first to prove it),
//   2. new case + evidence  → "Analyze the evidence" (+ status line),
//   3. run analysis         → back to "View the analysis",
//   4. add one more evidence → back to "Analyze the evidence",
//   5. click it             → analysis runs and the label returns to
//      "View the analysis" (proves the finally-reset is not stale),
//   6. test case + its generated artifacts deleted again (finally),
//      zero console/404 errors (pre-existing /favicon.ico excluded by URL).
// Note: the run also rewrites case_results.xlsx and cases/_index.json
// (next_seq bump) as a side effect of creating/deleting a case —
// `git checkout` those two if the data itself did not change for you.
const { chromium, request } = require('playwright-core');
const fs = require('fs');

const BASE = process.env.BASE || 'http://127.0.0.1:8083';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CASE_ID = process.env.CASE_ID || 'ANV-2026-0019';
const SAMPLE = process.env.SAMPLE || 'Sample_Medium_Priority_FIR.pdf';

const failures = [];
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures.push(name);
};
const isBaselineNoise = (e) => e.includes('favicon.ico');

(async () => {
  const api = await request.newContext({ baseURL: BASE, ignoreHTTPSErrors: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text() + ' @ ' + (m.location() && m.location().url));
  });
  page.on('response', (r) => { if (r.status() === 404) errors.push('404: ' + r.url()); });
  page.on('dialog', async (d) => { errors.push('dialog: ' + d.message()); await d.dismiss().catch(() => {}); });

  let testCaseId = null;

  const openCase = async (id) => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector(`.registry-case[data-case-id="${id}"] .registry-case-head`, { timeout: 20000 });
    await page.click(`.registry-case[data-case-id="${id}"] .registry-case-head`);
    await page.waitForFunction((cid) => {
      const cidEl = document.getElementById('workspace-case-id');
      return cidEl && cidEl.textContent.trim() === cid &&
        document.getElementById('workspace-analyze-btn');
    }, id, { timeout: 20000 });
    await page.waitForTimeout(300);
  };
  const btnState = () => page.evaluate(() => {
    const b = document.getElementById('workspace-analyze-btn');
    return {
      text: (b.textContent || '').replace(/\s+/g, ' ').trim(),
      action: b.dataset.action || '',
      rationale: ((document.getElementById('workspace-rationale') || {}).textContent || '').trim(),
    };
  });
  const upload = (id, name) => api.post(`/api/cases/${id}/documents`, {
    multipart: {
      file: { name, mimeType: 'application/pdf', buffer: fs.readFileSync(SAMPLE) },
      doc_type: 'Other',
    },
    timeout: 60000,
  });

  try {
    // ---- 1. fully-analysed case → "View the analysis" ----
    await page.addInitScript(() => { try { localStorage.setItem('anavaya-theme', 'dark'); } catch (_) {} });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#cases-registry-list .registry-case', { timeout: 20000 });
    await openCase(CASE_ID);
    let s = await btnState();
    check('analysed case: button = "View the analysis"', s.text === 'View the analysis', s.text);
    check('analysed case: action = view', s.action === 'view', s.action);

    // Prove clicking it navigates: switch away to the Case tab first.
    await page.click(".tab-btn[data-tab='case-tab']");
    await page.waitForFunction(() =>
      document.querySelector('.tab-btn.active')?.getAttribute('data-tab') === 'case-tab', { timeout: 5000 });
    await page.click('#workspace-analyze-btn');
    await page.waitForFunction(() =>
      document.querySelector('.tab-btn.active')?.getAttribute('data-tab') === 'details-tab' &&
      document.getElementById('analysis-whole-case')?.style.display !== 'none', { timeout: 10000 });
    check('"View the analysis" click opens the Analysis tab', true);

    // ---- 2. new case + evidence → "Analyze the evidence" ----
    const created = await api.post('/api/cases', {
      multipart: { case_title: 'ZZ Status Button Test', created_by: 'e2e' },
      timeout: 30000,
    });
    check('create test case (2xx)', created.ok(), String(created.status()));
    const cjson = await created.json();
    testCaseId = cjson.case_id || cjson.id || cjson.Case_File;
    check('test case id assigned', !!testCaseId, String(testCaseId));

    const up1 = await upload(testCaseId, 'ZZ Status Sample One.pdf');
    check('upload evidence #1 (2xx)', up1.ok(), String(up1.status()));

    await openCase(testCaseId);
    s = await btnState();
    check('pending evidence: button = "Analyze the evidence"', s.text === 'Analyze the evidence', s.text);
    check('pending evidence: action = analyze', s.action === 'analyze', s.action);
    check('status line names the pending document', /awaiting analysis/.test(s.rationale), s.rationale);

    // ---- 3. run analysis → "View the analysis" ----
    const an = await api.post(`/api/cases/${testCaseId}/analyze`, { timeout: 300000 });
    check('POST analyze (2xx)', an.ok(), String(an.status()));
    const after = await (await api.get(`/api/cases/${testCaseId}`)).json();
    check('whole-case verdict persisted', !!(after.case_level && after.case_level.priority),
      `case_level=${after.case_level && after.case_level.priority}`);

    await openCase(testCaseId);
    s = await btnState();
    check('after analysis: button = "View the analysis"', s.text === 'View the analysis', s.text);
    check('after analysis: action = view', s.action === 'view', s.action);

    // ---- 4. add one more evidence → back to "Analyze the evidence" ----
    const up2 = await upload(testCaseId, 'ZZ Status Sample Two.pdf');
    check('upload evidence #2 (2xx)', up2.ok(), String(up2.status()));

    await openCase(testCaseId);
    s = await btnState();
    check('new evidence added: button = "Analyze the evidence"', s.text === 'Analyze the evidence', s.text);
    check('new evidence added: status says the verdict needs updating', /new document on record/.test(s.rationale),
      s.rationale);

    // ---- 5. click it in the UI → analysis runs → label returns to View ----
    // The action buttons live in the Case tab's hero, so make sure that
    // tab is the visible one (analysed cases auto-open the Analysis tab).
    await page.click(".tab-btn[data-tab='case-tab']");
    await page.waitForFunction(() =>
      document.querySelector('.tab-btn.active')?.getAttribute('data-tab') === 'case-tab', { timeout: 5000 });
    await page.click('#workspace-analyze-btn');
    await page.waitForFunction(() =>
      (document.getElementById('workspace-analyze-btn')?.textContent || '').includes('View the analysis'),
      { timeout: 300000 });
    s = await btnState();
    check('UI analyze click returns to "View the analysis" (finally-reset not stale)',
      s.text === 'View the analysis' && s.action === 'view', `${s.text} / ${s.action}`);
  } finally {
    // ---- 6. cleanup: close the page first so no idle UI fetch races the
    //      deletion of the test case (that race produced a spurious 404),
    //      then remove the case we created ----
    await browser.close();
    if (testCaseId) {
      const del = await api.delete(`/api/cases/${testCaseId}`, { timeout: 30000 });
      console.log(`cleanup DELETE ${testCaseId}: ${del.status()}`);
      if (!del.ok()) failures.push('cleanup: test case delete failed');
      // Deleting a case leaves its generated artifacts behind (the app does
      // not prune them). Remove the ones this run created so repeated runs
      // do not dirty the working tree.
      for (const f of [
        `case_priority_system/decision_graphs/${testCaseId}_whole_case_decision_path.dot`,
        `case_priority_system/decision_graphs/${testCaseId}_whole_case_decision_report.md`,
        `case_priority_system/reports/${testCaseId}_whole_case_report.pdf`,
        'case_priority_system/decision_graphs/ZZ_Status_Sample_One_decision_path.dot',
        'case_priority_system/decision_graphs/ZZ_Status_Sample_One_decision_report.md',
        'case_priority_system/decision_graphs/ZZ_Status_Sample_Two_decision_path.dot',
        'case_priority_system/decision_graphs/ZZ_Status_Sample_Two_decision_report.md',
        'case_priority_system/reports/ZZ Status Sample One_report.pdf',
        'case_priority_system/reports/ZZ Status Sample Two_report.pdf',
      ]) {
        try { fs.rmSync(f, { force: true }); } catch (_) { /* best effort */ }
      }
    }
    await api.dispose();
  }

  const realErrors = errors.filter((e) => !isBaselineNoise(e));
  check('zero console/page/404/dialog errors (favicon baseline excluded)',
    realErrors.length === 0,
    realErrors.join(' ; ') || `clean${errors.length ? ` (${errors.length} favicon.ico baseline hit(s) ignored)` : ''}`);

  if (failures.length) {
    console.error(`\n${failures.length} CHECK(S) FAILED: ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log('\nALL CHECKS PASSED');
})().catch((e) => { console.error('HARNESS FAIL:', e); process.exit(1); });
