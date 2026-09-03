import 'server-only';

import { isDrawingPartAttachment } from '@/lib/attachment-visibility';
import { sanitizePricingForNonAdmin } from '@/lib/quote-visibility';
import { findOrderWithDetails, listDepartmentsOrdered, listOrders } from '@/repos/orders';
import { listTimeEntriesForPartsDetailed } from '@/repos/time';
import { LEGACY_IN_PROGRESS_ORDER_STATUSES, normalizeOrderWorkflowStatus } from './orders.constants';

type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string | object };
const ok = <T,>(data: T): ServiceResult<T> => ({ ok: true, data });
const fail = <T,>(status: number, error: string | object): ServiceResult<T> => ({ ok: false, status, error });
const getUserLabel = (user: { id?: string | null; name?: string | null; email?: string | null } | null | undefined) => user?.name?.trim() || user?.email?.trim() || user?.id || 'Unknown user';

export function buildPartActivityByPart(partIds: string[], entries: Array<{
  id: string; orderId: string; partId: string | null; departmentId: string | null; userId: string; operation: string | null;
  startedAt: Date; endedAt: Date | null; createdAt: Date; updatedAt: Date;
  user?: { id: string; name?: string | null; email?: string | null; active?: boolean | null } | null;
  department?: { id: string; name?: string | null } | null;
}>) {
  const partIdSet = new Set(partIds);
  const activityByPart = Object.fromEntries(partIds.map((partId) => [partId, { activeTimers: [] as Array<Record<string, unknown>>, timeByUser: [] as Array<Record<string, unknown>>, totalSeconds: 0 }])) as Record<string, { activeTimers: Array<Record<string, unknown>>; timeByUser: Array<Record<string, unknown>>; totalSeconds: number }>;
  const totalsByPartUser = new Map<string, { partId: string; user: { id: string; name?: string | null; email?: string | null; active?: boolean | null } | null; seconds: number }>();
  entries.forEach((entry) => {
    if (!entry.partId || !partIdSet.has(entry.partId)) return;
    const bucket = activityByPart[entry.partId];
    if (!bucket) return;
    if (!entry.endedAt) {
      bucket.activeTimers.push({ id: entry.id, orderId: entry.orderId, partId: entry.partId, departmentId: entry.departmentId, departmentName: entry.department?.name ?? null, userId: entry.userId, user: entry.user ?? null, operation: entry.operation ?? null, startedAt: entry.startedAt, elapsedSeconds: Math.max(0, Math.floor((Date.now() - entry.startedAt.getTime()) / 1000)) });
      return;
    }
    const diffMs = entry.endedAt.getTime() - entry.startedAt.getTime();
    if (diffMs <= 0) return;
    const seconds = Math.floor(diffMs / 1000);
    bucket.totalSeconds += seconds;
    const mapKey = `${entry.partId}:${entry.userId}`;
    const existing = totalsByPartUser.get(mapKey);
    if (existing) existing.seconds += seconds;
    else totalsByPartUser.set(mapKey, { partId: entry.partId, user: entry.user ?? null, seconds });
  });
  totalsByPartUser.forEach((entry) => activityByPart[entry.partId]?.timeByUser.push({ userId: entry.user?.id ?? null, user: entry.user ?? null, seconds: entry.seconds }));
  Object.values(activityByPart).forEach((entry) => {
    entry.activeTimers.sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    entry.timeByUser.sort((a: any, b: any) => b.seconds !== a.seconds ? b.seconds - a.seconds : getUserLabel(a.user ?? null).localeCompare(getUserLabel(b.user ?? null), undefined, { sensitivity: 'base' }));
  });
  return activityByPart;
}

export async function listOrdersForQuery(params: { q?: string; status?: string; priority?: string; assignedMachinistId?: string; customerId?: string; overdue?: boolean; awaitingMaterial?: boolean; take: number; cursor?: string | null }) {
  const { q, status, priority, assignedMachinistId, customerId, overdue, awaitingMaterial, take, cursor } = params;
  const where: Record<string, any> = {};
  if (q) where.OR = [{ orderNumber: { contains: q, mode: 'insensitive' } }, { customer: { name: { contains: q, mode: 'insensitive' } } }];
  if (status) {
    const normalizedStatus = normalizeOrderWorkflowStatus(status);
    if (normalizedStatus === 'CLOSED') where.status = { in: ['CLOSED'] };
    else if (normalizedStatus === 'COMPLETE') where.status = { in: ['COMPLETE'] };
    else if (normalizedStatus === 'RECEIVED') where.status = { in: ['NEW', 'RECEIVED'] };
    else where.status = { in: LEGACY_IN_PROGRESS_ORDER_STATUSES };
  }
  if (priority) where.priority = priority;
  if (assignedMachinistId) where.assignedMachinistId = assignedMachinistId;
  if (customerId) where.customerId = customerId;
  if (overdue) where.dueDate = { lt: new Date() };
  if (awaitingMaterial) where.AND = [...(where.AND ?? []), { materialNeeded: true, materialOrdered: false }];
  const items = await listOrders({ where, take, cursor });
  return ok({ items, nextCursor: items.length === take ? items[items.length - 1].id : null });
}

export async function getOrderDetails(id: string, options: { isAdmin: boolean; canUseTimerControls?: boolean }) {
  const order = await findOrderWithDetails(id);
  if (!order) return fail(404, 'Not found');
  const departments = await listDepartmentsOrdered();
  const partIds = Array.isArray(order.parts) ? order.parts.map((part: any) => part.id).filter(Boolean) : [];
  const partActivityById = partIds.length ? buildPartActivityByPart(partIds, await listTimeEntriesForPartsDetailed(partIds)) : {};
  const sanitized = sanitizePricingForNonAdmin(order, options.isAdmin) as any;
  if (!options.isAdmin) {
    sanitized.attachments = [];
    sanitized.partAttachments = Array.isArray(sanitized.partAttachments) ? sanitized.partAttachments.filter(isDrawingPartAttachment) : [];
  }
  sanitized.status = normalizeOrderWorkflowStatus(sanitized.status);
  sanitized.parts = Array.isArray(sanitized.parts) ? sanitized.parts.map((part: any) => {
    const isComplete = part.status === 'COMPLETE';
    return {
      ...part,
      attachments: options.isAdmin ? (Array.isArray(part.attachments) ? part.attachments : []) : (Array.isArray(part.attachments) ? part.attachments.filter(isDrawingPartAttachment) : []),
      currentDepartmentId: isComplete ? part.currentDepartmentId ?? null : part.currentDepartmentId ?? departments[0]?.id ?? null,
      status: isComplete ? 'COMPLETE' : 'IN_PROGRESS',
      instructionsVersion: Math.max(1, Number(part.instructionsVersion ?? 1)),
      workInstructions: part.workInstructions ?? '',
      assignments: Array.isArray(part.assignments) ? part.assignments : [],
      instructionReceipts: Array.isArray(part.instructionReceipts) ? part.instructionReceipts : [],
      partActivity: partActivityById[part.id] ?? { activeTimers: [], timeByUser: [], totalSeconds: 0 },
    };
  }) : sanitized.parts;
  return ok({ item: sanitized, departments, permissions: { canEditParts: options.isAdmin, canEditOrderStatus: options.isAdmin, canUseTimerControls: options.canUseTimerControls !== false } });
}
