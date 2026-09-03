import 'server-only';
import { createStatusHistoryEntry, findOrderForWorkflowStatus, findOrderStatus, updateOrderStatus } from '@/repos/orders';
import { normalizeOrderWorkflowStatus, ORDER_WORKFLOW_STATUSES } from './orders.constants';
type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string | object };
const ok = <T,>(data: T): ServiceResult<T> => ({ ok: true, data });
const fail = <T,>(status: number, error: string | object): ServiceResult<T> => ({ ok: false, status, error });
const isPartComplete = (part: { status?: string | null }) => normalizeOrderWorkflowStatus(part.status) === 'COMPLETE';
export function deriveWorkflowStatusFromSnapshot(order: { status?: string | null; parts?: Array<{ id: string; status?: string | null }>; checklist?: Array<{ partId?: string | null; completed?: boolean | null; isActive?: boolean | null }>; timeEntries?: Array<{ id: string }>; partEvents?: Array<{ id: string }> }) {
  const current = normalizeOrderWorkflowStatus(order.status);
  if (current === 'CLOSED') return 'CLOSED';
  const parts = Array.isArray(order.parts) ? order.parts : [];
  const checklist = Array.isArray(order.checklist) ? order.checklist : [];
  if (parts.length > 0 && parts.every((part) => isPartComplete(part))) return 'COMPLETE';
  const hasCompletedChecklist = checklist.some((item) => item.completed === true);
  const hasTrackedActivity = Boolean(order.timeEntries?.length || order.partEvents?.length);
  return current === 'IN_PROGRESS' || hasCompletedChecklist || hasTrackedActivity ? 'IN_PROGRESS' : 'RECEIVED';
}
export async function syncOrderWorkflowStatus(orderId: string, { userId, tx }: { userId?: string | null; tx?: any } = {}) {
  const order = await findOrderForWorkflowStatus(orderId, tx);
  if (!order) return fail(404, 'Order not found');
  const nextStatus = deriveWorkflowStatusFromSnapshot(order);
  const currentStatus = normalizeOrderWorkflowStatus(order.status);
  if (currentStatus === nextStatus && order.status === nextStatus) return ok({ orderId, status: nextStatus, changed: false });
  if (currentStatus === nextStatus) { await updateOrderStatus(orderId, nextStatus); return ok({ orderId, status: nextStatus, changed: true }); }
  await updateOrderStatus(orderId, nextStatus);
  await createStatusHistoryEntry({ orderId, from: order.status ?? currentStatus, to: nextStatus, userId: userId ?? null, reason: 'Workflow status auto-synced from part activity.' });
  return ok({ orderId, status: nextStatus, changed: true });
}
export async function updateOrderWorkflowStatusByAdmin({ orderId, status, reason, userId, actorName }: { orderId: string; status: string; reason: string; userId?: string; actorName?: string | null }) {
  const requestedStatus = (status ?? '').trim().toUpperCase();
  if (!ORDER_WORKFLOW_STATUSES.includes(requestedStatus as (typeof ORDER_WORKFLOW_STATUSES)[number])) return fail(400, 'Invalid status');
  const normalizedStatus = requestedStatus as (typeof ORDER_WORKFLOW_STATUSES)[number];
  if (!reason.trim()) return fail(400, 'Reason is required');
  const existingOrder = await findOrderStatus(orderId);
  if (!existingOrder) return fail(404, 'Order not found');
  const updatedOrder = await updateOrderStatus(orderId, normalizedStatus);
  const actorLabel = actorName?.trim() || userId || 'Admin';
  await createStatusHistoryEntry({ orderId, from: normalizeOrderWorkflowStatus(existingOrder.status), to: normalizedStatus, userId, reason: `Admin status change by ${actorLabel}: ${reason.trim()}` });
  return ok({ order: updatedOrder });
}
