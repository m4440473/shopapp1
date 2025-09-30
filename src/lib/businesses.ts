export const BUSINESS_CODE_VALUES = ['STD', 'CRM', 'PC'] as const;

const BUSINESS_CONFIG = [
  { code: BUSINESS_CODE_VALUES[0], name: 'Sterling Tool and Die', prefix: 'STD' },
  { code: BUSINESS_CODE_VALUES[1], name: 'C and R Machining', prefix: 'CRM' },
  { code: BUSINESS_CODE_VALUES[2], name: 'Powder Coating', prefix: 'PC' },
] as const;

export type BusinessCode = (typeof BUSINESS_CONFIG)[number]['code'];
export type BusinessName = (typeof BUSINESS_CONFIG)[number]['name'];

export const BUSINESS_CODES = BUSINESS_CODE_VALUES;
export const BUSINESS_NAMES = BUSINESS_CONFIG.map((item) => item.name) as readonly BusinessName[];

export interface BusinessOption {
  code: BusinessCode;
  name: BusinessName;
  slug: string;
  prefix: string;
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

export const BUSINESS_OPTIONS: readonly BusinessOption[] = BUSINESS_CONFIG.map((item) => ({
  code: item.code,
  name: item.name,
  slug: slugifyName(item.name, 'business'),
  prefix: item.prefix,
}));

export const BUSINESS_PREFIX_BY_CODE: Record<BusinessCode, string> = BUSINESS_OPTIONS.reduce(
  (acc, option) => {
    acc[option.code] = option.prefix;
    return acc;
  },
  {} as Record<BusinessCode, string>,
);

export const BUSINESS_NAME_BY_CODE: Record<BusinessCode, BusinessName> = BUSINESS_OPTIONS.reduce(
  (acc, option) => {
    acc[option.code] = option.name;
    return acc;
  },
  {} as Record<BusinessCode, BusinessName>,
);

export const BUSINESS_CODE_BY_NAME: Record<BusinessName, BusinessCode> = BUSINESS_OPTIONS.reduce(
  (acc, option) => {
    acc[option.name] = option.code;
    return acc;
  },
  {} as Record<BusinessName, BusinessCode>,
);

export function getBusinessOptionByCode(code: string | null | undefined): BusinessOption | undefined {
  if (!code) return undefined;
  return BUSINESS_OPTIONS.find((option) => option.code === code) ?? undefined;
}

export function getBusinessOptionByName(name: string | null | undefined): BusinessOption | undefined {
  if (!name) return undefined;
  return BUSINESS_OPTIONS.find((option) => option.name === name) ?? undefined;
}

export function businessNameFromCode(
  code: string | null | undefined,
  fallback: BusinessName = BUSINESS_OPTIONS[0]?.name ?? 'Sterling Tool and Die',
): BusinessName {
  const option = getBusinessOptionByCode(code);
  return option?.name ?? fallback;
}

export function businessCodeFromName(
  name: string | null | undefined,
  fallback?: BusinessCode,
): BusinessCode | undefined {
  if (!name) return fallback;
  const option = getBusinessOptionByName(name as BusinessName);
  return option?.code ?? fallback;
}

export function businessPrefixFromCode(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  const option = getBusinessOptionByCode(code);
  return option?.prefix;
}
