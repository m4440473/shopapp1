import 'server-only';

import type { z } from 'zod';
import {
  countOrderParts,
  createOrderNote,
  createOrderPartWithCharges,
  deleteOrderPartWithRelations,
  findOrderPart,
  findOrderSummary,
  findOrderPartSummary,
  findOrderPartWithCharges,
  runInTransaction,
  syncChecklistForOrder,
  updateOrderPart,
} from '@/repos/orders';
import { OrderPartCreate, OrderPartUpdate } from './orders.schema';
import { recordPartEvent } from './orders.events.service';

type OrderPartCreateInput = z.infer<typeof OrderPartCreate>;
type OrderPartUpdateInput = z.infer<typeof OrderPartUpdate>;
type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string | object };

export type OrderPartWorkflowDependencies = {
  initializeCurrentDepartmentForParts: (orderId: string) => Promise<unknown>;
  syncOrderWorkflowStatus: (orderId: string, userId?: string | null) => Promise<unknown>;
};

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

function fail<T>(status: number, error: string | object): ServiceResult<T> {
  return { ok: false, status, error };
}

function optionalId(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function addOrderPartCommand({
  orderId,
  payload,
  invoiceAction,
  copyChargesFromPartId,
  userId,
}: {
  orderId: string;
  payload: OrderPartCreateInput;
  invoiceAction?: 'new' | 'update';
  copyChargesFromPartId?: string;
  userId?: string;
}, dependencies: OrderPartWorkflowDependencies) {
  const order = await findOrderSummary(orderId);
  if (!order) {
    return fail(404, 'Order not found');
  }

  let sourcePart: { id: string; partNumber: string | null } | null = null;
  if (copyChargesFromPartId) {
    sourcePart = await findOrderPartSummary(orderId, copyChargesFromPartId);
    if (!sourcePart) {
      return fail(404, 'Source part not found on this order');
    }
  }

  const noteBuilder = userId
    ? ({ part, copiedCharges }: { part: { partNumber: string; quantity: number }; copiedCharges: number }) => {
        const invoiceLine =
          invoiceAction === 'update'
            ? `Invoice action: update existing invoice (invalidates prior PO${order.poNumber ? ` ${order.poNumber}` : ''}). Previous invoice/PO remain in attachments and notes.`
            : invoiceAction === 'new'
              ? 'Invoice action: create a separate invoice for the added part.'
              : null;
        const copyLine = sourcePart
          ? `Add-ons/labor: copied ${copiedCharges} charge${copiedCharges === 1 ? '' : 's'} from ${
              sourcePart.partNumber ?? 'selected part'
            }.`
          : null;
        return [`Added part ${part.partNumber} (qty ${part.quantity}).`, copyLine, invoiceLine]
          .filter(Boolean)
          .join(' ');
      }
    : undefined;

  const result = await createOrderPartWithCharges({
    orderId,
    partData: {
      partNumber: payload.partNumber,
      partName: payload.partName ?? null,
      quantity: payload.quantity,
      materialId: optionalId(payload.materialId),
      drawingMaterialText: payload.drawingMaterialText ?? null,
      drawingFinishText: payload.drawingFinishText ?? null,
      finish: payload.finish ?? null,
      materialStatus: payload.materialStatus ?? 'UNREVIEWED',
      inventoryLocation: payload.inventoryLocation ?? null,
      materialNotes: payload.materialNotes ?? null,
      procurementVendorId: optionalId(payload.procurementVendorId),
      stockSize: payload.stockSize ?? null,
      cutLength: payload.cutLength ?? null,
      finalPartLength: payload.finalPartLength ?? null,
      partWidth: payload.partWidth ?? null,
      partThickness: payload.partThickness ?? null,
      notes: payload.notes ?? null,
      workInstructions: payload.workInstructions ?? null,
    },
    sourcePartId: sourcePart?.id ?? null,
    userId: userId ?? null,
    noteBuilder,
  });

  if (sourcePart) {
    await syncChecklistForOrder(orderId);
    await dependencies.initializeCurrentDepartmentForParts(orderId);
  }

  await dependencies.syncOrderWorkflowStatus(orderId, userId ?? null);
  return ok({ part: result.part, copiedCharges: result.copiedCharges });
}

export async function updateOrderPartDetails({
  orderId,
  partId,
  payload,
  userId,
}: {
  orderId: string;
  partId: string;
  payload: OrderPartUpdateInput;
  userId?: string;
}) {
  const existing = await findOrderPart(orderId, partId);
  if (!existing) {
    return fail(404, 'Part not found for this order');
  }

  const data: Record<string, unknown> = {};
  if (payload.partNumber !== undefined) data.partNumber = payload.partNumber;
  if (payload.partName !== undefined) data.partName = payload.partName;
  if (payload.quantity !== undefined) data.quantity = payload.quantity;
  if (payload.materialId !== undefined) data.materialId = optionalId(payload.materialId);
  if (payload.drawingMaterialText !== undefined) data.drawingMaterialText = payload.drawingMaterialText;
  if (payload.drawingFinishText !== undefined) data.drawingFinishText = payload.drawingFinishText;
  if (payload.finish !== undefined) data.finish = payload.finish;
  if (payload.materialStatus !== undefined) data.materialStatus = payload.materialStatus;
  if (payload.inventoryLocation !== undefined) data.inventoryLocation = payload.inventoryLocation;
  if (payload.materialNotes !== undefined) data.materialNotes = payload.materialNotes;
  if (payload.procurementVendorId !== undefined) data.procurementVendorId = optionalId(payload.procurementVendorId);
  if (payload.stockSize !== undefined) data.stockSize = payload.stockSize;
  if (payload.cutLength !== undefined) data.cutLength = payload.cutLength;
  if (payload.finalPartLength !== undefined) data.finalPartLength = payload.finalPartLength;
  if (payload.partWidth !== undefined) data.partWidth = payload.partWidth;
  if (payload.partThickness !== undefined) data.partThickness = payload.partThickness;
  if (payload.notes !== undefined) data.notes = payload.notes;
  if (payload.workInstructions !== undefined) {
    data.workInstructions = payload.workInstructions;
    if ((payload.workInstructions ?? null) !== (existing.workInstructions ?? null)) {
      data.instructionsVersion = (existing.instructionsVersion ?? 1) + 1;
    }
  }

  const materialStatusChanged =
    payload.materialStatus !== undefined && payload.materialStatus !== existing.materialStatus;
  const priorMaterialStatus = existing.materialStatus ?? 'UNREVIEWED';
  const priorProcurementVendorId = existing.procurementVendorId ?? null;
  const part = materialStatusChanged
    ? await runInTransaction(async (tx) => {
        const updated = await updateOrderPart(partId, data, tx);
        await recordPartEvent({
          orderId,
          partId,
          userId: userId ?? null,
          type: 'MATERIAL_STATUS_CHANGED',
          message: `Material status changed from ${priorMaterialStatus} to ${payload.materialStatus}.`,
          meta: {
            fromMaterialStatus: priorMaterialStatus,
            toMaterialStatus: payload.materialStatus,
            procurementVendorId:
              payload.procurementVendorId !== undefined
                ? optionalId(payload.procurementVendorId)
                : priorProcurementVendorId,
          },
        }, tx);
        return updated;
      })
    : await updateOrderPart(partId, data);

  if (userId) {
    await createOrderNote(orderId, userId, `Updated part ${part.partNumber}.`);
    await recordPartEvent({
      orderId,
      partId: part.id,
      userId,
      type: 'PART_UPDATED',
      message: `Updated ${part.partNumber}.`,
    });
  }

  return ok({ part });
}

export async function deleteOrderPartCommand({
  orderId,
  partId,
  userId,
}: {
  orderId: string;
  partId: string;
  userId?: string;
}, dependencies: Pick<OrderPartWorkflowDependencies, 'syncOrderWorkflowStatus'>) {
  const partCount = await countOrderParts(orderId);
  if (partCount <= 1) {
    return fail(400, 'Orders must contain at least one part.');
  }

  const part = await findOrderPartWithCharges(orderId, partId);
  if (!part) {
    return fail(404, 'Part not found for this order');
  }

  const chargeIds = part.charges.map((charge) => charge.id);
  await deleteOrderPartWithRelations({
    orderId,
    partId,
    chargeIds,
    noteContent: userId ? `Removed part ${part.partNumber} (qty ${part.quantity}).` : null,
    userId: userId ?? null,
  });

  await syncChecklistForOrder(orderId);
  await dependencies.syncOrderWorkflowStatus(orderId, userId ?? null);
  return ok({ ok: true });
}
