import 'server-only';

import { prisma } from '@/lib/prisma';

const reusablePartSelect = {
  id: true,
  partNumber: true,
  partName: true,
  materialId: true,
  drawingMaterialText: true,
  drawingFinishText: true,
  finish: true,
  stockSize: true,
  cutLength: true,
  finalPartLength: true,
  partWidth: true,
  partThickness: true,
  notes: true,
  workInstructions: true,
  updatedAt: true,
  material: { select: { name: true } },
  attachments: {
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    select: {
      kind: true,
      url: true,
      storagePath: true,
      label: true,
      mimeType: true,
    },
  },
  drawingImportPage: {
    select: {
      id: true,
      jobId: true,
      sourceFilename: true,
      sourcePageNumber: true,
      canonicalPdfStoragePath: true,
      finalExtractionJson: true,
      localExtractionJson: true,
    },
  },
  order: {
    select: {
      id: true,
      customerId: true,
      orderNumber: true,
      status: true,
      business: true,
      receivedDate: true,
      customer: { select: { name: true } },
    },
  },
} as const;

export function listHistoricalCustomerParts(input: {
  candidateLimit: number;
}) {
  return prisma.orderPart.findMany({
    orderBy: [{ order: { receivedDate: 'desc' } }, { updatedAt: 'desc' }, { id: 'desc' }],
    take: input.candidateLimit,
    select: reusablePartSelect,
  });
}

export function findHistoricalCustomerPart(input: { sourcePartId: string }) {
  return prisma.orderPart.findFirst({
    where: { id: input.sourcePartId },
    select: reusablePartSelect,
  });
}

export type HistoricalCustomerPartRecord = NonNullable<Awaited<ReturnType<typeof findHistoricalCustomerPart>>>;
