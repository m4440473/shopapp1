export const ORDER_WORKFLOW_STATUSES = ['RECEIVED', 'IN_PROGRESS', 'COMPLETE', 'CLOSED'] as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Received',
  IN_PROGRESS: 'In progress',
  COMPLETE: 'Complete',
  CLOSED: 'Closed',
};

const LEGACY_RECEIVED_STATUSES = new Set(['NEW', 'RECEIVED']);
const LEGACY_COMPLETE_STATUSES = new Set(['COMPLETE']);
const LEGACY_CLOSED_STATUSES = new Set(['CLOSED']);
const LEGACY_IN_PROGRESS_STATUSES = new Set([
  'PROGRAMMING',
  'SETUP',
  'RUNNING',
  'FINISHING',
  'DONE_MACHINING',
  'INSPECTING',
  'INSPECTION',
  'READY_FOR_ADDONS',
  'SHIPPING',
  'IN_PROGRESS',
]);

export const LEGACY_IN_PROGRESS_ORDER_STATUSES = Array.from(LEGACY_IN_PROGRESS_STATUSES);

export function normalizeOrderWorkflowStatus(status: string | null | undefined) {
  const value = (status ?? '').trim().toUpperCase();
  if (LEGACY_CLOSED_STATUSES.has(value)) return 'CLOSED';
  if (LEGACY_COMPLETE_STATUSES.has(value)) return 'COMPLETE';
  if (LEGACY_IN_PROGRESS_STATUSES.has(value)) return 'IN_PROGRESS';
  if (LEGACY_RECEIVED_STATUSES.has(value)) return 'RECEIVED';
  return 'RECEIVED';
}
