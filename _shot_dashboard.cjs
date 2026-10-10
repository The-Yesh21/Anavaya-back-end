// Throwaway: screenshot the dashboard so the redesign can be judged visually.
// Captures light + dark at desktop and phone width, and reports the document's
// scrollWidth so a horizontal overflow (the phone header used to force one)
// shows up as a number instead of only as a cropped image.
const { chromium } = require('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8083';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = process.env.OUT || '_dash_shot';
const SIZES = [['desktop', 1440, 900], ['phone', 390, 844]];

// Layout stress test: fill the docket with the density the CSS must survive —
// six category rows and a three-way priority split — using exactly the markup
// the real renderer emits, so only the layout is under test. Pure DOM: no server
// state is touched.
function stressDocket() {
  const cats = [['Excise/Tax', 14], ['Theft', 11], ['Cyber Fraud', 7], ['Land Dispute', 5], ['Narcotics', 3], ['General Civil', 1]];
  const bars = document.getElementById('category-bars');
  if (bars) {
    bars.innerHTML = cats.map(([name, n], i) => `
      <div class="cat-bar-row" title="${name} — ${n} cases">
        <span class="cat-bar-rank">${i + 1}</span>
        <span class="cat-bar-name">${name}</span>
        <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${Math.round((n / 14) * 100)}%"></div></div>
        <span class="cat-bar-count">${n}</span>
      </div>`).join('');
  }
  const set = (id, pct) => { const el = document.getElementById(id); if (el) { el.hidden = pct === 0; el.style.width = pct + '%'; } };
  set('mix-seg-high', 34); set('mix-seg-medium', 45); set('mix-seg-low', 21);
  const key = document.getElementById('mix-key');
  if (key) {
    key.innerHTML = [['High', 34], ['Medium', 45], ['Low', 21]].map(([n, p]) =>
      `<li class="mix-key-item" title="${n} priority — ${p}% of cases on record">`
      + `<span class="legend-swatch swatch-${n.toLowerCase()}"></span>${n} <strong>${p}%</strong></li>`).join('');
  }
  [['stat-high-val', 14], ['stat-medium-val', 18], ['stat-low-val', 9]].forEach(([id, n]) => {
    const el = document.getElementById(id); if (el) el.textContent = n;
  });
  const total = document.getElementById('stat-total-val');
  if (total) total.textContent = '41';
  const dt = document.getElementById('donut-total-val');
  if (dt) dt.textContent = '41';
  const note = document.getElementById('docket-note');
  if (note) note.textContent = '41 cases on record · all ranked';
}
const THEMES = (process.env.THEMES || 'light,dark').split(',');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  for (const theme of THEMES) {
    for (const [name, width, height] of SIZES) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
      await page.addInitScript((t) => {
        try { localStorage.setItem('anavaya-theme', t); } catch (_) {}
      }, theme);
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2500);
      if (process.env.STRESS) await page.evaluate(stressDocket);
      await page.screenshot({ path: `${OUT}_${theme}_${name}.png`, fullPage: name === 'phone' });
      const box = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        theme: document.documentElement.dataset.theme,
        docket: document.querySelector('.docket-note') ? document.querySelector('.docket-note').textContent.trim() : null,
        mixKey: [...document.querySelectorAll('.mix-key-item')].map((n) => n.textContent.trim()),
        legend: [...document.querySelectorAll('.triage-legend-item')].map((n) => n.textContent.replace(/\s+/g, ' ').trim()),
        cats: [...document.querySelectorAll('.cat-bar-row')].map((n) => n.textContent.replace(/\s+/g, ' ').trim()),
        head: document.querySelector('.app-header') ? Math.round(document.querySelector('.app-header').getBoundingClientRect().height) : 0,
      }));
      console.log(`${theme}/${name} errors=${errors.length ? errors.slice(0, 3).join(' | ') : 'none'} ` +
                  `scrollW=${box.scrollWidth} clientW=${box.clientWidth} theme=${box.theme} headerH=${box.head}`);
      console.log('  note:', box.docket, '| key:', box.mixKey.join(' '), '| legend:', box.legend.join(' | '));
      console.log('  cats:', box.cats.join(' | '));
      await page.close();
    }
  }
  await browser.close();
})();
