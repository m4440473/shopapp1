/** Only desktop-session failures should open the global sign-in dialog. */
export async function shouldPromptForSignIn(response: Response, input: RequestInfo | URL, init: RequestInit | undefined, origin: string) {
  const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(requestUrl, origin);
  if (url.origin !== origin) return false;
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  // A locked kiosk is a normal background state, not an expired desktop login.
  if (method === 'GET' && url.pathname === '/api/kiosk/session') return false;
  // Phone capability failures are handled by the upload page, not desktop auth.
  if (url.pathname.startsWith('/api/phone-upload/')) return false;
  // Signing in again cannot fix authorization or CSRF failures.
  if (response.status === 403) return false;
  if (response.status === 401) return true;
  if (!response.headers.get('content-type')?.includes('application/json')) return false;
  try { return (await response.clone().json())?.code === 'AUTH_REQUIRED'; }
  catch { return false; }
}
