export type ProcurementGroupStatus = 'compatible' | 'needs_review';

export type ProcurementFilters = {
  overdue?: boolean;
  customerId?: string;
  customer?: string;
  material?: string;
  vendorId?: string;
  vendor?: string;
  asOf?: Date;
};

export type ProcurementPartRow = {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName?: string | null;
  dueDate: Date | string;
  partNumber: string;
  partName?: string | null;
  quantity: number;
  materialStatus: string;
  orderStatus?: string | null;
  partStatus?: string | null;
  materialId?: string | null;
  materialName?: string | null;
  drawingMaterialText?: string | null;
  materialNotes?: string | null;
  procurementVendorId?: string | null;
  procurementVendorName?: string | null;
  stockSize?: string | null;
  cutLength?: string | null;
  finalPartLength?: string | null;
  partWidth?: string | null;
  partThickness?: string | null;
};

export type ProcurementGroupMember = {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string | null;
  partNumber: string;
  partName: string | null;
  quantity: number;
  stockSize: string | null;
  cutLength: string | null;
  finalPartLength: string | null;
  dueDate: string;
  href: string;
  materialRaw: string | null;
  vendorId: string | null;
  vendorName: string | null;
  normalized: {
    version: 1;
    grade: string | null;
    specification: string | null;
    condition: string | null;
    profile: 'solid_round' | 'round_tube' | 'rectangular_tube' | 'flat_bar' | null;
    dimensions: Record<string, string>;
    unit: 'in';
    evidence: string[];
  };
  totalFinishedLength: number | null;
  totalCutLength: number | null;
  lengthNote: string;
  reasons: string[];
};

export type ProcurementGroup = {
  id: string;
  material: string;
  stock: string;
  status: ProcurementGroupStatus;
  reasons: string[];
  orderCount: number;
  partCount: number;
  quantity: number;
  totalFinishedLength: number | null;
  totalCutLength: number | null;
  lengthNote: string;
  members: ProcurementGroupMember[];
};

export type ProcurementUngroupedPart = {
  id: string;
  orderId: string;
  orderNumber: string;
  partNumber: string;
  reason: string;
};

export type ProcurementGroupingResult = {
  groups: ProcurementGroup[];
  eligibleParts: number;
  eligibleOrders: number;
  unreviewedParts: number;
  ungrouped: ProcurementUngroupedPart[];
  timings: { queryMs: number; groupingMs: number };
};

/** Stable UI/tool name for the complete deterministic procurement payload. */
export type ProcurementReport = ProcurementGroupingResult;
