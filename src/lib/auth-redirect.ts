const SIGN_IN_PATH = '/auth/signin';

export function normalizeCallbackUrl(rawCallbackUrl?: string | null, fallback = '/'): string {
  if (!rawCallbackUrl) {
    return fallback;
  }

  if (!rawCallbackUrl.startsWith('/') || rawCallbackUrl.startsWith('//')) {
    return fallback;
  }

  return rawCallbackUrl;
}

export function buildSignInRedirectPath(rawCallbackUrl?: string | null): string {
  const callbackUrl = normalizeCallbackUrl(rawCallbackUrl, '');
  if (!callbackUrl) {
    return SIGN_IN_PATH;
  }

  const params = new URLSearchParams({ callbackUrl });
  return `${SIGN_IN_PATH}?${params.toString()}`;
}
