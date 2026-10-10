// Behavioural check for the courtroom transcript's statement assembly UI.
//
// The server folds consecutive push-to-talk segments from one speaker into a
// single transcript entry and re-broadcasts it with `replaces_entry_id`; this
// check drives the real client handler with exactly those messages and asserts
// the record completes the line it already shows instead of printing a second
// half-sentence, keeps every clip of the statement playable, and still appends
// ordinary (non-replacing) entries.
//
// Run against a live server:  node _courtroom_transcript_check.cjs
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
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    const created = await page.evaluate(async () => {
      const r = await fetch('/api/court/rooms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_title: 'Transcript assembly check' }),
      });
      return r.json();
    });
    roomId = created.room_id || '';
    await page.goto(BASE + '/court/' + roomId, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.__anavayaCourt && window.__anavayaCourt.pushMessage),
      null, { timeout: 20000 });

    out = await page.evaluate(async () => {
      const C = window.__anavayaCourt;
      const feed = () => document.getElementById('transcript-feed');
      // The room opens with its own system lines, so every assertion about the
      // record is made on the STATEMENT entries only.
      const statements = () => [...feed().querySelectorAll('.entry.kind-statement')];
      const statementText = () => statements().map((n) => n.querySelector('.entry-text').textContent.trim());
      const ts = (offset) => new Date(Date.now() + offset).toISOString();
      const res = {};

      // 1. the first segment of a spoken statement
      await C.pushMessage({
        type: 'transcript_entry',
        entry: {
          timestamp: ts(0), actor: 'Witness One', role: 'Witness 1', kind: 'statement',
          text: 'The accused was seen at the', audio_file: 'clip-a.wav',
          audio_files: ['clip-a.wav'], entry_id: 'ENT1', speaker_id: 'p1',
          last_segment_at: ts(0),
        },
        replaces_entry_id: '',
      });
      res.afterFirst = {
        count: statements().length,
        text: statementText(),
        id: statements()[0] && statements()[0].dataset.entryId,
        clips: statements()[0] ? statements()[0].querySelectorAll('.audio-play').length : 0,
      };
      const firstNode = statements()[0] || null;
      res.firstNodeIdentity = !!firstNode;

      // 2. the second segment completes it (server sends replaced id + all clips)
      await C.pushMessage({
        type: 'transcript_entry',
        entry: {
          timestamp: ts(0), actor: 'Witness One', role: 'Witness 1', kind: 'statement',
          text: 'The accused was seen at the warehouse at nine in the evening.',
          audio_file: 'clip-a.wav', audio_files: ['clip-a.wav', 'clip-b.wav'],
          entry_id: 'ENT1', speaker_id: 'p1', last_segment_at: ts(4000),
        },
        replaces_entry_id: 'ENT1',
        merged: true,
      });
      const node = statements()[0] || null;
      res.afterMerge = {
        count: statements().length,
        statementCount: statementText().length,
        text: statementText()[0],
        id: node && node.dataset.entryId,
        clips: node ? node.querySelectorAll('.audio-play').length : 0,
        downloads: node ? node.querySelectorAll('.audio-download').length : 0,
        mergedFlash: !!(node && node.classList.contains('entry-merged')),
        isSameNode: !!node && node === firstNode,
        rowIndex: node ? statements().indexOf(node) : -1,
        countLabel: (document.getElementById('transcript-count') || {}).textContent,
        audioUrls: node ? [...node.querySelectorAll('.audio-play')].map((b) => b.dataset.url) : [],
      };

      // 3. an ordinary entry still appends
      await C.pushMessage({
        type: 'transcript_entry',
        entry: {
          timestamp: ts(9000), actor: 'Justice Rao', role: 'Presiding Judge',
          kind: 'statement', text: 'The witness may step down.', audio_file: '',
          audio_files: [], entry_id: 'ENT2', speaker_id: 'p2', last_segment_at: ts(9000),
        },
      });
      res.afterAppend = { count: statements().length, texts: statementText() };

      // 4. a replace for an entry that is not on screen must still render
      await C.pushMessage({
        type: 'transcript_entry',
        entry: {
          timestamp: ts(12000), actor: 'Witness One', role: 'Witness 1', kind: 'statement',
          text: 'A statement this client never saw.', audio_file: '',
          audio_files: [], entry_id: 'ENT3', speaker_id: 'p1', last_segment_at: ts(12000),
        },
        replaces_entry_id: 'GONE',
      });
      res.unknownReplace = { count: statements().length, texts: statementText() };
      return res;
    });
  } catch (e) {
    check('client transcript path runs end-to-end', false, e.message);
    console.log(JSON.stringify({ checks, errors }, null, 2));
    await browser.close();
    process.exit(1);
  }

  console.log(JSON.stringify(out, null, 2));

  check('first spoken segment renders as one entry', out.afterFirst.count === 1, `count=${out.afterFirst.count}`);
  check('the first segment carries its clip', out.afterFirst.clips === 1, `clips=${out.afterFirst.clips}`);
  check('completing the sentence REPLACES the fragment (no second line)',
    out.afterMerge.statementCount === 1 && out.afterMerge.count === 1,
    `entries=${out.afterMerge.count} statements=${out.afterMerge.statementCount}`);
  check('the replaced line stays where it was', out.afterMerge.rowIndex === 0,
    `row=${out.afterMerge.rowIndex}`);
  check('the entry shows the completed sentence',
    out.afterMerge.text === 'The accused was seen at the warehouse at nine in the evening.',
    out.afterMerge.text);
  check('the fragment text is gone',
    !out.afterMerge.text.includes('at the\n') && !out.afterMerge.text.endsWith('at the'),
    out.afterMerge.text);
  check('both clips of the statement stay playable',
    out.afterMerge.clips === 2 && out.afterMerge.downloads === 2,
    `play=${out.afterMerge.clips} download=${out.afterMerge.downloads}`);
  check('the clip urls point at the room audio route',
    out.afterMerge.audioUrls.length === 2
    && out.afterMerge.audioUrls.every((u) => u.includes('/audio/clip-')),
    out.afterMerge.audioUrls.join(' '));
  check('the entry keeps the same identity', out.afterMerge.id === 'ENT1', `id=${out.afterMerge.id}`);
  check('the completed line is marked as merged', out.afterMerge.mergedFlash === true);
  check('an ordinary entry still appends', out.afterAppend.count === 2, `count=${out.afterAppend.count}`);
  check('an unknown replace id falls back to appending',
    out.unknownReplace.count === 3, `count=${out.unknownReplace.count}`);
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
