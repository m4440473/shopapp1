import 'server-only';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { assistantDataRoot } from './assistant.storage';

export type IndexedDocument = { storagePath: string; state: string; method: string; text: string; pages?: number; indexedPages?: number; error?: string };
export type DocumentIndex = { updatedAt?: string; status?: string; processed?: number; total?: number; documents: Record<string, IndexedDocument> };
export async function readDocumentIndex(): Promise<DocumentIndex> {
  try { return JSON.parse(await readFile(path.join(assistantDataRoot(), 'documents.json'), 'utf8')); }
  catch { return { documents: {} }; }
}
export function attachmentHref(storagePath: string | null) {
  if (!storagePath) return null;
  const segments = storagePath.replace(/\\/g, '/').split('/');
  if (segments.some(s => !s || s === '..' || s === '.' || s.includes(':'))) return null;
  return `/attachments/${segments.map(encodeURIComponent).join('/')}`;
}
export function searchSnippet(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  const found = terms.map(t => lower.indexOf(t.toLowerCase())).filter(n => n >= 0);
  const start = found.length ? Math.max(0, Math.min(...found) - 100) : 0;
  return text.slice(start, start + 1000);
}
