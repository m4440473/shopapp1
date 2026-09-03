export type IntakeContactOption = {
  id: string;
  name: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  isPrimary?: boolean;
};

export type IntakeCustomerOption = {
  id: string;
  name: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  contacts?: IntakeContactOption[];
};

export function createIntakeKey() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function defaultIntakeDueDate(now = new Date(), days = 14) {
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + days);
  return dueDate.toISOString().slice(0, 10);
}

export function numberFromIntakeDraft(value: string | number | null | undefined) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '0'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function optionalIntakeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export async function extractIntakeError(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  if (typeof data?.error === 'string' && data.error.trim()) return data.error.trim();
  if (typeof data?.error?.message === 'string' && data.error.message.trim()) return data.error.message.trim();
  if (data?.error && typeof data.error === 'object') return JSON.stringify(data.error);
  return typeof data?.message === 'string' && data.message.trim() ? data.message.trim() : fallback;
}
