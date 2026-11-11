const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const srcStatic = path.join(repoRoot, 'case_priority_system', 'static');
const destDashboard = path.join(repoRoot, 'public', 'dashboard');

console.log('[Sync] Copying dashboard assets from', srcStatic, 'to', destDashboard);

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Copy dashboard static files
copyDirRecursive(srcStatic, destDashboard);

// 2. Copy sample cases for demo/offline viewing
const srcCases = path.join(repoRoot, 'case_priority_system', 'cases');
const destCases = path.join(destDashboard, 'cases');
if (fs.existsSync(srcCases)) {
  copyDirRecursive(srcCases, destCases);
}

console.log('[Sync] Dashboard assets synchronized successfully to public/dashboard.');
