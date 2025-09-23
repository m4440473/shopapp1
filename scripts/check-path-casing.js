#!/usr/bin/env node
const path = require('path');
const cwd = process.cwd();

// If the current working directory contains any uppercase letters, warn and exit
// because Windows environments can treat different casings as distinct module ids
// which leads to duplicate module identity problems (Missing ActionQueueContext).
if (cwd !== cwd.toLowerCase()) {
  console.error('\nError: Repository path contains uppercase letters which can cause module identity issues on Windows.');
  console.error('Opened as:    ', cwd);
  console.error('Recommendation: Close your editor and re-open the repository using a consistent path casing, or reclone into a lowercased path.');
  console.error('Example: C:\\Users\\user\\Documents\\GitHub\\shopapp1 (use consistent casing)\n');
  // exit with non-zero so postinstall fails and draws attention
  process.exit(1);
}

console.log('Path casing check: OK');
process.exit(0);
