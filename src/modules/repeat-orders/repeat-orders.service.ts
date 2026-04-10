import 'server-only';

import { Prisma } from '@prisma/client';
import { BUSINESS_PREFIX_BY_CODE, type BusinessCode } from '@/lib/businesses';
import {
  ensureOrderFilesInCanonicalStorage,
  generateNextOrderNumber,
  initializeCurrentDepartmentForOrder,
  syncChecklistForOrder,
  syncOrderWorkflowStatus,
} from '@/modules/orders/orders.service';
import type {
  RepeatOrderTemplateCreateFromOrderInput,
  RepeatOrderTemplateCreateOrderInput,
  RepeatOrderTemplateListQueryInput,
} from './repeat-orders.schema';
import {
  createOrderFromRepeatTemplate,
  createRepeatOrderTemplate,
  findOrderTemplateSource,
  findRepeatOrderTemplateById,
  listRepeatOrderTemplates,
} from './repeat-orders.repo';

type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string | object };

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

function fail<T>(status: number, error: string | object): ServiceResult<T> {
  return { ok: false, status, error };
}

function mapTemplateSummary(item: any) {
  return {
    id: item.id,
    name: item.name,
    customerId: item.customerId,
    customerName: item.customer?.name ?? null,
    sourceOrderId: item.sourceOrderId ?? null,
    sourceOrderNumber: item.sourceOrder?.orderNumber ?? null,
    business: item.business,
    priority: item.priority,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    partCount: Array.isArray(item.parts) ? item.parts.length : 0,
  };
}

function buildDefaultTemplateName(order: any) {
  const customerName = order.customer?.name?.trim() || 'Customer';
  return `${customerName} - ${order.orderNumber}`;
}

function validateProvidedOrderNumber(orderNumber: string, business: string) {
  const businessCode = business as BusinessCode;
  const prefix = BUSINESS_PREFIX_BY_CODE[businessCode] ?? business;
  if (!orderNumber.startsWith(`${prefix}-`)) {
    return fail(400, `Order numbers for ${prefix} must start with ${prefix}-`);
  }
  return null;
}

export async function snapshotRepeatOrderTemplateFromOrder(
  orderId: string,
  payload: RepeatOrderTemplateCreateFromOrderInput,
  userId?: string | null,
) {
  const order = await findOrderTemplateSource(orderId);
  if (!order) return fail(404, 'Order not found');

  const template = await createRepeatOrderTemplate({
    customerId: order.customerId,
    sourceOrderId: order.id,
    name: payload.name?.trim() || buildDefaultTemplateName(order),
    business: order.business,
    vendorId: order.vendorId ?? null,
    materialNeeded: Boolean(order.materialNeeded),
    materialOrdered: Boolean(order.materialOrdered),
    modelIncluded: Boolean(order.modelIncluded),
    priority: order.priority,
    notes: null,
    createdById: userId ?? null,
    parts: (order.parts ?? []).map((part: any, index: number) => ({
      partNumber: part.partNumber,
      quantity: part.quantity,
      materialId: part.materialId ?? null,
      stockSize: part.stockSize ?? null,
      cutLength: part.cutLength ?? null,
      notes: part.notes ?? null,
      workInstructions: part.workInstructions ?? null,
      instructionsVersion: part.instructionsVersion ?? 1,
      sortOrder: index,
      charges: (part.charges ?? []).map((charge: any) => ({
        departmentId: charge.departmentId,
        addonId: charge.addonId ?? null,
        kind: charge.kind,
        name: charge.name,
        description: charge.description ?? null,
        quantity: new Prisma.Decimal(charge.quantity),
        unitPrice: new Prisma.Decimal(charge.unitPrice),
        sortOrder: charge.sortOrder ?? 0,
      })),
      attachments: (part.attachments ?? []).map((attachment: any, attachmentIndex: number) => ({
        kind: attachment.kind ?? 'OTHER',
        url: attachment.url ?? null,
        storagePath: attachment.storagePath ?? null,
        label: attachment.label ?? null,
        mimeType: attachment.mimeType ?? null,
        sortOrder: attachmentIndex,
      })),
    })),
    attachments: (order.attachments ?? []).map((attachment: any, index: number) => ({
      kind: 'ORDER',
      url: attachment.url ?? null,
      storagePath: attachment.storagePath ?? null,
      label: attachment.label ?? null,
      mimeType: attachment.mimeType ?? null,
      sortOrder: index,
    })),
  });

  return ok({ template: mapTemplateSummary(template) });
}

