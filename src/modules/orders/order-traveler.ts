export type OrderTravelerFile = {
  id: string;
  label: string;
  kind: string | null;
  href: string | null;
};

export type OrderTravelerStep = {
  id: string;
  department: string;
  label: string;
  completed: boolean;
};

export type OrderTravelerPart = {
  id: string;
  partNumber: string;
  partName: string | null;
  quantity: number;
  status: string;
  currentDepartment: string;
  assignedWorkers: string[];
  material: string;
  specifications: Array<{ label: string; value: string }>;
  requiredReading: string | null;
  notes: string | null;
  files: OrderTravelerFile[];
  steps: OrderTravelerStep[];
};

export type OrderTraveler = {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  poNumber: string | null;
  receivedDate: string | Date | null;
  dueDate: string | Date | null;
  customer: {
    name: string;
    contact: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
  coordinator: string;
  orderNotes: Array<{ id: string; content: string; author: string; createdAt: string | Date | null }>;
  orderFiles: OrderTravelerFile[];
  parts: OrderTravelerPart[];
};

type UnknownRecord = Record<string, any>;

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned || null;
}

function displayName(user: UnknownRecord | null | undefined) {
  return cleanText(user?.name) ?? cleanText(user?.email) ?? null;
}

function customerAddress(customer: UnknownRecord | null | undefined) {
  const locality = [
    cleanText(customer?.city),
    [cleanText(customer?.stateProvince), cleanText(customer?.postalCode)].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ');
  const structured = [
    cleanText(customer?.addressLine1),
    cleanText(customer?.addressLine2),
    locality || null,
    cleanText(customer?.country),
  ].filter((value): value is string => Boolean(value));
  return structured.length ? structured.join('\n') : cleanText(customer?.address);
}

function fileLabel(file: UnknownRecord, fallback: string) {
  const explicit = cleanText(file?.label);
  if (explicit) return explicit;

  const candidate = cleanText(file?.storagePath) ?? cleanText(file?.url);
  if (!candidate) return fallback;
  const segments = candidate.split(/[\\/]/).filter(Boolean);
  return segments.at(-1) ?? fallback;
}

function safeFileHref(value: unknown) {
  const href = cleanText(value);
  if (!href) return null;
  if (href.startsWith('/') || href.startsWith('https://') || href.startsWith('http://')) return href;
  return null;
}

function normalizeFile(file: UnknownRecord, fallback: string): OrderTravelerFile {
  return {
    id: String(file?.id ?? `${fallback}-${file?.createdAt ?? ''}`),
    label: fileLabel(file, fallback),
    kind: cleanText(file?.kind) ?? cleanText(file?.mimeType),
    href: safeFileHref(file?.url),
  };
}

function checklistLabel(item: UnknownRecord) {
  return (
    cleanText(item?.charge?.name) ??
    cleanText(item?.addon?.name) ??
    cleanText(item?.charge?.description) ??
    'Production step'
  );
}

function buildPartSteps(part: UnknownRecord, checklist: UnknownRecord[]): OrderTravelerStep[] {
  return checklist
    .filter((item) => item?.partId === part?.id && item?.isActive !== false)
    .sort((left, right) => {
      const leftSort = Number(left?.department?.sortOrder ?? 0);
      const rightSort = Number(right?.department?.sortOrder ?? 0);
      if (leftSort !== rightSort) return leftSort - rightSort;
      return checklistLabel(left).localeCompare(checklistLabel(right));
    })
    .map((item) => ({
      id: String(item?.id),
      department: cleanText(item?.department?.name) ?? 'Unassigned',
      label: checklistLabel(item),
      completed: item?.completed === true,
    }));
}

function materialLabel(part: UnknownRecord) {
  const name = cleanText(part?.material?.name);
  const spec = cleanText(part?.material?.spec);
  if (name && spec) return `${name} — ${spec}`;
  return name ?? cleanText(part?.drawingMaterialText) ?? 'Not specified';
}

function buildSpecifications(part: UnknownRecord) {
  const entries: Array<{ label: string; value: string | null }> = [
    { label: 'Total stock dimensions', value: cleanText(part?.stockSize) },
    { label: 'Finished thickness', value: cleanText(part?.partThickness) },
    { label: 'Finished width', value: cleanText(part?.partWidth) },
    { label: 'Cut length', value: cleanText(part?.cutLength) },
    { label: 'Finish', value: cleanText(part?.finish) ?? cleanText(part?.drawingFinishText) },
    { label: 'Inventory location', value: cleanText(part?.inventoryLocation) },
    { label: 'Material notes', value: cleanText(part?.materialNotes) },
  ];
  return entries.filter((entry): entry is { label: string; value: string } => Boolean(entry.value));
}

function resolveCurrentDepartment(part: UnknownRecord, checklist: UnknownRecord[]) {
  const direct = cleanText(part?.currentDepartment?.name);
  if (direct) return direct;

  const matching = checklist.find(
    (item) => item?.partId === part?.id && item?.departmentId === part?.currentDepartmentId,
  );
  return cleanText(matching?.department?.name) ?? 'Unassigned';
}

export function buildOrderTraveler(order: UnknownRecord): OrderTraveler {
  const checklist = Array.isArray(order?.checklist) ? order.checklist : [];
  const parts = Array.isArray(order?.parts) ? order.parts : [];
  const orderFiles = Array.isArray(order?.attachments) ? order.attachments : [];
  const notes = Array.isArray(order?.notes) ? order.notes : [];

  return {
    id: String(order?.id ?? ''),
    orderNumber: cleanText(order?.orderNumber) ?? 'Unnumbered',
    status: cleanText(order?.status) ?? 'Unknown',
    priority: cleanText(order?.priority) ?? 'Normal',
    poNumber: cleanText(order?.poNumber),
    receivedDate: order?.receivedDate ?? null,
    dueDate: order?.dueDate ?? null,
    customer: {
      name: cleanText(order?.customer?.name) ?? 'Unknown customer',
      contact: cleanText(order?.contactName) ?? cleanText(order?.customerContact?.name) ?? cleanText(order?.customer?.contact),
      phone: cleanText(order?.contactPhone) ?? cleanText(order?.customerContact?.phone) ?? cleanText(order?.customer?.phone),
      email: cleanText(order?.contactEmail) ?? cleanText(order?.customerContact?.email) ?? cleanText(order?.customer?.email),
      address: customerAddress(order?.customer),
    },
    coordinator: displayName(order?.assignedMachinist) ?? 'Unassigned',
    orderNotes: notes.map((note) => ({
      id: String(note?.id ?? note?.createdAt ?? note?.content),
      content: cleanText(note?.content) ?? '',
      author: displayName(note?.user) ?? 'ShopApp user',
      createdAt: note?.createdAt ?? null,
    })),
    orderFiles: orderFiles.map((file, index) => normalizeFile(file, `Order file ${index + 1}`)),
    parts: parts.map((part, partIndex) => ({
      id: String(part?.id ?? `part-${partIndex + 1}`),
      partNumber: cleanText(part?.partNumber) ?? `Part ${partIndex + 1}`,
      partName: cleanText(part?.partName),
      quantity: Number.isFinite(Number(part?.quantity)) ? Number(part.quantity) : 0,
      status: cleanText(part?.status) ?? 'Unknown',
      currentDepartment: resolveCurrentDepartment(part, checklist),
      assignedWorkers: (Array.isArray(part?.assignments) ? part.assignments : [])
        .filter((assignment: UnknownRecord) => assignment?.isActive !== false)
        .map((assignment: UnknownRecord) => displayName(assignment?.user))
        .filter((name: string | null): name is string => Boolean(name)),
      material: materialLabel(part),
      specifications: buildSpecifications(part),
      requiredReading: cleanText(part?.workInstructions),
      notes: cleanText(part?.notes),
      files: (Array.isArray(part?.attachments) ? part.attachments : []).map(
        (file: UnknownRecord, index: number) => normalizeFile(file, `Part file ${index + 1}`),
      ),
      steps: buildPartSteps(part, checklist),
    })),
  };
}
