import 'server-only';
import { prisma } from '@/lib/prisma';
import type { IntakeDraftKind } from './durable-intake-draft.types';

export type StoredIntakeDraft = {
  id: string; userId: string; kind: string; key: string; revision: number; dataJson: string | null;
  lastMutationId: string; clearedAt: Date | null; createdAt: Date; updatedAt: Date;
};
export type IntakeDraftOwnerKey = { userId: string; kind: IntakeDraftKind; key: string };

export function findDurableIntakeDraft(identity: IntakeDraftOwnerKey): Promise<StoredIntakeDraft | null> {
  return prisma.intakeDraft.findUnique({ where: { userId_kind_key: identity } });
}

export async function compareAndSwapIntakeDraft(input: IntakeDraftOwnerKey & {
  expectedRevision: number; mutationId: string; dataJson: string | null; reactivate?: boolean;
}): Promise<StoredIntakeDraft | null> {
  const { userId, kind, key, expectedRevision, mutationId, dataJson } = input;
  const values = { dataJson, lastMutationId: mutationId, clearedAt: dataJson === null ? new Date() : null };
  try {
    if (expectedRevision === 0) {
      return await prisma.intakeDraft.create({ data: { userId, kind, key, revision: 1, ...values } });
    }
    // The revision and tombstone check are part of the same native SQLite update.
    return await prisma.intakeDraft.update({
      where: {
        userId_kind_key: { userId, kind, key }, revision: expectedRevision,
        ...(dataJson !== null && !input.reactivate ? { clearedAt: null } : {}),
      },
      data: { ...values, revision: { increment: 1 } },
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && ['P2002', 'P2025'].includes(String(error.code))) return null;
    throw error;
  }
}
