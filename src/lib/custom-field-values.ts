export type CustomFieldValueInput = {
  fieldId: string;
  value: unknown;
};

export const serializeCustomFieldValue = (value: unknown) => {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
};

export const parseCustomFieldValue = (value: string | null) => {
  if (value === null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const hasCustomFieldValue = (value: unknown) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};
