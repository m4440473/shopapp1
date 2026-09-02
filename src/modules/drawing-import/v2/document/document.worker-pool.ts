import path from 'node:path';
import { spawn } from 'node:child_process';

import type { DocumentWorkerRequest, DocumentWorkerResponse } from './document.worker-protocol';

type QueueItem = {
  request: DocumentWorkerRequest;
  signal?: AbortSignal;
  resolve: (result: DocumentWorkerResponse) => void;
  reject: (error: Error) => void;
};

function abortError() {
  const error = new Error('Document worker request was cancelled.');
  error.name = 'AbortError';
  return error;
}

export async function executeDocumentWorker(
  request: DocumentWorkerRequest,
  options: { scriptPath?: string; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<DocumentWorkerResponse> {
  if (options.signal?.aborted) throw abortError();
  const scriptPath = options.scriptPath ?? path.join(process.cwd(), 'scripts', 'drawing-import-v2-document-worker.mjs');
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? 10 * 60 * 1_000);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (error?: Error, response?: DocumentWorkerResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      if (error) reject(error);
      else resolve(response!);
    };
    const onAbort = () => {
      child.kill();
      finish(abortError());
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(new Error(`Document worker timed out after ${timeoutMs} ms.`));
    }, timeoutMs);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      if (stdout.length > 16 * 1024 * 1024) {
        child.kill();
        finish(new Error('Document worker response exceeded 16 MB.'));
      }
    });
    child.stderr.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-32_768);
    });
    child.on('error', (error) => finish(error));
    child.on('close', (code) => {
      if (settled) return;
      if (code !== 0) {
        finish(new Error(`Document worker exited with code ${code}: ${stderr.trim() || 'no error details'}`));
        return;
      }
      try {
        const response = JSON.parse(stdout) as DocumentWorkerResponse;
        if (response.protocolVersion !== request.protocolVersion || response.requestId !== request.requestId) {
          throw new Error('Document worker returned a mismatched protocol response.');
        }
        if (!response.ok) throw new Error(response.error || 'Document worker failed.');
        finish(undefined, response);
      } catch (error) {
        finish(error instanceof Error ? error : new Error('Document worker returned invalid JSON.'));
      }
    });
    child.stdin.on('error', (error) => finish(error));
    child.stdin.end(JSON.stringify(request));
  });
}

export class BoundedDocumentWorkerPool {
  private active = 0;
  private readonly queue: QueueItem[] = [];
  private closed = false;

  constructor(private readonly options: { concurrency: number; scriptPath?: string; timeoutMs?: number }) {
    if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
      throw new Error('Document worker concurrency must be a positive integer.');
    }
  }

  run(request: DocumentWorkerRequest, signal?: AbortSignal) {
    if (this.closed) return Promise.reject(new Error('Document worker pool is closed.'));
    if (signal?.aborted) return Promise.reject(abortError());
    return new Promise<DocumentWorkerResponse>((resolve, reject) => {
      this.queue.push({ request, signal, resolve, reject });
      this.drain();
    });
  }

  close() {
    this.closed = true;
    while (this.queue.length) this.queue.shift()!.reject(new Error('Document worker pool is closed.'));
  }

  get pendingCount() {
    return this.queue.length;
  }

  get activeCount() {
    return this.active;
  }

  private drain() {
    while (!this.closed && this.active < this.options.concurrency && this.queue.length) {
      const item = this.queue.shift()!;
      if (item.signal?.aborted) {
        item.reject(abortError());
        continue;
      }
      this.active += 1;
      void executeDocumentWorker(item.request, {
        scriptPath: this.options.scriptPath,
        timeoutMs: this.options.timeoutMs,
        signal: item.signal,
      }).then(item.resolve, item.reject).finally(() => {
        this.active -= 1;
        this.drain();
      });
    }
  }
}
