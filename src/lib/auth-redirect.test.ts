import { describe, expect, it } from 'vitest';
import { buildSignInRedirectPath, normalizeCallbackUrl } from '@/lib/auth-redirect';

describe('auth redirect helpers', () => {
  it('normalizes invalid callback URLs to fallback', () => {
    expect(normalizeCallbackUrl('https://evil.test', '/')).toBe('/');
    expect(normalizeCallbackUrl('//evil.test', '/')).toBe('/');
    expect(normalizeCallbackUrl('customers', '/')).toBe('/');
  });

  it('keeps valid internal callback URLs', () => {
    expect(normalizeCallbackUrl('/customers/123?tab=jobs', '/')).toBe('/customers/123?tab=jobs');
  });

  it('builds a sign-in path with encoded callback URL', () => {
    expect(buildSignInRedirectPath('/search?q=abc 123')).toBe('/auth/signin?callbackUrl=%2Fsearch%3Fq%3Dabc+123');
  });

  it('falls back to plain sign-in path when callback is invalid', () => {
    expect(buildSignInRedirectPath('https://evil.test')).toBe('/auth/signin');
  });
});