export async function listRepeatOrderTemplateSummaries(query: RepeatOrderTemplateListQueryInput) {
  const items = await listRepeatOrderTemplates({
    customerId: query.customerId,
    take: query.take,
  });
  return ok({ items: items.map(mapTemplateSummary) });
}

export async function getRepeatOrderTemplate(templateId: string) {
  const template = await findRepeatOrderTemplateById(templateId);
  if (!template) return fail(404, 'Repeat-order template not found');

  return ok({
    template: {
      ...mapTemplateSummary(template),
      notes: template.notes ?? null,
      vendorId: template.vendorId ?? null,
      vendorName: template.vendor?.name ?? null,
      materialNeeded: Boolean(template.materialNeeded),
      materialOrdered: Boolean(template.materialOrdered),
      modelIncluded: Boolean(template.modelIncluded),
      attachments: (template.attachments ?? []).map((attachment) => ({
        id: attachment.id,
        kind: attachment.kind,
        url: attachment.url ?? null,
        storagePath: attachment.storagePath ?? null,
        label: attachment.label ?? null,
        mimeType: attachment.mimeType ?? null,
        sortOrder: attachment.sortOrder ?? 0,
      })),
      parts: (template.parts ?? []).map((part) => ({
        id: part.id,
        partNumber: part.partNumber,
        quantity: part.quantity,
        materialId: part.materialId ?? null,
        stockSize: part.stockSize ?? null,
        cutLength: part.cutLength ?? null,
        notes: part.notes ?? null,
        workInstructions: part.workInstructions ?? null,
        instructionsVersion: part.instructionsVersion ?? 1,
        sortOrder: part.sortOrder ?? 0,
        charges: (part.charges ?? []).map((charge) => ({
          id: charge.id,
          departmentId: charge.departmentId,
          addonId: charge.addonId ?? null,
          kind: charge.kind,
          name: charge.name,
          description: charge.description ?? null,
          quantity: charge.quantity.toString(),
          unitPrice: charge.unitPrice.toString(),
          sortOrder: charge.sortOrder ?? 0,
        })),
        attachments: (part.attachments ?? []).map((attachment) => ({
          id: attachment.id,
          kind: attachment.kind,
          url: attachment.url ?? null,
          storagePath: attachment.storagePath ?? null,
          label: attachment.label ?? null,
          mimeType: attachment.mimeType ?? null,
          sortOrder: attachment.sortOrder ?? 0,
        })),
      })),
    },
  });
}

