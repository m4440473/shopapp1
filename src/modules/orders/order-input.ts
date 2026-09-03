export function normalizeOrderQuantityInput(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : 1;
}
