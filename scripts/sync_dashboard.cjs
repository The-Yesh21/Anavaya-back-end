process.env.DANGEROUSLY_DEPLOY_VULNERABLE_TANSTACK_START_XSS = "1";

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

// Only these demonstration records are intended for the public offline dashboard.
// The four exhibition IDs are defined in ingest_showcase_cases.py.
const publicCaseIds = require('./public_case_ids.json');
const srcCases = path.join(repoRoot, 'case_priority_system', 'cases');
const apiDir = path.join(destDashboard, 'api');
const detailsDir = path.join(apiDir, 'cases');
const registry = [];
fs.mkdirSync(detailsDir, { recursive: true });

function writeJson(filename, data) {
  fs.writeFileSync(filename, JSON.stringify(data, null, 2) + '\n');
}

for (const id of publicCaseIds) {
  const localRecord = path.join(srcCases, id + '.json');
  const publishedRecord = path.join(detailsDir, id + '.json');
  const record = JSON.parse(fs.readFileSync(fs.existsSync(localRecord) ? localRecord : publishedRecord, 'utf8'));
  if (record.case_id !== id) throw new Error('Public case ID mismatch: ' + id);
  const documents = record.documents.map(({ doc_id, filename, doc_type, uploaded_at, priority, decision_report }) =>
    ({ doc_id, filename, doc_type, uploaded_at, priority, decision_report })
  );
  registry.push({
    case_id: id, title: record.title, created_at: record.created_at, created_by: record.created_by,
    source: record.source, aggregate_priority: record.aggregate_priority,
    case_level_priority: record.case_level?.priority ?? null,
    document_count: documents.length, session_count: 0, documents,
  });
  // Offline case files contain exhibits and analyses; live sessions stay on the backend.
  const publicDocuments = record.documents.map(({ path: localPath, ...document }) => document);
  writeJson(path.join(detailsDir, id + '.json'), { ...record, sessions: [], documents: publicDocuments });
}
registry.sort((a, b) => b.created_at.localeCompare(a.created_at));
writeJson(path.join(apiDir, 'case-registry.json'), registry);

console.log('[Sync] Dashboard assets synchronized successfully to public/dashboard.');
