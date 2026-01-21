import { prisma } from '@/lib/prisma';
import { normalizeTemplateLayout } from '@/lib/document-template-layout';

export type DocumentTemplateType = 'QUOTE' | 'INVOICE' | 'ORDER_PRINT';

export async function getActiveDocumentTemplate({
  documentType,
  businessCode,
}: {
  documentType: DocumentTemplateType;
  businessCode?: string | null;
}) {
  if (businessCode) {
    const scoped = await prisma.documentTemplate.findFirst({
      where: {
        documentType,
        businessCode,
        isActive: true,
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    if (scoped) {
      return scoped;
    }
  }

  return prisma.documentTemplate.findFirst({
    where: {
      documentType,
      businessCode: null,
      isActive: true,
    },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  });
}

export function parseTemplateLayout(layoutJson: unknown) {
  return normalizeTemplateLayout(layoutJson);
}
