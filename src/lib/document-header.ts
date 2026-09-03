import type { BusinessCode } from '@/lib/businesses';

export type DocumentHeaderOptions = {
  businessName: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  email: string;
};

const SHARED_BUSINESS_EMAIL = 'acct.mgr@crmachinefab.com';

const BUSINESS_HEADER_PRESETS: Record<BusinessCode, DocumentHeaderOptions> = {
  STD: {
    businessName: 'Sterling Tool & Die, Inc.',
    addressLine1: '100 Tococo Ct',
    addressLine2: 'Wilmore, KY 40390',
    phone: '859-858-9327',
    email: SHARED_BUSINESS_EMAIL,
  },
  CRM: {
    businessName: 'C&R Machine & Fabrication, LLC',
    addressLine1: '744 Richmond Avenue',
    addressLine2: 'Nicholasville, KY 40356',
    phone: '859-887-4311',
    email: SHARED_BUSINESS_EMAIL,
  },
  PC: {
    businessName: 'Powder Coating',
    addressLine1: '',
    addressLine2: '',
    phone: '',
    email: SHARED_BUSINESS_EMAIL,
  },
};

function isBusinessCode(value: string | null | undefined): value is BusinessCode {
  return value === 'STD' || value === 'CRM' || value === 'PC';
}

export function getDocumentHeaderPreset(businessCode: string | null | undefined): DocumentHeaderOptions {
  if (isBusinessCode(businessCode)) {
    return { ...BUSINESS_HEADER_PRESETS[businessCode] };
  }

  return { ...BUSINESS_HEADER_PRESETS.STD };
}

export function normalizeDocumentHeaderOptions(
  options: unknown,
  businessCode: string | null | undefined,
): DocumentHeaderOptions {
  const preset = getDocumentHeaderPreset(businessCode);
  const record = options && typeof options === 'object' && !Array.isArray(options)
    ? (options as Record<string, unknown>)
    : {};

  const read = (key: keyof DocumentHeaderOptions) => {
    if (!Object.prototype.hasOwnProperty.call(record, key)) return preset[key];
    return typeof record[key] === 'string' ? record[key].trim() : preset[key];
  };

  return {
    businessName: read('businessName'),
    addressLine1: read('addressLine1'),
    addressLine2: read('addressLine2'),
    phone: read('phone'),
    email: read('email'),
  };
}
