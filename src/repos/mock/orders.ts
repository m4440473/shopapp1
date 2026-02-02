import { createMockSeedState, type MockOrderChecklist, type MockOrderPart } from './seed';

export function createMockOrdersRepo() {
  const state = createMockSeedState();
  const counters: Record<string, number> = {
    order: state.orders.length + 1000,
    note: state.notes.length + 1,
    attachment: state.orderAttachments.length + 1,
    partAttachment: state.partAttachments.length + 1,
    partEvent: state.partEvents.length + 1,
    checklist: state.orderChecklist.length + 1,
    charge: state.orderCharges.length + 1,
    status: state.statusHistory.length + 1,
  };

  const nextId = (prefix: string) => {
    counters[prefix] = (counters[prefix] ?? 0) + 1;
    return `${prefix}_test_${String(counters[prefix]).padStart(3, '0')}`;
  };

  const findOrderParts = (orderId: string) => state.orderParts.filter((part) => part.orderId === orderId);

  const findOrderPartById = (orderId: string, partId: string) =>
    state.orderParts.find((part) => part.orderId === orderId && part.id === partId) ?? null;

  const findChecklistForOrder = (orderId: string) => state.orderChecklist.filter((item) => item.orderId === orderId);

  const findOrderCharges = (orderId: string) => state.orderCharges.filter((charge) => charge.orderId === orderId);

  const mapPartWithRelations = (part: MockOrderPart) => {
    const material = state.materials.find((item) => item.id === part.materialId) ?? null;
    const attachments = state.partAttachments.filter((item) => item.partId === part.id);
    const charges = state.orderCharges
      .filter((charge) => charge.partId === part.id)
      .map((charge) => ({
        ...charge,
        department: state.departments.find((dept) => dept.id === charge.departmentId) ?? null,
      }));
    return {
      ...part,
      material,
      attachments,
      charges,
    };
  };

  return {
    async generateNextOrderNumber(business: string) {
      const prefix = business;
      const last = Math.max(
        1000,
        ...state.orders
          .filter((order) => order.business === business)
          .map((order) => parseInt(order.orderNumber.replace(/[^0-9]/g, ''), 10))
          .filter((value) => Number.isFinite(value))
      );
      return `${prefix}-${last + 1}`;
    },

    async syncChecklistForOrder() {
      return;
    },

    async listOrders({ take }: { where: Record<string, unknown>; take: number; cursor?: string | null }) {
      const items = state.orders.slice(0, take);
      return items.map((order) => {
        const customer = state.customers.find((item) => item.id === order.customerId);
        const assignedMachinist = state.users.find((item) => item.id === order.assignedMachinistId) ?? null;
        const parts = findOrderParts(order.id);
        const checklist = findChecklistForOrder(order.id).map((entry) => ({
          completed: entry.completed,
          addon: state.addons.find((addon) => addon.id === entry.addonId) ?? null,
        }));
        const statusHistory = state.statusHistory
          .filter((entry) => entry.orderId === order.id)
          .slice(0, 1)
          .map((entry) => ({ createdAt: entry.createdAt }));
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          business: order.business,
          dueDate: order.dueDate,
          receivedDate: order.receivedDate,
          priority: order.priority,
          status: order.status,
          customer: customer ? { id: customer.id, name: customer.name } : null,
          assignedMachinist: assignedMachinist
            ? { id: assignedMachinist.id, name: assignedMachinist.name, email: assignedMachinist.email }
            : null,
          materialNeeded: order.materialNeeded,
          materialOrdered: order.materialOrdered,
          parts: parts.map((part) => ({ quantity: part.quantity })),
          checklist,
          statusHistory,
        };
      });
    },

    async findActiveOrderCustomFields() {
      return [];
    },

    async createOrderWithCustomFields({ orderData }: { orderData: Record<string, any> }) {
      const id = nextId('order');
      const createdAt = new Date();
      const order = {
        id,
        orderNumber: orderData.data?.orderNumber ?? orderData.orderNumber ?? `STD-${counters.order}`,
        business: orderData.data?.business ?? orderData.business ?? 'STD',
        dueDate: orderData.data?.dueDate ?? orderData.dueDate ?? null,
        receivedDate: orderData.data?.receivedDate ?? orderData.receivedDate ?? null,
        priority: orderData.data?.priority ?? orderData.priority ?? null,
        status: orderData.data?.status ?? orderData.status ?? 'RECEIVED',
        customerId: orderData.data?.customerId ?? orderData.customerId ?? state.customers[0]?.id,
        assignedMachinistId: orderData.data?.assignedMachinistId ?? null,
        vendorId: orderData.data?.vendorId ?? null,
        materialNeeded: Boolean(orderData.data?.materialNeeded ?? false),
        materialOrdered: Boolean(orderData.data?.materialOrdered ?? false),
        modelIncluded: Boolean(orderData.data?.modelIncluded ?? false),
        poNumber: orderData.data?.poNumber ?? null,
        createdAt,
        updatedAt: createdAt,
      };
      state.orders.push(order);
      return { id: order.id };
    },

    async findOrderById(id: string) {
      const order = state.orders.find((item) => item.id === id);
      return order ? { id: order.id } : null;
    },

    async findOrderHeader(id: string) {
      const order = state.orders.find((item) => item.id === id);
      if (!order) return null;
      const customer = state.customers.find((item) => item.id === order.customerId);
      return { id: order.id, orderNumber: order.orderNumber, customer: customer ? { name: customer.name } : null };
    },

    async findOrderWithDetails(id: string) {
      const order = state.orders.find((item) => item.id === id);
      if (!order) return null;
      const customer = state.customers.find((item) => item.id === order.customerId) ?? null;
      const parts = findOrderParts(order.id).map(mapPartWithRelations);
      const checklist = findChecklistForOrder(order.id).map((entry) => ({
        ...entry,
        addon: state.addons.find((addon) => addon.id === entry.addonId) ?? null,
        department: state.departments.find((dept) => dept.id === entry.departmentId) ?? null,
        part: state.orderParts.find((part) => part.id === entry.partId) ?? null,
        charge: state.orderCharges.find((charge) => charge.id === entry.chargeId) ?? null,
      }));
      const charges = findOrderCharges(order.id).map((charge) => ({
        ...charge,
        department: state.departments.find((dept) => dept.id === charge.departmentId) ?? null,
        part: state.orderParts.find((part) => part.id === charge.partId) ?? null,
      }));
      const statusHistory = state.statusHistory.filter((entry) => entry.orderId === order.id);
      const notes = state.notes
        .filter((note) => note.orderId === order.id)
        .map((note) => ({
          ...note,
          user: state.users.find((user) => user.id === note.userId) ?? null,
        }));
      const attachments = state.orderAttachments
        .filter((attachment) => attachment.orderId === order.id)
        .map((attachment) => ({
          ...attachment,
          uploadedBy: state.users.find((user) => user.id === attachment.uploadedById) ?? null,
        }));
      const partAttachments = state.partAttachments.filter((attachment) => attachment.orderId === order.id);
      const assignedMachinist = state.users.find((user) => user.id === order.assignedMachinistId) ?? null;
      return {
        ...order,
        customer,
        parts,
        checklist,
        charges,
        statusHistory,
        notes,
        attachments,
        partAttachments,
        assignedMachinist,
        vendor: null,
      };
    },

    async updateOrder(id: string, data: Record<string, unknown>) {
      const order = state.orders.find((item) => item.id === id);
      if (!order) throw new Error('Order not found');
      Object.assign(order, data, { updatedAt: new Date() });
      return order;
    },

    async findOrderStatus(id: string) {
      const order = state.orders.find((item) => item.id === id);
      return order ? { status: order.status } : null;
    },

    async updateOrderStatus(id: string, status: string) {
      const order = state.orders.find((item) => item.id === id);
      if (!order) throw new Error('Order not found');
      order.status = status;
      order.updatedAt = new Date();
      return order;
    },

    async createStatusHistoryEntry(data: Record<string, unknown>) {
      const entry = {
        id: nextId('status'),
        orderId: data.orderId as string,
        from: data.from as string,
        to: data.to as string,
        userId: (data.userId as string) ?? null,
        reason: (data.reason as string) ?? '',
        createdAt: new Date(),
      };
      state.statusHistory.unshift(entry);
      return entry;
    },

    async updateOrderAssignee(id: string, machinistId: string | null) {
      const order = state.orders.find((item) => item.id === id);
      if (!order) throw new Error('Order not found');
      order.assignedMachinistId = machinistId;
      const assignedMachinist = state.users.find((user) => user.id === machinistId) ?? null;
      return {
        id: order.id,
        assignedMachinistId: order.assignedMachinistId,
        assignedMachinist: assignedMachinist
          ? { id: assignedMachinist.id, name: assignedMachinist.name, email: assignedMachinist.email }
          : null,
      };
    },

    async createOrderNote(orderId: string, userId: string, content: string) {
      const note = {
        id: nextId('note'),
        orderId,
        partId: null,
        userId,
        content,
        createdAt: new Date(),
      };
      state.notes.push(note);
      return note;
    },

    async findChecklistById(checklistId: string) {
      return state.orderChecklist.find((item) => item.id === checklistId) ?? null;
    },

    async findChecklistByCharge(orderId: string, chargeId: string) {
      return (
        state.orderChecklist.find((item) => item.orderId === orderId && item.chargeId === chargeId && item.isActive) ??
        null
      );
    },

    async findChecklistByAddon(orderId: string, addonId: string, partId: string | null) {
      return (
        state.orderChecklist.find(
          (item) => item.orderId === orderId && item.addonId === addonId && item.partId === partId && item.isActive
        ) ?? null
      );
    },

    async findChargeById(chargeId: string) {
      const charge = state.orderCharges.find((item) => item.id === chargeId);
      return charge ? { id: charge.id, name: charge.name } : null;
    },

    async findAddonById(addonId: string) {
      const addon = state.addons.find((item) => item.id === addonId);
      return addon ? { id: addon.id, name: addon.name } : null;
    },

    async findUserById(userId: string) {
      const user = state.users.find((item) => item.id === userId);
      return user ? { id: user.id } : null;
    },

    async updateChecklistCompletion({ checklistId, checked }: { checklistId: string; checked: boolean }) {
      const item = state.orderChecklist.find((entry) => entry.id === checklistId);
      if (item) {
        item.completed = checked;
      }
      return { count: item ? 1 : 0 };
    },

    async listChecklistItems(orderId: string) {
      return state.orderChecklist.filter((item) => item.orderId === orderId);
    },

    async findOrderSummary(id: string) {
      const order = state.orders.find((item) => item.id === id);
      if (!order) return null;
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        priority: order.priority,
        dueDate: order.dueDate,
        receivedDate: order.receivedDate,
        customer: state.customers.find((item) => item.id === order.customerId) ?? null,
      };
    },

    async findOrderPartSummary(orderId: string, partId: string) {
      const part = state.orderParts.find((item) => item.orderId === orderId && item.id === partId);
      if (!part) return null;
      return {
        ...part,
        order: state.orders.find((order) => order.id === orderId) ?? null,
        material: state.materials.find((material) => material.id === part.materialId) ?? null,
      };
    },

    async createPartEvent(data: { orderId: string; partId: string; userId?: string | null; type: string; message: string; meta?: Record<string, unknown> | null }) {
      const event = {
        id: nextId('partEvent'),
        orderId: data.orderId,
        partId: data.partId,
        userId: data.userId ?? null,
        type: data.type,
        message: data.message,
        meta: data.meta ?? null,
        createdAt: new Date(),
      };
      state.partEvents.unshift(event);
      return event;
    },

    async listPartEventsForPart(orderId: string, partId: string) {
      return state.partEvents
        .filter((event) => event.orderId === orderId && event.partId === partId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((event) => ({
          ...event,
          user: state.users.find((user) => user.id === event.userId) ?? null,
        }));
    },

    async createOrderPartWithCharges({
      orderId,
      partData,
    }: {
      orderId: string;
      partData: { partNumber: string; quantity: number; materialId?: string | null; stockSize?: string | null; cutLength?: string | null; notes?: string | null };
      sourcePartId?: string | null;
      userId?: string | null;
      noteBuilder?: (input: { part: { partNumber: string; quantity: number }; copiedCharges: number }) => string | null;
    }) {
      const part = {
        id: nextId('part'),
        orderId,
        partNumber: partData.partNumber ?? null,
        quantity: partData.quantity ?? null,
        description: partData.notes ?? null,
        status: null,
        materialId: partData.materialId ?? null,
        currentDepartmentId: null,
      };
      state.orderParts.push(part);
      return part;
    },

    async findOrderPart(orderId: string, partId: string) {
      return findOrderPartById(orderId, partId);
    },

    async listOrderPartsByIds(orderId: string, partIds: string[]) {
      return state.orderParts.filter((part) => part.orderId === orderId && partIds.includes(part.id));
    },

    async listOrderPartsMissingCurrentDepartment(orderId?: string) {
      return state.orderParts.filter(
        (part) => (!orderId || part.orderId === orderId) && !part.currentDepartmentId
      );
    },

    async moveOrderPartsToDepartment({ partIds, departmentId }: { partIds: string[]; departmentId: string | null }) {
      state.orderParts.forEach((part) => {
        if (partIds.includes(part.id)) {
          part.currentDepartmentId = departmentId ?? null;
        }
      });
      return { count: partIds.length };
    },

    async updateOrderPart(partId: string, data: Record<string, unknown>) {
      const part = state.orderParts.find((item) => item.id === partId);
      if (!part) throw new Error('Part not found');
      Object.assign(part, data);
      return part;
    },

    async countOrderParts(orderId: string) {
      return state.orderParts.filter((part) => part.orderId === orderId).length;
    },

    async findOrderPartWithCharges(orderId: string, partId: string) {
      const part = findOrderPartById(orderId, partId);
      if (!part) return null;
      return {
        ...part,
        charges: state.orderCharges.filter((charge) => charge.partId === partId),
      };
    },

    async deleteOrderPartWithRelations({ orderId, partId }: { orderId: string; partId: string }) {
      const index = state.orderParts.findIndex((part) => part.orderId === orderId && part.id === partId);
      if (index >= 0) {
        state.orderParts.splice(index, 1);
      }
      return { id: partId };
    },

    async listOrderCharges(orderId: string) {
      return findOrderCharges(orderId);
    },

    async listOrderLevelDepartmentChecklistItems() {
      return [];
    },

    async findChecklistByOrderPartDepartment({ orderId, partId, departmentId }: { orderId: string; partId: string; departmentId: string }) {
      return (
        state.orderChecklist.find(
          (item) => item.orderId === orderId && item.partId === partId && item.departmentId === departmentId && item.isActive
        ) ?? null
      );
    },

    async createOrderChecklistItem(data: Record<string, unknown>) {
      const item: MockOrderChecklist = {
        id: nextId('checklist'),
        orderId: data.orderId as string,
        partId: (data.partId as string) ?? null,
        chargeId: (data.chargeId as string) ?? null,
        addonId: (data.addonId as string) ?? null,
        departmentId: (data.departmentId as string) ?? null,
        completed: Boolean(data.completed ?? false),
        isActive: data.isActive !== false,
      };
      state.orderChecklist.push(item);
      return item;
    },

    async updateOrderChecklistItem(id: string, data: Record<string, unknown>) {
      const item = state.orderChecklist.find((entry) => entry.id === id);
      if (!item) throw new Error('Checklist item not found');
      Object.assign(item, data);
      return item;
    },

    async deleteOrderChecklistItem(id: string) {
      const index = state.orderChecklist.findIndex((entry) => entry.id === id);
      if (index >= 0) state.orderChecklist.splice(index, 1);
      return { id };
    },

    async findOrderPartForCharge(orderId: string, partId: string) {
      return state.orderParts.find((part) => part.orderId === orderId && part.id === partId) ?? null;
    },

    async findDepartmentById(departmentId: string) {
      return state.departments.find((dept) => dept.id === departmentId) ?? null;
    },

    async findActiveDepartmentById(departmentId: string) {
      const dept = state.departments.find((item) => item.id === departmentId && item.active);
      return dept ?? null;
    },

    async listDepartmentsOrdered() {
      return [...state.departments].sort((a, b) => a.sortOrder - b.sortOrder);
    },

    async findAddonDepartment(addonId: string) {
      const addon = state.addons.find((item) => item.id === addonId);
      if (!addon) return null;
      return state.departments.find((dept) => dept.id === addon.departmentId) ?? null;
    },

    async createOrderCharge(data: Record<string, unknown>) {
      const payload = ((data as { data?: Record<string, unknown> }).data ?? data) as Record<string, unknown>;
      const charge = {
        id: nextId('charge'),
        orderId: payload.orderId as string,
        partId: (payload.partId as string) ?? null,
        departmentId: (payload.departmentId as string) ?? null,
        addonId: (payload.addonId as string) ?? null,
        name: (payload.name as string) ?? 'Charge',
        kind: (payload.kind as string) ?? 'LABOR',
        unitPrice: String(payload.unitPrice ?? '0'),
        quantity: String(payload.quantity ?? '1'),
        sortOrder: Number(payload.sortOrder ?? 0),
        completedAt: (payload.completedAt as Date) ?? null,
      };
      state.orderCharges.push(charge);
      return charge;
    },

    async findOrderCharge(orderId: string, chargeId: string) {
      return state.orderCharges.find((charge) => charge.orderId === orderId && charge.id === chargeId) ?? null;
    },

    async updateOrderCharge(chargeId: string, data: Record<string, unknown>) {
      const charge = state.orderCharges.find((item) => item.id === chargeId);
      if (!charge) throw new Error('Charge not found');
      Object.assign(charge, data);
      return charge;
    },

    async deleteOrderChargeWithChecklist(chargeId: string) {
      const index = state.orderCharges.findIndex((item) => item.id === chargeId);
      if (index >= 0) state.orderCharges.splice(index, 1);
      state.orderChecklist = state.orderChecklist.filter((item) => item.chargeId !== chargeId);
      return { id: chargeId };
    },

    async createOrderAttachment(data: { data?: Record<string, unknown> } | Record<string, unknown>) {
      const payload = (data as { data?: Record<string, unknown> }).data ?? (data as Record<string, unknown>);
      const attachment = {
        id: nextId('attachment'),
        orderId: payload.orderId as string,
        url: (payload.url as string) ?? null,
        storagePath: (payload.storagePath as string) ?? null,
        label: (payload.label as string) ?? null,
        mimeType: (payload.mimeType as string) ?? null,
        uploadedById: (payload.uploadedById as string) ?? null,
        createdAt: new Date(),
      };
      state.orderAttachments.push(attachment);
      return attachment;
    },

    async findPartById(partId: string) {
      return state.orderParts.find((part) => part.id === partId) ?? null;
    },

    async listPartAttachments(partId: string) {
      return state.partAttachments
        .filter((attachment) => attachment.partId === partId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    async findPartWithOrderInfo(partId: string) {
      const part = state.orderParts.find((item) => item.id === partId);
      if (!part) return null;
      const order = state.orders.find((entry) => entry.id === part.orderId);
      return {
        ...part,
        order: order
          ? {
              orderNumber: order.orderNumber,
              business: order.business,
              customer: state.customers.find((customer) => customer.id === order.customerId) ?? null,
            }
          : null,
      };
    },

    async createPartAttachment(data: { data?: Record<string, unknown> } | Record<string, unknown>) {
      const payload = (data as { data?: Record<string, unknown> }).data ?? (data as Record<string, unknown>);
      const attachment = {
        id: nextId('partAttachment'),
        orderId: payload.orderId as string,
        partId: payload.partId as string,
        kind: (payload.kind as string) ?? 'OTHER',
        url: (payload.url as string) ?? null,
        storagePath: (payload.storagePath as string) ?? null,
        label: (payload.label as string) ?? null,
        mimeType: (payload.mimeType as string) ?? null,
        createdAt: new Date(),
      };
      state.partAttachments.push(attachment);
      return attachment;
    },

    async findPartAttachment(partId: string, attachmentId: string) {
      return state.partAttachments.find((attachment) => attachment.partId === partId && attachment.id === attachmentId) ?? null;
    },

    async updatePartAttachment(attachmentId: string, data: Record<string, unknown>) {
      const attachment = state.partAttachments.find((item) => item.id === attachmentId);
      if (!attachment) throw new Error('Attachment not found');
      Object.assign(attachment, data);
      return attachment;
    },

    async deletePartAttachment(attachmentId: string) {
      const index = state.partAttachments.findIndex((item) => item.id === attachmentId);
      if (index >= 0) state.partAttachments.splice(index, 1);
      return { id: attachmentId };
    },

    async listAddons({ take }: { where?: Record<string, unknown>; take: number; cursor?: string | null }) {
      return state.addons.slice(0, take + 1);
    },

    async listReadyOrderPartsForDepartment(departmentId: string) {
      return state.orderParts
        .filter((part) => part.currentDepartmentId === departmentId)
        .map((part) => {
          const order = state.orders.find((item) => item.id === part.orderId);
          return {
            id: part.id,
            partNumber: part.partNumber,
            quantity: part.quantity,
            orderId: part.orderId,
            order: order
              ? {
                  id: order.id,
                  orderNumber: order.orderNumber,
                  dueDate: order.dueDate,
                  status: order.status,
                  customer: state.customers.find((customer) => customer.id === order.customerId) ?? null,
                  parts: findOrderParts(order.id).map((entry) => ({ id: entry.id })),
                }
              : null,
          };
        });
    },
  };
}
