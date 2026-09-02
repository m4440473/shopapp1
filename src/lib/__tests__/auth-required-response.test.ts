import { describe, expect, it } from 'vitest';
import { shouldPromptForSignIn } from '../auth-required-response';
const origin = 'http://shopapp.local';
const check = (status: number, url = '/api/orders/example', init?: RequestInit) => shouldPromptForSignIn(new Response('', { status }), url, init, origin);
describe('global sign-in prompt policy', () => {
  it('does not interrupt viewing an order for a locked kiosk probe', async () => {
    expect(await check(401, '/api/kiosk/session')).toBe(false);
    expect(await check(401, '/api/kiosk/session?probe=1')).toBe(false);
  });
  it('does not describe forbidden/CSRF errors as expired authentication', async () => {
    expect(await check(403)).toBe(false);
    expect(await check(403, '/api/admin/phone-upload', { method: 'POST' })).toBe(false);
  });
  it('still prompts for missing desktop authentication on protected reads and writes', async () => {
    expect(await check(401)).toBe(true);
    expect(await check(401, '/api/admin/phone-upload', { method: 'POST' })).toBe(true);
    expect(await check(401, '/api/kiosk/unlock', { method: 'POST' })).toBe(true);
  });
  it('leaves phone-link and third-party failures to their own error handlers', async () => {
    expect(await check(401, '/api/phone-upload/example', { method: 'POST' })).toBe(false);
    expect(await check(401, 'https://other.test/api/example')).toBe(false);
  });
  it('handles Request inputs and explicit AUTH_REQUIRED without consuming the response', async () => {
    const response = Response.json({ code: 'AUTH_REQUIRED' });
    expect(await shouldPromptForSignIn(response, new Request(origin + '/api/orders/example'), undefined, origin)).toBe(true);
    expect(await response.json()).toEqual({ code: 'AUTH_REQUIRED' });
    expect(await check(200)).toBe(false);
  });
});
