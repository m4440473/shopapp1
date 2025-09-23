#!/usr/bin/env node
const path = require('path');
const cwd = process.cwd();

// If the current working directory contains any uppercase letters, warn and exit
// because Windows environments can treat different casings as distinct module ids
// which leads to duplicate module identity problems (Missing ActionQueueContext).
if (cwd !== cwd.toLowerCase()) {
  console.warn('\nWarning: Repository path contains uppercase letters which can cause module identity issues on Windows.');
  console.warn('Opened as:    ', cwd);
  console.warn('Recommendation: Close your editor and re-open the repository using a consistent path casing, or reclone into a lowercased path.');
  console.warn('Example: C:\\Users\\user\\Documents\\GitHub\\shopapp1 (use consistent casing)\n');
} else {
  console.log('Path casing check: OK');
}
// Always exit 0 so postinstall doesn't fail on shells that don't support POSIX operators
process.exit(0);
