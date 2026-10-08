import 'server-only';
import { prisma } from '@/lib/prisma';
import type { CreatedSubmissionRecord, CreationSubmissionIdentity } from './submissions.types';

export async function findCreatedSubmission(identity: Pick<CreationSubmissionIdentity, 'key' | 'kind'>): Promise<CreatedSubmissionRecord | null> {
  return identity.kind === 'quote'
    ? prisma.quote.findUnique({ where: { submissionKey: identity.key }, select: { id: true, submissionPayloadHash: true } })
    : prisma.order.findUnique({ where: { submissionKey: identity.key }, select: { id: true, orderNumber: true, submissionPayloadHash: true, parts: { select: { id: true }, orderBy: { createdAt: 'asc' } } } });
}
