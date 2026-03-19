const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function parseUrl(rawUrl?: string | null) {
  if (!rawUrl) {
    return null;
  }

  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname: string) {
  return LOOPBACK_HOSTS.has(hostname) || hostname.endsWith('.localhost');
}

export function resolveBaseUrl({
  envBaseUrl,
  fallbackBaseUrl,
}: {
  envBaseUrl?: string | null;
  fallbackBaseUrl?: string | null;
}) {
  const parsedEnvBaseUrl = parseUrl(envBaseUrl);
  const parsedFallbackBaseUrl = parseUrl(fallbackBaseUrl);

  if (parsedEnvBaseUrl && parsedFallbackBaseUrl) {
    if (isLoopbackHostname(parsedEnvBaseUrl.hostname) && !isLoopbackHostname(parsedFallbackBaseUrl.hostname)) {
      return parsedFallbackBaseUrl.origin;
    }

    return parsedEnvBaseUrl.origin;
  }

  if (parsedEnvBaseUrl) {
    return parsedEnvBaseUrl.origin;
  }

  if (parsedFallbackBaseUrl) {
    return parsedFallbackBaseUrl.origin;
  }

  return '';
}
