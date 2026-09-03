const { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } = require('node:fs');
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
// pdfjs-dist is intentionally resolved through a dynamic runtime specifier,
// so Next's static tracer cannot discover its fonts/runtime.
replaceDirectory(
  resolve(projectRoot, 'node_modules', 'pdfjs-dist'),
  resolve(standaloneDirectory, 'node_modules', 'pdfjs-dist'),
);

const pdfWorkerSource = resolve(projectRoot, 'scripts', 'render-pdf-packet.mjs');
const imageExtractionWorkerSource = resolve(projectRoot, 'scripts', 'extract-drawing-image.mjs');
const drawingImportV2WorkerSource = resolve(projectRoot, 'scripts', 'drawing-import-v2-document-worker.mjs');
const standaloneScripts = resolve(standaloneDirectory, 'scripts');
if (existsSync(pdfWorkerSource)) {
  mkdirSync(standaloneScripts, { recursive: true });
  copyFileSync(pdfWorkerSource, resolve(standaloneScripts, 'render-pdf-packet.mjs'));
}
if (existsSync(imageExtractionWorkerSource)) {
  mkdirSync(standaloneScripts, { recursive: true });
  copyFileSync(imageExtractionWorkerSource, resolve(standaloneScripts, 'extract-drawing-image.mjs'));
}
if (existsSync(drawingImportV2WorkerSource)) {
  mkdirSync(standaloneScripts, { recursive: true });
  copyFileSync(drawingImportV2WorkerSource, resolve(standaloneScripts, 'drawing-import-v2-document-worker.mjs'));
}

// A static require.resolve('pdfjs-dist/package.json') is rewritten by Next to
// a numeric webpack module id. That compiles successfully but crashes the
// standalone drawing importer when path.dirname receives the number.
const serverChunksDirectory = resolve(buildDirectory, 'server', 'chunks');
if (existsSync(serverChunksDirectory)) {
  for (const filename of readdirSync(serverChunksDirectory)) {
    if (!filename.endsWith('.js')) continue;
    const content = readFileSync(resolve(serverChunksDirectory, filename), 'utf8');
    if (/dirname\(\d+\),["']standard_fonts["']/.test(content)) {
      throw new Error(`Unsafe bundled PDF.js path resolver detected in .next/server/chunks/${filename}.`);
    }
  }
}

console.log('Standalone assets copied.');
