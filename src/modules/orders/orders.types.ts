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
  parts?: Array<{ quantity: number | null }>;
  checklist?: Array<{ completed: boolean; addon?: { name?: string | null } | null }>;
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
