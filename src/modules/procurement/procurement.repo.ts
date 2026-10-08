import 'server-only';

import { prisma } from '@/lib/prisma';
import type { ProcurementFilters, ProcurementPartRow } from './procurement.types';

const TERMINAL_ORDER_STATUSES = ['COMPLETE', 'COMPLETED', 'CLOSED', 'CANCELLED', 'CANCELED', 'SHIPPED'];

export async function listProcurementParts(filters: ProcurementFilters): Promise<ProcurementPartRow[]> {
  const rows = await prisma.orderPart.findMany({
    where: {
      materialStatus: { in: ['NEED_TO_ORDER', 'UNREVIEWED'] },
      status: { notIn: ['COMPLETE', 'COMPLETED', 'CLOSED', 'CANCELLED', 'CANCELED', 'SHIPPED'] },
      order: {
        status: { notIn: TERMINAL_ORDER_STATUSES },
        ...(filters.overdue ? { dueDate: { lt: filters.asOf ?? new Date() } } : {}),
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
        ...(filters.customer ? { customer: { name: { contains: filters.customer } } } : {}),
      },
      ...(filters.vendorId ? { procurementVendorId: filters.vendorId } : {}),
      ...(filters.vendor ? { procurementVendor: { name: { contains: filters.vendor } } } : {}),
      ...(filters.material ? {
        OR: [
          { material: { name: { contains: filters.material } } },
          { drawingMaterialText: { contains: filters.material } },
        ],
      } : {}),
    },
    orderBy: [{ order: { dueDate: 'asc' } }, { order: { orderNumber: 'asc' } }, { partNumber: 'asc' }, { id: 'asc' }],
    select: {
      id: true, orderId: true, partNumber: true, partName: true, quantity: true,
      materialStatus: true, status: true, materialId: true, drawingMaterialText: true,
      materialNotes: true, procurementVendorId: true, stockSize: true, cutLength: true,
      finalPartLength: true, partWidth: true, partThickness: true,
      material: { select: { name: true } },
      procurementVendor: { select: { name: true } },
      order: { select: { orderNumber: true, status: true, dueDate: true, customerId: true, customer: { select: { name: true } } } },
    },
  });

  return rows.map(row => ({
    id: row.id, orderId: row.orderId, orderNumber: row.order.orderNumber,
    customerId: row.order.customerId, customerName: row.order.customer.name,
    dueDate: row.order.dueDate, partNumber: row.partNumber, partName: row.partName,
    quantity: row.quantity, materialStatus: row.materialStatus, partStatus: row.status,
    orderStatus: row.order.status,
    materialId: row.materialId, materialName: row.material?.name ?? null,
    drawingMaterialText: row.drawingMaterialText, materialNotes: row.materialNotes,
    procurementVendorId: row.procurementVendorId,
    procurementVendorName: row.procurementVendor?.name ?? null,
    stockSize: row.stockSize, cutLength: row.cutLength, finalPartLength: row.finalPartLength,
    partWidth: row.partWidth, partThickness: row.partThickness,
  }));
}
