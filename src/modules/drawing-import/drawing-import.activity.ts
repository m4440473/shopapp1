import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, unlink, writeFile } from 'node:fs/promises';

export function getDrawingImportActivityDirectory() {
  const configured = process.env.SHOPAPP_IMPORT_ACTIVITY_DIR?.trim();
  return configured || path.join(process.cwd(), '.runtime', 'drawing-import-active');
}

export async function beginDrawingImportActivity() {
  const directory = getDrawingImportActivityDirectory();
  await mkdir(directory, { recursive: true });

  const markerPath = path.join(directory, `${Date.now()}-${randomUUID()}.json`);
  const activityLogPath = process.env.SHOPAPP_IMPORT_ACTIVITY_LOG?.trim()
    || path.join(path.dirname(directory), 'drawing-import-events.log');
  const startedAtUtc = new Date().toISOString();
  await writeFile(markerPath, JSON.stringify({
    processId: process.pid,
    startedAtUtc,
  }), 'utf8');
  await appendFile(activityLogPath, `${startedAtUtc} begin pid=${process.pid} marker=${path.basename(markerPath)}\n`, 'utf8');

  let finished = false;
  return {
    markerPath,
    async record(event: string) {
      const safeEvent = event.replace(/[\r\n]+/g, ' ').trim().slice(0, 500);
      await appendFile(
        activityLogPath,
        `${new Date().toISOString()} stage pid=${process.pid} marker=${path.basename(markerPath)} event=${safeEvent}\n`,
        'utf8',
      );
    },
    async finish() {
      if (finished) return;
      finished = true;
      await unlink(markerPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      });
      await appendFile(
        activityLogPath,
        `${new Date().toISOString()} finish pid=${process.pid} marker=${path.basename(markerPath)}\n`,
        'utf8',
      );
    },
  };
}
