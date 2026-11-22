// Offline UI regression. No backend, webcam, model downloads or case data writes.
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const staticDir = path.resolve('case_priority_system/static');
// Explicit opt-in: download official runtime/model and test empty-frame inference.
// Still no people, webcam, backend, or courtroom data.
const modelSmoke = process.argv.includes('--model-smoke');
(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => { window.lucide = { createIcons() {} }; });
        const room = { room_id: 'ABCD', case_title: 'Synthetic UI fixture', status: 'live', participants: [], transcript: [], roles_available: ['Judge'], phase: 'Opening', face_summaries: [] };
        await page.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (modelSmoke && (url.href.startsWith('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/') ||
                url.href.startsWith('https://storage.googleapis.com/mediapipe-models/face_landmarker/'))) return route.continue();
            if (url.hostname !== 'anavaya.test') return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
            if (url.pathname.startsWith('/api/')) return route.fulfill({ json: url.pathname.includes('/rooms/ABCD') ? room : url.pathname.includes('rtc-config') ? { iceServers: [] } : {} });
            if (url.pathname === '/court/ABCD') {
                const html = fs.readFileSync(path.join(staticDir, 'courtroom.html'), 'utf8');
                return route.fulfill({ contentType: 'text/html', body: html });
            }
            const exactFile = path.join(staticDir, url.pathname);
            if (fs.existsSync(exactFile) && fs.statSync(exactFile).isFile()) {
                const ext = path.extname(exactFile);
                const mime = ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : ext === '.wasm' ? 'application/wasm' : 'application/octet-stream';
                return route.fulfill({ contentType: mime, body: fs.readFileSync(exactFile) });
            }
            const filename = path.join(staticDir, path.basename(url.pathname));
            if (fs.existsSync(filename) && /\.(js|css)$/.test(filename)) return route.fulfill({ contentType: filename.endsWith('.js') ? 'application/javascript' : 'text/css', body: fs.readFileSync(filename) });
            return route.fulfill({ body: '' });
        });
        await page.goto('http://anavaya.test/court/ABCD');
        await page.waitForFunction(() => !!window.__anavayaFace);
        const result = await page.evaluate(async () => {
            const F = window.__anavayaFace;
            const C = window.__anavayaCourt;
            C.state.me = { participant_id: 'TEST', name: 'Fixture', role: 'Judge', display_role: 'Judge' };
            F.state.landmarker = {}; F.state.camera = { stop() {} };
            let now = 100000;
            const originalNow = Date.now;
            Date.now = () => now;
            try {
                await F.start();
                const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
                const set = (i,x,y) => { lm[i] = {x,y,z:0}; };
                set(33,.3,.4);set(133,.4,.4);set(362,.6,.4);set(263,.7,.4);
                for (const i of [160,158,159]) set(i,.35,.385);
                for (const i of [153,144]) set(i,.35,.415);
                for (const i of [385,387,386]) set(i,.65,.385);
                for (const i of [373,380]) set(i,.65,.415);
                set(468,.35,.4);set(473,.65,.4);
                set(13,.5,.61);set(14,.5,.62);set(61,.43,.615);set(291,.57,.615);
                set(0,.5,.6);set(17,.5,.63);set(107,.4,.32);set(336,.6,.32);
                set(70,.3,.32);set(300,.7,.32);
                // The same pixel geometry in a differently proportioned frame
                // must keep the same eye aperture and mouth measurement.
                const square = F.extract(lm, 1);
                const wide = F.extract(lm.map(p => ({...p, y:p.y * 2})), 0.5);
                if (Math.abs(square.ear - wide.ear) > 1e-9 || Math.abs(square.lipOpen - wide.lipOpen) > 1e-9) throw new Error('Aspect-ratio-dependent measurements');
                const make = (values) => ({ faceLandmarks: [lm], faceBlendshapes: [{categories:Object.entries(values).map(([categoryName,score])=>({categoryName,score}))}] });
                const base = { eyeBlinkLeft: 0, eyeBlinkRight: 0, browDownLeft: 0, browDownRight: 0 };
                for(let i=0;i<55;i++){now+=50;F.onResults(make(base));}
                const calibrated = F.state.calibrated;
                for(let i=0;i<45;i++){now+=50;F.onResults(make({...base,browOuterUpLeft:.9,browOuterUpRight:.9}));}
                const action = document.getElementById('fm-expression').textContent;
                const stress = document.getElementById('fm-stress-val').textContent;
                // Exercise the real mouth-motion gate, not a mocked speaking flag.
                for(let i=0;i<80;i++) {
                    now+=50;set(14,.5,.62 + (i % 6) * .012);
                    F.onResults(make({...base,jawOpen:.9,mouthPressLeft:.9,mouthPressRight:.9}));
                }
                const speaking = F.state.speaking;
                const withheld = F.state.observer.lastOutput.actions.lip_press;
                const speechActivity = F.state.observer.lastOutput.activity;
                now+=50;F.onResults({faceLandmarks:[lm,lm]});
                const multiple = document.getElementById('fm-confidence').textContent;
                now+=50;F.onResults({faceLandmarks:[]});
                const missing = document.getElementById('fm-expression').textContent;
                const score = document.getElementById('face-score').textContent;
                F.stop(false);
                return {calibrated,action,stress,missing,score,speaking,withheld,speechActivity,multiple};
            } finally { Date.now = originalNow; }
        });
        assert.equal(result.calibrated, true);
        assert.match(result.action, /Brows raised/);
        assert.equal(result.stress, 'Not measurable from video');
        assert.equal(result.missing, 'Not assessable');
        assert.equal(result.score, '—');
        assert.equal(result.speaking, true);
        assert.equal(result.withheld, null);
        assert.equal(result.speechActivity, 0);
        assert.match(result.multiple, /Multiple faces/);
        assert.deepEqual(errors, []);
        console.log('PASS: courtroom UI calibration, aspect ratio, facial actions, speech gating, stress abstention, multiple/missing-face clearing; no page errors.');
        if (modelSmoke) {
            await page.evaluate(() => {
                window.__anavayaFace.state.landmarker = null;
                window.__anavayaFace.initPanel();
            });
            await page.waitForFunction(() => typeof window.__anavayaFace.state.landmarker?.detectForVideo === 'function', null, {timeout: 45000});
            const count = await page.evaluate(() => {
                const model = window.__anavayaFace.state.landmarker;
                const canvas = document.createElement('canvas'); canvas.width=640;canvas.height=480;
                const ctx = canvas.getContext('2d');ctx.fillStyle='#808080';ctx.fillRect(0,0,640,480);
                const result = model.detectForVideo(canvas, performance.now());
                model.close();
                return result.faceLandmarks.length;
            });
            assert.equal(count, 0);
            assert.deepEqual(errors, []);
            console.log('PASS: official MediaPipe runtime/model loaded; real empty-frame inference returns no face. This does not test human accuracy.');
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
