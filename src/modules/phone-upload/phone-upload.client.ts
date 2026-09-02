import { PHONE_UPLOAD_LIMITS } from './phone-upload.types';

export const PHONE_UPLOAD_CLIENT_CONCURRENCY = 2;

export type PhoneUploadQueueState = 'queued' | 'uploading' | 'uploaded' | 'failed';

export type PhoneUploadQueueItem<T> = {
  id: string;
  value: T;
  size: number;
};

export type PhoneUploadQueueResult<T> = PhoneUploadQueueItem<T> & {
  state: 'uploaded' | 'failed';
  error: string | null;
};

export function preflightPhoneUploadSelection<T>(input: {
  existingCount: number;
  existingBytes: number;
  candidates: PhoneUploadQueueItem<T>[];
}) {
  const accepted: PhoneUploadQueueItem<T>[] = [];
  const rejected: Array<PhoneUploadQueueItem<T> & { reason: string }> = [];
  let count = input.existingCount;
  let bytes = input.existingBytes;

  for (const candidate of input.candidates) {
    if (count >= PHONE_UPLOAD_LIMITS.files) {
      rejected.push({ ...candidate, reason: `This batch can contain at most ${PHONE_UPLOAD_LIMITS.files} photos.` });
      continue;
    }
    if (bytes + candidate.size > PHONE_UPLOAD_LIMITS.totalBytes) {
      rejected.push({ ...candidate, reason: 'These selections would exceed the 95 MB batch limit.' });
      continue;
    }
    accepted.push(candidate);
    count += 1;
    bytes += candidate.size;
  }

  return { accepted, rejected, acceptedBytes: bytes - input.existingBytes };
}

export async function runBoundedPhoneUploads<T>(input: {
  items: PhoneUploadQueueItem<T>[];
  upload: (item: PhoneUploadQueueItem<T>) => Promise<void>;
  onState?: (id: string, state: PhoneUploadQueueState, error?: string) => void;
  concurrency?: number;
}) {
  const concurrency = Math.max(
    1,
    Math.min(PHONE_UPLOAD_CLIENT_CONCURRENCY, Math.floor(input.concurrency ?? PHONE_UPLOAD_CLIENT_CONCURRENCY)),
  );
  const results = new Array<PhoneUploadQueueResult<T>>(input.items.length);
  let cursor = 0;

  async function worker() {
    for (;;) {
      const index = cursor++;
      if (index >= input.items.length) return;
      const item = input.items[index];
      input.onState?.(item.id, 'uploading');
      try {
        await input.upload(item);
        input.onState?.(item.id, 'uploaded');
        results[index] = { ...item, state: 'uploaded', error: null };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed. Please retry.';
        input.onState?.(item.id, 'failed', message);
        results[index] = { ...item, state: 'failed', error: message };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, input.items.length || 1) }, worker));
  return results;
}
