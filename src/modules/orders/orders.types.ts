export type OrderListItem = {
  id: string;
  orderNumber: string;
  business: string;
  status: string;
  priority: string;
  dueDate: string | Date | null;
  receivedDate: string | Date | null;
  customer?: { name?: string | null } | null;
  assignedMachinist?: { id?: string; name?: string | null; email?: string | null } | null;
  parts?: Array<{ quantity: number | null; currentDepartmentId?: string | null }>;
  checklist?: Array<{ completed: boolean; departmentId?: string | null; addon?: { name?: string | null } | null }>;
  statusHistory?: Array<{ createdAt: string | Date }>;
};

export type OrderWithMeta = OrderListItem & {
  totalQuantity: number;
  addonCount: number;
  openAddonCount: number;
  hasAddons: boolean;
  lastStatusChange: Date | null;
};

export type OrderFilterState = {
  statuses: string[];
  priorities: string[];
  machinistId: string;
  createdFrom?: string;
  createdTo?: string;
  dueFrom?: string;
  dueTo?: string;
  minQty?: number;
  maxQty?: number;
  requiresAddons: boolean;
  staleStatus: boolean;
};

export type DepartmentFeedPart = {
  id: string;
  partNumber: string | null;
  quantity: number | null;
  flagged: boolean;
  reasonText: string | null;
  checklistDoneCount: number;
  checklistTotalCount: number;
};

export type DepartmentFeedOrder = {
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  dueDate: Date | string | null;
  status: string;
  assignedMachinistName: string | null;
  partsInDeptCount: number;
  openChecklistCount: number;
  flaggedCount: number;
  latestActivityAt: Date | string | null;
  parts: DepartmentFeedPart[];
};
