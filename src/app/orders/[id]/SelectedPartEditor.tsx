'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/Textarea';

export const PART_MATERIAL_STATUS_OPTIONS = [
  ['UNREVIEWED', 'Not reviewed'],
  ['NEED_TO_ORDER', 'Needs ordering'],
  ['WAITING_ON_STOCK', 'Waiting on stock to arrive'],
  ['IN_STOCK', 'Material arrived / on hand'],
  ['NOT_REQUIRED', 'No stock required'],
] as const;

export type SelectedPartDraft = {
  partNumber: string;
  partName: string;
  quantity: number;
  materialId: string;
  materialStatus: string;
  procurementVendorId: string;
  inventoryLocation: string;
  materialNotes: string;
  stockSize: string;
  cutLength: string;
  finalPartLength: string;
  partWidth: string;
  partThickness: string;
  notes: string;
  workInstructions: string;
};

type NamedOption = { id: string; name: string };

type Props = {
  draft: SelectedPartDraft;
  setDraft: Dispatch<SetStateAction<SelectedPartDraft>>;
  materials: NamedOption[];
  vendors: NamedOption[];
  saving: boolean;
  canDelete: boolean;
  onAdd: () => void;
  onDelete: () => void;
  onSave: () => void;
};

export function SelectedPartEditor({
  draft,
  setDraft,
  materials,
  vendors,
  saving,
  canDelete,
  onAdd,
  onDelete,
  onSave,
}: Props) {
  return (
    <div className="order-detail-inset space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Edit selected part</p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onAdd}>Add part</Button>
          <Button size="sm" variant="destructive" onClick={onDelete} disabled={!canDelete}>Delete part</Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save part'}
          </Button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Part number</Label>
          <Input value={draft.partNumber} onChange={(event) => setDraft((previous) => ({ ...previous, partNumber: event.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label>Part name</Label>
          <Input value={draft.partName} onChange={(event) => setDraft((previous) => ({ ...previous, partName: event.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label>Quantity</Label>
          <Input
            type="number"
            min={1}
            value={draft.quantity}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraft((previous) => ({ ...previous, quantity: Number(event.target.value || 1) }))}
          />
        </div>
        <div className="grid gap-2">
          <Label>Material</Label>
          <Select value={draft.materialId || '__none__'} onValueChange={(value) => setDraft((previous) => ({ ...previous, materialId: value === '__none__' ? '' : value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No material</SelectItem>
              {materials.map((material) => <SelectItem key={material.id} value={material.id}>{material.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Material status</Label>
          <Select value={draft.materialStatus} onValueChange={(value) => setDraft((previous) => ({ ...previous, materialStatus: value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PART_MATERIAL_STATUS_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Procurement vendor</Label>
          <Select value={draft.procurementVendorId || '__none__'} onValueChange={(value) => setDraft((previous) => ({ ...previous, procurementVendorId: value === '__none__' ? '' : value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No vendor</SelectItem>
              {vendors.map((vendor) => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Inventory location</Label>
          <Input value={draft.inventoryLocation} onChange={(event) => setDraft((previous) => ({ ...previous, inventoryLocation: event.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label>Total stock dimensions</Label>
          <Input value={draft.stockSize} onChange={(event) => setDraft((previous) => ({ ...previous, stockSize: event.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label>Finished part thickness</Label>
          <Input value={draft.partThickness} onChange={(event) => setDraft((previous) => ({ ...previous, partThickness: event.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label>Finished part width</Label>
          <Input value={draft.partWidth} onChange={(event) => setDraft((previous) => ({ ...previous, partWidth: event.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label>Cut length</Label>
          <Input value={draft.cutLength} onChange={(event) => setDraft((previous) => ({ ...previous, cutLength: event.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label>Finished part length</Label>
          <Input value={draft.finalPartLength} onChange={(event) => setDraft((previous) => ({ ...previous, finalPartLength: event.target.value }))} />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label>Material / purchasing notes</Label>
          <Textarea rows={3} value={draft.materialNotes} onChange={(event) => setDraft((previous) => ({ ...previous, materialNotes: event.target.value }))} />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label>Part notes</Label>
          <Textarea rows={3} value={draft.notes} onChange={(event) => setDraft((previous) => ({ ...previous, notes: event.target.value }))} />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label>Work instructions</Label>
          <Textarea
            rows={4}
            value={draft.workInstructions}
            onChange={(event) => setDraft((previous) => ({ ...previous, workInstructions: event.target.value }))}
            placeholder="Must-read floor instructions for this part."
          />
        </div>
      </div>
    </div>
  );
}
