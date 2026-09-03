"use client";

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PART_MATERIAL_STATUS_OPTIONS } from './SelectedPartEditor';

type InstructionSection = {
  heading: string | null;
  items: string[];
};

type Worker = { id: string; name: string };

type PartOverviewDetailsProps = {
  customerName?: string | null;
  dueDateLabel: string;
  orderPriority?: string | null;
  selectedCurrentDepartment?: { name?: string | null } | null;
  selectedPart?: any | null;
  canEditMaterialStatus?: boolean;
  materialStatusSaving?: boolean;
  onMaterialStatusChange?: (value: string) => void;
};

export function PartOverviewDetails({
  customerName,
  dueDateLabel,
  orderPriority,
  selectedCurrentDepartment,
  selectedPart,
  canEditMaterialStatus = false,
  materialStatusSaving = false,
  onMaterialStatusChange,
}: PartOverviewDetailsProps) {
  const materialStatus =
    selectedPart?.materialStatus === 'AVAILABLE'
      ? 'Available'
      : selectedPart?.materialStatus === 'WAITING_ON_STOCK'
        ? 'Waiting on stock'
        : 'Not reviewed';

  const fields = [
    ['Part', selectedPart?.partNumber || 'Select a part'],
    ['Description', selectedPart?.notes || '—'],
    ['Customer', customerName ?? '—'],
    ['Quantity', selectedPart?.quantity ?? '—'],
    ['Current department', selectedCurrentDepartment?.name ?? selectedPart?.currentDepartmentId ?? 'Unassigned'],
    ['Total stock dimensions', selectedPart?.stockSize || '—'],
    ['Finished thickness', selectedPart?.partThickness || '—'],
    ['Finished width', selectedPart?.partWidth || '—'],
    ['Cut length', selectedPart?.cutLength || '—'],
    ['Material', selectedPart?.material?.name || '—'],
    ['Procurement vendor', selectedPart?.procurementVendor?.name || '—'],
    ['Priority', orderPriority ?? '—'],
    ['Due date', dueDateLabel],
  ] as const;

  return (
    <div className="order-detail-tile grid gap-3 rounded-lg border p-4 md:grid-cols-2">
      {fields.map(([label, value]) => (
        <div key={label}>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className={label === 'Part' ? 'text-base font-medium text-foreground' : 'text-foreground'}>{value}</div>
        </div>
      ))}
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Material status</div>
        {selectedPart && canEditMaterialStatus && onMaterialStatusChange ? (
          <div className="mt-1 flex items-center gap-2">
            <Select value={selectedPart.materialStatus ?? 'UNREVIEWED'} onValueChange={onMaterialStatusChange} disabled={materialStatusSaving}>
              <SelectTrigger className="h-9 max-w-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{PART_MATERIAL_STATUS_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
            {materialStatusSaving ? <span className="text-xs text-muted-foreground">Saving...</span> : null}
          </div>
        ) : <div className="text-foreground">{materialStatus}</div>}
      </div>
    </div>
  );
}

type PartInstructionsPanelProps = {
  acknowledgedReceipts: any[];
  acknowledgedWorkers: Worker[];
  currentDepartmentName?: string | null;
  currentUserName: string;
  instructionReceipt?: any | null;
  instructionSections: InstructionSection[];
  instructions: string;
  instructionsVersion: number;
  requiresInstructionGate: boolean;
  unacknowledgedWorkers: Worker[];
  canAcknowledge: boolean;
  onOpen: () => void;
};

export function PartInstructionsPanel({
  acknowledgedReceipts,
  acknowledgedWorkers,
  currentDepartmentName,
  currentUserName,
  instructionReceipt,
  instructionSections,
  instructions,
  instructionsVersion,
  requiresInstructionGate,
  unacknowledgedWorkers,
  canAcknowledge,
  onOpen,
}: PartInstructionsPanelProps) {
  return (
    <div className="order-detail-tile space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Read me first</div>
          <div className="text-sm font-semibold text-foreground">Part instructions</div>
        </div>
        <Badge className={instructionReceipt ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-100'}>
          {instructionReceipt ? 'Read and logged' : requiresInstructionGate ? 'Needs acknowledgement' : 'Optional reference'}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-foreground">
          Dept: {currentDepartmentName ?? 'Unassigned'}
        </span>
        <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-foreground">
          Version: {instructionsVersion}
        </span>
      </div>
      {instructions ? (
        <div className="order-detail-inset rounded-md border p-3 text-sm text-foreground">
          <div className="space-y-4">
            {instructionSections.map((section, index) => (
              <div key={`${section.heading ?? 'notes'}-${index}`} className="space-y-2">
                {section.heading ? (
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {section.heading}
                  </div>
                ) : null}
                <ul className="list-disc space-y-1 pl-5">
                  {section.items.map((item, itemIndex) => (
                    <li key={`${index}-${itemIndex}`} className="leading-6 text-foreground">{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border/70 bg-background/60 p-3 text-sm text-muted-foreground">
          No part-specific instructions were entered for this job.
        </div>
      )}
      {instructions ? (
        <div className="order-detail-inset grid gap-3 rounded-md border p-3 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <span>Acknowledged</span>
              <Badge className="bg-emerald-500/15 text-emerald-200">{acknowledgedWorkers.length}</Badge>
            </div>
            {acknowledgedWorkers.length ? acknowledgedWorkers.map((worker) => {
              const receipt = acknowledgedReceipts.find((item: any) => item.userId === worker.id);
              return (
                <div key={worker.id} className="rounded-md border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-sm">
                  <div className="font-medium text-foreground">{worker.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {receipt?.acknowledgedAt ? new Date(receipt.acknowledgedAt).toLocaleString() : 'Receipt saved'}
                  </div>
                </div>
              );
            }) : <div className="text-sm text-muted-foreground">Nobody yet.</div>}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <span>Not acknowledged</span>
              <Badge className="bg-amber-500/15 text-amber-100">{unacknowledgedWorkers.length}</Badge>
            </div>
            {unacknowledgedWorkers.length ? unacknowledgedWorkers.map((worker) => (
              <div key={worker.id} className="rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm font-medium text-foreground">
                {worker.name}
              </div>
            )) : <div className="text-sm text-muted-foreground">All active users have acknowledged.</div>}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant={instructionReceipt ? 'outline' : 'secondary'} onClick={onOpen} disabled={!canAcknowledge}>
          {instructionReceipt ? 'Review brief' : 'Read and acknowledge'}
        </Button>
        {instructionReceipt ? (
          <span className="text-xs text-muted-foreground">Logged for {currentUserName} in {currentDepartmentName ?? 'this department'}.</span>
        ) : null}
      </div>
    </div>
  );
}
