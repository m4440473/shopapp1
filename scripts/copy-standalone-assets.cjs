const { cpSync, existsSync, mkdirSync, rmSync } = require('node:fs');
const { resolve } = require('node:path');

const projectRoot = resolve(__dirname, '..');
const buildDirectory = resolve(projectRoot, '.next');
const standaloneDirectory = resolve(buildDirectory, 'standalone');

if (!existsSync(buildDirectory)) {
  console.error('Missing .next build output. Run next build first.');
  process.exit(1);
}

mkdirSync(resolve(standaloneDirectory, '.next'), { recursive: true });

function replaceDirectory(source, destination) {
  if (!existsSync(source)) return;
  rmSync(destination, { recursive: true, force: true });
  cpSync(source, destination, { recursive: true });
}

replaceDirectory(
  resolve(buildDirectory, 'static'),
  resolve(standaloneDirectory, '.next', 'static'),
);
replaceDirectory(
  resolve(projectRoot, 'public'),
  resolve(standaloneDirectory, 'public'),
);

console.log('Standalone assets copied.');
