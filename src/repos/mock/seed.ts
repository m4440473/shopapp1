export type MockUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  admin: boolean;
  active: boolean;
};

export type MockCustomer = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MockDepartment = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
};

export type MockAddon = {
  id: string;
  name: string;
  departmentId: string | null;
  rateType: string;
  rateCents: number;
  affectsPrice: boolean;
  isChecklistItem: boolean;
};

export type MockMaterial = {
  id: string;
  name: string;
};

export type MockOrder = {
  id: string;
  orderNumber: string;
  business: string;
  dueDate: Date | null;
  receivedDate: Date | null;
  priority: string | null;
  status: string;
  customerId: string;
  assignedMachinistId: string | null;
  vendorId: string | null;
  materialNeeded: boolean;
  materialOrdered: boolean;
  modelIncluded: boolean;
  poNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MockOrderPart = {
  id: string;
  orderId: string;
  partNumber: string | null;
  quantity: number | null;
  description: string | null;
  status: string | null;
  materialId: string | null;
  currentDepartmentId: string | null;
  workInstructions?: string | null;
  instructionsVersion?: number;
};

export type MockOrderCharge = {
  id: string;
  orderId: string;
  partId: string | null;
  departmentId: string | null;
  addonId: string | null;
  name: string;
  kind: string;
  unitPrice: string;
  quantity: string;
  sortOrder: number;
  completedAt: Date | null;
};

export type MockOrderChecklist = {
  id: string;
  orderId: string;
  partId: string | null;
  chargeId: string | null;
  addonId: string | null;
  departmentId: string | null;
  completed: boolean;
  isActive: boolean;
  toggledById?: string | null;
  performedById?: string | null;
};

export type MockOrderPartAssignment = {
  id: string;
  partId: string;
  userId: string;
  assignedById: string | null;
  assignmentType: string;
  isActive: boolean;
  removedAt: Date | null;
  createdAt: Date;
};

export type MockPartInstructionReceipt = {
  id: string;
  partId: string;
  userId: string;
  departmentId: string;
  instructionsVersion: number;
  acknowledgedAt: Date;
};

export type MockStatusHistory = {
  id: string;
  orderId: string;
  from: string;
  to: string;
  userId: string | null;
  reason: string;
  createdAt: Date;
};

export type MockNote = {
  id: string;
  orderId: string;
  partId: string | null;
  userId: string;
  content: string;
  createdAt: Date;
};

export type MockOrderAttachment = {
  id: string;
  orderId: string;
  url: string | null;
  storagePath: string | null;
  label: string | null;
  mimeType: string | null;
  uploadedById: string | null;
  createdAt: Date;
};

export type MockPartAttachment = {
  id: string;
  orderId: string;
  partId: string;
  kind: string;
  url: string | null;
  storagePath: string | null;
  label: string | null;
  mimeType: string | null;
  createdAt: Date;
};

export type MockPartEvent = {
  id: string;
  orderId: string;
  partId: string;
  userId: string | null;
  type: string;
  message: string;
  meta: Record<string, unknown> | null;
  createdAt: Date;
};

export type MockPartTimeAdjustment = {
  id: string;
  orderId: string;
  partId: string;
  userId: string | null;
  seconds: number;
  note: string;
  createdAt: Date;
};

export type MockTimeEntry = {
  id: string;
  userId: string;
  orderId: string;
  partId: string | null;
  departmentId: string | null;
  operation: string | null;
  startedAt: Date;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MockSeedState = {
  users: MockUser[];
  customers: MockCustomer[];
  departments: MockDepartment[];
  addons: MockAddon[];
  materials: MockMaterial[];
  orders: MockOrder[];
  orderParts: MockOrderPart[];
  orderCharges: MockOrderCharge[];
  orderChecklist: MockOrderChecklist[];
  orderPartAssignments: MockOrderPartAssignment[];
  partInstructionReceipts: MockPartInstructionReceipt[];
  statusHistory: MockStatusHistory[];
  notes: MockNote[];
  orderAttachments: MockOrderAttachment[];
  partAttachments: MockPartAttachment[];
  partEvents: MockPartEvent[];
  partTimeAdjustments: MockPartTimeAdjustment[];
  timeEntries: MockTimeEntry[];
};

export function createMockSeedState(): MockSeedState {
  const baseDate = new Date('2026-02-01T12:00:00Z');
  const laterDate = new Date('2026-02-03T15:30:00Z');

  const users: MockUser[] = [
    {
      id: 'test-user',
      name: 'Test Admin',
      email: 'test@local',
      role: 'ADMIN',
      admin: true,
      active: true,
    },
    {
      id: 'user_test_machinist',
      name: 'Alex Machinist',
      email: 'machinist@local',
      role: 'MACHINIST',
      admin: false,
      active: true,
    },
    {
      id: 'user_test_helper',
      name: 'Jamie Helper',
      email: 'helper@local',
      role: 'MACHINIST',
      admin: false,
      active: true,
    },
  ];

  const customers: MockCustomer[] = [
    {
      id: 'customer_test_001',
      name: 'Acme Aerospace',
      email: 'buyer@acme.local',
      phone: '555-0100',
      createdAt: baseDate,
      updatedAt: baseDate,
    },
    {
      id: 'customer_test_002',
      name: 'Nimbus Labs',
      email: 'ops@nimbus.local',
      phone: '555-0101',
      createdAt: baseDate,
      updatedAt: baseDate,
    },
  ];

  const departments: MockDepartment[] = [
    { id: 'dept_test_001', name: 'Machining', sortOrder: 1, active: true },
    { id: 'dept_test_002', name: 'Finishing', sortOrder: 2, active: true },
  ];

  const addons: MockAddon[] = [
    {
      id: 'addon_test_001',
      name: 'Anodize',
      departmentId: 'dept_test_002',
      rateType: 'FLAT',
      rateCents: 2500,
      affectsPrice: true,
      isChecklistItem: true,
    },
  ];

  const materials: MockMaterial[] = [
    { id: 'material_test_001', name: '6061 Aluminum' },
    { id: 'material_test_002', name: '4140 Steel' },
  ];

  const orders: MockOrder[] = [
    {
      id: 'order_test_001',
      orderNumber: 'STD-1001',
      business: 'STD',
      dueDate: laterDate,
      receivedDate: baseDate,
      priority: 'HOT',
      status: 'RECEIVED',
      customerId: 'customer_test_001',
      assignedMachinistId: 'user_test_machinist',
      vendorId: null,
      materialNeeded: true,
      materialOrdered: false,
      modelIncluded: true,
      poNumber: 'PO-1001',
      createdAt: baseDate,
      updatedAt: baseDate,
    },
    {
      id: 'order_test_002',
      orderNumber: 'CRM-2002',
      business: 'CRM',
      dueDate: new Date('2026-02-10T12:00:00Z'),
      receivedDate: new Date('2026-02-02T08:00:00Z'),
      priority: 'NORMAL',
      status: 'IN_PROGRESS',
      customerId: 'customer_test_002',
      assignedMachinistId: null,
      vendorId: null,
      materialNeeded: false,
      materialOrdered: true,
      modelIncluded: false,
      poNumber: null,
      createdAt: baseDate,
      updatedAt: baseDate,
    },
  ];

  const orderParts: MockOrderPart[] = [
    {
      id: 'part_test_001',
      orderId: 'order_test_001',
      partNumber: 'ACME-01',
      quantity: 2,
      description: 'Main housing',
      status: 'IN_PROGRESS',
      materialId: 'material_test_001',
      currentDepartmentId: 'dept_test_001',
    },
    {
      id: 'part_test_002',
      orderId: 'order_test_001',
      partNumber: 'ACME-02',
      quantity: 1,
      description: 'Cap plate',
      status: 'IN_PROGRESS',
      materialId: 'material_test_002',
      currentDepartmentId: 'dept_test_002',
    },
    {
      id: 'part_test_003',
      orderId: 'order_test_002',
      partNumber: 'NIM-100',
      quantity: 3,
      description: 'Fixture base',
      status: 'IN_PROGRESS',
      materialId: 'material_test_001',
      currentDepartmentId: 'dept_test_001',
    },
    {
      id: 'part_ack_test_001',
      orderId: 'order_test_001',
      partNumber: 'ACME-ACK',
      quantity: 1,
      description: 'Ack-gated finishing part',
      status: 'IN_PROGRESS',
      materialId: 'material_test_001',
      currentDepartmentId: 'dept_test_001',
      workInstructions: 'Read setup note. Verify soft jaws and deburr before submit.',
      instructionsVersion: 1,
    },
  ];

  const orderCharges: MockOrderCharge[] = [
    {
      id: 'charge_test_001',
      orderId: 'order_test_001',
      partId: 'part_test_001',
      departmentId: 'dept_test_001',
      addonId: null,
      name: 'Setup',
      kind: 'LABOR',
      unitPrice: '125.00',
      quantity: '1',
      sortOrder: 1,
      completedAt: null,
    },
    {
      id: 'charge_test_002',
      orderId: 'order_test_001',
      partId: 'part_test_002',
      departmentId: 'dept_test_002',
      addonId: 'addon_test_001',
      name: 'Anodize',
      kind: 'ADDON',
      unitPrice: '45.00',
      quantity: '1',
      sortOrder: 2,
      completedAt: null,
    },
    {
      id: 'charge_ack_test_001',
      orderId: 'order_test_001',
      partId: 'part_ack_test_001',
      departmentId: 'dept_test_001',
      addonId: null,
      name: 'Soft Jaw Setup',
      kind: 'LABOR',
      unitPrice: '30.00',
      quantity: '1',
      sortOrder: 3,
      completedAt: null,
    },
  ];

  const orderChecklist: MockOrderChecklist[] = [
    {
      id: 'checklist_test_001',
      orderId: 'order_test_001',
      partId: 'part_test_002',
      chargeId: 'charge_test_002',
      addonId: 'addon_test_001',
      departmentId: 'dept_test_002',
      completed: false,
      isActive: true,
    },
    {
      id: 'checklist_ack_test_001',
      orderId: 'order_test_001',
      partId: 'part_ack_test_001',
      chargeId: 'charge_ack_test_001',
      addonId: null,
      departmentId: 'dept_test_001',
      completed: false,
      isActive: true,
      toggledById: null,
      performedById: null,
    },
  ];

  const orderPartAssignments: MockOrderPartAssignment[] = [];
  const partInstructionReceipts: MockPartInstructionReceipt[] = [];

  const statusHistory: MockStatusHistory[] = [
    {
      id: 'status_test_001',
      orderId: 'order_test_001',
      from: 'NEW',
      to: 'RECEIVED',
      userId: 'test-user',
      reason: 'Order received',
      createdAt: baseDate,
    },
  ];

  const notes: MockNote[] = [
    {
      id: 'note_test_001',
      orderId: 'order_test_001',
      partId: 'part_test_001',
      userId: 'test-user',
      content: 'Verify tolerances on the main housing.',
      createdAt: baseDate,
    },
  ];

  const orderAttachments: MockOrderAttachment[] = [
    {
      id: 'attachment_test_001',
      orderId: 'order_test_001',
      url: 'https://example.com/specs.pdf',
      storagePath: null,
      label: 'Specs PDF',
      mimeType: 'application/pdf',
      uploadedById: 'test-user',
      createdAt: baseDate,
    },
  ];

  const partAttachments: MockPartAttachment[] = [
    {
      id: 'part_attachment_test_001',
      orderId: 'order_test_001',
      partId: 'part_test_001',
      kind: 'PDF',
      url: 'https://example.com/part-drawing.pdf',
      storagePath: null,
      label: 'Drawing',
      mimeType: 'application/pdf',
      createdAt: baseDate,
    },
  ];

  const partEvents: MockPartEvent[] = [
    {
      id: 'event_test_001',
      orderId: 'order_test_001',
      partId: 'part_test_001',
      userId: 'test-user',
      type: 'NOTE_ADDED',
      message: 'Note added.',
      meta: { noteId: 'note_test_001' },
      createdAt: baseDate,
    },
  ];

  const timeEntries: MockTimeEntry[] = [
    {
      id: 'time_entry_test_001',
      userId: 'test-user',
      orderId: 'order_test_001',
      partId: 'part_test_001',
      departmentId: 'dept_test_001',
      operation: 'Machining',
      startedAt: baseDate,
      endedAt: laterDate,
      createdAt: baseDate,
      updatedAt: laterDate,
    },
    {
      id: 'time_entry_test_002',
      userId: 'user_test_helper',
      orderId: 'order_test_001',
      partId: 'part_test_001',
      departmentId: 'dept_test_001',
      operation: 'Part Work',
      startedAt: new Date('2026-02-02T09:00:00Z'),
      endedAt: new Date('2026-02-02T09:20:00Z'),
      createdAt: new Date('2026-02-02T09:00:00Z'),
      updatedAt: new Date('2026-02-02T09:20:00Z'),
    },
  ];

  return {
    users,
    customers,
    departments,
    addons,
    materials,
    orders,
    orderParts,
    orderCharges,
    orderChecklist,
    orderPartAssignments,
    partInstructionReceipts,
    statusHistory,
    notes,
    orderAttachments,
    partAttachments,
    partEvents,
    partTimeAdjustments: [],
    timeEntries,
  };
}