export async function createOrderFromRepeatOrderTemplate(
  templateId: string,
  payload: RepeatOrderTemplateCreateOrderInput,
  userId?: string | null,
) {
  const template = await findRepeatOrderTemplateById(templateId);
  if (!template) return fail(404, 'Repeat-order template not found');
  if (!(template.parts ?? []).length) {
    return fail(409, 'Repeat-order template has no parts to create.');
  }

  const dueDate = payload.dueDate ? new Date(payload.dueDate) : (() => {
    const next = new Date();
    next.setDate(next.getDate() + 14);
    return next;
  })();
  if (Number.isNaN(dueDate.getTime())) {
    return fail(400, 'Provide a valid due date.');
  }

  const templatePartIds = new Set((template.parts ?? []).map((part) => part.id));
  const templatePartOverrides = new Map<string, NonNullable<RepeatOrderTemplateCreateOrderInput['parts']>[number]>();

  for (const partOverride of payload.parts ?? []) {
    if (!templatePartIds.has(partOverride.templatePartId)) {
      return fail(400, `Unknown template part override: ${partOverride.templatePartId}`);
    }
    if (templatePartOverrides.has(partOverride.templatePartId)) {
      return fail(400, `Duplicate template part override: ${partOverride.templatePartId}`);
    }
    templatePartOverrides.set(partOverride.templatePartId, partOverride);
  }

  const parts = (template.parts ?? []).map((part) => {
    const override = templatePartOverrides.get(part.id);
    return {
      templatePartId: part.id,
      partNumber: override?.partNumber?.trim() || part.partNumber,
      quantity: override?.quantity ?? part.quantity,
      materialId: override?.materialId === undefined ? part.materialId ?? null : override.materialId ?? null,
      stockSize: override?.stockSize === undefined ? part.stockSize ?? null : override.stockSize ?? null,
      cutLength: override?.cutLength === undefined ? part.cutLength ?? null : override.cutLength ?? null,
      notes: override?.notes === undefined ? part.notes ?? null : override.notes ?? null,
      workInstructions:
        override?.workInstructions === undefined ? part.workInstructions ?? null : override.workInstructions ?? null,
      instructionsVersion: part.instructionsVersion ?? 1,
      charges: (part.charges ?? []).map((charge) => ({
        departmentId: charge.departmentId,
        addonId: charge.addonId ?? null,
        kind: charge.kind,
        name: charge.name,
        description: charge.description ?? null,
        quantity: new Prisma.Decimal(charge.quantity),
        unitPrice: new Prisma.Decimal(charge.unitPrice),
        sortOrder: charge.sortOrder ?? 0,
      })),
      attachments: (part.attachments ?? []).map((attachment) => ({
        kind: attachment.kind,
        url: attachment.url ?? null,
        storagePath: attachment.storagePath ?? null,
        label: attachment.label ?? null,
        mimeType: attachment.mimeType ?? null,
      })),
    };
  });

  const providedOrderNumber = payload.orderNumber?.trim();
  if (providedOrderNumber?.length) {
    const invalid = validateProvidedOrderNumber(providedOrderNumber, template.business);
    if (invalid) return invalid;
  }
  const orderNumber = providedOrderNumber?.length
    ? providedOrderNumber
    : await generateNextOrderNumber(template.business as BusinessCode);

  const result = await createOrderFromRepeatTemplate({
    orderNumber,
    business: template.business,
    customerId: template.customerId,
    receivedDate: new Date(),
    dueDate,
    priority: payload.priority ?? template.priority,
    materialNeeded: payload.materialNeeded ?? Boolean(template.materialNeeded),
    materialOrdered: payload.materialOrdered ?? Boolean(template.materialOrdered),
    modelIncluded: payload.modelIncluded ?? Boolean(template.modelIncluded),
    vendorId: payload.vendorId ?? template.vendorId ?? null,
    poNumber: payload.poNumber?.trim() ? payload.poNumber.trim() : null,
    assignedMachinistId: payload.assignedMachinistId?.trim() ? payload.assignedMachinistId.trim() : null,
    notes: payload.notes?.trim()?.length ? payload.notes.trim() : null,
    userId: userId ?? null,
    parts,
    attachments: (template.attachments ?? []).map((attachment) => ({
      kind: attachment.kind,
      url: attachment.url ?? null,
      storagePath: attachment.storagePath ?? null,
      label: attachment.label ?? null,
      mimeType: attachment.mimeType ?? null,
    })),
  });

  await syncChecklistForOrder(result.id);
  await initializeCurrentDepartmentForOrder(result.id);
  await syncOrderWorkflowStatus(result.id, { userId: userId ?? null });
  await ensureOrderFilesInCanonicalStorage(result.id);

  return ok({ id: result.id });
}
