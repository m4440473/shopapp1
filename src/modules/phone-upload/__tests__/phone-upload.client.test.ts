import { describe, expect, it } from 'vitest';

import {
  PHONE_UPLOAD_CLIENT_CONCURRENCY,
  preflightPhoneUploadSelection,
  runBoundedPhoneUploads,
} from '../phone-upload.client';
import { PHONE_UPLOAD_LIMITS } from '../phone-upload.types';

describe('phone upload client queue', () => {
  it('preflights the combined remote, queued, and newly selected batch', () => {
    const result = preflightPhoneUploadSelection({
      existingCount: 2,
      existingBytes: PHONE_UPLOAD_LIMITS.totalBytes - 7,
      candidates: [
        { id: 'fits', value: 'fits', size: 7 },
        { id: 'too-large', value: 'too-large', size: 1 },
      ],
    });

    expect(result.accepted.map(item => item.id)).toEqual(['fits']);
    expect(result.rejected).toMatchObject([{ id: 'too-large', reason: expect.stringContaining('95 MB') }]);
  });

  it('uploads at most two photos concurrently and preserves per-file failures', async () => {
    let active = 0;
    let maximum = 0;
    const releases: Array<() => void> = [];
    const items = Array.from({ length: 5 }, (_, index) => ({ id: `photo-${index}`, value: index, size: 10 }));
    const operation = runBoundedPhoneUploads({
      items,
      upload: async item => {
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise<void>(resolve => releases.push(resolve));
        active -= 1;
        if (item.id === 'photo-2') throw new Error('network interrupted');
      },
    });

    for (let index = 0; index < items.length; index += 1) {
      while (!releases[index]) await Promise.resolve();
      releases[index]();
    }
    const results = await operation;

    expect(maximum).toBe(PHONE_UPLOAD_CLIENT_CONCURRENCY);
    expect(results.filter(result => result.state === 'uploaded')).toHaveLength(4);
    expect(results.find(result => result.id === 'photo-2')).toMatchObject({ state: 'failed', error: 'network interrupted' });
  });

  it('can retry only failed items without re-running completed request IDs', async () => {
    const calls: string[] = [];
    const first = await runBoundedPhoneUploads({
      items: [
        { id: 'stable-a', value: 'a', size: 1 },
        { id: 'stable-b', value: 'b', size: 1 },
      ],
      upload: async item => {
        calls.push(item.id);
        if (item.id === 'stable-b') throw new Error('offline');
      },
    });
    const failed = first.filter(result => result.state === 'failed');
    await runBoundedPhoneUploads({ items: failed, upload: async item => { calls.push(item.id); } });

    expect(calls).toEqual(['stable-a', 'stable-b', 'stable-b']);
  });
});
