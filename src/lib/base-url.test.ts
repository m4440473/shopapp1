import { describe, expect, it } from 'vitest';

import { resolveBaseUrl } from '@/lib/base-url';

describe('resolveBaseUrl', () => {
  it('prefers a LAN fallback when env points to localhost', () => {
    expect(
      resolveBaseUrl({
        envBaseUrl: 'http://localhost:3000',
        fallbackBaseUrl: 'http://192.168.1.25:3000',
      })
    ).toBe('http://192.168.1.25:3000');
  });

  it('keeps the configured env origin when both origins are non-loopback', () => {
    expect(
      resolveBaseUrl({
        envBaseUrl: 'http://10.0.0.20:3000',
        fallbackBaseUrl: 'http://192.168.1.25:3000',
      })
    ).toBe('http://10.0.0.20:3000');
  });

  it('falls back to the request origin when env is missing', () => {
    expect(resolveBaseUrl({ fallbackBaseUrl: 'http://192.168.1.25:3000' })).toBe(
      'http://192.168.1.25:3000'
    );
  });
});
