// Compatibility entry point for isolated facial-observation regressions.
// No live API, webcam, model download or production courtroom writes.
// Synthetic fixtures verify software behavior, not human emotion accuracy.
const { spawnSync } = require('node:child_process');
const suites = [
    ['--test', 'case_priority_system/tests/face_observations.test.cjs'],
    ['case_priority_system/tests/face_observations_browser.cjs'],
];
for (const args of suites) {
    const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
    if (result.error) { console.error(result.error); process.exit(1); }
    if (result.status !== 0) process.exit(result.status || 1);
}
