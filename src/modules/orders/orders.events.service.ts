import 'server-only';

import { createPartEvent } from '@/repos/orders';

export type PartEventInput = { orderId: string; partId: string; userId?: string | null; type: string; message: string; meta?: Record<string, unknown> | null };

export function recordPartEvent({ orderId, partId, userId, type, message, meta }: PartEventInput, db?: unknown) {
  return createPartEvent({ orderId, partId, userId: userId ?? null, type, message, meta: meta ?? null }, db);
}
