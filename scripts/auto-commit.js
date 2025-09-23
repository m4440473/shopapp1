#!/usr/bin/env node
// Auto-commit script: stages tracked changes and commits them periodically with a timestamp.
// WARNING: This will commit all tracked modifications. It intentionally ignores untracked files (like DB files).

const { execSync } = require('child_process');
const fs = require('fs');

const INTERVAL_MS = process.env.AUTO_COMMIT_INTERVAL_MS ? Number(process.env.AUTO_COMMIT_INTERVAL_MS) : 30_000; // 30s default

function run(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe' }).toString().trim();
  } catch (e) {
    return null;
  }
}

function hasChanges() {
  const out = run('git status --porcelain');
  return out && out.length > 0;
}

console.log('Auto-commit watcher starting. Interval:', INTERVAL_MS, 'ms');
setInterval(() => {
  try {
    // Stage modified files (tracked files only)
    run('git add -u');
    if (!hasChanges()) return;
    const msg = `auto-commit: ${new Date().toISOString()}`;
    run(`git commit -m "${msg}"`);
    run('git push origin main');
    console.log(new Date().toISOString(), '-> committed and pushed');
  } catch (err) {
    console.error('Auto-commit error:', err && err.message);
  }
}, INTERVAL_MS);

// Keep the process alive
process.stdin.resume();
