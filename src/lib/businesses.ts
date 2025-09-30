export const BUSINESS_NAMES = [
  'Sterling Tool and Die',
  'C and R Machining',
  'Powder Coating',
] as const;

export type BusinessName = (typeof BUSINESS_NAMES)[number];

export interface BusinessOption {
  name: BusinessName;
  slug: string;
}

export function slugifyName(value: string | null | undefined, fallback = 'item'): string {
  const base = value?.toString().trim() ?? '';
  const normalized = base.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

  const slug = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || fallback;
}

export const BUSINESS_OPTIONS: readonly BusinessOption[] = BUSINESS_NAMES.map((name) => ({
  name,
  slug: slugifyName(name, 'business'),
}));
