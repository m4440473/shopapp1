export type RepeatOrderTemplateSummary = {
  id: string;
  name: string;
  customerId: string;
  customerName: string | null;
  sourceOrderId: string | null;
  sourceOrderNumber: string | null;
  business: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
  partCount: number;
};

export type RepeatOrderTemplatePartInput = {
  id: string;
  partNumber: string;
  quantity: number;
  materialId: string | null;
  stockSize: string | null;
  cutLength: string | null;
  notes: string | null;
  workInstructions: string | null;
  instructionsVersion: number;
  sortOrder: number;
  charges: Array<{
    id: string;
    departmentId: string;
    addonId: string | null;
    kind: string;
    name: string;
    description: string | null;
    quantity: string;
    unitPrice: string;
    sortOrder: number;
  }>;
  attachments: Array<{
    id: string;
    kind: string;
    url: string | null;
    storagePath: string | null;
    label: string | null;
    mimeType: string | null;
    sortOrder: number;
  }>;
};

export type RepeatOrderTemplateDetail = RepeatOrderTemplateSummary & {
  notes: string | null;
  vendorId: string | null;
  vendorName: string | null;
  materialNeeded: boolean;
  materialOrdered: boolean;
  modelIncluded: boolean;
  parts: RepeatOrderTemplatePartInput[];
  attachments: Array<{
    id: string;
    kind: string;
    url: string | null;
    storagePath: string | null;
    label: string | null;
    mimeType: string | null;
    sortOrder: number;
  }>;
};
