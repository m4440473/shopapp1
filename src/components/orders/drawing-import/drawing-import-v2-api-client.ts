'use client';

import type { DrawingImportV2ApiClient } from './drawing-import-ui.types';

const base = '/api/admin/drawing-import';

async function json<T>(responseInput: Response | Promise<Response>): Promise<T> {
  const response = await responseInput;
  const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error || 'Drawing import request failed.');
  return payload;
}

function encoded(value: string | number) {
  return encodeURIComponent(String(value));
}

function requestId() {
  return globalThis.crypto?.randomUUID?.() ?? `drawing-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createQuoteDrawingImportV2ApiClient(destination: 'quote' | 'order' = 'quote'): DrawingImportV2ApiClient {
  return {
    getFeatureStatus: () => json(fetch(base, { cache: 'no-store' })),
    startQuoteImport: (input) => json(fetch(base, {
      method: 'POST',
      headers: {
        'Content-Type': input.file.type || 'application/octet-stream',
        'x-shopapp-destination': destination,
        'x-shopapp-filename': encoded(input.file.name),
        'x-shopapp-business': encoded(input.business),
        'x-shopapp-customer': encoded(input.customerName),
        'x-shopapp-draft-reference': encoded(input.draftReference),
        'x-shopapp-intake-mode': input.intakeMode,
        'x-shopapp-assembly-multiplier': String(input.assemblyMultiplier),
        'x-shopapp-import-idempotency-key': requestId(),
      },
      body: input.file,
    })),
    getJob: (jobId) => json(fetch(`${base}/${encodeURIComponent(jobId)}`, { cache: 'no-store' })),
    cancelJob: (jobId) => json(fetch(`${base}/${encodeURIComponent(jobId)}/cancel`, { method: 'POST' })),
    reprocessPage: (jobId, pageId) => json(fetch(`${base}/${encodeURIComponent(jobId)}/pages/${encodeURIComponent(pageId)}/reprocess`, { method: 'POST' })),
    saveCorrection: (input) => json(fetch(`${base}/${encodeURIComponent(input.jobId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'field', pageId: input.pageId, field: input.field, value: input.value }),
    })),
    saveClassification: (input) => json(fetch(`${base}/${encodeURIComponent(input.jobId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'classification', pageId: input.pageId, classification: input.classification }),
    })),
  };
}
