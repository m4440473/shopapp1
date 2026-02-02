const globalForTestMode = globalThis as { __testModeLogged?: boolean };

export function isTestMode(): boolean {
  const enabled = process.env.TEST_MODE === 'true';
  if (enabled && process.env.NODE_ENV !== 'production' && !globalForTestMode.__testModeLogged) {
    globalForTestMode.__testModeLogged = true;
    // eslint-disable-next-line no-console
    console.log('[TEST_MODE] Enabled: using mock auth + in-memory repos.');
  }
  return enabled;
}
