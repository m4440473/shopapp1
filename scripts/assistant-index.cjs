/* Local document index. Read-only business data; writes only the assistant cache.
 * Each parser runs in a bounded child process so corrupt files cannot stop the scan.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const { fork } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = process.env.SHOPAPP_ASSISTANT_DATA_DIR || path.resolve('.runtime/assistant');
const INDEX_VERSION = 1;

function contained(rootPath, filePath) {
  const rel = path.relative(rootPath, filePath);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}
async function parseFile(filename) {
  const buffer = await fs.readFile(filename);
  const ext = path.extname(filename).toLowerCase();
  if (buffer.length > 50 * 1024 * 1024) return { state: 'unsupported', method: 'metadata only: file exceeds 50 MB', text: '' };
  let worker;
  async function ocr(image) {
    const tesseract = require('tesseract.js');
    if (!worker) worker = await tesseract.createWorker('eng', tesseract.OEM.LSTM_ONLY, {
      langPath: require('@tesseract.js-data/eng').langPath, gzip: true,
      cachePath: root, logger: () => {},
    });
    return (await worker.recognize(image)).data.text;
  }
  try {
    if (ext === '.pdf') {
      const canvasApi = require('@napi-rs/canvas');
      global.DOMMatrix ||= canvasApi.DOMMatrix;
      global.Path2D ||= canvasApi.Path2D;
      global.ImageData ||= canvasApi.ImageData;
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useWorkerFetch: false,
        standardFontDataUrl: path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts').replace(/\\/g, '/') + '/',
      }).promise;
      const text = []; let usedOcr = false;
      try {
        for (let pageNumber = 1; pageNumber <= Math.min(doc.numPages, 60); pageNumber++) {
          const page = await doc.getPage(pageNumber);
          const content = await page.getTextContent();
          let pageText = content.items.map(x => x.str || '').join(' ');
          if (pageText.replace(/\s/g, '').length < 80) {
            const base = page.getViewport({ scale: 1 });
            const viewport = page.getViewport({ scale: Math.min(2, 2600 / Math.max(base.width, base.height)) });
            const canvas = canvasApi.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
            await page.render({ canvasContext: canvas.getContext('2d'), canvas, viewport }).promise;
            pageText += '\n' + await ocr(canvas.toBuffer('image/png')); usedOcr = true;
          }
          text.push(`[Page ${pageNumber}]\n${pageText}`);
          page.cleanup();
        }
        const joined = text.join('\n\n');
        return { state: doc.numPages > 60 || joined.length > 200000 ? 'partial' : 'indexed', method: usedOcr ? 'PDF text + local OCR' : 'PDF text', pages: doc.numPages, indexedPages: text.length, text: joined.slice(0, 200000) };
      } finally { await doc.destroy(); }
    }
    if (['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.webp'].includes(ext)) {
      const sharp = require('sharp');
      const metadata = await sharp(buffer).metadata();
      const image = await sharp(buffer).rotate().resize({ width: 3000, height: 3000, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
      return { state: metadata.pages > 1 ? 'partial' : 'indexed', method: 'Local OCR (image text; not geometry)', pages: metadata.pages || 1, indexedPages: 1, text: (await ocr(image)).slice(0, 200000) };
    }
    if (['.dxf', '.step', '.stp', '.iges', '.igs', '.svg', '.txt', '.csv'].includes(ext)) {
      const raw = buffer.toString('utf8');
      if (buffer.subarray(0, 22).toString().startsWith('AutoCAD Binary DXF')) return { state: 'unsupported', method: 'Binary DXF: metadata only', text: '' };
      let text = raw;
      if (ext === '.dxf') {
        const lines = raw.split(/\r?\n/); const labels = [];
        for (let i = 0; i + 1 < lines.length; i += 2) if (['1', '2', '3', '4', '8', '1000'].includes(lines[i].trim())) labels.push(lines[i + 1].replace(/\\P/g, '\n'));
        text = labels.join('\n');
      } else if (['.step', '.stp', '.iges', '.igs'].includes(ext)) {
        text = (raw.match(/'(?:[^']|'')*'/g) || []).join('\n');
      } else if (ext === '.svg') text = raw.replace(/<[^>]*>/g, ' ');
      return { state: 'partial', method: `${ext.slice(1).toUpperCase()} text/labels only; no geometry evaluation`, text: text.slice(0, 200000) };
    }
    return { state: 'unsupported', method: 'Metadata only; native/binary CAD requires PDF or ASCII DXF export for content search', text: '' };
  } finally { if (worker) await worker.terminate(); }
}

if (process.argv[2] === '--parse') {
  process.once('message', async filename => {
    try { process.send(await parseFile(filename)); }
    catch (e) { process.send({ state: 'error', method: 'Parser could not read file', text: '', error: String(e.message).slice(0, 200) }); }
    finally { process.exit(0); }
  });
} else if (require.main === module) {
  main().catch(e => { console.error(e.message); process.exitCode = 1; });
}

async function main() {
  await fs.mkdir(root, { recursive: true });
  const lockPath = path.join(root, 'index.lock');
  // The lock is only abandoned if its owning process is no longer alive.
  try {
    const pid = Number(await fs.readFile(lockPath, 'utf8'));
    try { process.kill(pid, 0); console.log('Indexer already running'); return; } catch (e) { if (e.code !== 'ESRCH') return; }
    await fs.unlink(lockPath);
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const lock = await fs.open(lockPath, 'wx');
  await lock.writeFile(String(process.pid));
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient();
  const target = path.join(root, 'documents.json');
  const old = await fs.readFile(target, 'utf8').then(JSON.parse).catch(() => ({ documents: {} }));
  const index = { version: INDEX_VERSION, status: 'indexing', updatedAt: new Date().toISOString(), processed: 0, total: 0, documents: {} };
  async function save() { index.updatedAt = new Date().toISOString(); await fs.writeFile(target + '.tmp', JSON.stringify(index)); await fs.rename(target + '.tmp', target); }
  try {
    const settings = await db.appSettings.findFirst({ select: { attachmentsDir: true } });
    const storageRoot = await fs.realpath(path.resolve(settings?.attachmentsDir || process.env.ATTACHMENTS_DIR || 'storage'));
    const paths = new Set();
    for (const table of ['attachment', 'partAttachment', 'quoteAttachment', 'quotePartAttachment']) {
      for (const file of await db[table].findMany({ select: { storagePath: true } })) if (file.storagePath) paths.add(file.storagePath);
    }
    index.total = paths.size;
    // Preserve old text during the scan, but drop attachments no longer registered.
    for (const storagePath of paths) if (old.documents[storagePath]) index.documents[storagePath] = old.documents[storagePath];
    await save();
    const hashes = new Map();
    for (const storagePath of paths) {
      try {
        const fullPath = await fs.realpath(path.resolve(storageRoot, storagePath));
        if (!contained(storageRoot, fullPath)) throw new Error('Path is outside attachment root');
        const stat = await fs.stat(fullPath);
        if (!stat.isFile()) throw new Error('Not a file');
        const signature = `${INDEX_VERSION}:${stat.size}:${stat.mtimeMs}`;
        if (old.documents[storagePath]?.signature === signature && old.documents[storagePath]?.state !== 'error') {
          index.documents[storagePath] = old.documents[storagePath];
        } else if (stat.size > 50 * 1024 * 1024) {
          index.documents[storagePath] = { storagePath, signature, state: 'unsupported', method: 'File exceeds 50 MB', text: '' };
        } else {
          const hash = createHash('sha256').update(await fs.readFile(fullPath)).digest('hex');
          let result = hashes.get(hash);
          if (!result) {
            result = await new Promise(resolve => {
              const child = fork(__filename, ['--parse'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true });
              const timer = setTimeout(() => { child.kill(); resolve({ state: 'error', method: 'Parsing exceeded 120 seconds; metadata remains searchable', text: '' }); }, 120000);
              child.once('message', value => { clearTimeout(timer); resolve(value); });
              child.once('error', () => { clearTimeout(timer); resolve({ state: 'error', method: 'Parser unavailable', text: '' }); });
              child.once('exit', code => { clearTimeout(timer); if (code) resolve({ state: 'error', method: 'Parser stopped', text: '' }); });
              child.send(fullPath);
            });
            hashes.set(hash, result);
          }
          index.documents[storagePath] = { storagePath, signature, hash, ...result };
        }
      } catch { index.documents[storagePath] = { storagePath, state: 'missing', method: 'File not available in configured attachment storage', text: '' }; }
      index.processed++;
      await save();
      console.log(`Indexed ${index.processed}/${index.total}`);
    }
    index.status = 'ready'; await save();
  } finally { await db.$disconnect(); await lock.close(); await fs.unlink(lockPath).catch(() => {}); }
}
module.exports = { parseFile, contained };
