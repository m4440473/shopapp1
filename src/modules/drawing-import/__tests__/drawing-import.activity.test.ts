import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { beginDrawingImportActivity, getDrawingImportActivityDirectory } from '../drawing-import.activity';

const originalActivityDirectory = process.env.SHOPAPP_IMPORT_ACTIVITY_DIR;
const originalActivityLog = process.env.SHOPAPP_IMPORT_ACTIVITY_LOG;
let temporaryDirectory: string | null = null;

afterEach(async () => {
  if (originalActivityDirectory === undefined) delete process.env.SHOPAPP_IMPORT_ACTIVITY_DIR;
  else process.env.SHOPAPP_IMPORT_ACTIVITY_DIR = originalActivityDirectory;
  if (originalActivityLog === undefined) delete process.env.SHOPAPP_IMPORT_ACTIVITY_LOG;
  else process.env.SHOPAPP_IMPORT_ACTIVITY_LOG = originalActivityLog;
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = null;
});

describe('drawing import activity markers', () => {
  it('uses the configured production-safe activity directory', () => {
    process.env.SHOPAPP_IMPORT_ACTIVITY_DIR = 'C:\\ShopApp\\logs\\drawing-import-active';
    expect(getDrawingImportActivityDirectory()).toBe('C:\\ShopApp\\logs\\drawing-import-active');
  });

  it('creates a traceable per-request marker and removes it idempotently', async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'shopapp-drawing-import-'));
    process.env.SHOPAPP_IMPORT_ACTIVITY_DIR = temporaryDirectory;
    process.env.SHOPAPP_IMPORT_ACTIVITY_LOG = path.join(temporaryDirectory, 'events.log');

    const activity = await beginDrawingImportActivity();
    const filesDuringImport = await readdir(temporaryDirectory);
    expect(filesDuringImport.sort()).toEqual(['events.log', path.basename(activity.markerPath)].sort());
    expect(JSON.parse(await readFile(activity.markerPath, 'utf8'))).toMatchObject({ processId: process.pid });

    await activity.record('raw-body-complete bytes=123');
    await activity.finish();
    await activity.finish();
    expect(await readdir(temporaryDirectory)).toEqual(['events.log']);
    expect(await readFile(path.join(temporaryDirectory, 'events.log'), 'utf8')).toMatch(/ begin[\s\S]*stage[\s\S]*raw-body-complete bytes=123[\s\S]* finish/);
  });

  it('guards monitor restarts only when an active import and live listener both exist', async () => {
    const installer = await readFile(
      path.join(process.cwd(), 'scripts', 'windows', 'install-shopapp-health-monitor.ps1'),
      'utf8',
    );

    expect(installer).toContain("'C:\\ShopApp\\app\\.runtime\\drawing-import-active'");
    expect(installer).toContain("'C:\\ShopApp\\app\\.next\\standalone\\.runtime\\drawing-import-active'");
    expect(installer).toContain('$activeImports.Count -gt 0 -and $runtimePresent');
    expect(installer).toContain("Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\"");
    expect(installer).toContain('$runtimeProcessIds -notcontains $markerProcessId');
    expect(installer).toContain('Stop-Process -Id $_.ProcessId -Force');
    expect(installer).toContain("$unresponsiveSincePath = 'C:\\ShopApp\\logs\\health-unresponsive-since.txt'");
    expect(installer).toContain("Write-HealthState -status 'pre-route-grace'");
    expect(installer).toContain('$unresponsiveMinutes -lt $preRouteGraceMinutes');
    expect(installer).toContain('Remove-Item -LiteralPath $marker.FullName');
    expect(installer).toContain("Write-HealthState -status 'busy-import'");
  });

  it('uses raw drawing bytes while retaining activity protection and multipart compatibility', async () => {
    const route = await readFile(
      path.join(process.cwd(), 'src', 'app', 'api', 'orders', 'drawing-import', 'route.ts'),
      'utf8',
    );
    const panel = await readFile(
      path.join(process.cwd(), 'src', 'components', 'orders', 'DrawingImportPanel.tsx'),
      'utf8',
    );
    expect(route.indexOf('beginDrawingImportActivity()')).toBeLessThan(route.indexOf('req.arrayBuffer()'));
    expect(route).toContain("req.headers.get('x-shopapp-upload') === 'drawing-raw-v1'");
    expect(route).toContain("activity.record('drawing-import-start')");
    expect(route).toContain('await activity.finish()');
    expect(panel).toContain("'x-shopapp-upload': 'drawing-raw-v1'");
    expect(panel).toContain('body: file');
  });

  it('brackets quote attachment multipart parsing independently', async () => {
    const route = await readFile(
      path.join(process.cwd(), 'src', 'app', 'api', 'admin', 'quotes', 'upload', 'route.ts'),
      'utf8',
    );
    expect(route.indexOf('beginDrawingImportActivity()')).toBeLessThan(route.indexOf('req.formData()'));
    expect(route).toContain('await activity.finish()');
  });

  it('runs production with headroom and durable fatal/exit diagnostics', async () => {
    const launcher = await readFile(
      path.join(process.cwd(), 'scripts', 'windows', 'start-shopapp.ps1'),
      'utf8',
    );

    expect(launcher).toContain('--max-old-space-size=12288');
    expect(launcher).toContain('--report-on-fatalerror');
    expect(launcher).toContain('--report-uncaught-exception');
    expect(launcher).toContain('runtime-exit.log');
    expect(launcher).toContain("SHOPAPP_IMPORT_ACTIVITY_DIR = 'C:\\ShopApp\\app\\.runtime\\drawing-import-active'");
    expect(launcher).toContain("SHOPAPP_IMPORT_ACTIVITY_LOG = 'C:\\ShopApp\\app\\.runtime\\drawing-import-events.log'");
  });
});
