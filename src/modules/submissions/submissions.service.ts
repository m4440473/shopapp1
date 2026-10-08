import 'server-only';
import { createHash } from 'node:crypto';
import { findCreatedSubmission } from './submissions.repo';
import type { CreatedSubmissionRecord, CreationSubmissionIdentity, CreationSubmissionScope } from './submissions.types';

export class SubmissionError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); }
}
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }

export function submissionIdentity(input: { actorId?: string | null; scope: string; clientKey: string | null; payload?: unknown }): CreationSubmissionIdentity | null {
  if (!input.clientKey) return null;
  if (!input.actorId) throw new SubmissionError('Sign in before submitting.', 401, 'SUBMISSION_AUTH_REQUIRED');
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(input.clientKey)) throw new SubmissionError('Invalid submission identifier.', 400, 'INVALID_SUBMISSION_KEY');
  if (!/^(quote:create|order:create|order:repeat:[a-zA-Z0-9_-]+|quote:convert:[a-zA-Z0-9_-]+)$/.test(input.scope)) throw new SubmissionError('Invalid submission operation.', 400, 'INVALID_SUBMISSION_SCOPE');
  return { key: hash(JSON.stringify([input.actorId, input.scope, input.clientKey])), payloadHash: hash(canonicalJson(input.payload)), kind: input.scope === 'quote:create' ? 'quote' : 'order' };
}

const active = new Map<string, { payloadHash: string; result: Promise<unknown> }>();

/** The durable unique key lives on the created record in its existing transaction. */
export async function runCreationSubmission<T>(identity: CreationSubmissionIdentity | null, create: () => Promise<T>, recover: (record: CreatedSubmissionRecord) => Promise<T>): Promise<T> {
  if (!identity) return create();
  const accept = (record: CreatedSubmissionRecord) => {
    if (record.submissionPayloadHash !== identity.payloadHash) throw new SubmissionError('This submission already saved different information. Recover the previous result before starting another submission.', 409, 'SUBMISSION_PAYLOAD_MISMATCH');
    return recover(record);
  };
  const pending = active.get(identity.key);
  if (pending) {
    if (pending.payloadHash !== identity.payloadHash) throw new SubmissionError('A submission with different information is still running. Retry its saved request.', 409, 'SUBMISSION_PAYLOAD_MISMATCH');
    const result = await pending.result as T;
    const saved = await findCreatedSubmission(identity);
    return saved ? accept(saved) : result;
  }
  const operation = (async () => {
    const existing = await findCreatedSubmission(identity);
    if (existing) return accept(existing);
    try { return await create(); }
    catch (error) {
      // A response/finalization failure or a concurrent unique-key winner may follow a committed create.
      const saved = await findCreatedSubmission(identity);
      if (saved) return accept(saved);
      throw error;
    }
  })();
  active.set(identity.key, { payloadHash: identity.payloadHash, result: operation });
  try { return await operation; }
  finally { if (active.get(identity.key)?.result === operation) active.delete(identity.key); }
}

export async function getCreationSubmissionStatus(actorId: string, scope: CreationSubmissionScope, clientKey: string) {
  const identity = submissionIdentity({ actorId, scope, clientKey });
  if (!identity) throw new SubmissionError('A submission identifier is required.', 400, 'INVALID_SUBMISSION_KEY');
  const found = await findCreatedSubmission(identity);
  return found ? { state: 'created' as const, id: found.id, kind: identity.kind, ...(found.orderNumber ? { orderNumber: found.orderNumber } : {}) } : { state: 'unknown' as const };
}
